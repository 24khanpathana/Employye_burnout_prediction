interface PredictionCardProps {
  name: string
  email: string
  burnoutScore: number
  riskLevel: 'low' | 'medium' | 'high'
  employeeId: string
  promotionStatus: string
}

export default function PredictionCard({ name, email, burnoutScore, riskLevel, employeeId, promotionStatus }: PredictionCardProps) {
  const riskConfig = {
    high:   { label: 'High Risk',   bg: 'bg-red-100 text-red-800',    bar: 'bg-red-500',    border: 'border-red-200' },
    medium: { label: 'Medium Risk', bg: 'bg-yellow-100 text-yellow-800', bar: 'bg-yellow-500', border: 'border-yellow-200' },
    low:    { label: 'Low Risk',    bg: 'bg-green-100 text-green-800', bar: 'bg-green-500',   border: 'border-green-200' },
  }
  const config = riskConfig[riskLevel]

  return (
    <div className={`bg-gray-900 border ${config.border} rounded-xl p-4 hover:shadow-lg transition-shadow`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-white font-semibold text-sm">{name}</h3>
          <p className="text-gray-400 text-xs mt-0.5">{email}</p>
        </div>
        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${config.bg}`}>
          {config.label}
        </span>
      </div>

      {/* Score Bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-xs">Burnout Score</span>
          <span className="text-white text-xs font-bold">{burnoutScore}%</span>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${config.bar}`}
            style={{ width: `${burnoutScore}%` }}
          />
        </div>
      </div>

      {/* Extended Info */}
      <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-800">
        <p className="text-gray-600 text-xs font-mono">{employeeId.startsWith('EMP') ? employeeId : `EMP-${String(employeeId).padStart(3, '0')}`}</p>
        <span className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${
          promotionStatus === 'Recommended' ? 'bg-indigo-500/10 text-indigo-400' :
          promotionStatus === 'On Track' ? 'bg-blue-500/10 text-blue-400' :
          'bg-gray-800 text-gray-500'
        }`}>
          {promotionStatus}
        </span>
      </div>
    </div>
  )
}
