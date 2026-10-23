'use client'

import { useState, useEffect } from 'react'
import { Loader2, RefreshCw, X, Upload } from 'lucide-react'
import { uploadCSV, uploadFromGoogleSheets } from '@/lib/api'

interface EmployeeFormProps {
  onSuccess: () => void
}

export default function EmployeeForm({ onSuccess }: EmployeeFormProps) {
  const [mode, setMode] = useState<'csv' | 'sheets'>('csv')
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [sheetUrl, setSheetUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<NodeJS.Timeout | null>(null)
  const [dragActive, setDragActive] = useState(false)

  // Auto-refresh Google Sheets every 10 seconds
  useEffect(() => {
    if (autoRefresh && sheetUrl && mode === 'sheets') {
      const interval = setInterval(() => {
        handleSheetSubmit()
      }, 10000)
      setAutoRefreshInterval(interval)
      return () => clearInterval(interval)
    } else if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval)
      setAutoRefreshInterval(null)
    }
  }, [autoRefresh, sheetUrl, mode])

  const convertToCSVUrl = (url: string): string | null => {
    try {
      const match = url.match(/\/d\/(.*?)\//)
      if (!match) return null
      return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`
    } catch {
      return null
    }
  }

  const handleFileChange = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const file = files[0]
    if (!file.name.endsWith('.csv')) {
      setError('Please upload a CSV file')
      return
    }
    setCsvFile(file)
    setError(null)
  }

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    handleFileChange(e.dataTransfer.files)
  }

  const handleCsvSubmit = async () => {
    if (!csvFile) {
      setError('Please select a CSV file')
      return
    }

    setLoading(true)
    setError(null)
    setSuccessMsg(null)

    try {
      const result = await uploadCSV(csvFile)
      setSuccessMsg(`✅ Successfully uploaded ${result.total_employees} employee records. Dashboard will refresh.`)
      setCsvFile(null)
      onSuccess()
    } catch (err: any) {
      setError(err.message || 'Failed to upload CSV. Please check file format and required columns.')
    } finally {
      setLoading(false)
    }
  }

  const handleSheetSubmit = async () => {
    if (!sheetUrl) {
      setError('Please enter a Google Sheets URL')
      return
    }

    const csvUrl = convertToCSVUrl(sheetUrl)
    if (!csvUrl) {
      setError('Invalid Google Sheets URL. Make sure the link is public and in the correct format.')
      return
    }

    setLoading(true)
    setError(null)
    setSuccessMsg(null)

    try {
      const result = await uploadFromGoogleSheets(csvUrl)
      setSuccessMsg(`✅ Successfully fetched ${result.total_employees} employee records from Google Sheets. Dashboard will refresh.`)
      onSuccess()
    } catch (err: any) {
      setError(err.message || 'Failed to fetch from Google Sheets. Ensure: 1) Sheet is public 2) URL is correct 3) CSV format matches required columns')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <h2 className="text-lg font-bold text-white mb-6">Upload Employee Data</h2>

      {/* Mode Toggle */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setMode('csv')}
          className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-colors ${
            mode === 'csv'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          📄 CSV File
        </button>
        <button
          onClick={() => setMode('sheets')}
          className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-colors ${
            mode === 'sheets'
              ? 'bg-green-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          📊 Google Sheets
        </button>
      </div>

      <div className="space-y-4">
        {/* CSV Upload Mode */}
        {mode === 'csv' && (
          <>
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                dragActive
                  ? 'border-blue-400 bg-blue-500/10'
                  : 'border-gray-700 bg-gray-800/30 hover:border-gray-600'
              } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <input
                type="file"
                accept=".csv"
                onChange={(e) => handleFileChange(e.target.files)}
                className="hidden"
                id="csv-input"
                disabled={loading}
              />
              <label htmlFor="csv-input" className="cursor-pointer block">
                <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-300 mb-1">
                  {csvFile ? csvFile.name : 'Drop your CSV file here or click to select'}
                </p>
                <p className="text-xs text-gray-500">
                  CSV should contain columns: employee_id, name, salary, working_hours, stress_level, experience, department, overtime_frequency, work_life_balance_score, leave_taken, performance_rating
                </p>
              </label>
            </div>

            {/* Success Message */}
            {successMsg && (
              <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-400 text-sm rounded-lg">
                {successMsg}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg">
                <p className="font-semibold mb-1">Upload Failed</p>
                <p className="text-xs leading-relaxed">{error}</p>
              </div>
            )}

            {/* Upload Button */}
            <button
              onClick={handleCsvSubmit}
              disabled={!csvFile || loading}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Uploading & Analyzing...' : 'Upload CSV'}
            </button>
          </>
        )}

        {/* Google Sheets Mode */}
        {mode === 'sheets' && (
          <>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">
                Google Sheets URL
                <span className="text-xs text-gray-500 ml-2">(Sheet must be public)</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Paste your Google Sheets link here... (e.g., https://docs.google.com/spreadsheets/d/ABC123...)"
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors"
                  disabled={loading}
                />
                {sheetUrl && (
                  <button
                    onClick={() => setSheetUrl('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-white transition-colors"
                    title="Clear URL"
                    disabled={loading}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500">
                💡 Make sure your Google Sheet is shared publicly (File → Share → "Anyone with link → Viewer")
              </p>
            </div>

            {/* Auto-refresh toggle */}
            <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
              <input
                type="checkbox"
                id="auto-refresh"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                disabled={loading || !sheetUrl}
                className="w-4 h-4 cursor-pointer"
              />
              <label htmlFor="auto-refresh" className="text-sm text-gray-300 cursor-pointer flex-1">
                Auto-refresh every 10 seconds
              </label>
              <RefreshCw className={`w-4 h-4 text-gray-500 ${autoRefresh ? 'animate-spin' : ''}`} />
            </div>

            {/* Success Message */}
            {successMsg && (
              <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-400 text-sm rounded-lg">
                {successMsg}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg">
                <p className="font-semibold mb-1">Failed to fetch</p>
                <p className="text-xs leading-relaxed">{error}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleSheetSubmit}
                disabled={!sheetUrl || loading}
                className="flex-1 py-2.5 px-4 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? 'Fetching & Analyzing...' : 'Fetch from Google Sheets'}
              </button>
              {sheetUrl && !autoRefresh && (
                <button
                  onClick={handleSheetSubmit}
                  disabled={loading}
                  className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-700/50 text-white rounded-lg transition-colors flex items-center gap-2"
                  title="Refresh now"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

