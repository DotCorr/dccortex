/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

/**
 * DCCortex Platform API
 *
 * Responsibilities:
 *  - Manage org Docker containers (create / delete)
 *  - Accept build jobs: run `cargo tauri build` in an ephemeral build container
 *    with the org's app URL baked in, then serve the resulting installer artifact.
 *
 * Build flow:
 *  1. POST /api/v1/apps/organizations/:orgId/build
 *     → creates a Job record (in-memory), spins up a builder container, returns jobId
 *  2. GET  /api/v1/apps/organizations/:orgId/build/:jobId
 *     → returns { status, log, downloadUrl? }
 *  3. GET  /api/v1/apps/organizations/:orgId/build/:jobId/download
 *     → streams the built artifact file
 */

import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import { spawn } from 'child_process'
import { v4 as uuidv4 } from 'uuid'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

const app = express()
app.use(cors())
app.use(express.json())

const PORT = process.env.PORT || 3001
const ARTIFACTS_DIR = process.env.ARTIFACTS_DIR || path.join(os.tmpdir(), 'dccortex-builds')

// ── In-memory job store (use Redis/DB in production) ─────────────────────────
interface BuildJob {
  jobId: string
  orgId: string
  projectId: string
  target: string
  appUrl: string
  appName: string
  status: 'queued' | 'building' | 'done' | 'failed'
  log: string
  downloadUrl: string | null
  artifactPath: string | null
  createdAt: Date
  updatedAt: Date
}

const jobs = new Map<string, BuildJob>()

// Ensure artifacts dir exists
fs.mkdirSync(ARTIFACTS_DIR, { recursive: true })

// ── Helpers ───────────────────────────────────────────────────────────────────

function getJobArtifactDir(jobId: string): string {
  return path.join(ARTIFACTS_DIR, jobId)
}

/**
 * Run a Tauri build in an ephemeral Docker container.
 *
 * We use the `ghcr.io/tauri-apps/tauri-action` runner image which has
 * Rust + Tauri CLI + all platform toolchains pre-installed.
 *
 * The strategy:
 *  1. Write a minimal tauri.conf.json pointing `frontendDist` to a tiny HTML
 *     that just full-page-iframes the user's web app URL.
 *  2. Mount a host output directory.
 *  3. Run `cargo tauri build` inside the container.
 *  4. Copy artifacts to ARTIFACTS_DIR/<jobId>/.
 */
