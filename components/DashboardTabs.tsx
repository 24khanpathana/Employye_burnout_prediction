'use client'

import { useState, useEffect } from 'react'
import { getResults, getDashboardStats, runPredictions, PredictionResult, DashboardStats } from '@/lib/api'
import { AlertTriangle, Loader2 } from 'lucide-react'

// Import modular components
import Overview from './dashboard/Overview'
import Employees from './dashboard/Employees'
import Predictions from './dashboard/Predictions'
import Settings from './dashboard/Settings'

export default function DashboardTabs() {
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [results, setResults] = useState<PredictionResult[]>([])
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [res, st] = await Promise.all([
        getResults(),
        getDashboardStats()
      ])
      setResults(res)
      setStats(st)
    } catch (err: any) {
      setError('Failed to load data from backend. Make sure the FastAPI server is running.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handlePredictAll = async () => {
    setLoading(true)
    try {
      const predictionResponse = await runPredictions()
      console.log('Prediction Results:', predictionResponse)
      await fetchData()
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'employees', label: 'Employees' },
    { id: 'predictions', label: 'Predictions' },
    { id: 'settings', label: 'Settings' }
  ]

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800 pb-4">
        <h1 className="text-2xl font-bold text-white tracking-tight">Dashboard</h1>
        <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-800 w-max overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="h-64 flex flex-col items-center justify-center text-gray-500">
          <Loader2 className="w-8 h-8 animate-spin mb-4 text-blue-600" />
          Loading dashboard data...
        </div>
      )}

      {/* --- MODULAR VIEWS --- */}
      {!loading && activeTab === 'overview' && (
        <Overview stats={stats} results={results} />
      )}

      {!loading && activeTab === 'employees' && (
        <Employees results={results} />
      )}

      {!loading && activeTab === 'predictions' && (
        <Predictions 
          loading={loading} 
          results={results} 
          handlePredictAll={handlePredictAll} 
        />
      )}

      {!loading && activeTab === 'settings' && (
        <Settings fetchData={fetchData} />
      )}
    </div>
  )
}
