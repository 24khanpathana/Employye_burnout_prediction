import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Bell, CheckCircle2, Clock3, LogOut, RefreshCw, ShieldCheck } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const employeeTabs = ['Overview', 'Assessments', 'Tasks', 'Attendance', 'Results', 'Notifications'];

async function employeeRequest(path, options = {}) {
  const response = await fetch(`${API_URL}/api/employees${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${localStorage.getItem('burnoutguard_token')}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || 'Unable to load employee information.');
  return body;
}

function EmployeeDashboardPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('Overview');
  const [profile, setProfile] = useState(null);
  const [tests, setTests] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [results, setResults] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [activeTest, setActiveTest] = useState(null);
  const [answers, setAnswers] = useState({});
  const [questionIndex, setQuestionIndex] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [profileData, testData, taskData, attendanceData, resultData, notificationData] = await Promise.all([
        employeeRequest('/me'),
        employeeRequest('/me/tests'),
        employeeRequest('/me/tasks'),
        employeeRequest('/me/attendance'),
        employeeRequest('/me/results'),
        employeeRequest('/me/notifications')
      ]);
      setProfile(profileData.employee);
      setTests(testData.tests || []);
      setTasks(taskData.tasks || []);
      setAttendance(attendanceData.attendance || []);
      setResults(resultData.results || []);
      setNotifications(notificationData.notifications || []);
    } catch (requestError) {
      setError(requestError.message);
      if (/token|employee/i.test(requestError.message)) {
        localStorage.removeItem('burnoutguard_token');
        localStorage.removeItem('burnoutguard_user');
        navigate('/login/employee', { replace: true });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('burnoutguard_token');
    let user = null;
    try { user = JSON.parse(localStorage.getItem('burnoutguard_user') || 'null'); } catch { user = null; }
    if (!token || user?.role !== 'EMPLOYEE') {
      navigate('/login/employee', { replace: true });
      return;
    }
    load();
  }, []);

  const logout = () => {
    localStorage.removeItem('burnoutguard_token');
    localStorage.removeItem('burnoutguard_user');
    navigate('/login/employee', { replace: true });
  };

  const startTest = async (testId) => {
    setBusy(true);
    setError('');
    try {
      const data = await employeeRequest(`/me/tests/${testId}/start`, { method: 'POST', body: '{}' });
      setActiveTest(data.test);
      setAnswers({});
      setQuestionIndex(0);
      setStartedAt(Date.now());
    } catch (requestError) {
      setError(requestError.message);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const submitTest = async () => {
    if (!activeTest) return;
    const missing = activeTest.questions.find((question) => question.required && !answers[question.id]);
    if (missing) {
      setError(`Please answer question ${activeTest.questions.findIndex((question) => question.id === missing.id) + 1} before submitting.`);
      setQuestionIndex(activeTest.questions.findIndex((question) => question.id === missing.id));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const data = await employeeRequest(`/me/tests/${activeTest.id}/submit`, {
        method: 'POST',
        body: JSON.stringify({ answers, timeTakenSeconds: Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) })
      });
      setMessage(data.message);
      setActiveTest(null);
      setAnswers({});
      await load();
      setTab('Assessments');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const updateTask = async (task, status) => {
    setBusy(true);
    setError('');
    try {
      await employeeRequest(`/me/tasks/${task.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status })
      });
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const markNotificationRead = async (notification) => {
    setError('');
    try {
      await employeeRequest(`/me/notifications/${notification.id}/read`, { method: 'PUT', body: '{}' });
      setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, read: true } : item));
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const completedIds = useMemo(() => new Set(results.map((result) => result.assessmentId)), [results]);

  if (activeTest) {
    const question = activeTest.questions[questionIndex];
    const progress = activeTest.questions.length ? Math.round(((questionIndex + 1) / activeTest.questions.length) * 100) : 0;
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <button type="button" onClick={() => setActiveTest(null)} className="mb-5 flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={16} /> Exit assessment</button>
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-widest text-blue-300">Employee assessment</p><h1 className="mt-2 text-2xl font-bold">{activeTest.title}</h1></div><span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">{questionIndex + 1} / {activeTest.questions.length}</span></div>
            {activeTest.instructions && <p className="mt-4 text-sm text-slate-400">{activeTest.instructions}</p>}
            <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${progress}%` }} /></div>
            {error && <Alert text={error} />}
            {question && <article className="mt-8">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-300">{question.section}</p>
              <h2 className="mt-3 text-xl font-semibold leading-relaxed">{question.text}{question.required && <span className="ml-1 text-rose-400" aria-label="required">*</span>}</h2>
              <fieldset className="mt-6 space-y-3"><legend className="sr-only">Choose one response</legend>{question.options.map((option) => <label key={option.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-4 transition ${answers[question.id] === option.id ? 'border-blue-500 bg-blue-950/30' : 'border-slate-700 hover:border-slate-500'}`}><input type="radio" name={question.id} value={option.id} checked={answers[question.id] === option.id} onChange={() => setAnswers((current) => ({ ...current, [question.id]: option.id }))} /><span>{option.label}</span></label>)}</fieldset>
            </article>}
            <footer className="mt-8 flex justify-between border-t border-slate-800 pt-5">
              <button type="button" disabled={questionIndex === 0} onClick={() => { setError(''); setQuestionIndex((index) => index - 1); }} className="btn-secondary flex items-center gap-2 disabled:opacity-40"><ArrowLeft size={15} /> Previous</button>
              {questionIndex < activeTest.questions.length - 1 ? <button type="button" onClick={() => { if (question.required && !answers[question.id]) { setError('Select an answer before continuing.'); return; } setError(''); setQuestionIndex((index) => index + 1); }} className="btn-primary flex items-center gap-2">Next <ArrowRight size={15} /></button> : <button type="button" disabled={busy} onClick={submitTest} className="btn-primary flex items-center gap-2"><CheckCircle2 size={16} /> {busy ? 'Submitting…' : 'Submit assessment'}</button>}
            </footer>
          </section>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/90"><div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6"><div><p className="text-xs font-semibold uppercase tracking-widest text-blue-400">BurnoutGuard employee portal</p><h1 className="mt-1 text-xl font-bold">{profile?.fullName || 'Employee dashboard'}</h1></div><div className="flex items-center gap-2"><button type="button" onClick={load} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800" aria-label="Refresh dashboard"><RefreshCw size={17} /></button><button type="button" onClick={logout} className="btn-secondary flex items-center gap-2"><LogOut size={15} /> Sign out</button></div></div></header>
      <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6">
        <nav className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-slate-800 bg-slate-900 p-1" aria-label="Employee sections">{employeeTabs.map((item) => <button key={item} type="button" onClick={() => { setTab(item); setMessage(''); }} className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold ${tab === item ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>{item}</button>)}</nav>
        {error && <Alert text={error} />}
        {message && <div className="mb-5 rounded-lg border border-emerald-900 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">{message}</div>}
        {loading ? <Empty text="Loading your employee information…" /> : (
          <>
            {tab === 'Overview' && <Overview profile={profile} tests={tests} tasks={tasks} attendance={attendance} onTests={() => setTab('Assessments')} />}
            {tab === 'Assessments' && <Assessments tests={tests} busy={busy} onStart={startTest} completedIds={completedIds} />}
            {tab === 'Tasks' && <Tasks tasks={tasks} busy={busy} onUpdate={updateTask} />}
            {tab === 'Attendance' && <Attendance attendance={attendance} />}
            {tab === 'Results' && <Results results={results} />}
            {tab === 'Notifications' && <Notifications notifications={notifications} onRead={markNotificationRead} />}
          </>
        )}
      </main>
    </div>
  );
}

