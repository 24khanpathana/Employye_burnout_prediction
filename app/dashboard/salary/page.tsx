'use client'

import Link from 'next/link'
import { ArrowLeft, IndianRupee, TrendingDown, Target, Wallet } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'

export default function SalaryPage() {
  // Mock data for salary correlation
  const correlationData = [
    { salary: 30000, burnout: 85 },
    { salary: 45000, burnout: 78 },
    { salary: 60000, burnout: 62 },
    { salary: 75000, burnout: 45 },
    { salary: 90000, burnout: 32 },
    { salary: 120000, burnout: 28 },
    { salary: 150000, burnout: 25 },
  ]

  const equityData = [
    { dept: 'Engineering', avg: 95000 },
    { dept: 'Sales', avg: 110000 },
    { dept: 'Marketing', avg: 72000 },
    { dept: 'HR', avg: 65000 },
    { dept: 'Finance', avg: 88000 },
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
            <IndianRupee className="w-8 h-8 text-yellow-500" />
            Salary Analytics
          </h1>
          <p className="text-gray-400 mt-2 max-w-2xl">
            Correlating compensation packages with employee fatigue and retention potential.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 text-yellow-500 mb-4">
            <Wallet className="w-5 h-5" />
            <h3 className="font-semibold text-sm">Avg Company CTC</h3>
          </div>
          <div className="text-3xl font-bold text-white">{formatCurrency(82500)}</div>
          <p className="text-xs text-gray-500 mt-2 uppercase tracking-wider font-semibold">Across all Departments</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 text-green-500 mb-4">
            <TrendingDown className="w-5 h-5" />
            <h3 className="font-semibold text-sm">Retention Correlation</h3>
          </div>
          <div className="text-3xl font-bold text-white">-0.64</div>
          <p className="text-xs text-gray-500 mt-2 uppercase tracking-wider font-semibold">Higher Salary = Lower Burnout</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 text-blue-500 mb-4">
            <Target className="w-5 h-5" />
            <h3 className="font-semibold text-sm">Market Benchmarking</h3>
          </div>
          <div className="text-3xl font-bold text-white">+12%</div>
          <p className="text-xs text-gray-500 mt-2 uppercase tracking-wider font-semibold">Above Industry Average</p>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-3xl overflow-hidden p-8">
        <h2 className="text-lg font-bold text-white mb-2">Burnout vs. Salary Correlation</h2>
        <p className="text-sm text-gray-500 mb-8">Visualizing how compensation levels impact employee fatigue scores.</p>
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={correlationData} margin={{ left: -10 }}>
              <defs>
                <linearGradient id="colorBurnout" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#eab308" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#eab308" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
              <XAxis dataKey="salary" stroke="#9ca3af" fontSize={12} axisLine={false} tickLine={false} tickFormatter={(val) => `₹${val/1000}k`} />
              <YAxis stroke="#9ca3af" fontSize={12} axisLine={false} tickLine={false} label={{ value: 'Burnout Score', angle: -90, position: 'insideLeft', fill: '#6b7280', offset: 20 }} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '12px' }}
                formatter={(val: number) => [`${val}/100`, 'Burnout Score']}
                labelFormatter={(label) => `Salary: ₹${label}`}
              />
              <Area type="monotone" dataKey="burnout" stroke="#eab308" fillOpacity={1} fill="url(#colorBurnout)" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h3 className="text-white font-bold mb-4">Salary Bias Check</h3>
          <div className="space-y-4">
            {equityData.map(d => (
              <div key={d.dept} className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-gray-400">{d.dept}</span>
                  <span className="text-white">{formatCurrency(d.avg)}</span>
                </div>
                <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-yellow-500 h-full rounded-full" style={{ width: `${(d.avg / 110000) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col justify-center">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-yellow-500/20">
               <Target className="w-8 h-8 text-yellow-500" />
            </div>
            <h3 className="text-xl font-bold text-white tracking-tight">Financial Health Indicator</h3>
            <p className="text-sm text-gray-400 max-w-xs mx-auto">
              Our model indicates that increasing salaries by <span className="text-white font-bold">₹5,000</span> for employees in the high-stress tier could reduce turnover risk by <span className="text-green-500 font-bold">14.2%</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
