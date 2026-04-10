'use client'

import Link from 'next/link'
import { ArrowLeft, Network, Zap, CornerDownRight, AlertTriangle, Lightbulb } from 'lucide-react'

export default function PatternsPage() {
  const patterns = [
    { 
      title: 'The Overload Loop', 
      logic: 'Working Hours > 55 + High Stress', 
      impact: '89% Burnout Probability',
      severity: 'High',
      desc: 'Employees exceeding 55 hours weekly with self-reported high stress levels are almost guaranteed to reach fatigue within 3 months.'
    },
    { 
      title: 'The Junior Crunch', 
      logic: 'Experience < 2 Years + 5+ Projects', 
      impact: '72% Burnout Probability',
      severity: 'Medium',
      desc: 'Early-career professionals assigned to more than 5 concurrent projects show rapid decline in performance ratings.'
    },
    { 
      title: 'The Vacation Gap', 
      logic: 'Leave Taken < 5 Days + 1 Year Tenure', 
      impact: '64% Burnout Probability',
      severity: 'Medium',
      desc: 'A direct correlation exists between minimal leave utilization and increased sick day frequency in the following quarter.'
    },
    { 
      title: 'The Bonus Buffer', 
      logic: 'High Salary + Performance > 4', 
      impact: '12% Burnout Probability',
      severity: 'Low',
      desc: 'High compensation acts as a significant psychological buffer against high workloads for top performers.'
    }
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
            <Network className="w-8 h-8 text-blue-500" />
            Pattern Discovery
          </h1>
          <p className="text-gray-400 mt-2 max-w-2xl">
            Uncovering hidden behavioral correlations using the Apriori association rule mining algorithm.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="bg-blue-600 rounded-2xl p-6 text-white col-span-1 lg:col-span-3">
           <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                  <Zap className="w-5 h-5 fill-white" />
                  Real-time Pattern Detection Active
                </h3>
                <p className="text-blue-100 text-sm max-w-xl">
                  Our algorithm continuously scans your HR dataset for recurring attribute combinations that lead to burnout. These "rules" help predict risk even before the ML model scores an individual.
                </p>
              </div>
              <div className="hidden sm:block text-5xl font-black opacity-20 select-none">AI</div>
           </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col justify-center text-center">
            <div className="text-2xl font-bold text-white">14</div>
            <p className="text-xs text-gray-500 uppercase font-bold tracking-widest mt-1">Rules Identified</p>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-white font-bold text-xl flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-yellow-500" />
          Discovered Heuristics
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {patterns.map((p, i) => (
            <div key={i} className="group bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-blue-500/30 transition-all">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-bold text-white group-hover:text-blue-400 transition-colors">{p.title}</h4>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-widest ${
                  p.severity === 'High' ? 'bg-red-500/10 text-red-500 border-red-500/30' :
                  p.severity === 'Medium' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30' :
                  'bg-green-500/10 text-green-500 border-green-500/30'
                }`}>
                  {p.severity} Priority
                </span>
              </div>
              
              <div className="bg-gray-950 rounded-lg p-3 border border-gray-800 mb-4 font-mono text-xs flex items-center gap-2">
                 <CornerDownRight className="w-3.5 h-3.5 text-blue-500" />
                 <span className="text-gray-300">IF <span className="text-blue-400 font-bold">{p.logic}</span></span>
              </div>

              <div className="flex items-center gap-2 mb-3">
                 <AlertTriangle className={`w-4 h-4 ${p.severity === 'High' ? 'text-red-500' : 'text-yellow-500'}`} />
                 <span className="text-sm font-bold text-white">{p.impact}</span>
              </div>

              <p className="text-xs text-gray-500 leading-relaxed">
                {p.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 border-dashed flex flex-col items-center justify-center text-center space-y-3">
          <p className="text-sm text-gray-500 italic max-w-md">
            "Association rule mining helps us identify structural issues in team management that a standard row-by-row prediction might miss."
          </p>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">— System Insights Engine</p>
      </div>
    </div>
  )
}
