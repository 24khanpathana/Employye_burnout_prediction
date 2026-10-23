'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import {
  Shield, Brain, TrendingUp, Users, Zap,
  ArrowRight, Check, ChevronRight, Activity, AlertTriangle,
  IndianRupee, Network
} from 'lucide-react'

// Keep the existing data structures
const riskTableData = [
  { id: 'EMP-001', dept: 'Engineering', risk: 'High', score: 87 },
  { id: 'EMP-042', dept: 'Sales', risk: 'High', score: 82 },
  { id: 'EMP-108', dept: 'Marketing', risk: 'Medium', score: 65 },
  { id: 'EMP-079', dept: 'HR', risk: 'Low', score: 31 },
  { id: 'EMP-203', dept: 'Finance', risk: 'Medium', score: 58 },
]

const stats = [
  { value: '76%', label: 'Employees face burnout', icon: AlertTriangle, color: 'text-red-500' },
  { value: '₹26 Lakh Cr', label: 'Lost annually worldwide', icon: IndianRupee, color: 'text-yellow-500' },
  { value: '3×', label: 'More likely to quit', icon: TrendingUp, color: 'text-blue-500' },
]

const features = [
  {
    icon: Brain,
    title: 'Burnout Prediction',
    desc: 'Logistic Regression model trained on 10k+ employees identifies high-risk individuals with 92% accuracy.',
    color: 'text-blue-500 bg-blue-500/10',
  },
  {
    icon: IndianRupee,
    title: 'Salary Analytics',
    desc: 'Deep dive into pay equity, compensation trends, and salary-burnout correlations by department.',
    color: 'text-yellow-500 bg-yellow-500/10',
  },
  {
    icon: Network,
    title: 'Pattern Discovery',
    desc: 'Apriori algorithm uncovers hidden behavioral patterns like "High Overtime + Low Pay → Burnout".',
    color: 'text-red-500 bg-red-500/10',
  },
  {
    icon: Activity,
    title: 'Company Health Score',
    desc: 'Composite 0–100 score tracking salary fairness, work-life balance, culture, and growth.',
    color: 'text-green-500 bg-green-500/10',
  },
]

const steps = [
  { n: '01', title: 'Upload Employee Data', desc: 'Import HR records via CSV or connect your HRIS system.' },
  { n: '02', title: 'Run ML Analysis', desc: 'Logistic Regression and Apriori algorithms process your data instantly.' },
  { n: '03', title: 'View Predictions', desc: 'Get risk scores, feature importance, and behavioral patterns.' },
  { n: '04', title: 'Take Action', desc: 'Receive priority recommendations and track health improvements.' },
]