async function runBuild(job: BuildJob): Promise<void> {
  const artifactDir = getJobArtifactDir(job.jobId)
  fs.mkdirSync(artifactDir, { recursive: true })

  const projectDir = path.join(os.tmpdir(), `dccortex-project-${job.jobId}`)
  fs.mkdirSync(path.join(projectDir, 'src-tauri'), { recursive: true })
  fs.mkdirSync(path.join(projectDir, 'web'), { recursive: true })

  // Minimal web shim — full-screen iframe pointing at the real app
  const htmlShim = `<!DOCTYPE html>
<html style="margin:0;padding:0;height:100%;width:100%">
<head>
  <meta charset="utf-8">
  <title>${job.appName}</title>
  <style>*{margin:0;padding:0;box-sizing:border-box}html,body,iframe{width:100%;height:100%;border:none;overflow:hidden}</style>
</head>
<body>
  <iframe src="${job.appUrl}" allow="fullscreen"></iframe>
</body>
</html>`
  fs.writeFileSync(path.join(projectDir, 'web', 'index.html'), htmlShim)

  // Tauri v2 config
  const safeAppId = `com.dccortex.${job.appName.toLowerCase().replace(/[^a-z0-9]/g, '')}`
  const tauriConf = {
    productName: job.appName,
    version: '0.1.0',
    identifier: safeAppId,
    build: {
      frontendDist: '../web',
    },
    app: {
      windows: [
        {
          title: job.appName,
          width: 1280,
          height: 800,
          resizable: true,
          fullscreen: false,
        },
      ],
      security: {
        csp: null,
      },
    },
    bundle: {
      active: true,
      targets: targetToTauriBundleTargets(job.target),
      icon: ['icons/32x32.png', 'icons/128x128.png', 'icons/128x128@2x.png', 'icons/icon.icns', 'icons/icon.ico'],
    },
  }
  fs.writeFileSync(path.join(projectDir, 'src-tauri', 'tauri.conf.json'), JSON.stringify(tauriConf, null, 2))

  // Minimal Cargo.toml
  const cargoToml = `[package]
name = "${job.appName.toLowerCase().replace(/[^a-z0-9-]/g, '-')}"
version = "0.1.0"
edition = "2021"

[lib]
name = "app_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-shell = "2"

[profile.dev]
incremental = true

[profile.release]
panic = "abort"
codegen-units = 1
lto = true
opt-level = "s"
strip = true
`
  fs.writeFileSync(path.join(projectDir, 'src-tauri', 'Cargo.toml'), cargoToml)

  // Minimal Rust entrypoint
  const mainRs = `// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
fn main() {
    app_lib::run();
}
`
  const libRs = `#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
`
  fs.mkdirSync(path.join(projectDir, 'src-tauri', 'src'), { recursive: true })
  fs.writeFileSync(path.join(projectDir, 'src-tauri', 'src', 'main.rs'), mainRs)
  fs.writeFileSync(path.join(projectDir, 'src-tauri', 'src', 'lib.rs'), libRs)

  // build.rs (required by tauri-build)
  const buildRs = `fn main() { tauri_build::build() }\n`
  fs.writeFileSync(path.join(projectDir, 'src-tauri', 'build.rs'), buildRs)

  // Default icons (placeholder 1x1 pixels — user should replace)
  const iconsDir = path.join(projectDir, 'src-tauri', 'icons')
  fs.mkdirSync(iconsDir, { recursive: true })
  // Copy from dashboard's tauri icons if they exist, else touch placeholder files
  const dashboardIconsDir = path.join(__dirname, '..', '..', 'dashboard', 'src-tauri', 'icons')
  for (const icon of ['32x32.png', '128x128.png', '128x128@2x.png', 'icon.icns', 'icon.ico']) {
    const src = path.join(dashboardIconsDir, icon)
    const dst = path.join(iconsDir, icon)
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dst)
    } else {
      // Tiny 1×1 transparent PNG (8 bytes header + IHDR + IDAT + IEND)
      fs.writeFileSync(dst, Buffer.from('89504e470d0a1a0a0000000d494844520000000100000001080200000090774d0e000000124944415478016360f8cfc0c0c0000000020001e221bc330000000049454e44ae426082', 'hex'))
    }
  }

  job.log += `\n[platform-api] Project scaffolded at ${projectDir}\n`
  job.log += `[platform-api] Starting Docker build for target: ${job.target}\n`
  job.updatedAt = new Date()

  // Determine bundle targets for Docker build command
  const bundleFlag = job.target === 'all' ? '' : `--bundles ${tauriConf.bundle.targets.join(',')}`

  // Use a Docker builder container — image with Rust + Tauri CLI pre-installed
  // On Linux, this runs natively; cross-compilation is handled by Tauri's toolchains.
  const dockerImage = process.env.TAURI_BUILDER_IMAGE || 'ghcr.io/tauri-apps/tauri-action/ubuntu-latest:latest'

  // Try native build first (if Rust/Tauri is available on the host), fall back to Docker
  const useDocker = !commandExists('cargo')

  let buildProc: ReturnType<typeof spawn>

  if (useDocker) {
    job.log += `[platform-api] Running build in Docker container: ${dockerImage}\n`
    buildProc = spawn('docker', [
      'run', '--rm',
      '-v', `${projectDir}:/project`,
      '-v', `${artifactDir}:/output`,
      '-w', '/project',
      dockerImage,
      'sh', '-c',
      `cd src-tauri && cargo tauri build${bundleFlag ? ` ${bundleFlag}` : ''} && cp -r target/release/bundle/* /output/ 2>/dev/null || true`,
    ], { env: process.env })
  } else {
    job.log += `[platform-api] Running build natively (cargo + tauri-cli found on host)\n`
    buildProc = spawn(
      'sh',
      ['-c', `cd "${path.join(projectDir, 'src-tauri')}" && cargo tauri build${bundleFlag ? ` ${bundleFlag}` : ''}`],
      {
        env: {
          ...process.env,
          TAURI_SKIP_DEVSERVER_CHECK: 'true',
        },
        cwd: projectDir,
      }
    )
  }

  await new Promise<void>((resolve) => {
    buildProc.stdout?.on('data', (chunk) => {
      job.log += chunk.toString()
      job.updatedAt = new Date()
    })
    buildProc.stderr?.on('data', (chunk) => {
      job.log += chunk.toString()
      job.updatedAt = new Date()
    })
    buildProc.on('close', (code) => {
      if (code === 0) {
        // If native (not docker), copy artifacts to artifactDir
        if (!useDocker) {
          const bundleDir = path.join(projectDir, 'src-tauri', 'target', 'release', 'bundle')
          if (fs.existsSync(bundleDir)) {
            copyDirRecursive(bundleDir, artifactDir)
          }
        }
        // Find the main installer files
        const artifact = findArtifact(artifactDir, job.target)
        if (artifact) {
          job.artifactPath = artifact
          job.downloadUrl = `/api/v1/apps/organizations/${job.orgId}/build/${job.jobId}/download`
          job.status = 'done'
          job.log += `\n[platform-api] ✅ Build succeeded. Artifact: ${path.basename(artifact)}\n`
        } else {
          job.status = 'done'
          job.downloadUrl = null
          job.log += `\n[platform-api] ✅ Build finished but no artifact found in ${artifactDir}\n`
        }
      } else {
        job.status = 'failed'
        job.log += `\n[platform-api] ❌ Build failed with exit code ${code}\n`
      }
      job.updatedAt = new Date()
      // Clean up project dir to save space
      try { fs.rmSync(projectDir, { recursive: true, force: true }) } catch {}
      resolve()
    })
    buildProc.on('error', (err) => {
      job.status = 'failed'
      job.log += `\n[platform-api] ❌ Spawn error: ${err.message}\n`
      job.updatedAt = new Date()
      resolve()
    })
  })
}

