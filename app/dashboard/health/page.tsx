'use client'

import Link from 'next/link'
import { ArrowLeft, Activity, Heart, Shield, Award, CheckCircle2 } from 'lucide-react'
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts'

export default function HealthPage() {
  const healthMetrics = [
    { subject: 'Work-Life Balance', A: 65, fullMark: 100 },
    { subject: 'Salary Fairness', A: 82, fullMark: 100 },
    { subject: 'Growth Potential', A: 55, fullMark: 100 },
    { subject: 'Management Culture', A: 78, fullMark: 100 },
    { subject: 'Mental Health Support', A: 45, fullMark: 100 },
    { subject: 'Peer Collaboration', A: 90, fullMark: 100 },
  ]

  const stats = [
    { label: 'Overall Score', value: '72/100', color: 'text-green-500', icon: Activity },
    { label: 'Retention Health', value: 'Strong', color: 'text-blue-500', icon: Shield },
    { label: 'Risk Exposure', value: 'Moderate', color: 'text-yellow-500', icon: Heart },
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
            <Activity className="w-8 h-8 text-green-500" />
            Company Health Score
          </h1>
          <p className="text-gray-400 mt-2 max-w-2xl">
            A weighted aggregate indicator of organizational wellness and attrition resilience.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((s, i) => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
             <div className="flex items-center gap-3 text-gray-400 mb-4">
               <s.icon className={`w-5 h-5 ${s.color}`} />
               <h3 className="font-semibold text-sm">{s.label}</h3>
             </div>
             <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-gray-900 border border-gray-800 rounded-3xl p-8 flex flex-col items-center">
          <h2 className="text-lg font-bold text-white mb-8 w-full text-left">Culture Radar Map</h2>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={healthMetrics}>
                <PolarGrid stroke="#374151" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                <Radar
                  name="Organization Health"
                  dataKey="A"
                  stroke="#22c55e"
                  fill="#22c55e"
                  fillOpacity={0.4}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-4">
           <h2 className="text-lg font-bold text-white mb-4">Metric Breakdown</h2>
           <div className="space-y-4">
              {[
                { name: 'Peer Collaboration', score: 90, status: 'Outstanding' },
                { name: 'Salary Fairness', score: 82, status: 'Healthy' },
                { name: 'Management Culture', score: 78, status: 'Healthy' },
                { name: 'Work-Life Balance', score: 65, status: 'Needs Improvement' },
                { name: 'Growth Potential', score: 55, status: 'Critical' },
                { name: 'Mental Health Support', score: 45, status: 'Critical' },
              ].map((m, i) => (
                <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
                   <div className="flex items-center gap-4">
                      <div className={`w-2 h-2 rounded-full ${m.score >= 70 ? 'bg-green-500' : m.score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} />
                      <div>
                        <div className="text-sm font-bold text-white">{m.name}</div>
                        <div className="text-[10px] text-gray-500 uppercase tracking-widest">{m.status}</div>
                      </div>
                   </div>
                   <div className="text-right">
                      <div className="text-lg font-black text-white">{m.score}%</div>
                   </div>
                </div>
              ))}
           </div>
        </div>
      </div>

      <div className="bg-blue-600/5 border border-blue-500/20 rounded-2xl p-8 flex flex-col md:flex-row items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center flex-shrink-0 animate-pulse">
             <Award className="w-8 h-8 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white mb-1 tracking-tight">Recommendation for Improvement</h3>
            <p className="text-sm text-gray-400 leading-relaxed max-w-2xl">
              Focusing on <span className="text-blue-400 font-bold underline underline-offset-4">Mental Health Support</span> (lowest scoring metric) is predicted to improve the overall Health Score by up to 12% within two quarters. Consider implementing wellness programs or counseling subsidies.
            </p>
          </div>
          <button className="flex-shrink-0 bg-white text-blue-600 px-6 py-2.5 rounded-lg font-bold text-sm hover:bg-blue-50 transition-colors flex items-center gap-2">
             <CheckCircle2 className="w-4 h-4" />
             Apply Focus
          </button>
      </div>
    </div>
  )
}
