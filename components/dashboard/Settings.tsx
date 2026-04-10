'use client'

import EmployeeForm from '../EmployeeForm'

interface SettingsProps {
  fetchData: () => Promise<void>;
}

export default function Settings({ fetchData }: SettingsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-300">
      <EmployeeForm onSuccess={fetchData} />
      
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-bold text-white mb-4">Pipeline Configuration</h2>
        <p className="text-gray-400 text-sm mb-4">
          Upload your employee records utilizing the standard <code className="bg-gray-800 px-1 rounded text-red-400 font-bold">15-column schema</code> to seamlessly integrate with the Logistic Regression pipeline.
        </p>
        <div className="p-4 bg-gray-950 rounded-lg border border-gray-800 font-mono text-xs text-gray-300 space-y-1.5 overflow-x-auto whitespace-nowrap">
          <p className="text-blue-400 font-bold"># Expected CSV Header Format</p>
          <p>employee_id,name,salary,working_hours,stress_level,experience,department...</p>
          <p className="text-blue-400 font-bold mt-2 pt-2 border-t border-gray-800"># Sample Row (15 Elements)</p>
          <p>EMP-001,Rajesh Kumar,85000,55,8,3.5,Engineering,4,3,10,4,3,6.5,85,7.5</p>
        </div>
      </div>
    </div>
  )
}