function RiskBadge({ risk }: { risk: string }) {
  const colors: Record<string, string> = {
    High: 'bg-red-500/15 text-red-500 border-red-500/30',
    Medium: 'bg-yellow-500/15 text-yellow-500 border-yellow-500/30',
    Low: 'bg-green-500/15 text-green-500 border-green-500/30',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${colors[risk]}`}>
      {risk}
    </span>
  )
}

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* ── Navbar ── */}
      <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? 'bg-gray-950/95 backdrop-blur-xl border-b border-gray-800 shadow-sm' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Shield className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight text-white">BurnoutGuard</span>
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm text-gray-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <button className="px-3 py-1.5 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 rounded-md transition-colors">
                Login
              </button>
            </Link>
            <Link href="/login">
              <button className="flex items-center gap-1.5 px-4 py-1.5 bg-white text-gray-950 hover:bg-gray-200 text-sm font-semibold rounded-md shadow-sm transition-colors">
                Get Started <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="pt-32 pb-20 px-4 sm:px-6 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded-full">
              <Zap className="w-3.5 h-3.5" /> Powered by Logistic Regression & Apriori
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight text-white">
              Predict Employee Burnout{' '}
              <span className="text-blue-500">Before It Happens</span>
            </h1>
            <p className="text-lg text-gray-400 leading-relaxed max-w-lg">
              BurnoutGuard uses machine learning to identify at-risk employees, uncover hidden patterns,
              and give HR teams the insights they need to build healthier, more resilient workplaces.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/dashboard">
                <button className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-lg shadow-blue-600/25 transition-all">
                  Launch Dashboard <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
              <Link href="/login">
                <button className="flex items-center justify-center gap-2 px-6 py-3 bg-transparent border border-gray-700 hover:bg-gray-800 text-white font-semibold rounded-lg transition-all">
                  <Users className="w-4 h-4" /> View Demo
                </button>
              </Link>
            </div>
          </div>

          {/* Hero Card — Mini Dashboard Preview */}
          <div className="relative animate-in fade-in duration-1000 delay-300">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-transparent rounded-2xl blur-3xl" />
            <div className="relative rounded-2xl border border-gray-800 bg-gray-900 shadow-2xl overflow-hidden">
              <div className="border-b border-gray-800 px-5 py-3 flex items-center justify-between bg-gray-950 overflow-hidden">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/70" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                    <div className="w-3 h-3 rounded-full bg-green-500/70" />
                  </div>
                  <span className="text-xs text-gray-400 ml-2 font-medium">BurnoutGuard — Risk Overview</span>
                </div>
                <span className="bg-green-500/10 text-green-500 border border-green-500/30 text-xs px-2 py-0.5 rounded font-medium">Live</span>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'High Risk', val: 23, color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/20' },
                    { label: 'Medium Risk', val: 47, color: 'text-yellow-500', bg: 'bg-yellow-500/10 border-yellow-500/20' },
                    { label: 'Low Risk', val: 180, color: 'text-green-500', bg: 'bg-green-500/10 border-green-500/20' },
                  ].map(m => (
                    <div key={m.label} className={`rounded-xl border p-3 text-center ${m.bg}`}>
                      <div className={`text-2xl font-bold ${m.color}`}>{m.val}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{m.label}</div>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl border border-gray-800 overflow-hidden">
                  <div className="bg-gray-950 px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Recent High-Risk Alerts
                  </div>
                  <table className="w-full text-sm">
                    <tbody>
                      {riskTableData.map((row, i) => (
                        <tr key={i} className="border-t border-gray-800 hover:bg-gray-800/50 transition-colors">
                          <td className="px-4 py-2.5 font-mono text-xs text-gray-400">{row.id}</td>
                          <td className="px-2 py-2.5 text-xs text-gray-300">{row.dept}</td>
                          <td className="px-2 py-2.5"><RiskBadge risk={row.risk} /></td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 rounded-full bg-gray-800 overflow-hidden relative">
                                <div
                                  className={`absolute left-0 top-0 bottom-0 rounded-full ${row.risk === 'High' ? 'bg-red-500' : row.risk === 'Medium' ? 'bg-yellow-500' : 'bg-green-500'}`}
                                  style={{ width: `${row.score}%` }}
                                />
                              </div>
                              <span className="text-xs font-semibold w-8 text-right text-white">{row.score}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Problem Stats ── */}
      <section className="py-16 border-y border-gray-800 bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {stats.map((s, i) => (
              <div key={i} className="flex items-center gap-5 justify-center">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center bg-gray-800 border border-gray-700`}>
                  <s.icon className={`w-7 h-7 ${s.color}`} />
                </div>
                <div>
                  <div className={`text-4xl font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-sm text-gray-400 mt-0.5">{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-24 px-4 sm:px-6 max-w-7xl mx-auto">
        <div className="text-center mb-16 space-y-4">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
            Platform Features
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-white">Everything HR Teams Need</h2>
          <p className="text-gray-400 max-w-xl mx-auto">
            From raw data to actionable insights — powered by proven ML algorithms.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f, i) => (
            <div key={i} className="group rounded-2xl border border-gray-800 bg-gray-900 p-6 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${f.color}`}>
                <f.icon className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg mb-2 text-white group-hover:text-blue-400 transition-colors">{f.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="py-24 border-y border-gray-800 bg-gray-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16 space-y-4">
             <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
              Process
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white">How BurnoutGuard Works</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((s, i) => (
              <div key={i} className="relative">
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-full w-full h-px bg-gradient-to-r from-gray-800 to-transparent z-0" />
                )}
                <div className="relative z-10 rounded-2xl border border-gray-800 bg-gray-900 p-6">
                  <div className="text-4xl font-black text-blue-500/20 mb-3">{s.n}</div>
                  <h3 className="font-bold mb-2 text-white">{s.title}</h3>
                  <p className="text-sm text-gray-400">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ── CTA Banner ── */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center rounded-3xl bg-blue-600 p-16 shadow-2xl shadow-blue-600/30 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-blue-700 opacity-80" />
          <div className="relative z-10">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Ready to Protect Your Team?
            </h2>
            <p className="text-blue-100 mb-8 max-w-lg mx-auto">
              Join thousands of HR professionals using BurnoutGuard to build healthier, more engaged workplaces.
            </p>
            <Link href="/dashboard">
              <button className="inline-flex items-center justify-center bg-white text-blue-700 hover:bg-gray-50 gap-2 shadow-lg px-8 py-3 rounded-lg font-bold transition-colors">
                Launch Dashboard <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-800 bg-gray-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-10">
            <div className="col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
                  <Shield className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="font-bold text-white">BurnoutGuard</span>
              </div>
              <p className="text-sm text-gray-500 max-w-xs">
                AI-powered employee burnout prediction using Logistic Regression and Apriori pattern mining.
              </p>
            </div>
            {[
              { heading: 'Product', links: ['Features', 'Security', 'Changelog'] },
              { heading: 'Company', links: ['About', 'Blog', 'Careers', 'Press'] },
              { heading: 'Legal', links: ['Privacy', 'Terms', 'Cookies'] },
            ].map((col) => (
              <div key={col.heading}>
                <h4 className="font-semibold text-white mb-4 text-sm">{col.heading}</h4>
                <ul className="space-y-2.5">
                  {col.links.map(l => (
                    <li key={l}>
                      <a href="#" className="text-sm text-gray-500 hover:text-white transition-colors">{l}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
            <span>© 2026 BurnoutGuard. All rights reserved.</span>
            <div className="flex gap-6">
              {['Twitter', 'LinkedIn', 'GitHub'].map(s => (
                <a key={s} href="#" className="hover:text-white transition-colors">{s}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
