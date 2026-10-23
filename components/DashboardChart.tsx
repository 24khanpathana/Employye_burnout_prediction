'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts'
import { PredictionResult } from '@/lib/api'

interface DashboardChartProps {
  data: PredictionResult[]
}

export default function DashboardChart({ data }: DashboardChartProps) {
  // Process data for the chart: Aggregate by risk level
  const riskCounts = data.reduce((acc, curr) => {
    acc[curr.risk_level] = (acc[curr.risk_level] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const chartData = [
    { name: 'Low Risk', value: riskCounts.low || 0, color: '#22c55e' }, // green-500
    { name: 'Medium Risk', value: riskCounts.medium || 0, color: '#eab308' }, // yellow-500
    { name: 'High Risk', value: riskCounts.high || 0, color: '#ef4444' }, // red-500
  ]

  if (data.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 h-[400px] flex items-center justify-center text-gray-400 text-sm">
        No prediction data available. Upload a CSV to get started.
      </div>
    )
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full">
      <h3 className="text-white font-semibold mb-6">Burnout Risk Distribution</h3>
      
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
            <XAxis 
              dataKey="name" 
              stroke="#9ca3af" 
              fontSize={12} 
              tickLine={false} 
              axisLine={false} 
            />
            <YAxis 
              stroke="#9ca3af" 
              fontSize={12} 
              tickLine={false} 
              axisLine={false} 
            />
            <RechartsTooltip 
              cursor={{ fill: '#374151', opacity: 0.4 }}
              contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '0.5rem', color: '#fff' }}
              itemStyle={{ color: '#fff' }}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={60}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      <div className="flex justify-center gap-6 mt-6 border-t border-gray-800 pt-4">
        {chartData.map(item => (
          <div key={item.name} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-sm text-gray-300">{item.name} ({item.value})</span>
          </div>
        ))}
      </div>
    </div>
  )
}
