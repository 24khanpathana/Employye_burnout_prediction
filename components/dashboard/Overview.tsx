'use client'

import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'
import { Brain, IndianRupee, Network, Activity, ChevronRight } from 'lucide-react'
import DashboardChart from '../DashboardChart'
import { DashboardStats, PredictionResult } from '@/lib/api'

interface OverviewProps {
  stats: DashboardStats | null;
  results: PredictionResult[];
}

export default function Overview({ stats, results }: OverviewProps) {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Module Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/dashboard/burnout" className="group">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-blue-500/50 hover:bg-gray-800/50 hover:scale-[1.02] hover:shadow-2xl hover:shadow-blue-500/10 transition-all cursor-pointer h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Brain className="w-5 h-5 text-red-500" />
                </div>
                <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="text-sm font-medium text-gray-400">Burnout Prediction</h3>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="text-2xl font-bold text-white">{stats?.high_risk || 0}</span>
                <span className="text-xs text-red-500 font-medium font-mono">High Risk Cases</span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-800/50">
              <span className="text-xs text-blue-400 font-medium group-hover:underline">View Analytics</span>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/salary" className="group">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-blue-500/50 hover:bg-gray-800/50 hover:scale-[1.02] hover:shadow-2xl hover:shadow-blue-500/10 transition-all cursor-pointer h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <IndianRupee className="w-5 h-5 text-yellow-500" />
                </div>
                <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="text-sm font-medium text-gray-400">Salary Analytics</h3>
              <div className="mt-2">
                <span className="text-2xl font-bold text-white tracking-tight">{formatCurrency(stats?.avg_salary || 0)}</span>
                <p className="text-xs text-gray-500 mt-1">Average Base Salary</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-800/50">
              <span className="text-xs text-blue-400 font-medium group-hover:underline">View Salary Bias</span>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/patterns" className="group">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-blue-500/50 hover:bg-gray-800/50 hover:scale-[1.02] hover:shadow-2xl hover:shadow-blue-500/10 transition-all cursor-pointer h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Network className="w-5 h-5 text-blue-500" />
                </div>
                <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="text-sm font-medium text-gray-400">Pattern Discovery</h3>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="text-2xl font-bold text-white">{stats?.patterns_found || 0}</span>
                <span className="text-xs text-gray-400 font-medium font-mono">Heuristics Detected</span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-800/50">
              <span className="text-xs text-blue-400 font-medium group-hover:underline">Explore Patterns</span>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/health" className="group">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-blue-500/50 hover:bg-gray-800/50 hover:scale-[1.02] hover:shadow-2xl hover:shadow-blue-500/10 transition-all cursor-pointer h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Activity className="w-5 h-5 text-green-500" />
                </div>
                <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="text-sm font-medium text-gray-400">Company Health</h3>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-2xl font-bold text-white">{stats?.health_score || 0}</span>
                <span className="text-lg text-gray-500 font-medium">/100</span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-800/50 space-y-3">
              <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-green-500 h-full transition-all duration-1000" 
                  style={{ width: `${stats?.health_score || 0}%` }}
                />
              </div>
              <span className="text-xs text-blue-400 font-medium group-hover:underline block">View Company Health</span>
            </div>
          </div>
        </Link>
      </div>

      <DashboardChart data={results} />
    </div>
  )
}
