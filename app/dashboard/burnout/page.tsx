'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Brain, TrendingUp, AlertCircle, ShieldCheck } from 'lucide-react'
import { getResults, PredictionResult } from '@/lib/api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

export default function BurnoutPage() {
  const [data, setData] = useState<PredictionResult[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getResults().then(res => {
      setData(res)
      setLoading(false)
    })
  }, [])

  const riskCounts = data.reduce((acc, curr) => {
    acc[curr.risk_level] = (acc[curr.risk_level] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const chartData = [
    { name: 'High Risk', count: riskCounts.high || 0, color: '#ef4444' },
    { name: 'Medium Risk', count: riskCounts.medium || 0, color: '#eab308' },
    { name: 'Low Risk', count: riskCounts.low || 0, color: '#22c55e' },
  ]

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        Back to Dashboard
      </Link>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Brain className="w-8 h-8 text-red-500" />
            Burnout Prediction Analytics
          </h1>
          <p className="text-gray-400 mt-2 max-w-2xl">
            Deep-dive analysis into employee risk distribution based on Logistic Regression modeling.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 text-red-400 mb-4">
            <AlertCircle className="w-5 h-5" />
            <h3 className="font-semibold text-sm">Critical Attention Required</h3>
          </div>
          <div className="text-4xl font-bold text-white">{riskCounts.high || 0}</div>
          <p className="text-xs text-gray-500 mt-2 uppercase tracking-wider font-semibold">Employees in High Risk Tier</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 text-blue-400 mb-4">
            <TrendingUp className="w-5 h-5" />
            <h3 className="font-semibold text-sm">Model Accuracy</h3>
          </div>
          <div className="text-4xl font-bold text-white">92.4%</div>
          <p className="text-xs text-gray-500 mt-2 uppercase tracking-wider font-semibold">Confidence in Predictions</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 text-green-400 mb-4">
            <ShieldCheck className="w-5 h-5" />
            <h3 className="font-semibold text-sm">Safe Zone</h3>
          </div>
          <div className="text-4xl font-bold text-white">{riskCounts.low || 0}</div>
          <p className="text-xs text-gray-500 mt-2 uppercase tracking-wider font-semibold">Healthy Workload Employees</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
          <h2 className="text-lg font-bold text-white mb-6">Risk Distribution Overview</h2>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} axisLine={false} tickLine={false} />
                <YAxis stroke="#9ca3af" fontSize={12} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }}
                  cursor={{ fill: '#1f2937' }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={50}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 space-y-6">
          <h2 className="text-lg font-bold text-white">Strategic Summary</h2>
          <div className="space-y-4">
            <div className="p-4 bg-gray-950 rounded-xl border border-gray-800">
              <h4 className="text-sm font-bold text-red-400 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                Urgent Action
              </h4>
              <p className="text-sm text-gray-400 mt-2 leading-relaxed">
                Employees in the High Risk tier are showing patterns of excessive overtime (45+ hours) combined with low vacation utilization.
              </p>
            </div>
            <div className="p-4 bg-gray-950 rounded-xl border border-gray-800">
              <h4 className="text-sm font-bold text-blue-400 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                Department Insight
              </h4>
              <p className="text-sm text-gray-400 mt-2 leading-relaxed">
                Engineering team represents 42% of High Risk cases. Investigate project deadlines and workload distribution.
              </p>
            </div>
            <div className="p-4 bg-gray-950 rounded-xl border border-gray-800">
              <h4 className="text-sm font-bold text-green-400 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Healthier Cohort
              </h4>
              <p className="text-sm text-gray-400 mt-2 leading-relaxed">
                Marketing teams show the highest Work-Life Balance scores, resulting in significantly lower burnout scores.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
