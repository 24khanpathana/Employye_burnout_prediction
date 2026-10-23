'use client'

import { PredictionResult } from '@/lib/api'
import PredictionCard from '../PredictionCard'

interface PredictionsProps {
  loading: boolean;
  results: PredictionResult[];
  handlePredictAll: () => Promise<void>;
}

export default function Predictions({ loading, results, handlePredictAll }: PredictionsProps) {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-gray-900 border border-gray-800 p-5 rounded-2xl gap-4">
        <div>
          <h2 className="text-white font-bold">Run Machine Learning Model</h2>
          <p className="text-gray-400 text-sm mt-1 max-w-xl">
            Pass the latest employee records through the Logistic Regression pipeline to recalculate burnout probabilities.
          </p>
        </div>
        <button
          onClick={handlePredictAll}
          disabled={loading}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-lg transition-colors whitespace-nowrap"
        >
          {loading ? 'Analyzing...' : 'Analyze Records'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {results.map((res) => (
          <PredictionCard
            key={res.employee_id}
            employeeId={res.employee_id}
            name={res.name}
            email={res.email}
            burnoutScore={res.burnout_score}
            riskLevel={res.risk_level}
            promotionStatus={res.promotion_status}
          />
        ))}
        {results.length === 0 && !loading && (
          <div className="col-span-full py-16 text-center text-gray-500 border border-gray-800 rounded-2xl border-dashed">
            No active predictions available. Please run the model or upload your CSV dataset in Settings.
          </div>
        )}
      </div>
    </div>
  )
}
