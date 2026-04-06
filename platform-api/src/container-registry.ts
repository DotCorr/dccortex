import { spawn } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

export type ContainerStatus = 'queued' | 'provisioning' | 'ready' | 'deleting' | 'deleted' | 'failed'

export type ContainerHistoryEvent = {
  at: string
  action: 'requested' | 'provisioning' | 'provisioned' | 'deletion_requested' | 'deleted' | 'failed'
  message: string
}

export type ContainerRecord = {
  orgId: string
  status: ContainerStatus
  backend?: 'docker' | 'kubernetes' | 'filesystem'
  resourceName?: string
  namespace?: string
  containerId?: string
  podName?: string
  deploymentName?: string
  requestedAt: string
  updatedAt: string
  provisionedAt?: string
  deletedAt?: string
  workspacePath?: string
  lastError?: string
  history: ContainerHistoryEvent[]
}

type RegistryState = {
  version: 1
  containers: Record<string, ContainerRecord>
}

const DATA_DIR = process.env.DCCORTEX_PLATFORM_DATA_DIR || path.join(os.tmpdir(), 'dccortex-platform')
const REGISTRY_FILE = path.join(DATA_DIR, 'containers.json')
const CONTAINER_ROOT = path.join(DATA_DIR, 'org-containers')

const pending = new Set<string>()
let workerStarted = false
let workerRunning = false

function ensureDataDirs(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.mkdirSync(CONTAINER_ROOT, { recursive: true })
}