function targetToTauriBundleTargets(target: string): string[] {
  switch (target) {
    case 'desktop-mac': return ['dmg', 'app']
    case 'desktop-windows': return ['msi', 'nsis']
    case 'desktop-linux': return ['deb', 'appimage', 'rpm']
    default: return ['dmg', 'app', 'msi', 'nsis', 'deb', 'appimage']
  }
}

function findArtifact(dir: string, target: string): string | null {
  const extensions: Record<string, string[]> = {
    'desktop-mac': ['.dmg'],
    'desktop-windows': ['.msi', '.exe'],
    'desktop-linux': ['.AppImage', '.deb'],
    all: ['.dmg', '.AppImage', '.msi', '.deb'],
  }
  const exts = extensions[target] ?? extensions.all
  return findFileByExtension(dir, exts)
}

function findFileByExtension(dir: string, exts: string[]): string | null {
  if (!fs.existsSync(dir)) return null
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      const found = findFileByExtension(full, exts)
      if (found) return found
    } else if (exts.some((e) => entry.name.toLowerCase().endsWith(e.toLowerCase()))) {
      return full
    }
  }
  return null
}

function copyDirRecursive(src: string, dst: string) {
  fs.mkdirSync(dst, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name)
    const dstPath = path.join(dst, entry.name)
    if (entry.isDirectory()) copyDirRecursive(srcPath, dstPath)
    else fs.copyFileSync(srcPath, dstPath)
  }
}

function commandExists(cmd: string): boolean {
  try {
    const { execSync } = require('child_process')
    execSync(`which ${cmd}`, { stdio: 'ignore' })
    return true
  } catch { return false }
}