function Overview({ profile, tests, tasks, attendance, onTests }) {
  const pendingTasks = tasks.filter((task) => !['COMPLETED', 'OVERDUE'].includes(String(task.status).toUpperCase())).length;
  const present = attendance.filter((entry) => ['PRESENT', 'LATE'].includes(String(entry.status).toUpperCase())).length;
  const attendanceRate = attendance.length ? Math.round((present / attendance.length) * 100) : null;
  return <div className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Department" value={profile?.department || 'N/A'} /><Metric label="Available assessments" value={tests.length} /><Metric label="Open tasks" value={pendingTasks} /><Metric label="Recorded attendance" value={attendanceRate === null ? 'N/A' : `${attendanceRate}%`} /></div>
    <section className="grid gap-5 lg:grid-cols-2">
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><h2 className="font-semibold">Your profile</h2><dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 text-sm">{[['Employee ID', profile?.employeeId], ['Name', profile?.fullName], ['Job role', profile?.position], ['Department', profile?.department], ['Joining date', profile?.joiningDate ? new Date(profile.joiningDate).toLocaleDateString() : null]].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 text-slate-200">{value || 'N/A'}</dd></div>)}</dl><p className="mt-5 flex items-center gap-2 border-t border-slate-800 pt-4 text-xs text-slate-500"><ShieldCheck size={15} /> Your records are only accessible to your account and authorized administrators.</p></div>
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><div className="flex items-center justify-between"><h2 className="font-semibold">Available assessments</h2><button type="button" onClick={onTests} className="text-sm text-blue-300 hover:text-blue-200">View all</button></div>{tests.slice(0, 3).map((test) => <div key={test.id} className="mt-4 rounded-xl border border-slate-800 p-4"><p className="font-medium">{test.title}</p><p className="mt-1 text-xs text-slate-400">{test.description || 'Employee well-being assessment'}</p>{test.expiresAt && <p className="mt-2 flex items-center gap-1 text-xs text-amber-300"><Clock3 size={13} /> Closes {new Date(test.expiresAt).toLocaleString()}</p>}</div>)}{tests.length === 0 && <Empty text="There are no assessments available right now." />}</div>
    </section>
  </div>;
}

