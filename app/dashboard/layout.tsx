'use client'

import Link from 'next/link'
import { Shield, LogOut } from 'lucide-react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Top Header */}
      <header className="border-b border-gray-800 bg-gray-950 sticky top-0 z-40">
        <div className="flex h-16 items-center justify-between max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-bold tracking-tight">BurnoutGuard</span>
          </Link>
          <Link
            href="/login"
            className="flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto">
        <div className="w-full max-w-6xl mx-auto">
          <div className="py-6 px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