// ── Routes ────────────────────────────────────────────────────────────────────

const router = express.Router()

// Health check
router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', version: '1.0.0' })
})

// ── Org container lifecycle ────────────────────────────────────────────────────
// These are called by the dashboard at org create/delete time.
// For now they're no-ops; in production you'd provision a Docker network/container here.

router.post('/organizations/:orgId/container', (req: Request, res: Response) => {
  const { orgId } = req.params
  console.log(`[container] CREATE org=${orgId}`)
  res.json({ orgId, status: 'created', message: 'Container provisioned (stub)' })
})

router.delete('/organizations/:orgId/container', (req: Request, res: Response) => {
  const { orgId } = req.params
  console.log(`[container] DELETE org=${orgId}`)
  res.json({ orgId, status: 'deleted' })
})

// ── Build endpoints ────────────────────────────────────────────────────────────

/** POST /api/v1/apps/organizations/:orgId/build — queue a new build */
router.post('/organizations/:orgId/build', (req: Request, res: Response) => {
  const { orgId } = req.params
  const { projectId, target = 'all', appUrl, appName = 'MyApp' } = req.body as {
    projectId?: string
    target?: string
    appUrl?: string
    appName?: string
  }

  if (!appUrl) {
    return res.status(400).json({ error: 'appUrl is required' })
  }

  const validTargets = ['desktop-mac', 'desktop-windows', 'desktop-linux', 'all']
  if (!validTargets.includes(target)) {
    return res.status(400).json({ error: `Invalid target: ${target}` })
  }

  const jobId = uuidv4()
  const job: BuildJob = {
    jobId,
    orgId,
    projectId: projectId ?? '',
    target,
    appUrl,
    appName,
    status: 'queued',
    log: `[platform-api] Job ${jobId} queued\n[platform-api] target=${target} appUrl=${appUrl}\n`,
    downloadUrl: null,
    artifactPath: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  jobs.set(jobId, job)

  // Run async — don't await
  job.status = 'building'
  runBuild(job).catch((err) => {
    job.status = 'failed'
    job.log += `\n[platform-api] Unhandled error: ${err?.message ?? String(err)}\n`
    job.updatedAt = new Date()
  })

  console.log(`[build] Started job=${jobId} org=${orgId} target=${target}`)
  return res.status(202).json({ jobId, status: 'queued' })
})

/** GET /api/v1/apps/organizations/:orgId/build/:jobId — poll build status */
router.get('/organizations/:orgId/build/:jobId', (req: Request, res: Response) => {
  const { jobId } = req.params
  const job = jobs.get(jobId)
  if (!job) {
    return res.status(404).json({ error: 'Job not found' })
  }
  return res.json({
    jobId: job.jobId,
    status: job.status,
    log: job.log,
    downloadUrl: job.downloadUrl
      ? `${req.protocol}://${req.get('host')}${job.downloadUrl}`
      : null,
    error: job.status === 'failed' ? job.log.split('\n').filter(Boolean).pop() : undefined,
  })
})

/** GET /api/v1/apps/organizations/:orgId/build/:jobId/download — stream artifact */
router.get('/organizations/:orgId/build/:jobId/download', (req: Request, res: Response) => {
  const { jobId } = req.params
  const job = jobs.get(jobId)
  if (!job || !job.artifactPath || !fs.existsSync(job.artifactPath)) {
    return res.status(404).json({ error: 'Artifact not found' })
  }
  const filename = path.basename(job.artifactPath)
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.setHeader('Content-Type', 'application/octet-stream')
  fs.createReadStream(job.artifactPath).pipe(res)
  return
})

app.use('/api/v1/apps', router)

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[platform-api] Listening on port ${PORT}`)
  console.log(`[platform-api] Artifacts dir: ${ARTIFACTS_DIR}`)
  console.log(`[platform-api] Using Docker: ${!commandExists('cargo')}`)
})

export default app
