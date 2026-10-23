import { ArrowRight, ShieldCheck, BarChart3, BrainCircuit, Users, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const featureList = [
  'Burnout Prediction',
  'Sentiment Analysis',
  'Employee Retention',
  'Test Management',
  'Performance Analytics',
  'Attendance',
  'Task Management',
  'Employee Analytics'
];

function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 font-bold text-white">B</div>
          <div>
            <div className="text-xl font-bold">BurnoutGuard</div>
          </div>
        </div>
        <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
          <a href="#features">Features</a>
          <a href="#how-it-works">How It Works</a>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-7xl gap-10 px-6 py-16 md:grid-cols-2 md:items-center">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-500/40 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-200">
              <ShieldCheck size={14} /> Enterprise HR intelligence
            </div>
            <h1 className="max-w-xl text-5xl font-bold leading-tight text-white md:text-6xl">
              Predict Employee Burnout<br />Before It Happens
            </h1>
            <p className="mt-6 max-w-lg text-lg text-slate-300">
              Use AI-powered analytics to understand employee well-being, identify burnout and attrition risks, analyze sentiment, and make informed workforce decisions.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link className="btn-primary inline-flex items-center gap-2" to="/login/admin">
                Admin Login <ArrowRight size={16} />
              </Link>
              <Link className="btn-secondary" to="/login/employee">Employee Login</Link>
              <Link className="btn-secondary" to="/register">New Employee Registration</Link>
            </div>
          </div>

          <div className="card p-6">
            <p className="mb-4 text-xs text-slate-400">Illustrative demo metrics — not actual organizational results</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-700 bg-slate-800 p-4">
                <BrainCircuit className="mb-3 text-blue-400" />
                <div className="text-2xl font-bold">84%</div>
                <div className="text-sm text-slate-300">Burnout risk projection</div>
              </div>
              <div className="rounded-2xl border border-slate-700 bg-slate-800 p-4">
                <BarChart3 className="mb-3 text-emerald-400" />
                <div className="text-2xl font-bold">32%</div>
                <div className="text-sm text-slate-300">Retention improvement</div>
              </div>
              <div className="rounded-2xl border border-slate-700 bg-slate-800 p-4 sm:col-span-2">
                <Users className="mb-3 text-violet-400" />
                <div className="text-2xl font-bold">Employee wellbeing</div>
                <div className="mt-2 text-sm text-slate-300">Dashboards, AI predictions, and action-ready HR reporting.</div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-7xl px-6 py-10">
          <h2 className="mb-8 text-3xl font-bold text-white">Features</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {featureList.map((feature) => (
              <div key={feature} className="card p-5">
                <CheckCircle2 className="mb-3 text-emerald-400" size={18} />
                <div className="font-semibold text-slate-200">{feature}</div>
              </div>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="mx-auto max-w-7xl px-6 py-16">
          <h2 className="mb-8 text-3xl font-bold text-white">How It Works</h2>
          <div className="grid gap-6 md:grid-cols-4">
            {[
              'Upload Employee Data',
              'Run AI Analysis',
              'View Predictions',
              'Take Action'
            ].map((step, index) => (
              <div key={step} className="card p-5">
                <div className="mb-4 text-sm font-semibold text-blue-300">0{index + 1}</div>
                <div className="text-lg font-semibold text-white">{step}</div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default LandingPage;