function Assessments({ tests, busy, onStart, completedIds }) {
  return <section><div className="mb-4"><h2 className="text-xl font-bold">Available assessments</h2><p className="mt-1 text-sm text-slate-400">Your responses are used for workforce well-being analytics and are not a medical diagnosis.</p></div><div className="grid gap-4 md:grid-cols-2">{tests.map((test) => {
    const completed = Boolean(test.alreadySubmitted || completedIds.has(test.id));
    return <article key={test.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><div className="flex items-start justify-between gap-2"><div><h3 className="font-semibold">{test.title}</h3><p className="mt-1 text-sm text-slate-400">{test.description || 'No description provided.'}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${completed ? 'bg-emerald-950 text-emerald-300' : 'bg-blue-950 text-blue-300'}`}>{completed ? 'Submitted' : 'Available'}</span></div><div className="mt-4 text-xs text-slate-500">{test.questions.length} questions{test.durationMinutes ? ` · ${test.durationMinutes} minutes` : ''}{test.expiresAt ? ` · Due ${new Date(test.expiresAt).toLocaleString()}` : ''}</div><button type="button" disabled={busy || (completed && !test.allowRetakes)} onClick={() => onStart(test.id)} className="btn-primary mt-5 w-full disabled:cursor-not-allowed disabled:opacity-50">{completed ? test.allowRetakes ? 'Take again' : 'Already submitted' : 'Start assessment'}</button></article>;
  })}{tests.length === 0 && <Empty text="There are no assessments open for your account at this time." />}</div></section>;
}

function Tasks({ tasks, busy, onUpdate }) {
  return <section><h2 className="mb-4 text-xl font-bold">Your tasks</h2><div className="grid gap-3">{tasks.map((task) => <article key={task.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4"><div className="flex justify-between gap-3"><h3 className="font-medium">{task.title}</h3><span className="text-xs text-blue-300">{task.status || 'N/A'}</span></div><p className="mt-2 text-sm text-slate-400">{task.description || 'No description provided.'}</p><div className="mt-3 flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-slate-500">Due: {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'N/A'} · Priority: {task.priority || 'N/A'}</p>{task.status !== 'COMPLETED' && <div className="flex gap-2">{task.status !== 'IN_PROGRESS' && <button type="button" disabled={busy} onClick={() => onUpdate(task, 'IN_PROGRESS')} className="btn-secondary px-3 py-1 text-xs disabled:opacity-50">Start</button>}<button type="button" disabled={busy} onClick={() => onUpdate(task, 'COMPLETED')} className="btn-primary px-3 py-1 text-xs disabled:opacity-50">Mark complete</button></div>}</div></article>)}{tasks.length === 0 && <Empty text="No task records are currently assigned to you." />}</div></section>;
}

function Attendance({ attendance }) {
  return <section><h2 className="mb-4 text-xl font-bold">Attendance history</h2><div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900"><table className="w-full min-w-[500px] text-left text-sm"><thead className="bg-slate-950 text-xs uppercase text-slate-400"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Note</th></tr></thead><tbody className="divide-y divide-slate-800">{attendance.map((entry) => <tr key={entry.id}><td className="px-4 py-3">{entry.date ? new Date(entry.date).toLocaleDateString() : 'N/A'}</td><td className="px-4 py-3">{entry.status || 'N/A'}</td><td className="px-4 py-3 text-slate-400">{entry.note || 'N/A'}</td></tr>)}{attendance.length === 0 && <tr><td colSpan="3" className="p-8 text-center text-slate-400">No attendance records available.</td></tr>}</tbody></table></div></section>;
}

function Results({ results }) {
  return <section><h2 className="mb-4 text-xl font-bold">Visible assessment results</h2><p className="mb-4 text-sm text-slate-400">Only results your administrator has made visible are shown here.</p><div className="grid gap-3 md:grid-cols-2">{results.map((result) => <article key={result.id} className="rounded-xl border border-slate-800 bg-slate-900 p-5"><p className="font-medium">{result.results?.overallScore === undefined ? 'Assessment result' : 'Assessment score'}</p><p className="mt-1 text-xs text-slate-500">{result.submittedAt ? new Date(result.submittedAt).toLocaleString() : 'N/A'}</p><p className="mt-4 text-3xl font-bold text-blue-300">{result.results?.overallScore ?? 'N/A'}{result.results?.overallScore !== undefined ? '%' : ''}</p></article>)}{results.length === 0 && <Empty text="No results have been shared with you." />}</div></section>;
}

function Notifications({ notifications, onRead }) {
  return <section><div className="mb-4"><h2 className="text-xl font-bold">Notifications</h2><p className="mt-1 text-sm text-slate-400">Assessment and task updates for your account.</p></div><div className="space-y-3">{notifications.map((notification) => <article key={notification.id} className={`rounded-xl border p-4 ${notification.read ? 'border-slate-800 bg-slate-900' : 'border-blue-900/70 bg-blue-950/20'}`}><div className="flex items-start justify-between gap-4"><div className="flex gap-3"><Bell size={17} className="mt-1 shrink-0 text-blue-300" /><div><p className="text-sm text-slate-200">{notification.message}</p><p className="mt-2 text-xs text-slate-500">{notification.createdAt ? new Date(notification.createdAt).toLocaleString() : 'Recently'}</p></div></div>{!notification.read && <button type="button" onClick={() => onRead(notification)} className="shrink-0 text-xs font-semibold text-blue-300 hover:text-blue-200">Mark read</button>}</div></article>)}{notifications.length === 0 && <Empty text="You have no notifications." />}</div></section>;
}

function Metric({ label, value }) {
  return <div className="rounded-xl border border-slate-800 bg-slate-900 p-5"><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>;
}

function Alert({ text }) {
  return <div role="alert" className="mb-5 rounded-lg border border-rose-900 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">{text}</div>;
}

function Empty({ text }) {
  return <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">{text}</div>;
}

export default EmployeeDashboardPage;
