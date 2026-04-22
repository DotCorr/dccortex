/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

'use client'

import { useSession } from 'next-auth/react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import Link from 'next/link'
import { Plus, Users, Edit2, Trash2, MoreVertical, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LoadingBar } from '@/components/ui/loading-bar'
import { useState, Suspense } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLayout><LoadingBar fullPage /></DashboardLayout>}>
      <DashboardContent />
    </Suspense>
  )
}

function DashboardContent() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  const [editingOrg, setEditingOrg] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [orgToDelete, setOrgToDelete] = useState<any>(null)
  const [verificationName, setVerificationName] = useState('')

  const { data: orgsData, isLoading: orgsLoading } = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const res = await axios.get('/api/organizations')
      return res.data
    },
  })

  const updateOrgMutation = useMutation({
    mutationFn: async ({ id, name, description }: { id: string; name: string; description?: string }) => {
      const res = await axios.put(`/api/organizations/${id}`, { name, description })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] })
      queryClient.refetchQueries({ queryKey: ['organizations'] })
      setEditingOrg(null)
      setEditName('')
      setEditDescription('')
    },
    onError: (error: any) => {
      console.error('[Dashboard] Update org error:', error)
      const errorMessage = error.response?.data?.error || error.message || 'Failed to update organization'
      alert(errorMessage)
    },
  })

  const deleteOrgMutation = useMutation({
    mutationFn: async ({ id, verificationName }: { id: string; verificationName: string }) => {
      const res = await axios.delete(`/api/organizations/${id}`, {
        data: { verificationName }
      })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] })
      setDeleteDialogOpen(false)
      setOrgToDelete(null)
      setVerificationName('')
      // Force page reload to ensure UI updates
      window.location.reload()
    },
    onError: (error: any) => {
      console.error('[Dashboard] Delete org error:', error)
      const errorMessage = error.response?.data?.error || error.message || 'Failed to delete organization'
      alert(errorMessage)
    },
  })

  const organizations = orgsData?.organizations || []

  const handleEdit = (org: any) => {
    setEditingOrg(org.id)
    setEditName(org.name)
    setEditDescription(org.description || '')
  }

  const handleSave = (id: string) => {
    updateOrgMutation.mutate({ id, name: editName, description: editDescription })
  }

  const handleCancel = () => {
    setEditingOrg(null)
    setEditName('')
    setEditDescription('')
  }

  if (orgsLoading) {
    return (
      <DashboardLayout>
        <LoadingBar fullPage />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-white dark:bg-[#0d1117]">
        {/* Hero Section */}
        <section className="pt-24 pb-16 px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="mb-16">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-medium tracking-tighter text-black dark:text-white mb-6 leading-[0.95]">
              Welcome back,<br />
              <span className="text-gray-300 dark:text-gray-500">{session?.user?.name || 'User'}</span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-500 dark:text-gray-400 font-light max-w-2xl leading-relaxed mb-8">
              Manage your organizations and projects. Build apps without code.
            </p>
          </div>
        </section>

        {/* Organizations Section */}
        <section className="px-6 lg:px-8 max-w-7xl mx-auto pb-24">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-6 mb-12">
            <div>
              <h2 className="text-3xl md:text-4xl font-medium tracking-tighter text-black dark:text-white mb-2">
                Organizations
              </h2>
              <p className="text-gray-500 dark:text-gray-400 font-light">
                Create orgs and add projects (your apps)
              </p>
            </div>
            <Link href="/organizations/new">
              <button className="group inline-flex items-center justify-center gap-3 bg-black dark:bg-white text-white dark:text-black px-8 py-4 text-base font-medium hover:bg-gray-900 dark:hover:bg-gray-200 transition-all hover:translate-y-[-2px]">
                <Plus size={18} />
                New Organization
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </Link>
          </div>

          {organizations.length === 0 ? (
            <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] p-20 text-center">
              <Users size={64} className="mx-auto mb-6 text-gray-300 dark:text-gray-600" />
              <h3 className="text-2xl font-medium text-black dark:text-white mb-3 tracking-tight">No organizations yet</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-8 font-light max-w-md mx-auto">
                Create your first organization, then add projects and build no-code apps with your team.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-gray-200 dark:bg-[#30363d] border border-gray-200 dark:border-[#30363d]">
              {organizations.map((org: any) => (
                <div
                  key={org.id}
                  className="bg-white dark:bg-[#161b22] p-8 hover:bg-gray-50 dark:hover:bg-[#1c2128] transition-colors relative group"
                >
                  {(() => {
                    const status = String(org?.metadata?.containerStatus ?? 'unknown')
                    if (status !== 'provisioning' && status !== 'queued' && status !== 'failed') {
                      return null
                    }

                    const statusClasses = status === 'failed'
                      ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
                      : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'

                    const statusText = status === 'failed' ? 'Setup Issue' : 'Background Setup'

                    return (
                      <span className={`absolute top-6 left-6 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] border ${statusClasses}`}>
                        {statusText}
                      </span>
                    )
                  })()}
                  {editingOrg === org.id ? (
                    <div className="space-y-4">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-[#30363d] focus:outline-none focus:border-black dark:focus:border-white text-black dark:text-white bg-white dark:bg-[#0d1117]"
                        placeholder="Organization name"
                        autoFocus
                      />
                      <textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-[#30363d] focus:outline-none focus:border-black dark:focus:border-white text-black dark:text-white bg-white dark:bg-[#0d1117] resize-none"
                        placeholder="Description (optional)"
                        rows={3}
                      />
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleSave(org.id)}
                          disabled={!editName.trim() || updateOrgMutation.isPending}
                          className="flex-1 bg-black dark:bg-white text-white dark:text-black px-6 py-3 text-sm font-medium hover:bg-gray-900 dark:hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {updateOrgMutation.isPending ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={handleCancel}
                          disabled={updateOrgMutation.isPending}
                          className="flex-1 bg-white dark:bg-[#161b22] border border-gray-300 dark:border-[#30363d] text-black dark:text-white px-6 py-3 text-sm font-medium hover:bg-gray-50 dark:hover:bg-[#1c2128] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Link
                        href={`/organizations/${org.id}`}
                        className="block mb-6 group/link"
                      >
                        <h3 className="text-2xl font-medium mb-3 text-black dark:text-white tracking-tight group-hover/link:text-gray-600 dark:group-hover/link:text-gray-400 transition-colors mt-8">
                          {org.name}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 font-light leading-relaxed min-h-[3rem]">
                          {org.description || 'No description'}
                        </p>
                        <div className="flex items-center gap-6 text-xs text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider">
                          <span>{org._count?.projects || 0} Projects</span>
                          <span>{org.members?.length || 0} Members</span>
                        </div>
                      </Link>
                      <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="h-8 w-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-[#1c2128] transition-colors">
                              <MoreVertical size={16} className="text-gray-500 dark:text-gray-400" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d]">
                            <DropdownMenuItem 
                              onSelect={() => handleEdit(org)}
                              className="cursor-pointer focus:bg-gray-50 dark:focus:bg-[#1c2128] text-black dark:text-white"
                            >
                              <Edit2 size={14} className="mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => {
                                setOrgToDelete(org)
                                setDeleteDialogOpen(true)
                              }}
                              className="text-red-600 dark:text-red-400 cursor-pointer focus:bg-red-50 dark:focus:bg-red-900/20"
                            >
                              <Trash2 size={14} className="mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Delete Organization Verification Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              <span className="text-red-600">Delete Organization</span>
            </DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-400">
              This will permanently delete <strong className="text-black dark:text-white">{orgToDelete?.name}</strong> and ALL related data:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded">
              <ul className="text-sm text-red-800 dark:text-red-300 space-y-1 list-disc list-inside">
                <li>All projects and their code</li>
                <li>All builds and generated files</li>
                <li>The organization workspace</li>
                <li>All team members and invitations</li>
                <li>All deployment data</li>
              </ul>
              <p className="text-sm text-red-700 dark:text-red-400 font-medium mt-3">
                This action cannot be undone!
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-black dark:text-white mb-2 block">
                Type the organization name to confirm: <strong>{orgToDelete?.name}</strong>
              </label>
              <Input
                type="text"
                placeholder={orgToDelete?.name}
                value={verificationName}
                onChange={(e) => setVerificationName(e.target.value)}
                className="border-red-200 dark:border-red-800 focus:border-red-400 dark:focus:border-red-600 dark:bg-[#0d1117] dark:text-white"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setDeleteDialogOpen(false)
                  setOrgToDelete(null)
                  setVerificationName('')
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1c2128] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (orgToDelete && verificationName.trim() === orgToDelete.name.trim()) {
                    try {
                      console.log('[Dashboard] Deleting organization:', orgToDelete.id, 'with verification:', verificationName)
                      await deleteOrgMutation.mutateAsync({ 
                        id: orgToDelete.id, 
                        verificationName: verificationName.trim()
                      })
                      // Success - dialog will close via onSuccess
                      // Force refresh the page to ensure UI updates
                      window.location.reload()
                    } catch (error: any) {
                      // Error is handled in onError callback
                      console.error('Delete failed:', error)
                      alert(error.response?.data?.error || error.message || 'Failed to delete organization')
                    }
                  } else {
                    console.warn('[Dashboard] Verification mismatch:', { 
                      expected: orgToDelete?.name, 
                      got: verificationName 
                    })
                  }
                }}
                disabled={verificationName.trim() !== orgToDelete?.name?.trim() || deleteOrgMutation.isPending}
                className="px-4 py-2 text-sm font-medium bg-red-600 dark:bg-red-700 text-white hover:bg-red-700 dark:hover:bg-red-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleteOrgMutation.isPending ? 'Deleting...' : 'Delete Forever'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
