import { useEffect, useMemo, useState } from 'react';
import { Activity, Bell, Brain, Building2, Check, ChevronRight, ClipboardCheck, ClipboardList, Download, FileText, History, LayoutDashboard, ListTodo, LogOut, Menu, RefreshCw, Search, Settings, Shield, Upload, Users, X } from 'lucide-react';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import TestManagementPage from './TestManagementPage';
import DepartmentManagementPage from './DepartmentManagementPage';
import RegistrationRequestsPage from './RegistrationRequestsPage';
import OperationsPage from './OperationsPage';
import AuditLogsPage from './AuditLogsPage';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const navigation = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Employees', icon: Users },
  { label: 'Departments', icon: Building2 },
  { label: 'Registration Requests', icon: ClipboardCheck },
  { label: 'Tests', icon: ClipboardList },
  { label: 'Tasks & Attendance', icon: ListTodo },
  { label: 'Predictions', icon: Activity },
  { label: 'Audit Log', icon: History },
  { label: 'Settings', icon: Settings }
];

function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState('Overview');
  const [dashboard, setDashboard] = useState({ stats: {}, employees: [], requests: [], notifications: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const loadDashboard = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('burnoutguard_token');
      const response = await fetch(`${API_URL}/api/admin/dashboard`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error('Unable to load admin data.');
      setDashboard(await response.json());
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDashboard(); }, []);

  const stats = dashboard.stats || {};
  const employees = dashboard.employees || [];
  const requests = dashboard.requests || [];
  const notifications = useMemo(() => [...(dashboard.notifications || []), ...requests.filter((request) => request.status === 'PENDING').map((request) => ({
    id: request.id,
    title: 'Registration awaiting review',
    detail: `${request.fullName || request.employeeId || 'Employee request'} · ${request.email || 'No email provided'}`,
    status: request.status,
    createdAt: request.createdAt
  }))].sort((first, second) => new Date(second.createdAt || 0) - new Date(first.createdAt || 0)), [dashboard.notifications, requests]);

  const logout = () => {
    localStorage.removeItem('burnoutguard_token');
    localStorage.removeItem('burnoutguard_user');
    window.location.href = '/login/admin';
  };

  return (
    <div className="admin-shell min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setSidebarOpen((open) => !open)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 md:hidden" aria-label="Toggle admin navigation"><Menu size={20} /></button>
            <div className="rounded-xl bg-blue-600 p-2 text-white"><Shield size={19} /></div>
            <div><span className="font-bold tracking-tight">BurnoutGuard</span><span className="ml-2 hidden text-xs text-slate-400 sm:inline">ADMIN PORTAL</span></div>
          </div>
          <div className="relative flex items-center gap-2">
            <span className="hidden text-sm text-slate-500 sm:inline">Administrator</span>
            <button type="button" onClick={() => setNotificationsOpen((open) => !open)} className="relative rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900" aria-label="Open notifications"><Bell size={19} />{notifications.length > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-500" />}</button>
            <button type="button" onClick={logout} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"><LogOut size={16} /><span className="hidden sm:inline">Logout</span></button>
            {notificationsOpen && <NotificationPanel notifications={notifications} onClose={() => setNotificationsOpen(false)} />}
          </div>
        </div>
      </header>
      <div className="flex min-h-[calc(100vh-4rem)]">
        {sidebarOpen && <button type="button" className="fixed inset-0 z-20 bg-slate-950/30 md:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close navigation" />}
        <aside className={`admin-sidebar fixed inset-y-16 left-0 z-30 w-72 border-r border-slate-200 bg-white p-4 transition-transform md:sticky md:top-16 md:z-0 md:block md:h-[calc(100vh-4rem)] md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <p className="mb-3 px-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">Workspace</p>
          <nav className="space-y-1" aria-label="Admin sections">{navigation.map(({ label, icon: Icon }) => <button key={label} type="button" onClick={() => { setActiveTab(label); setSidebarOpen(false); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${activeTab === label ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}><Icon size={17} />{label}</button>)}</nav>
          <div className="absolute bottom-4 left-4 right-4 rounded-xl border border-blue-100 bg-blue-50 p-3"><p className="text-xs font-semibold text-blue-900">Well-being insights</p><p className="mt-1 text-xs leading-5 text-blue-700">Risk indicators support workforce planning; they are not medical diagnoses.</p></div>
        </aside>
        <main className="admin-main min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[1500px]">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-blue-600">BurnoutGuard / Admin</p><h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{activeTab}</h1></div><button type="button" onClick={loadDashboard} disabled={loading} className="btn-secondary flex items-center gap-2"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh</button></div>
            {error && <div className="mb-5 flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"><span>{error}</span><button type="button" onClick={loadDashboard} className="font-semibold">Retry</button></div>}
            <div className="admin-page-content">
              {activeTab === 'Overview' && <Overview stats={stats} employees={employees} departments={dashboard.departments || []} recentActivity={dashboard.recentActivity || []} loading={loading} onNavigate={setActiveTab} />}
              {activeTab === 'Employees' && <Employees employees={employees} loading={loading} />}
              {activeTab === 'Departments' && <DepartmentManagementPage />}
              {activeTab === 'Registration Requests' && <RegistrationRequestsPage />}
              {activeTab === 'Tests' && <TestManagementPage />}
              {activeTab === 'Tasks & Attendance' && <OperationsPage />}
              {activeTab === 'Predictions' && <Predictions employees={employees} loading={loading} onRefresh={loadDashboard} />}
              {activeTab === 'Audit Log' && <AuditLogsPage />}
              {activeTab === 'Settings' && <SettingsPanel onRefresh={loadDashboard} />}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function Overview({ stats, employees, departments, recentActivity, loading, onNavigate }) {
  const cards = [
    { label: 'Total Employees', value: stats.totalEmployees, note: 'Active employees', icon: ClipboardList, color: 'text-blue-400', action: 'View workforce', tab: 'Employees' },
    { label: 'High Burnout Risk', value: stats.highBurnoutRisk, note: 'Employees flagged high', icon: Brain, color: 'text-rose-400', action: 'View predictions', tab: 'Predictions' },
    { label: 'High Attrition Risk', value: stats.highAttritionRisk, note: 'Employees flagged high', icon: Activity, color: 'text-amber-400', action: 'View employees', tab: 'Employees' },
    { label: 'Average Burnout', value: stats.averageBurnoutScore === null ? 'N/A' : `${stats.averageBurnoutScore}/100`, note: `${stats.burnoutScoreCoverage ?? 0}% score coverage`, icon: Brain, color: 'text-violet-400', action: 'Review predictions', tab: 'Predictions' },
    { label: 'Open Tasks', value: stats.openTasks, note: `${stats.overdueTasks || 0} overdue`, icon: ListTodo, color: 'text-amber-400', action: 'Manage operations', tab: 'Tasks & Attendance' },
    { label: 'Pending Requests', value: stats.pendingRegistrations, note: 'Awaiting review', icon: Users, color: 'text-blue-400', action: 'Review requests', tab: 'Registration Requests' },
    { label: 'Assessments', value: stats.activeTests, note: `${stats.submissionsThisMonth || 0} submissions this month`, icon: Check, color: 'text-emerald-400', action: 'Manage tests', tab: 'Tests' }
  ];
  return <div className="space-y-6">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({ label, value, note, icon: Icon, color, action, tab }) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-5 flex items-center justify-between"><div className={`rounded-xl bg-slate-50 p-3 ${color}`}><Icon size={21} /></div><ChevronRight size={18} className="text-slate-300" /></div><div className="text-sm text-slate-500">{label}</div><div className="mt-2 text-2xl font-bold">{loading ? '...' : value ?? 'N/A'}</div><div className="mt-1 text-xs text-slate-500">{note}</div><button type="button" onClick={() => onNavigate(tab)} className="mt-4 w-full border-t border-slate-100 pt-3 text-left text-sm font-semibold text-blue-700 hover:text-blue-600">{action}</button></div>)}</div>
    <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="mb-5"><h2 className="text-lg font-bold">Burnout risk distribution</h2><p className="mt-1 text-sm text-slate-500">Available predictions across approved employee records.</p></div><RiskChart employees={employees} /></section>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-bold">Department overview</h2><p className="mt-1 text-sm text-slate-500">Teams with the highest current risk counts.</p></div><button type="button" onClick={() => onNavigate('Departments')} className="text-sm font-semibold text-blue-700">All teams</button></div><div className="space-y-3">{[...departments].sort((first, second) => second.riskCounts.HIGH - first.riskCounts.HIGH).slice(0, 5).map((department) => <div key={department.id} className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-4 py-3"><div><p className="text-sm font-semibold">{department.name}</p><p className="mt-1 text-xs text-slate-500">{department.employeeCount} employees · avg score {department.averageBurnoutScore ?? 'N/A'}</p></div><span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700">{department.riskCounts.HIGH} high</span></div>)}{departments.length === 0 && <p className="py-8 text-center text-sm text-slate-500">Department metrics will appear when workforce records are available.</p>}</div></section>
    </div>
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-bold">Recent administrator activity</h2><p className="mt-1 text-sm text-slate-500">Recent recorded actions in the audit trail.</p></div><button type="button" onClick={() => onNavigate('Audit Log')} className="text-sm font-semibold text-blue-700">Open audit log</button></div><div className="divide-y divide-slate-100">{recentActivity.slice(0, 5).map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><span className="font-medium">{item.actor}</span><code className="text-xs text-slate-500">{item.action}</code><span className="text-xs text-slate-400">{new Date(item.occurredAt).toLocaleString()}</span></div>)}{recentActivity.length === 0 && <p className="py-6 text-sm text-slate-500">No administrator changes recorded yet.</p>}</div></section>
  </div>;
}

function RiskChart({ employees }) {
  const levels = ['LOW', 'MEDIUM', 'HIGH'];
  const counts = levels.map((level) => employees.filter((employee) => (employee.burnoutRisk || '').toUpperCase() === level).length);
  const data = levels.map((level, index) => ({ name: level, value: counts[index] }));
  if (!counts.some(Boolean)) return <div className="flex h-64 items-center justify-center text-sm text-slate-500">No burnout predictions are available yet.</div>;
  return <div className="h-72 w-full"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="82%" paddingAngle={3}>{data.map((entry) => <Cell key={entry.name} fill={entry.name === 'HIGH' ? '#f43f5e' : entry.name === 'MEDIUM' ? '#f59e0b' : '#10b981'} />)}</Pie><Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12, color: '#f8fafc' }} /><Legend formatter={(value) => <span className="text-xs text-slate-300">{value}</span>} /></PieChart></ResponsiveContainer></div>;
}

function Employees({ employees, loading }) {
  const [query, setQuery] = useState('');
  const rows = employees.filter((employee) => `${employee.fullName} ${employee.email} ${employee.employeeId}`.toLowerCase().includes(query.toLowerCase()));
  return <section><div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h2 className="text-2xl font-bold">Workforce Records</h2><p className="mt-1 text-sm text-slate-400">Review approved employee records and available predictions.</p></div><div className="relative"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search employees..." className="input pl-10 sm:w-72" /></div></div><div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/90"><table className="w-full min-w-[680px] text-left"><thead className="bg-[#030914] text-xs uppercase tracking-wide text-slate-400"><tr><th className="px-6 py-4">Employee name</th><th className="px-6 py-4">Contact / ID</th><th className="px-6 py-4">Burnout score</th><th className="px-6 py-4">Risk assessment</th></tr></thead><tbody className="divide-y divide-slate-800">{!loading && rows.map((employee) => <tr key={employee.id || employee.employeeId} className="text-sm"><td className="px-6 py-4 font-semibold">{employee.fullName}</td><td className="px-6 py-4 text-slate-400">{employee.email || 'N/A'}<div className="mt-1 text-xs text-slate-600">{employee.employeeId}</div></td><td className="px-6 py-4">{employee.burnoutScore ?? 'N/A'}{employee.burnoutScore !== null && employee.burnoutScore !== undefined && <span className="text-slate-500"> /100</span>}</td><td className="px-6 py-4"><RiskBadge risk={employee.burnoutRisk} /></td></tr>)}{!loading && rows.length === 0 && <EmptyRow text="No employee records available." />}{loading && <EmptyRow text="Loading employee records..." />}</tbody></table></div></section>;
}

function Predictions({ employees, loading, onRefresh }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const exportHistory = async () => {
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/admin/predictions/export`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('burnoutguard_token')}` }
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || 'Unable to export prediction history.');
      }
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'prediction-history.csv';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(requestError.message);
    }
  };
  const runPredictions = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch(`${API_URL}/api/admin/predictions/run`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('burnoutguard_token')}` }
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Prediction run failed.');
      const modelNames = Object.entries(body.models || {}).filter(([, available]) => available).map(([name]) => name);
      setMessage(`${body.message}${modelNames.length ? ` Trained models used: ${modelNames.join(', ')}.` : ' No trained XGBoost artifacts were found; only the documented formula was applied.'}`);
      await onRefresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };
  return <section><div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/90 p-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h2 className="text-lg font-bold">Burnout and attrition predictions</h2><p className="mt-1 max-w-2xl text-sm text-slate-400">The Python service uses trained XGBoost artifacts when available. Without a trained artifact, burnout scores are identified as formula-based and attrition predictions remain unavailable.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={exportHistory} className="btn-secondary flex shrink-0 items-center gap-2"><Download size={15} /> Export history</button><button type="button" disabled={busy} onClick={runPredictions} className="btn-primary flex shrink-0 items-center gap-2 disabled:opacity-50"><RefreshCw size={16} className={busy ? 'animate-spin' : ''} /> {busy ? 'Analyzing…' : 'Run predictions'}</button></div></div>{error && <p role="alert" className="mt-4 rounded-lg border border-rose-900 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">{error}</p>}{message && <p role="status" className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">{message}</p>}</div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{!loading && employees.filter((employee) => employee.status === 'APPROVED').map((employee) => <div key={employee.id || employee.employeeId} className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{employee.fullName}</h3><p className="mt-1 text-xs text-slate-400">{employee.email || employee.employeeId}</p></div><RiskBadge risk={employee.burnoutRisk} /></div><div className="mt-5 flex justify-between text-sm"><span className="text-slate-400">Burnout score</span><strong>{employee.burnoutScore === null || employee.burnoutScore === undefined ? 'N/A' : `${employee.burnoutScore}%`}</strong></div><div className="mt-2 h-2 rounded-full bg-slate-800"><div className="h-2 rounded-full bg-amber-400" style={{ width: `${Math.min(Number(employee.burnoutScore) || 0, 100)}%` }} /></div><div className="mt-4 flex justify-between text-xs"><span className="text-slate-500">Attrition risk</span><span className="text-slate-300">{employee.attritionRisk || 'N/A'}</span></div><div className="mt-4 border-t border-slate-800 pt-4 text-xs text-slate-500">{employee.burnoutPredictionMethod === 'XGBOOST' ? `Model ${employee.predictionModelVersion || 'XGBoost'}` : employee.burnoutPredictionMethod === 'BURNOUT_FORMULA' ? 'Burnout formula' : 'Not analyzed'} · {employee.employeeId}</div></div>)}{!loading && employees.filter((employee) => employee.status === 'APPROVED').length === 0 && <div className="col-span-full rounded-2xl border border-dashed border-slate-700 p-10 text-center text-sm text-slate-500">No approved employee records are available to analyze.</div>}</div></section>;
}

function SettingsPanel({ onRefresh }) {
  const [source, setSource] = useState('csv');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const importData = async (endpoint, options) => {
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const token = localStorage.getItem('burnoutguard_token');
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) },
        body: options.body
      });
      const responseText = await response.text();
      let data;
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        throw new Error(response.ok
          ? 'The server returned an invalid response. Restart the backend and try again.'
          : 'The import service is unavailable. Make sure the backend is running on port 5000.');
      }
      if (!response.ok) throw new Error(data.message || 'Unable to import employee data.');
      setMessage(data.message);
      await onRefresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const uploadCsv = () => {
    if (!file) {
      setError('Choose a CSV file first.');
      return;
    }
    const body = new FormData();
    body.append('file', file);
    importData('/api/admin/dataset/csv', { body });
  };

  const fetchSheet = () => {
    if (!url.trim()) {
      setError('Paste a Google Sheets URL first.');
      return;
    }
    importData('/api/admin/dataset/google-sheets', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url.trim() })
    });
  };

  return <div className="grid gap-6 lg:grid-cols-[1fr_1fr]"><section className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6"><h2 className="text-lg font-bold">Upload Employee Data</h2><div className="mt-6 grid grid-cols-2 gap-2"><button type="button" onClick={() => { setSource('csv'); setError(''); }} className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${source === 'csv' ? 'bg-blue-600 text-white' : 'btn-secondary'}`}><FileText size={17} /> CSV File</button><button type="button" onClick={() => { setSource('sheets'); setError(''); }} className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${source === 'sheets' ? 'bg-emerald-600 text-white' : 'btn-secondary'}`}><Upload size={17} /> Google Sheets</button></div>{source === 'csv' ? <><label className="label mt-7">CSV file</label><div className="flex gap-2"><label className="btn-secondary flex min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 truncate"><FileText size={17} /> <span className="truncate">{file ? file.name : 'Choose a CSV file'}</span><input type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => { setFile(event.target.files?.[0] || null); setMessage(''); setError(''); }} /></label><button type="button" onClick={uploadCsv} disabled={busy || !file} className="btn-primary flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"><Upload size={17} /> {busy ? 'Uploading...' : 'Upload'}</button></div><p className="mt-3 text-xs text-slate-500">Choose one CSV file using the schema shown on the right.</p></> : <><label className="label mt-7">Google Sheets URL <span className="ml-1 text-xs font-normal text-slate-500">(Sheet must be public)</span></label><input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="Paste your Google Sheets link here..." className="input" /><p className="mt-3 text-xs text-slate-500">Set Google Sheets sharing to “Anyone with the link” as Viewer.</p><button type="button" onClick={fetchSheet} disabled={busy} className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-3 text-sm font-semibold hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"><RefreshCw size={17} className={busy ? 'animate-spin' : ''} /> {busy ? 'Fetching...' : 'Fetch from Google Sheets'}</button></>}{message && <p className="mt-4 rounded-lg border border-emerald-800 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-300">{message}</p>}{error && <p className="mt-4 rounded-lg border border-rose-800 bg-rose-950/30 px-3 py-2 text-sm text-rose-300">{error}</p>}<div className="mt-8 border-t border-slate-800 pt-6"><h3 className="font-semibold">Dataset History</h3><p className="mt-2 text-sm text-slate-500">The latest successful import becomes the active dataset.</p></div></section><section className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6"><h2 className="text-lg font-bold">Pipeline Configuration</h2><p className="mt-3 text-sm leading-6 text-slate-400">Upload your employee records utilizing the standard <strong className="text-rose-400">15-column schema</strong> to integrate with the Logistic Regression pipeline.</p><pre className="mt-5 overflow-x-auto rounded-xl border border-slate-700 bg-[#030914] p-4 text-xs leading-7 text-blue-300"># Expected CSV Header Format{`\n`}employee_id,name,salary,working_hours,stress_level,experience,department{`\n\n`}# Sample Row (15 Elements){`\n`}EMP-001,Employee Name,85000,55,8,3,5,Engineering</pre></section></div>;
}

