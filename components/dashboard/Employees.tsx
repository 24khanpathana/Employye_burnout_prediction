'use client'

import { PredictionResult } from '@/lib/api'
import { useState } from 'react'
import { Search } from 'lucide-react'

interface EmployeesProps {
  results: PredictionResult[];
}

export default function Employees({ results }: EmployeesProps) {
  const [searchTerm, setSearchTerm] = useState('')

  const filtered = results.filter(emp => 
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Workforce Records</h2>
          <p className="text-gray-400 text-sm">Review burnout risk levels across all predicted staff.</p>
        </div>
        
        <div className="relative">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="Search employees..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-gray-900 border border-gray-800 text-white text-sm rounded-lg pl-10 pr-4 py-2 w-full sm:w-64 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-400">
            <thead className="bg-gray-950 border-b border-gray-800 text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-4 text-gray-300">Employee Name</th>
                <th className="px-6 py-4 text-gray-300">Contact / ID</th>
                <th className="px-6 py-4 text-center text-gray-300">Burnout Score</th>
                <th className="px-6 py-4 text-gray-300">Risk Assessment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.map((emp, i) => (
                <tr key={i} className="hover:bg-gray-800/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-white">
                    {emp.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                    {emp.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className="font-mono text-white">{emp.burnout_score}</span>
                    <span className="text-gray-500 text-xs ml-1">/100</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2.5 py-1 text-[10px] uppercase tracking-wider font-bold rounded-full border ${
                      emp.risk_level === 'high' ? 'bg-red-500/10 text-red-500 border-red-500/30' :
                      emp.risk_level === 'medium' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30' :
                      'bg-green-500/10 text-green-500 border-green-500/30'
                    }`}>
                      {emp.risk_level} Base
                    </span>
                  </td>
                </tr>
              ))}
              
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    No records found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
