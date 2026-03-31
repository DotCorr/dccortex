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
import { Users, FolderKanban, Plus, Mail, X, UserPlus, ArrowRight, FileText, Settings, CheckCircle, Trash2, Send, Copy, Sparkles } from 'lucide-react'
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
  const isOwner = currentUserMember?.role === 'owner'
  const isAdmin = currentUserMember?.role === 'admin' || isOwner

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
          <Breadcrumb
            items={[
              { label: 'Organizations', href: '/dashboard' },
              { label: organization.name },
            ]}
          />
          <div className="mt-6">
            <h1 className="text-3xl md:text-4xl font-medium tracking-tighter text-black dark:text-white mb-3">
              {organization.name}
            </h1>
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
            {(isOwner || isAdmin) && (
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
              {(isOwner || isAdmin) && (
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
                      {isOwner && member.role !== 'owner' ? (
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
                      {(isOwner || isAdmin) && member.role !== 'owner' && member.user?.id !== session?.user?.id && (
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
                        {(isOwner || isAdmin) && (
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
    </DashboardLayout>
  )
}