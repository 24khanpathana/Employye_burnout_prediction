import { useEffect, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

async function adminRequest(path, options = {}) {
  const response = await fetch(`${API_URL}/api/admin${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${localStorage.getItem('burnoutguard_token')}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'The request could not be completed.');
  return data;
}

function OperationsPage() {
  const [section, setSection] = useState('tasks');
  const [employees, setEmployees] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', assignedToId: '', dueDate: '', priority: 'MEDIUM' });
  const [attendanceForm, setAttendanceForm] = useState({ employeeId: '', date: new Date().toISOString().slice(0, 10), status: 'PRESENT', note: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const exportAttendance = async () => {
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/admin/attendance/export`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('burnoutguard_token')}` }
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || 'Unable to export attendance.');
      }
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'attendance-report.csv';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const load = async () => {
    setError('');
    try {
      const [employeeData, taskData, attendanceData] = await Promise.all([
        adminRequest('/employees'),
        adminRequest('/tasks'),
        adminRequest('/attendance')
      ]);
      const activeEmployees = (employeeData.employees || []).filter((employee) => employee.status === 'APPROVED');
      setEmployees(activeEmployees);
      setTasks(taskData.tasks || []);
      setAttendance(attendanceData.attendance || []);
      setTaskForm((current) => ({ ...current, assignedToId: current.assignedToId || activeEmployees[0]?.id || '' }));
      setAttendanceForm((current) => ({ ...current, employeeId: current.employeeId || activeEmployees[0]?.id || '' }));
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  useEffect(() => { load(); }, []);

  const createTask = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await adminRequest('/tasks', { method: 'POST', body: JSON.stringify(taskForm) });
      setTaskForm((current) => ({ ...current, title: '', description: '' }));
      setMessage('Task assigned.');
      await load();
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
      await adminRequest(`/tasks/${task.id}`, { method: 'PUT', body: JSON.stringify({ status }) });
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const recordAttendance = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await adminRequest('/attendance', { method: 'POST', body: JSON.stringify(attendanceForm) });
      setMessage('Attendance record saved.');
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return <section className="space-y-5">
    <header className="flex items-end justify-between gap-3"><div><p className="text-sm font-semibold uppercase tracking-widest text-blue-400">Operations</p><h2 className="mt-1 text-2xl font-bold">Tasks & attendance</h2><p className="mt-1 text-sm text-slate-400">Manage explicit task assignments and attendance records.</p></div><button type="button" onClick={load} className="btn-secondary flex items-center gap-2"><RefreshCw size={15} /> Refresh</button></header>
    <div className="flex gap-2"><button type="button" onClick={() => setSection('tasks')} className={section === 'tasks' ? 'btn-primary' : 'btn-secondary'}>Tasks</button><button type="button" onClick={() => setSection('attendance')} className={section === 'attendance' ? 'btn-primary' : 'btn-secondary'}>Attendance</button></div>
    {error && <div role="alert" className="rounded-lg border border-rose-900 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">{error}</div>}
    {message && <div role="status" className="rounded-lg border border-emerald-900 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">{message}</div>}

    {section === 'tasks' ? <div className="grid gap-5 xl:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.5fr)]">
      <form onSubmit={createTask} className="h-fit space-y-3 rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h3 className="font-semibold">Assign a task</h3>
        <Field label="Title"><input required maxLength={160} className="input" value={taskForm.title} onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))} /></Field>
        <Field label="Description"><textarea className="input min-h-20" value={taskForm.description} onChange={(event) => setTaskForm((current) => ({ ...current, description: event.target.value }))} /></Field>
        <Field label="Employee"><select required className="input" value={taskForm.assignedToId} onChange={(event) => setTaskForm((current) => ({ ...current, assignedToId: event.target.value }))}><option value="">Select employee</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.fullName} · {employee.employeeId}</option>)}</select></Field>
        <Field label="Due date"><input required type="datetime-local" className="input" value={taskForm.dueDate} onChange={(event) => setTaskForm((current) => ({ ...current, dueDate: event.target.value }))} /></Field>
        <Field label="Priority"><select className="input" value={taskForm.priority} onChange={(event) => setTaskForm((current) => ({ ...current, priority: event.target.value }))}><option>LOW</option><option>MEDIUM</option><option>HIGH</option></select></Field>
        <button type="submit" disabled={busy || employees.length === 0} className="btn-primary w-full disabled:opacity-50">{busy ? 'Saving…' : 'Assign task'}</button>
      </form>
      <div className="space-y-3">{tasks.map((task) => <article key={task.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-medium">{task.title}</h3><p className="mt-1 text-xs text-slate-400">{task.employee?.fullName || 'N/A'} · {task.employee?.employeeId || 'N/A'}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${task.status === 'COMPLETED' ? 'bg-emerald-950 text-emerald-300' : task.status === 'OVERDUE' ? 'bg-rose-950 text-rose-300' : 'bg-blue-950 text-blue-300'}`}>{task.status}</span></div><p className="mt-3 text-sm text-slate-400">{task.description || 'No description provided.'}</p><div className="mt-3 flex items-center justify-between text-xs text-slate-500"><span>{task.priority} priority · Due {task.dueDate ? new Date(task.dueDate).toLocaleString() : 'N/A'}</span>{task.status !== 'COMPLETED' && <select aria-label={`Update status for ${task.title}`} className="input w-36 py-1" value={task.status === 'OVERDUE' ? 'PENDING' : task.status || 'PENDING'} disabled={busy} onChange={(event) => updateTask(task, event.target.value)}><option value="PENDING">Pending</option><option value="IN_PROGRESS">In progress</option><option value="COMPLETED">Completed</option></select>}</div></article>)}{tasks.length === 0 && <Empty text="No tasks have been assigned." />}</div>
    </div> : <div className="grid gap-5 xl:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.5fr)]">
      <form onSubmit={recordAttendance} className="h-fit space-y-3 rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h3 className="font-semibold">Record attendance</h3>
        <Field label="Employee"><select required className="input" value={attendanceForm.employeeId} onChange={(event) => setAttendanceForm((current) => ({ ...current, employeeId: event.target.value }))}><option value="">Select employee</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.fullName} · {employee.employeeId}</option>)}</select></Field>
        <Field label="Date"><input required type="date" className="input" value={attendanceForm.date} onChange={(event) => setAttendanceForm((current) => ({ ...current, date: event.target.value }))} /></Field>
        <Field label="Status"><select className="input" value={attendanceForm.status} onChange={(event) => setAttendanceForm((current) => ({ ...current, status: event.target.value }))}><option>PRESENT</option><option>ABSENT</option><option>LATE</option><option>LEAVE</option></select></Field>
        <Field label="Note"><textarea className="input min-h-16" value={attendanceForm.note} onChange={(event) => setAttendanceForm((current) => ({ ...current, note: event.target.value }))} /></Field>
        <button type="submit" disabled={busy || employees.length === 0} className="btn-primary w-full disabled:opacity-50">{busy ? 'Saving…' : 'Save attendance'}</button>
      </form>
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900"><div className="flex items-center justify-between gap-3 border-b border-slate-800 p-4"><h3 className="font-semibold">Attendance records</h3><button type="button" onClick={exportAttendance} className="btn-secondary flex items-center gap-2"><Download size={15} /> Export CSV</button></div><div className="overflow-x-auto"><table className="w-full min-w-[550px] text-left text-sm"><thead className="bg-slate-950 text-xs uppercase text-slate-400"><tr><th className="px-4 py-3">Employee</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Note</th></tr></thead><tbody className="divide-y divide-slate-800">{attendance.map((entry) => { const employee = employees.find((item) => item.id === entry.employeeId); return <tr key={entry.id}><td className="px-4 py-3">{employee?.fullName || 'N/A'}<span className="block text-xs text-slate-500">{employee?.employeeId || 'N/A'}</span></td><td className="px-4 py-3">{entry.date || 'N/A'}</td><td className="px-4 py-3">{entry.status}</td><td className="px-4 py-3 text-slate-400">{entry.note || 'N/A'}</td></tr>; })}{attendance.length === 0 && <tr><td colSpan="4" className="p-8 text-center text-slate-400">No attendance has been recorded.</td></tr>}</tbody></table></div></div>
    </div>}
  </section>;
}

function Field({ label, children }) {
  return <label className="label">{label}{children}</label>;
}

function Empty({ text }) {
  return <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">{text}</div>;
}

export default OperationsPage;
