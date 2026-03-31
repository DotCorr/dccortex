/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

'use client'

import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { useSession } from 'next-auth/react'
import { User, Mail, Key, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function SettingsPage() {
  const { data: session } = useSession()

  return (
    <DashboardLayout>
      <div className="space-y-6 sm:space-y-8">
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-medium mb-2 text-black dark:text-white tracking-tighter">Settings</h1>
          <p className="text-gray-500 dark:text-gray-400 text-base sm:text-lg font-light">Manage your account and preferences</p>
        </div>

        {/* Profile Settings */}
        <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] p-4 sm:p-6 lg:p-10 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <User size={20} className="sm:w-6 sm:h-6 text-black" />
            <h2 className="text-xl sm:text-2xl font-medium text-black">Profile</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-black">Name</label>
              <input
                type="text"
                defaultValue={session?.user?.name || ''}
                className="w-full px-4 py-2.5 bg-white border border-gray-200 focus:outline-none focus:border-gray-400 transition-colors"
                placeholder="Your name"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2 text-black">Email</label>
              <div className="flex items-center gap-2">
                <input
                  type="email"
                  defaultValue={session?.user?.email || ''}
                  disabled
                  className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 text-gray-500"
                />
                <Mail size={18} className="text-gray-400" />
              </div>
              <p className="mt-1 text-xs text-gray-500">Email cannot be changed</p>
            </div>

            <div className="pt-4">
              <Button>
                Save Changes
              </Button>
            </div>
          </div>
        </div>

        {/* Security Settings */}
        <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] p-4 sm:p-6 lg:p-10 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <Key size={20} className="sm:w-6 sm:h-6 text-black dark:text-white" />
            <h2 className="text-xl sm:text-2xl font-medium text-black dark:text-white">Security</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-black dark:text-white">Current Password</label>
              <input
                type="password"
                className="w-full px-4 py-2.5 bg-white dark:bg-[#0d1117] text-black dark:text-white border border-gray-200 dark:border-[#30363d] focus:outline-none focus:border-gray-400 dark:focus:border-[#58a6ff] transition-colors"
                placeholder="Enter current password"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2 text-black dark:text-white">New Password</label>
              <input
                type="password"
                className="w-full px-4 py-2.5 bg-white dark:bg-[#0d1117] text-black dark:text-white border border-gray-200 dark:border-[#30363d] focus:outline-none focus:border-gray-400 dark:focus:border-[#58a6ff] transition-colors"
                placeholder="Enter new password"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-black dark:text-white">Confirm New Password</label>
              <input
                type="password"
                className="w-full px-4 py-2.5 bg-white dark:bg-[#0d1117] text-black dark:text-white border border-gray-200 dark:border-[#30363d] focus:outline-none focus:border-gray-400 dark:focus:border-[#58a6ff] transition-colors"
                placeholder="Confirm new password"
              />
            </div>

            <div className="pt-4">
              <Button>
                Update Password
              </Button>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] p-4 sm:p-6 lg:p-10 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <Bell size={20} className="sm:w-6 sm:h-6 text-black dark:text-white" />
            <h2 className="text-xl sm:text-2xl font-medium text-black dark:text-white">Notifications</h2>
          </div>
          
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                defaultChecked
                className="w-4 h-4 border-gray-200"
              />
              <span className="text-sm text-black dark:text-white">Email notifications for deployments</span>
            </label>
            
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                defaultChecked
                className="w-4 h-4 border-gray-200"
              />
              <span className="text-sm text-black dark:text-white">Email notifications for errors</span>
            </label>
            
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 border-gray-200"
              />
              <span className="text-sm text-black dark:text-white">Weekly summary emails</span>
            </label>

            <div className="pt-4">
              <Button>
                Save Preferences
              </Button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