function readRegistrySync(): RegistryState {
  ensureDataDirs()
  try {
    const raw = fs.readFileSync(REGISTRY_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') throw new Error('invalid registry')
    const containers = (parsed as Partial<RegistryState>).containers
    return {
      version: 1,
      containers: containers && typeof containers === 'object' ? (containers as Record<string, ContainerRecord>) : {},
    }
  } catch {
    return { version: 1, containers: {} }
  }
}

function writeRegistrySync(registry: RegistryState): void {
  ensureDataDirs()
  const tmp = `${REGISTRY_FILE}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(registry, null, 2))
  fs.renameSync(tmp, REGISTRY_FILE)
}

function nowIso(): string {
  return new Date().toISOString()
}

function sanitizeResourceName(orgId: string): string {
  const base = orgId.toLowerCase().replace(/[^a-z0-9-]/g, '-')
  return base.replace(/^-+|-+$/g, '').slice(0, 42) || 'org'
}

function commandExists(cmd: string): boolean {
  try {
    const { execSync } = require('child_process')
    execSync(`which ${cmd}`, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function resolveBackendPreference(): 'docker' | 'kubernetes' | 'filesystem' {
  const forced = String(process.env.CONTAINER_BACKEND ?? '').trim().toLowerCase()
  if (forced === 'docker' || forced === 'kubernetes' || forced === 'filesystem') return forced
  if (commandExists('docker')) return 'docker'
  if (commandExists('kubectl')) return 'kubernetes'
  return 'filesystem'
}

function runCommand(command: string, args: string[], input?: string): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env: process.env })
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (chunk) => { stdout += chunk.toString() })
    child.stderr?.on('data', (chunk) => { stderr += chunk.toString() })
    child.on('error', reject)
    child.on('close', (code) => resolve({ stdout, stderr, code: code ?? 1 }))
    if (input) {
      child.stdin?.write(input)
      child.stdin?.end()
    }
  })
}

function getWorkspacePath(orgId: string): string {
  return path.join(CONTAINER_ROOT, orgId)
}

function buildRegistryRecord(orgId: string, backend: ContainerRecord['backend'], status: ContainerStatus): ContainerRecord {
  const now = nowIso()
  return {
    orgId,
    status,
    backend,
    requestedAt: now,
    updatedAt: now,
    history: [],
  }
}

async function provisionDocker(record: ContainerRecord): Promise<ContainerRecord> {
  const containerName = `dccortex-org-${sanitizeResourceName(record.orgId)}`
  const workspacePath = getWorkspacePath(record.orgId)
  fs.mkdirSync(workspacePath, { recursive: true })
  const provisionedEvent: ContainerHistoryEvent = {
    at: nowIso(),
    action: 'provisioned',
    message: `Docker container ${containerName} is ready`,
  }

  await runCommand('docker', ['rm', '-f', containerName]).catch(() => undefined)

  const image = process.env.DCCORTEX_CONTAINER_IMAGE || 'alpine:3.20'
  const args = [
    'run', '-d',
    '--name', containerName,
    '--restart', 'unless-stopped',
    '--label', 'app=dccortex',
    '--label', `orgId=${record.orgId}`,
    '--label', 'managedBy=dccortex-platform-api',
    '-v', `${workspacePath}:/workspace`,
    image,
    'sh', '-lc', 'trap : TERM INT; while :; do sleep 3600; done',
  ]
  const result = await runCommand('docker', args)
  if (result.code !== 0 || !result.stdout.trim()) {
    throw new Error(result.stderr.trim() || 'Docker container provisioning failed')
  }

  return {
    ...record,
    status: 'ready',
    workspacePath,
    resourceName: containerName,
    containerId: result.stdout.trim(),
    provisionedAt: nowIso(),
    updatedAt: nowIso(),
    lastError: undefined,
    history: [...record.history, provisionedEvent].slice(-25),
  }
}

async function deleteDocker(record: ContainerRecord): Promise<ContainerRecord> {
  const containerName = record.resourceName ?? `dccortex-org-${sanitizeResourceName(record.orgId)}`
  const workspacePath = record.workspacePath ?? getWorkspacePath(record.orgId)
  await runCommand('docker', ['rm', '-f', containerName]).catch(() => undefined)
  try { fs.rmSync(workspacePath, { recursive: true, force: true }) } catch {}
  const deletedEvent: ContainerHistoryEvent = {
    at: nowIso(),
    action: 'deleted',
    message: `Docker container ${containerName} removed`,
  }
  return {
    ...record,
    status: 'deleted',
    deletedAt: nowIso(),
    updatedAt: nowIso(),
    history: [...record.history, deletedEvent].slice(-25),
  }
}

async function provisionKubernetes(record: ContainerRecord): Promise<ContainerRecord> {
  const namespace = `dccortex-org-${sanitizeResourceName(record.orgId)}`
  const deploymentName = `dccortex-org-${sanitizeResourceName(record.orgId)}`
  const image = process.env.DCCORTEX_CONTAINER_IMAGE || 'alpine:3.20'
  const provisionedEvent: ContainerHistoryEvent = {
    at: nowIso(),
    action: 'provisioned',
    message: `Kubernetes namespace ${namespace} is ready`,
  }
  const manifest = `apiVersion: v1
kind: Namespace
metadata:
  name: ${namespace}
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${deploymentName}
  namespace: ${namespace}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ${deploymentName}
  template:
    metadata:
      labels:
        app: ${deploymentName}
    spec:
      containers:
        - name: workspace
          image: ${image}
          command: ["sh", "-lc", "trap : TERM INT; while :; do sleep 3600; done"]
          volumeMounts:
            - name: workspace
              mountPath: /workspace
      volumes:
        - name: workspace
          emptyDir: {}
`
  const result = await runCommand('kubectl', ['apply', '-f', '-'], manifest)
  if (result.code !== 0) {
    throw new Error(result.stderr.trim() || 'Kubernetes provisioning failed')
  }

  return {
    ...record,
    status: 'ready',
    backend: 'kubernetes',
    namespace,
    deploymentName,
    provisionedAt: nowIso(),
    updatedAt: nowIso(),
    lastError: undefined,
    history: [...record.history, provisionedEvent].slice(-25),
  }
}

async function deleteKubernetes(record: ContainerRecord): Promise<ContainerRecord> {
  const namespace = record.namespace ?? `dccortex-org-${sanitizeResourceName(record.orgId)}`
  await runCommand('kubectl', ['delete', 'namespace', namespace, '--ignore-not-found=true']).catch(() => undefined)
  const deletedEvent: ContainerHistoryEvent = {
    at: nowIso(),
    action: 'deleted',
    message: `Kubernetes namespace ${namespace} removed`,
  }
  return {
    ...record,
    status: 'deleted',
    deletedAt: nowIso(),
    updatedAt: nowIso(),
    history: [...record.history, deletedEvent].slice(-25),
  }
}

function appendHistory(record: ContainerRecord, action: ContainerHistoryEvent['action'], message: string): ContainerRecord {
  const next: ContainerRecord = {
    ...record,
    updatedAt: nowIso(),
    history: [
      ...(record.history ?? []),
      { at: nowIso(), action, message },
    ].slice(-25),
  }
  return next
}

function enqueue(orgId: string): void {
  pending.add(orgId)
  void scheduleWorker()
}

async function scheduleWorker(): Promise<void> {
  if (workerRunning) return
  workerRunning = true
  try {
    while (pending.size > 0) {
      const orgId = pending.values().next().value as string | undefined
      if (!orgId) break
      pending.delete(orgId)
      await processOrg(orgId)
    }
  } finally {
    workerRunning = false
  }
}

async function processOrg(orgId: string): Promise<void> {
  const registry = readRegistrySync()
  const record = registry.containers[orgId]
  if (!record) return

  if (record.status === 'deleted') return

  if (record.status === 'deleting') {
    try {
      const next = record.backend === 'kubernetes' ? await deleteKubernetes(record) : await deleteDocker(record)
      registry.containers[orgId] = next
    } catch (err: any) {
      registry.containers[orgId] = {
        ...appendHistory({ ...record, status: 'failed' }, 'failed', err?.message || 'Deletion failed'),
        status: 'failed',
        lastError: err?.message || 'Deletion failed',
      }
    }
    writeRegistrySync(registry)
    return
  }

  const backend = record.backend ?? resolveBackendPreference()
  const provisioning = appendHistory({ ...record, backend, status: 'provisioning' }, 'provisioning', `Provisioning worker started using ${backend}`)
  registry.containers[orgId] = provisioning
  writeRegistrySync(registry)

  try {
    const next = backend === 'kubernetes'
      ? await provisionKubernetes(provisioning)
      : backend === 'docker'
        ? await provisionDocker(provisioning)
        : (() => {
            const workspacePath = getWorkspacePath(orgId)
            fs.mkdirSync(workspacePath, { recursive: true })
            fs.writeFileSync(path.join(workspacePath, 'container.json'), JSON.stringify({ orgId, workspacePath, provisionedAt: nowIso(), status: 'ready' }, null, 2))
            return {
              ...appendHistory({ ...provisioning, status: 'ready', workspacePath }, 'provisioned', 'Filesystem workspace ready'),
              status: 'ready' as const,
              backend: 'filesystem' as const,
              workspacePath,
              provisionedAt: nowIso(),
              updatedAt: nowIso(),
              lastError: undefined,
            }
          })()
    registry.containers[orgId] = next
    writeRegistrySync(registry)
  } catch (err: any) {
    registry.containers[orgId] = {
      ...appendHistory({ ...provisioning, status: 'failed' }, 'failed', err?.message || 'Provisioning failed'),
      status: 'failed',
      backend,
      lastError: err?.message || 'Provisioning failed',
    }
    writeRegistrySync(registry)
  }
}

export function ensureContainerWorkerStarted(): void {
  if (workerStarted) return
  workerStarted = true
  ensureDataDirs()
  setInterval(() => {
    void scheduleWorker()
  }, 1000).unref()
}

export async function requestContainerProvision(orgId: string): Promise<ContainerRecord> {
  ensureContainerWorkerStarted()
  const registry = readRegistrySync()
  const now = nowIso()
  const existing = registry.containers[orgId]
  const requestedEvent: ContainerHistoryEvent = {
    at: now,
    action: 'requested',
    message: existing ? 'Provisioning requested again' : 'Provisioning requested',
  }

  if (existing && (existing.status === 'ready' || existing.status === 'provisioning' || existing.status === 'queued')) {
    return existing
  }

  const next: ContainerRecord = existing
    ? {
        ...existing,
        status: 'queued',
        backend: existing.backend ?? resolveBackendPreference(),
        requestedAt: now,
        updatedAt: now,
        lastError: undefined,
        history: [...existing.history, requestedEvent].slice(-25),
      }
    : {
        orgId,
        status: 'queued',
        backend: resolveBackendPreference(),
        requestedAt: now,
        updatedAt: now,
        history: [requestedEvent],
      }

  registry.containers[orgId] = next
  writeRegistrySync(registry)
  enqueue(orgId)
  return next
}

export async function requestContainerDeletion(orgId: string): Promise<ContainerRecord | null> {
  ensureContainerWorkerStarted()
  const registry = readRegistrySync()
  const existing = registry.containers[orgId]
  if (!existing) return null

  const now = nowIso()
  const deletionRequestedEvent: ContainerHistoryEvent = {
    at: now,
    action: 'deletion_requested',
    message: 'Deletion requested',
  }
  registry.containers[orgId] = {
    ...existing,
    status: 'deleting',
    backend: existing.backend ?? resolveBackendPreference(),
    updatedAt: now,
    history: [...existing.history, deletionRequestedEvent].slice(-25),
  }
  writeRegistrySync(registry)
  enqueue(orgId)
  return registry.containers[orgId]
}

export function getContainerRecord(orgId: string): ContainerRecord | null {
  ensureContainerWorkerStarted()
  const registry = readRegistrySync()
  return registry.containers[orgId] ?? null
}

export function listContainerRecords(): ContainerRecord[] {
  ensureContainerWorkerStarted()
  const registry = readRegistrySync()
  return Object.values(registry.containers)
}