function NotificationPanel({ notifications, onClose }) {
  return <div className="absolute right-0 top-12 z-20 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-4 text-slate-900 shadow-xl"><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Notifications</h2><button type="button" onClick={onClose} aria-label="Close notifications" className="text-slate-500 hover:text-slate-900"><X size={17} /></button></div>{notifications.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">You are all caught up.</p> : <div className="space-y-2">{notifications.slice(0, 5).map((notification) => <div key={notification.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3"><div className="flex gap-2"><Check size={16} className={notification.status === 'APPROVED' ? 'text-emerald-500' : 'text-amber-500'} /><div><p className="text-sm font-medium">{notification.title}</p><p className="mt-1 text-xs text-slate-500">{notification.detail}</p></div></div></div>)}</div>}</div>;
}

function RiskBadge({ risk }) {
  const normalizedRisk = (risk || 'UNKNOWN').toUpperCase();
  const styles = normalizedRisk === 'HIGH' ? 'border-rose-500/40 bg-rose-500/10 text-rose-300' : normalizedRisk === 'MEDIUM' ? 'border-amber-500/40 bg-amber-500/10 text-amber-300' : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300';
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold uppercase ${styles}`}>{normalizedRisk} risk</span>;
}

function EmptyRow({ text }) {
  return <tr><td colSpan="4" className="px-6 py-12 text-center text-sm text-slate-500">{text}</td></tr>;
}

export default AdminDashboardPage;
