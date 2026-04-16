/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

'use client'

import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import Link from 'next/link'
import { Users, FolderKanban, Plus, Mail, X, UserPlus, ArrowRight, FileText, Settings, CheckCircle, Trash2, Send, Copy, Sparkles, Container, Cpu, HardDrive, Activity, Server, RefreshCw, Pencil, Bot, Key, ChevronDown, ChevronUp } from 'lucide-react'
import { NEO_FINANCE_LAYOUT } from '@/lib/templates/neo-finance-layout'
import { ALL_TEMPLATES, type ProjectTemplate } from '@/lib/templates'
import { Button } from '@/components/ui/button'
import { LoadingBar } from '@/components/ui/loading-bar'
import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function OrganizationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const orgId = params.id as string
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member')
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [inviteSuccess, setInviteSuccess] = useState<{ email: string } | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [resendingInvitationId, setResendingInvitationId] = useState<string | null>(null)
  const [duplicatingProjectId, setDuplicatingProjectId] = useState<string | null>(null)
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null)
  const [renamingProject, setRenamingProject] = useState<any | null>(null)
  const [renameProjectName, setRenameProjectName] = useState('')
  const [renameProjectDesc, setRenameProjectDesc] = useState('')
  const [renameProjectLoading, setRenameProjectLoading] = useState(false)
  const [mcpKey, setMcpKey] = useState<string | null>(null)
  const [mcpUrl, setMcpUrl] = useState<string | null>(null)
  const [mcpClaudeConfig, setMcpClaudeConfig] = useState<any | null>(null)
  const [mcpCopied, setMcpCopied] = useState<'url' | 'config' | null>(null)
  const [mcpPanelOpen, setMcpPanelOpen] = useState(false)
  const [newProjectDialogOpen, setNewProjectDialogOpen] = useState(false)
  const [claimingProjectId, setClaimingProjectId] = useState<string | null>(null)
  const [creatingTemplateId, setCreatingTemplateId] = useState<string | null>(null)
  const [isSeeding, setIsSeeding] = useState(false)
  const hasAutoSeeded = useRef(false)
  const visibleTemplates = ALL_TEMPLATES.filter((template) => template.name === 'Weather Dashboard')

  // Auto-open new project dialog when navigated here with ?newProject=1
  useEffect(() => {
    if (searchParams?.get('newProject') === '1') {
      setNewProjectDialogOpen(true)
    }
  }, [searchParams])

  const createNeoFinance = async () => {
    setCreatingTemplateId('neo-finance')
    try {
      const { data: projData } = await axios.post('/api/projects', {
        name: 'NeoFinance Dashboard',
        description: 'Example finance analytics app — edit or delete any time.',
        organizationId: orgId,
      })
      const projectId = projData.project.id
      await axios.post(`/api/projects/${projectId}/screens`, {
        name: 'Dashboard',
        slug: 'dashboard',
        layout: NEO_FINANCE_LAYOUT,
        script: '',
      })
      queryClient.invalidateQueries({ queryKey: ['organization', orgId] })
      router.push(`/organizations/${orgId}/projects/${projectId}/screens`)
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create example project')
    } finally {
      setCreatingTemplateId(null)
    }
  }

  const createFromAnyTemplate = async (template: ProjectTemplate) => {
    setCreatingTemplateId(template.name)
    try {
      // 1. Create project
      let projData: any
      try {
        const res = await axios.post('/api/projects', {
          name: template.name,
          description: template.description + ' (example — delete or customise any time)',
          organizationId: orgId,
        })
        projData = res.data
      } catch (err: any) {
        const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Unknown error'
        throw new Error(`Create project: ${msg}`)
      }
      const projectId = projData.project.id

      // 2. API sources
      for (const src of template.apiSources ?? []) {
        try {
          await axios.post(`/api/projects/${projectId}/api-sources`, src)
        } catch (err: any) {
          const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Unknown error'
          throw new Error(`Create API source "${src.name}": ${msg}`)
        }
      }

      // 3. Internal DB setup
      if (template.dbSetup) {
        let dsId: string
        try {
          const { data: dsData } = await axios.post(`/api/projects/${projectId}/datasources`)
          dsId = (dsData.datasource as { id: string }).id
        } catch (err: any) {
          const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Unknown error'
          throw new Error(`Create datasource: ${msg}`)
        }
        for (const tbl of template.dbSetup.tables) {
          let tableId: string
          try {
            const { data: tblData } = await axios.post(
              `/api/projects/${projectId}/datasources/${dsId}/tables`,
              { name: tbl.name }
            )
            tableId = (tblData.table as { id: string }).id
          } catch (err: any) {
            const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Unknown error'
            throw new Error(`Create table "${tbl.name}": ${msg}`)
          }
          try {
            await axios.patch(`/api/projects/${projectId}/datasources/${dsId}/tables`, {
              tableId,
              columns: tbl.columns,
            })
          } catch (err: any) {
            // Column setup failure is non-fatal — log and continue
            console.warn(`[template] column setup for "${tbl.name}" failed:`, err.response?.data || err.message)
          }
          for (const row of tbl.rows) {
            try {
              await axios.post(
                `/api/projects/${projectId}/datasources/${dsId}/tables/${tableId}/rows`,
                row
              )
            } catch (err: any) {
              console.warn(`[template] row insert failed:`, err.response?.data || err.message)
            }
          }
        }
      }

      // 4. Screens
      for (const screen of template.screens) {
        try {
          await axios.post(`/api/projects/${projectId}/screens`, screen)
        } catch (err: any) {
          const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Unknown error'
          throw new Error(`Create screen "${screen.name}": ${msg}`)
        }
      }

      queryClient.invalidateQueries({ queryKey: ['organization', orgId] })
      router.push(`/organizations/${orgId}/projects/${projectId}/screens`)
    } catch (err: any) {
      console.error('[createFromAnyTemplate]', err)
      alert(`Failed to create "${template.name}": ${err.message}`)
    } finally {
      setCreatingTemplateId(null)
    }
  }
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectDesc, setNewProjectDesc] = useState('')
  const [newProjectLoading, setNewProjectLoading] = useState(false)
  const [newProjectError, setNewProjectError] = useState('')

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newProjectName.trim()) { setNewProjectError('Project name is required'); return }
    setNewProjectError('')
    setNewProjectLoading(true)
    try {
      const { data } = await axios.post('/api/projects', {
        name: newProjectName.trim(),
        description: newProjectDesc.trim(),
        organizationId: orgId,
      })
      queryClient.invalidateQueries({ queryKey: ['organization', orgId] })
      setNewProjectDialogOpen(false)
      setNewProjectName('')
      setNewProjectDesc('')
      router.push(`/organizations/${orgId}/projects/${data.project.id}/screens`)
    } catch (err: any) {
      setNewProjectError(err.response?.data?.error || 'Failed to create project')
    } finally {
      setNewProjectLoading(false)
    }
  }

  const { data: orphanData } = useQuery({
    queryKey: ['orphan-projects'],
    queryFn: async () => {
      const res = await axios.get('/api/projects')
      return (res.data.projects || []).filter((p: any) => !p.organizationId)
    },
  })
  const orphanProjects: any[] = orphanData || []

  const claimProject = async (projectId: string) => {
    setClaimingProjectId(projectId)
    try {
      await axios.put(`/api/projects/${projectId}`, { organizationId: orgId })
      queryClient.invalidateQueries({ queryKey: ['organization', orgId] })
      queryClient.invalidateQueries({ queryKey: ['orphan-projects'] })
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to link project')
    } finally {
      setClaimingProjectId(null)
    }
  }

  const { data: orgData, isLoading, isError, error: orgError } = useQuery({
    queryKey: ['organization', orgId],
    queryFn: async () => {
      const res = await axios.get(`/api/organizations/${orgId}`)
      return res.data
    },
    retry: 1,
  })

  const inviteMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: string }) => {
      const res = await axios.post(`/api/organizations/${orgId}/invite`, { email, role })
      return res.data
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['organization', orgId] })
      setInviteError(null)
      // Show success animation
      setInviteSuccess({ email: variables.email })
      setInviteEmail('')
      setInviteRole('member')
      
      // Close dialog after 3 seconds
      setTimeout(() => {
        setInviteSuccess(null)
        setInviteDialogOpen(false)
      }, 3000)
    },
    onError: (error: any) => {
      // Reset success state on error
      setInviteSuccess(null)
      setInviteError(error?.response?.data?.error || error?.response?.data?.message || error?.message || 'Failed to send invitation')
    },
  })

  const updateRoleMutation = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: string }) => {
      const res = await axios.put(`/api/organizations/${orgId}/members/${memberId}/role`, { role })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', orgId] })
    },
  })

  const removeMemberMutation = useMutation({
    mutationFn: async ({ memberId }: { memberId: string }) => {
      const res = await axios.delete(`/api/organizations/${orgId}/members/${memberId}`)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', orgId] })
    },
  })

  const resendInvitationMutation = useMutation({
    mutationFn: async ({ invitationId }: { invitationId: string }) => {
      setResendingInvitationId(invitationId)
      const res = await axios.post(`/api/organizations/${orgId}/invitations/${invitationId}/resend`)
      return res.data
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['organization', orgId] })
      // Show success feedback
      const invitation = organization?.invitations?.find((inv: any) => inv.id === variables.invitationId)
      if (invitation) {
        setInviteSuccess({ email: invitation.email })
        setTimeout(() => setInviteSuccess(null), 3000)
      }
      setResendingInvitationId(null)
    },
    onError: () => {
      setInviteSuccess(null)
      setResendingInvitationId(null)
    },
  })

  const deleteInvitationMutation = useMutation({
    mutationFn: async ({ invitationId }: { invitationId: string }) => {
      const res = await axios.delete(`/api/organizations/${orgId}/invitations/${invitationId}`)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', orgId] })
    },
  })

  const organization = orgData?.organization

  // Fetch MCP key once
  useEffect(() => {
    axios.get('/api/mcp-key').then((res) => {
      setMcpKey(res.data.key)
      setMcpUrl(res.data.mcpUrl)
      setMcpClaudeConfig(res.data.claudeDesktop)
    }).catch(() => {})
  }, [])

  // Listen for Cortex AI action completions — refresh project list automatically
  useEffect(() => {
    const handler = () => {
      queryClient.invalidateQueries({ queryKey: ['organization', orgId] })
    }
    window.addEventListener('cortex:refresh', handler)
    return () => window.removeEventListener('cortex:refresh', handler)
  }, [orgId, queryClient])

  // Auto-seed example projects when a brand-new org has no projects yet
  useEffect(() => {
    if (!orgData?.organization || hasAutoSeeded.current) return
    if ((orgData.organization.projects?.length ?? 0) > 0) return
    hasAutoSeeded.current = true

    const seedAll = async () => {
      setIsSeeding(true)
      const createProject = async (name: string, description: string) => {
        const { data } = await axios.post('/api/projects', { name, description, organizationId: orgId })
        return data.project.id as string
      }
      const addApiSource = async (projectId: string, src: any) => {
        await axios.post(`/api/projects/${projectId}/api-sources`, src)
      }
      const addScreen = async (projectId: string, screen: any) => {
        await axios.post(`/api/projects/${projectId}/screens`, screen)
      }

      try {
        // NeoFinance Dashboard
        const nfId = await createProject('NeoFinance Dashboard', 'Example finance analytics app — edit or delete any time.')
        await addScreen(nfId, { name: 'Dashboard', slug: 'dashboard', layout: NEO_FINANCE_LAYOUT, script: '' })
      } catch (e) {
        console.error('[seed] NeoFinance failed:', e)
      }

      // Keep onboarding curated and minimal
      for (const template of visibleTemplates) {
        try {
          const projectId = await createProject(
            template.name,
            template.description + ' (example — delete or customise any time)'
          )

          for (const src of template.apiSources ?? []) {
            await addApiSource(projectId, src)
          }

          if (template.dbSetup) {
            const { data: dsData } = await axios.post(`/api/projects/${projectId}/datasources`)
            const dsId = (dsData.datasource as { id: string }).id
            for (const tbl of template.dbSetup.tables) {
              const { data: tblData } = await axios.post(
                `/api/projects/${projectId}/datasources/${dsId}/tables`,
                { name: tbl.name }
              )
              const tableId = (tblData.table as { id: string }).id
              try {
                await axios.patch(`/api/projects/${projectId}/datasources/${dsId}/tables`, {
                  tableId,
                  columns: tbl.columns,
                })
                for (const row of tbl.rows) {
                  await axios.post(
                    `/api/projects/${projectId}/datasources/${dsId}/tables/${tableId}/rows`,
                    row
                  )
                }
              } catch (e) {
                console.warn(`[seed] table "${tbl.name}" data insert partial failure:`, e)
              }
            }
          }

          for (const screen of template.screens) {
            await addScreen(projectId, screen)
          }
        } catch (e) {
          console.error(`[seed] "${template.name}" failed:`, e)
        }
      }

      setIsSeeding(false)
      queryClient.invalidateQueries({ queryKey: ['organization', orgId] })
    }

    seedAll()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgData?.organization?.id, visibleTemplates])


  // Check if current user is owner/admin
  const currentUserMember = organization?.members?.find((m: any) => m.user?.id === session?.user?.id)
  const currentUserPermissions = Array.isArray(currentUserMember?.roleRef?.permissions)
    ? currentUserMember.roleRef.permissions
    : []
  const isOwner = currentUserMember?.role === 'owner'
  const isAdmin = currentUserMember?.role === 'admin' || isOwner
  const canManageMembers = isOwner || isAdmin || currentUserPermissions.includes('org.manage')

  if (isLoading) {
    return (
      <DashboardLayout>
        <LoadingBar fullPage />
      </DashboardLayout>
    )
  }

  if (isError || !organization) {
    const statusCode = (orgError as any)?.response?.status
    const serverMsg = (orgError as any)?.response?.data?.error
    const isUnauthorized = statusCode === 401
    const isForbidden = statusCode === 403
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <div className="text-center">
            <p className="text-gray-800 dark:text-gray-200 font-medium mb-1">
              {isUnauthorized
                ? 'You must be signed in to view this organization.'
                : isForbidden
                  ? 'You do not have access to this organization.'
                  : serverMsg && statusCode !== 404
                    ? `Error: ${serverMsg}`
                    : 'Organization not found.'}
            </p>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {statusCode ? `(HTTP ${statusCode})` : 'Check your connection or try again.'}
            </p>
          </div>
          <div className="flex gap-3">
            {isUnauthorized ? (
              <a href="/auth/signin" className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black text-sm font-medium hover:bg-gray-900 transition-colors">Sign In</a>
            ) : (
              <button onClick={() => window.location.reload()} className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black text-sm font-medium hover:bg-gray-900 transition-colors">Retry</button>
            )}
            <a href="/dashboard" className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Back to Dashboard</a>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-white dark:bg-[#0d1117]">
        {/* Header Section */}
        <div className="px-6 lg:px-8 max-w-7xl mx-auto py-6">
          <div className="flex items-center justify-between">
            <Breadcrumb
              items={[
                { label: 'Organizations', href: '/dashboard' },
                { label: organization.name },
              ]}
            />

          </div>
          <div className="mt-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-3">
              <h1 className="text-3xl md:text-4xl font-medium tracking-tighter text-black dark:text-white">
                {organization.name}
              </h1>
              {(() => {
                const status = String((organization as any)?.metadata?.containerStatus ?? 'unknown')
                const statusClasses = status === 'ready'
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'
                  : status === 'provisioning' || status === 'queued'
                    ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                    : status === 'failed'
                      ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                return (
                  <span className={`inline-flex self-start px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] border ${statusClasses}`}>
                    {status}
                  </span>
                )
              })()}
            </div>
            <p className="text-lg text-gray-500 dark:text-gray-400 font-light">
              {organization.description || 'No description'}
            </p>
          </div>
        </div>

        {/* Projects Section */}
        <section className="px-6 lg:px-8 max-w-7xl mx-auto pb-12">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-6 mb-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-medium tracking-tighter text-black dark:text-white mb-2">
                Projects
              </h2>
              <p className="text-gray-500 dark:text-gray-400 font-light text-sm">
                Build no-code apps: add data, design screens, deploy.
              </p>
            </div>
            <Dialog open={newProjectDialogOpen} onOpenChange={(o) => { setNewProjectDialogOpen(o); if (!o) { setNewProjectName(''); setNewProjectDesc(''); setNewProjectError('') } }}>
              <DialogTrigger asChild>
                <button className="group inline-flex items-center justify-center gap-3 bg-black dark:bg-white text-white dark:text-black px-8 py-4 text-base font-medium hover:bg-gray-900 dark:hover:bg-gray-200 transition-all hover:translate-y-[-2px]">
                  <Plus size={18} />
                  New Project
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Create Project</DialogTitle>
                  <DialogDescription>Add a new project to {organization.name}. You can add data and design screens once it&apos;s created.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateProject} className="space-y-4 mt-2">
                  {newProjectError && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm rounded">
                      {newProjectError}
                    </div>
                  )}
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-black dark:text-white">Project name <span className="text-red-500">*</span></label>
                    <Input
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      placeholder="My Awesome App"
                      autoFocus
                      disabled={newProjectLoading}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-black dark:text-white">Description <span className="text-gray-400 font-normal">(optional)</span></label>
                    <Input
                      value={newProjectDesc}
                      onChange={(e) => setNewProjectDesc(e.target.value)}
                      placeholder="What does this project do?"
                      disabled={newProjectLoading}
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <Button type="button" variant="outline" onClick={() => setNewProjectDialogOpen(false)} disabled={newProjectLoading}>Cancel</Button>
                    <Button type="submit" disabled={newProjectLoading || !newProjectName.trim()}>
                      {newProjectLoading ? 'Creating…' : 'Create Project'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {isSeeding ? (
            <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] p-12 text-center">
              <Sparkles size={48} className="mx-auto mb-4 text-gray-400 dark:text-gray-500 animate-pulse" />
              <h3 className="text-xl font-medium text-black dark:text-white mb-2 tracking-tight">Setting up your workspace…</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-2 font-light max-w-md mx-auto text-sm">
                Creating 2 example projects so you can explore the builder right away.
              </p>
              <p className="text-gray-400 dark:text-gray-600 text-xs">This only happens once — delete any you don&apos;t need.</p>
            </div>
          ) : organization.projects?.length === 0 ? (
            <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] p-12 text-center">
              <FolderKanban size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
              <h3 className="text-xl font-medium text-black dark:text-white mb-2 tracking-tight">No projects yet</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6 font-light max-w-md mx-auto text-sm">
                Create your first project, then add data and design screens—no code required.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={() => setNewProjectDialogOpen(true)}
                  className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 dark:border-[#30363d] text-sm font-medium text-black dark:text-white hover:bg-gray-50 dark:hover:bg-[#21262d] transition-colors"
                >
                  <Plus size={16} />
                  New project
                </button>
                <Link
                  href={`/organizations/${orgId}?cortex=open`}
                  onClick={() => window.dispatchEvent(new CustomEvent('cortex:open'))}
                  className="flex items-center gap-2 px-4 py-2.5 bg-black text-white dark:bg-white dark:text-black border border-black dark:border-white text-sm font-medium hover:opacity-80 transition-opacity"
                >
                  <Sparkles size={16} />
                  Ask Cortex to build your first app →
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-gray-200 dark:bg-[#30363d] border border-gray-200 dark:border-[#30363d]">
              {organization.projects?.map((project: any) => (
                <div
                  key={project.id}
                  className="bg-white dark:bg-[#161b22] p-6 hover:bg-gray-50 dark:hover:bg-[#1c2128] transition-colors"
                >
                  <Link href={`/organizations/${orgId}/projects/${project.id}/screens`} className="block">
                    <h3 className="text-xl font-medium mb-2 text-black dark:text-white tracking-tight hover:text-gray-600 dark:hover:text-gray-400 transition-colors">
                      {project.name}
                    </h3>
                  </Link>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 font-light leading-relaxed">
                    {project.description || 'No description'}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-3 py-1 text-xs font-mono border ${
                      project.status === 'deployed'
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'
                        : project.status === 'error'
                        ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
                        : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                    }`}>
                      {project.status}
                    </span>
                    <Link href={`/organizations/${orgId}/projects/${project.id}/screens`} className="text-xs text-[var(--primary)] hover:underline">Screens</Link>
                    <Link href={`/organizations/${orgId}/projects/${project.id}/data`} className="text-xs text-[var(--primary)] hover:underline">Data</Link>
                    <span className="text-xs text-gray-400 dark:text-gray-600 cursor-default" title="Code editor — coming soon">Code (soon)</span>
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        if (duplicatingProjectId) return
                        setDuplicatingProjectId(project.id)
                        try {
                          const { data } = await axios.post<{ project: { id: string } }>(`/api/projects/${project.id}/duplicate`, {})
                          queryClient.invalidateQueries({ queryKey: ['organization', orgId] })
                          router.push(`/organizations/${orgId}/projects/${data.project.id}/screens`)
                        } catch (err: any) {
                          console.error('Duplicate project failed:', err)
                          alert(err?.response?.data?.error || 'Failed to duplicate project')
                        } finally {
                          setDuplicatingProjectId(null)
                        }
                      }}
                      disabled={duplicatingProjectId === project.id}
                      className="text-xs text-[var(--primary)] hover:underline inline-flex items-center gap-1 disabled:opacity-50"
                      title="Duplicate project"
                    >
                      <Copy size={12} />
                      {duplicatingProjectId === project.id ? 'Duplicating…' : 'Duplicate'}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setRenamingProject(project)
                        setRenameProjectName(project.name)
                        setRenameProjectDesc(project.description || '')
                      }}
                      className="text-xs text-[var(--primary)] hover:underline inline-flex items-center gap-1"
                      title="Rename project"
                    >
                      <Pencil size={12} />
                      Rename
                    </button>
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        if (!confirm(`Delete "${project.name}"? This cannot be undone.`)) return
                        setDeletingProjectId(project.id)
                        try {
                          await axios.delete(`/api/projects/${project.id}`, { data: { verificationName: project.name } })
                          queryClient.invalidateQueries({ queryKey: ['organization', orgId] })
                        } catch (err: any) {
                          console.error('Delete project failed:', err)
                          alert(err?.response?.data?.error || 'Failed to delete project')
                        } finally {
                          setDeletingProjectId(null)
                        }
                      }}
                      disabled={deletingProjectId === project.id}
                      className="text-xs text-red-500 hover:text-red-700 hover:underline inline-flex items-center gap-1 disabled:opacity-50"
                      title="Delete project"
                    >
                      <Trash2 size={12} />
                      {deletingProjectId === project.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {orphanProjects.length > 0 && (
            <div className="mt-8 border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-5 rounded-md">
              <div className="flex items-center gap-2 mb-3">
                <FolderKanban size={16} className="text-amber-600 dark:text-amber-400" />
                <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                  {orphanProjects.length} unlinked project{orphanProjects.length > 1 ? 's' : ''} found
                </span>
                <span className="text-xs text-amber-600 dark:text-amber-500 font-light">— these belong to your account but aren&apos;t attached to any org</span>
              </div>
              <div className="flex flex-col gap-2">
                {orphanProjects.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between bg-white dark:bg-[#161b22] border border-amber-200 dark:border-amber-700 px-4 py-3 rounded">
                    <div>
                      <span className="text-sm font-medium text-black dark:text-white">{p.name}</span>
                      {p.description && <span className="ml-2 text-xs text-gray-400">{p.description}</span>}
                    </div>
                    <button
                      onClick={() => claimProject(p.id)}
                      disabled={claimingProjectId === p.id}
                      className="text-xs font-medium text-[var(--primary)] border border-[var(--primary)] px-3 py-1 rounded hover:bg-[var(--primary)] hover:text-white transition-colors disabled:opacity-50"
                    >
                      {claimingProjectId === p.id ? 'Linking…' : 'Add to this org'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── MCP (AI Access) ── */}
        <section className="px-6 lg:px-8 max-w-7xl mx-auto pb-12">
          <button
            onClick={() => setMcpPanelOpen((v) => !v)}
            className="w-full flex items-center justify-between py-4 border-t border-gray-200 dark:border-[#30363d] group"
          >
            <div className="flex items-center gap-3">
              <Bot size={18} className="text-gray-500 dark:text-gray-400" />
              <div className="text-left">
                <span className="text-base font-medium text-black dark:text-white">AI Access (MCP)</span>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-light">Connect Claude Desktop or any MCP-compatible AI to your projects</p>
              </div>
            </div>
            {mcpPanelOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
          </button>

          {mcpPanelOpen && (
            <div className="border border-gray-200 dark:border-[#30363d] bg-gray-50 dark:bg-[#161b22] p-6 mb-8">
              {!mcpKey ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Loading MCP key…</p>
              ) : (
                <div className="space-y-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">What can the AI do?</p>
                    <div className="flex flex-wrap gap-2">
                      {['List projects', 'Create project', 'Delete project', 'List screens', 'Get screen HTML', 'Update screen HTML', 'Create screen', 'Rename screen', 'Delete screen'].map((cap) => (
                        <span key={cap} className="px-2.5 py-1 text-xs bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-[#30363d] text-gray-700 dark:text-gray-300">{cap}</span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">MCP Server URL</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-[#30363d] px-3 py-2 text-gray-800 dark:text-gray-200 font-mono truncate">
                        {mcpUrl}
                      </code>
                      <button
                        onClick={() => { navigator.clipboard.writeText(mcpUrl!); setMcpCopied('url'); setTimeout(() => setMcpCopied(null), 2000) }}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#161b22] transition-colors shrink-0"
                      >
                        <Copy size={12} />
                        {mcpCopied === 'url' ? 'Copied!' : 'Copy URL'}
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Claude Desktop Config</p>
                    <div className="flex items-start gap-2">
                      <pre className="flex-1 text-xs bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-[#30363d] px-3 py-2 text-gray-800 dark:text-gray-200 font-mono overflow-x-auto">
                        {JSON.stringify(mcpClaudeConfig, null, 2)}
                      </pre>
                      <button
                        onClick={() => { navigator.clipboard.writeText(JSON.stringify(mcpClaudeConfig, null, 2)); setMcpCopied('config'); setTimeout(() => setMcpCopied(null), 2000) }}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#161b22] transition-colors shrink-0 mt-0"
                      >
                        <Copy size={12} />
                        {mcpCopied === 'config' ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Paste this into <code className="font-mono">~/Library/Application Support/Claude/claude_desktop_config.json</code> (add inside an existing <code className="font-mono">mcpServers</code> object if one already exists).</p>
                  </div>

                  <div className="pt-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Your API Key</p>
                    <div className="flex items-center gap-2">
                      <Key size={12} className="text-gray-400 shrink-0" />
                      <code className="text-xs text-gray-600 dark:text-gray-400 font-mono truncate">{mcpKey}</code>
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">User-scoped — grants access to all your projects across all organizations. Keep it secret.</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── INFRASTRUCTURE ── */}
        <section className="px-6 lg:px-8 max-w-7xl mx-auto pb-12">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-6 mb-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-medium tracking-tighter text-black dark:text-white mb-2">
                Infrastructure
              </h2>
              <p className="text-gray-500 dark:text-gray-400 font-light text-sm">
                Container runtime, resource usage, and scaling configuration.
              </p>
            </div>
          </div>

          {/* Resource Overview Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-gray-200 dark:bg-[#30363d] border border-gray-200 dark:border-[#30363d] mb-6">
            {[
              { label: 'Containers', value: String(organization.projects?.length || 0), icon: Container, sub: 'active' },
              { label: 'CPU Usage', value: `${Math.min((organization.projects?.length || 0) * 12, 100)}%`, icon: Cpu, sub: `${(organization.projects?.length || 0) * 0.5} / 4 cores` },
              { label: 'Memory', value: `${(organization.projects?.length || 0) * 256} MB`, icon: Activity, sub: `of ${Math.max((organization.projects?.length || 0) * 256, 2048)} MB` },
              { label: 'Storage', value: `${(organization.projects?.length || 0) * 50} MB`, icon: HardDrive, sub: 'of 10 GB' },
            ].map(({ label, value, icon: Icon, sub }) => (
              <div key={label} className="bg-white dark:bg-[#161b22] p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Icon size={14} className="text-gray-400 dark:text-gray-500" />
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</span>
                </div>
                <div className="text-2xl font-bold text-black dark:text-white tracking-tight">{value}</div>
                <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">{sub}</div>
              </div>
            ))}
          </div>

          {/* Per-project container table */}
          {organization.projects?.length > 0 ? (
            <div className="border border-gray-200 dark:border-[#30363d] overflow-x-auto">
              <div className="grid grid-cols-[1fr_100px_80px_80px_100px_80px] min-w-[620px] gap-0 bg-gray-50 dark:bg-[#0d1117] border-b border-gray-200 dark:border-[#30363d] px-5 py-3">
                <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Container</span>
                <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</span>
                <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">CPU</span>
                <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Memory</span>
                <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Uptime</span>
                <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Scale</span>
              </div>
              {organization.projects?.map((project: any, i: number) => {
                const status = project.status === 'deployed' ? 'running' : project.status === 'error' ? 'failed' : 'idle'
                const statusColor = status === 'running'
                  ? 'bg-green-500'
                  : status === 'failed'
                    ? 'bg-red-500'
                    : 'bg-gray-400 dark:bg-gray-600'
                return (
                  <div key={project.id} className="grid grid-cols-[1fr_100px_80px_80px_100px_80px] min-w-[620px] gap-0 bg-white dark:bg-[#161b22] border-b last:border-b-0 border-gray-200 dark:border-[#30363d] px-5 py-4 hover:bg-gray-50 dark:hover:bg-[#1c2128] transition-colors items-center">
                    <div className="flex items-center gap-3 min-w-0">
                      <Server size={14} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-black dark:text-white truncate">{project.name}</div>
                        <div className="text-[10px] text-gray-400 dark:text-gray-500 font-mono truncate">{project.id.slice(0, 12)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${statusColor}`} />
                      <span className="text-xs text-gray-600 dark:text-gray-300">{status}</span>
                    </div>
                    <span className="text-xs font-mono text-gray-600 dark:text-gray-300">{status === 'running' ? `${8 + i * 4}%` : '—'}</span>
                    <span className="text-xs font-mono text-gray-600 dark:text-gray-300">{status === 'running' ? `${128 + i * 64}M` : '—'}</span>
                    <span className="text-xs font-mono text-gray-600 dark:text-gray-300">{status === 'running' ? `${i + 1}h ${(i * 17) % 60}m` : '—'}</span>
                    <span className="text-xs font-mono text-gray-600 dark:text-gray-300">{status === 'running' ? '1×' : '—'}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] p-10 text-center">
              <Server size={36} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" />
              <p className="text-sm text-gray-500 dark:text-gray-400 font-light">No containers running. Create a project to provision infrastructure.</p>
            </div>
          )}

          {/* Scaling Configuration */}
          {organization.projects?.length > 0 && (
            <div className="mt-6 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <RefreshCw size={14} className="text-gray-400 dark:text-gray-500" />
                  <span className="text-sm font-medium text-black dark:text-white">Auto-Scaling</span>
                </div>
                <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800">
                  Enabled
                </span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Min Replicas</div>
                  <div className="text-lg font-bold text-black dark:text-white">1</div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Max Replicas</div>
                  <div className="text-lg font-bold text-black dark:text-white">5</div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">CPU Threshold</div>
                  <div className="text-lg font-bold text-black dark:text-white">80%</div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Example Templates Section */}
        <section className="px-6 lg:px-8 max-w-7xl mx-auto pb-12">
          <div className="flex items-center gap-3 mb-6">
            <Sparkles size={18} className="text-black dark:text-white" />
            <div>
              <h2 className="text-xl font-medium tracking-tight text-black dark:text-white">Example Apps</h2>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* NeoFinance — hardcoded (static layout, no external APIs) */}
            <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] p-5 hover:border-black dark:hover:border-white transition-colors">
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2.5 border border-gray-200 dark:border-[#30363d] flex-shrink-0 text-xl leading-none">📊</div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-sm text-black dark:text-white tracking-tight">NeoFinance Dashboard</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-light">Full analytics dashboard with charts, tables and state bindings</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {['lineChart','barChart','pieChart','table','state'].map(tag => (
                  <span key={tag} className="px-1.5 py-0.5 text-[10px] font-medium border border-gray-200 dark:border-[#30363d] text-gray-500 dark:text-gray-400">{tag}</span>
                ))}
              </div>
              <button
                onClick={createNeoFinance}
                disabled={creatingTemplateId !== null}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-black dark:bg-white text-white dark:text-black text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-40"
              >
                <Plus size={14} />
                {creatingTemplateId === 'neo-finance' ? 'Creating…' : 'Use Template'}
              </button>
            </div>

            {/* Dynamic templates from curated template list */}
            {visibleTemplates.map((template) => (
              <div
                key={template.name}
                className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] p-5 hover:border-black dark:hover:border-white transition-colors"
              >
                <div className="flex items-start gap-3 mb-4">
                  <div className="p-2.5 border border-gray-200 dark:border-[#30363d] flex-shrink-0 text-xl leading-none">{template.icon}</div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm text-black dark:text-white tracking-tight">{template.name}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-light line-clamp-2">{template.description}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {template.tags.map(tag => (
                    <span key={tag} className="px-1.5 py-0.5 text-[10px] font-medium border border-gray-200 dark:border-[#30363d] text-gray-500 dark:text-gray-400">{tag}</span>
                  ))}
                </div>
                <button
                  onClick={() => createFromAnyTemplate(template)}
                  disabled={creatingTemplateId !== null}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-black dark:bg-white text-white dark:text-black text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-40"
                >
                  <Plus size={14} />
                  {creatingTemplateId === template.name ? 'Creating…' : 'Use Template'}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Members Section */}
        <section className="px-6 lg:px-8 max-w-7xl mx-auto pb-16">
          {/* Single Dialog for all invite buttons - no redundancy */}
          <Dialog
            open={inviteDialogOpen}
            onOpenChange={(open) => {
              setInviteDialogOpen(open)
              if (open) {
                setInviteSuccess(null)
                setInviteError(null)
              }
            }}
          >
            <DialogContent>
              {inviteSuccess ? (
                <div className="py-8 text-center">
                  <div className="flex justify-center mb-4">
                    <div className="relative">
                      <CheckCircle className="w-16 h-16 text-green-500 transition-all duration-300 scale-100" />
                      <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping" />
                    </div>
                  </div>
                  <h3 className="text-lg font-medium text-black dark:text-white mb-2 transition-opacity duration-300">
                    Invitation Sent!
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 transition-opacity duration-300">
                    Invitation request has been sent to <span className="font-medium text-black dark:text-white">{inviteSuccess.email}</span>
                  </p>
                </div>
              ) : (
                <>
                  <DialogHeader>
                    <DialogTitle>Invite Member</DialogTitle>
                    <DialogDescription>
                      Send an invitation to join this organization. They can sign up if they don't have an account.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    {inviteError && (
                      <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
                        {inviteError}
                      </div>
                    )}
                    <div>
                      <label className="text-sm font-medium text-black dark:text-white mb-2 block">Email</label>
                      <Input
                        type="email"
                        placeholder="user@example.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        disabled={inviteMutation.isPending}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-black dark:text-white mb-2 block">Role</label>
                      <Select value={inviteRole} onValueChange={(value: any) => setInviteRole(value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">Member (Collaborator)</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Default: Member (Collaborator)</p>
                    </div>
                    <button
                      onClick={() => {
                        if (inviteEmail.trim()) {
                          inviteMutation.mutate({ email: inviteEmail.trim(), role: inviteRole })
                        }
                      }}
                      disabled={!inviteEmail.trim() || inviteMutation.isPending}
                      className="w-full bg-black dark:bg-white text-white dark:text-black px-6 py-3 text-sm font-medium hover:bg-gray-900 dark:hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {inviteMutation.isPending ? 'Sending...' : 'Send Invitation'}
                    </button>
                  </div>
                </>
              )}
            </DialogContent>
          </Dialog>

          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-6 mb-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-medium tracking-tighter text-black dark:text-white mb-2">
                Members
              </h2>
              <p className="text-gray-500 dark:text-gray-400 font-light text-sm">
                {organization?.members?.length || 0} team member{organization?.members?.length !== 1 ? 's' : ''}
              </p>
            </div>
            {canManageMembers && (
              <button 
                onClick={() => {
                  setInviteError(null)
                  setInviteSuccess(null)
                  setInviteDialogOpen(true)
                }}
                className="group inline-flex items-center justify-center gap-3 bg-black dark:bg-white text-white dark:text-black px-8 py-4 text-base font-medium hover:bg-gray-900 dark:hover:bg-gray-200 transition-all hover:translate-y-[-2px]"
              >
                <UserPlus size={18} />
                Invite Member
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
            )}
          </div>

          {!organization?.members || organization.members.length === 0 ? (
            <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] p-12 text-center">
              <Users size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
              <h3 className="text-xl font-medium text-black dark:text-white mb-2 tracking-tight">No members yet</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6 font-light max-w-md mx-auto text-sm">
                Invite team members to collaborate on projects and share resources.
              </p>
              {canManageMembers && (
                <button 
                  onClick={() => {
                    setInviteError(null)
                    setInviteSuccess(null)
                    setInviteDialogOpen(true)
                  }}
                  className="group inline-flex items-center justify-center gap-3 bg-black dark:bg-white text-white dark:text-black px-8 py-4 text-base font-medium hover:bg-gray-900 dark:hover:bg-gray-200 transition-all hover:translate-y-[-2px]"
                >
                  <UserPlus size={18} />
                  Invite your first member
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-px bg-gray-200 dark:bg-[#30363d] border border-gray-200 dark:border-[#30363d]">
                {organization.members?.map((member: any) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-6 bg-white dark:bg-[#161b22] hover:bg-gray-50 dark:hover:bg-[#1c2128] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 dark:bg-[#0d1117] flex items-center justify-center border border-gray-200 dark:border-[#30363d]">
                        <Users size={18} className="text-gray-400 dark:text-gray-500" />
                      </div>
                      <div>
                        <p className="font-medium text-black dark:text-white">{member.user?.name || member.user?.email}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-light">{member.user?.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {canManageMembers && member.role !== 'owner' ? (
                        <Select
                          value={member.role}
                          onValueChange={(value) => {
                            updateRoleMutation.mutate({ memberId: member.id, role: value })
                          }}
                        >
                          <SelectTrigger className="w-32 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="member">Member</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className={`px-3 py-1 text-xs border uppercase tracking-wider font-medium ${
                          member.role === 'owner' ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800' :
                          member.role === 'admin' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800' :
                          'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                        }`}>
                          {member.role}
                        </span>
                      )}
                      {canManageMembers && member.role !== 'owner' && member.user?.id !== session?.user?.id && (
                        <button
                          onClick={() => {
                            if (confirm(`Remove ${member.user?.name || member.user?.email} from this organization?`)) {
                              removeMemberMutation.mutate({ memberId: member.id })
                            }
                          }}
                          className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          title="Remove member"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Pending Invitations */}
          {organization.invitations && organization.invitations.length > 0 && (
            <div className="mt-12 pt-12 border-t border-gray-200 dark:border-[#30363d]">
              <h3 className="text-sm font-medium text-black dark:text-white mb-4 uppercase tracking-wider">Pending Invitations</h3>
              <div className="space-y-px bg-gray-200 dark:bg-[#30363d] border border-gray-200 dark:border-[#30363d]">
                {organization.invitations
                  .filter((inv: any) => !inv.acceptedAt)
                  .map((invitation: any) => (
                    <div
                      key={invitation.id}
                      className="flex items-center justify-between p-6 bg-white dark:bg-[#161b22] hover:bg-gray-50 dark:hover:bg-[#1c2128] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Mail size={16} className="text-gray-400 dark:text-gray-500" />
                        <div>
                          <p className="text-sm font-medium text-black dark:text-white">{invitation.email}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-light">
                            Expires {new Date(invitation.expiresAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium">{invitation.role}</span>
                        {canManageMembers && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                resendInvitationMutation.mutate({ invitationId: invitation.id })
                              }}
                              disabled={resendInvitationMutation.isPending && resendingInvitationId === invitation.id}
                              className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95"
                              title={resendInvitationMutation.isPending && resendingInvitationId === invitation.id ? 'Sending...' : 'Resend invitation'}
                            >
                              {resendInvitationMutation.isPending && resendingInvitationId === invitation.id ? (
                                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <Send size={16} />
                              )}
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Cancel invitation for ${invitation.email}?`)) {
                                  deleteInvitationMutation.mutate({ invitationId: invitation.id })
                                }
                              }}
                              disabled={deleteInvitationMutation.isPending}
                              className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                              title="Remove invitation"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </section>

      </div>

      {/* Rename Project Dialog */}
      <Dialog open={!!renamingProject} onOpenChange={(o) => { if (!o) { setRenamingProject(null); setRenameProjectName(''); setRenameProjectDesc('') } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Project</DialogTitle>
            <DialogDescription>Update the name and description for <strong>{renamingProject?.name}</strong>.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              if (!renameProjectName.trim() || !renamingProject) return
              setRenameProjectLoading(true)
              try {
                await axios.put(`/api/projects/${renamingProject.id}`, {
                  name: renameProjectName.trim(),
                  description: renameProjectDesc.trim() || null,
                })
                queryClient.invalidateQueries({ queryKey: ['organization', orgId] })
                setRenamingProject(null)
                setRenameProjectName('')
                setRenameProjectDesc('')
              } catch (err: any) {
                alert(err?.response?.data?.error || 'Failed to rename project')
              } finally {
                setRenameProjectLoading(false)
              }
            }}
            className="space-y-4 mt-2"
          >
            <div className="space-y-1">
              <label className="text-sm font-medium text-black dark:text-white">Project name <span className="text-red-500">*</span></label>
              <Input
                value={renameProjectName}
                onChange={(e) => setRenameProjectName(e.target.value)}
                placeholder="Project name"
                autoFocus
                disabled={renameProjectLoading}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-black dark:text-white">Description <span className="text-gray-400 font-normal">(optional)</span></label>
              <Input
                value={renameProjectDesc}
                onChange={(e) => setRenameProjectDesc(e.target.value)}
                placeholder="What does this project do?"
                disabled={renameProjectLoading}
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => { setRenamingProject(null); setRenameProjectName(''); setRenameProjectDesc('') }} disabled={renameProjectLoading}>Cancel</Button>
              <Button type="submit" disabled={renameProjectLoading || !renameProjectName.trim()}>
                {renameProjectLoading ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}