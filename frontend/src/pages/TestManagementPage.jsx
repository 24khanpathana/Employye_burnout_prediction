import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, Copy, Download, Eye, Plus, RefreshCw, Save, Search, Square, Trash2, TriangleAlert } from 'lucide-react';

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
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || 'The request could not be completed.');
  return body;
}

function TestManagementPage() {
  const [tests, setTests] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [view, setView] = useState('assessments');
  const [title, setTitle] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const selectedTest = tests.find((test) => test.id === selectedId);
  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [testData, employeeData] = await Promise.all([
        adminRequest('/tests'),
        adminRequest('/employees')
      ]);
      setTests(testData.tests || []);
      setEmployees(employeeData.employees || []);
      if (!selectedId && testData.tests?.length) setSelectedId(testData.tests[0].id);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const createTest = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await adminRequest('/tests', {
        method: 'POST',
        body: JSON.stringify({ title })
      });
      setTests((current) => [data.test, ...current]);
      setSelectedId(data.test.id);
      setTitle('');
      setCreateOpen(false);
      setMessage('Draft created with the standard 20-question assessment.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const updateSelected = (update) => {
    setTests((current) => current.map((test) => test.id === selectedId ? { ...test, ...update } : test));
  };

  const updateQuestion = (questionId, update) => {
    if (!selectedTest) return;
    updateSelected({
      questions: selectedTest.questions.map((question) =>
        question.id === questionId ? { ...question, ...update } : question
      )
    });
  };

  const saveTest = async () => {
    if (!selectedTest) return;
    setBusy(true);
    setError('');
    try {
      const data = await adminRequest(`/tests/${selectedTest.id}`, {
        method: 'PUT',
        body: JSON.stringify(selectedTest)
      });
      setTests((current) => current.map((test) => test.id === data.test.id ? data.test : test));
      setMessage('Draft saved.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const changeHosting = async (action) => {
    if (!selectedTest) return;
    setBusy(true);
    setError('');
    try {
      const data = await adminRequest(`/tests/${selectedTest.id}/${action}`, { method: 'PUT', body: '{}' });
      setTests((current) => current.map((test) => test.id === data.test.id ? data.test : test));
      const emailNote = data.notification?.status === 'not_configured'
        ? ' Email delivery is not configured.'
        : data.notification?.status === 'partial'
          ? ` ${data.notification.failed} email notifications failed.`
          : data.notification?.status === 'sent'
            ? ` ${data.notification.sent} email notifications sent.`
            : '';
      setMessage(action === 'host'
        ? `Assessment is ${data.test.status.toLowerCase()}.${emailNote}`
        : 'Hosting stopped. Submitted results have been retained.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const loadResults = async () => {
    setView('results');
    setError('');
  };

  return (
    <section className="space-y-5">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-400">Assessments</p>
          <h2 className="mt-1 text-2xl font-bold">Employee tests</h2>
          <p className="mt-1 text-sm text-slate-400">Build, preview, host, and review versioned well-being assessments.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={loadResults} className="btn-secondary">Test results</button>
          <button type="button" onClick={() => { setCreateOpen(true); setMessage(''); }} className="btn-primary flex items-center gap-2"><Plus size={16} /> New test</button>
        </div>
      </header>

      {error && <Notice kind="error" text={error} />}
      {message && <Notice kind="success" text={message} />}

      {view === 'results' ? (
        <ResultsTable tests={tests} onBack={() => setView('assessments')} />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.7fr)]">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">Assessment library</h3>
              <button type="button" onClick={load} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800" aria-label="Refresh assessments"><RefreshCw size={16} /></button>
            </div>
            {loading ? <p className="p-4 text-sm text-slate-400">Loading assessments…</p> : tests.length === 0 ? (
              <EmptyState text="No assessments yet. Create a draft to get started." />
            ) : (
              <ul className="space-y-2">
                {tests.map((test) => (
                  <li key={test.id}>
                    <button type="button" onClick={() => { setSelectedId(test.id); setMessage(''); }} className={`w-full rounded-xl border p-4 text-left transition ${selectedId === test.id ? 'border-blue-500 bg-blue-950/30' : 'border-slate-800 hover:border-slate-700 hover:bg-slate-800/50'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <span className="font-semibold text-slate-100">{test.title}</span>
                        <StatusBadge status={test.status} />
                      </div>
                      <p className="mt-2 text-xs text-slate-400">{test.questions?.length || 0} questions · {test.submissionCount || 0} submissions</p>
                      <p className="mt-1 text-xs text-slate-500">{test.targetDepartment || 'All departments'}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {selectedTest ? (
            <TestEditor
              test={selectedTest}
              departments={[...new Set(employees.map((employee) => employee.department).filter(Boolean))].sort()}
              busy={busy}
              onChange={updateSelected}
              onQuestionChange={updateQuestion}
              onSave={saveTest}
              onHost={() => changeHosting('host')}
              onStop={() => changeHosting('stop')}
            />
          ) : <EmptyState text="Select an assessment to view its builder." />}
        </div>
      )}

      {createOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4" role="dialog" aria-modal="true" aria-labelledby="new-test-title">
        <form onSubmit={createTest} className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6">
          <h3 id="new-test-title" className="text-lg font-bold">Create assessment</h3>
          <label className="label mt-5" htmlFor="test-title">Test title</label>
          <input id="test-title" autoFocus required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} className="input" placeholder="Quarterly well-being check-in" />
          <p className="mt-2 text-xs text-slate-400">A new draft starts with the required 20-question template.</p>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" onClick={() => setCreateOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={busy} className="btn-primary">{busy ? 'Creating…' : 'Create draft'}</button>
          </div>
        </form>
      </div>}
    </section>
  );
}

function TestEditor({ test, departments, busy, onChange, onQuestionChange, onSave, onHost, onStop }) {
  const [preview, setPreview] = useState(false);
  const updateOption = (question, optionIndex, patch) => {
    onQuestionChange(question.id, {
      options: question.options.map((option, index) => index === optionIndex ? { ...option, ...patch } : option)
    });
  };
  const moveQuestion = (index, offset) => {
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= test.questions.length) return;
    const questions = [...test.questions];
    [questions[index], questions[nextIndex]] = [questions[nextIndex], questions[index]];
    onChange({ questions });
  };
  const addQuestion = (sourceQuestion = null) => {
    const used = new Set(test.questions.map((question) => question.id));
    const id = Array.from({ length: 20 }, (_, index) => `q${index + 1}`).find((candidate) => !used.has(candidate));
    if (!id) return;
    const defaults = createQuestionDefaults(id);
    const question = {
      ...defaults,
      ...(sourceQuestion ? { ...sourceQuestion, ...defaults } : {}),
      text: sourceQuestion?.text || defaults.text,
      options: sourceQuestion?.options?.map((option) => ({ ...option })) || defaults.options
    };
    onChange({ questions: [...test.questions, question] });
  };
  const removeQuestion = (questionId) => {
    onChange({ questions: test.questions.filter((question) => question.id !== questionId) });
  };

  return (
    <section className="min-w-0 space-y-4">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="text-lg font-bold">{test.title}</h3><p className="mt-1 text-sm text-slate-400">Version {test.version || 1} · {test.questions?.length || 0} questions</p></div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setPreview((value) => !value)} className="btn-secondary flex items-center gap-2"><Eye size={15} /> {preview ? 'Edit questions' : 'Preview'}</button>
            {test.status === 'DRAFT' && <button type="button" disabled={busy} onClick={onSave} className="btn-primary flex items-center gap-2"><Save size={15} /> Save draft</button>}
            {['DRAFT', 'STOPPED'].includes(test.status) && <button type="button" disabled={busy} onClick={onHost} className="btn-primary">Host test</button>}
            {['LIVE', 'SCHEDULED'].includes(test.status) && <button type="button" disabled={busy} onClick={onStop} className="btn-secondary flex items-center gap-2"><Square size={14} /> Stop hosting</button>}
          </div>
          {test.status === 'DRAFT' && <button type="button" disabled={test.questions.length >= 20} onClick={() => addQuestion()} className="btn-secondary mt-4 flex items-center gap-2 disabled:opacity-40"><Plus size={15} /> Add question</button>}
        </div>
        {test.status !== 'DRAFT' && <p className="mt-4 rounded-lg border border-amber-900/60 bg-amber-950/20 p-3 text-xs text-amber-200">Published assessments are read-only. Stopping hosting prevents new attempts; submitted results remain available.</p>}
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label="Title"><input className="input" value={test.title} disabled={test.status !== 'DRAFT'} onChange={(event) => onChange({ title: event.target.value })} /></Field>
          <Field label="Target department">
            <select className="input" value={test.targetDepartment || ''} disabled={test.status !== 'DRAFT'} onChange={(event) => onChange({ targetDepartment: event.target.value || null })}>
              <option value="">All departments</option>{departments.map((department) => <option key={department} value={department}>{department}</option>)}
            </select>
          </Field>
          <Field label="Description"><textarea className="input min-h-20" value={test.description || ''} disabled={test.status !== 'DRAFT'} onChange={(event) => onChange({ description: event.target.value })} /></Field>
          <Field label="Instructions"><textarea className="input min-h-20" value={test.instructions || ''} disabled={test.status !== 'DRAFT'} onChange={(event) => onChange({ instructions: event.target.value })} /></Field>
          <Field label="Start date and time"><input type="datetime-local" className="input" value={toDateTimeLocal(test.startAt)} disabled={test.status !== 'DRAFT'} onChange={(event) => onChange({ startAt: event.target.value || null })} /></Field>
          <Field label="Expiry date and time"><input type="datetime-local" className="input" value={toDateTimeLocal(test.expiresAt)} disabled={test.status !== 'DRAFT'} onChange={(event) => onChange({ expiresAt: event.target.value || null })} /></Field>
          <Field label="Duration (minutes, optional)"><input type="number" min="1" className="input" value={test.durationMinutes || ''} disabled={test.status !== 'DRAFT'} onChange={(event) => onChange({ durationMinutes: event.target.value ? Number(event.target.value) : null })} /></Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-300"><input type="checkbox" checked={Boolean(test.allowRetakes)} disabled={test.status !== 'DRAFT'} onChange={(event) => onChange({ allowRetakes: event.target.checked })} /> Allow retakes</label>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-300"><input type="checkbox" checked={Boolean(test.allowEmployeeResults)} disabled={test.status !== 'DRAFT'} onChange={(event) => onChange({ allowEmployeeResults: event.target.checked })} /> Allow employees to see results</label>
        </div>
      </div>

      {preview ? (
        <div className="space-y-3">
          {test.questions.map((question, index) => <article key={question.id} className="rounded-xl border border-slate-800 bg-slate-900/80 p-5"><p className="text-xs font-semibold uppercase tracking-wide text-blue-300">{question.section} · Question {index + 1}</p><h4 className="mt-2 font-semibold">{question.text}</h4><div className="mt-4 grid gap-2 sm:grid-cols-2">{question.options.map((option) => <div key={option.id} className="rounded-lg border border-slate-800 px-3 py-2 text-sm text-slate-300">{option.label}</div>)}</div></article>)}
        </div>
      ) : (
        <div className="space-y-3">
          {test.questions.map((question, index) => <article key={question.id} className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
            <div className="mb-4 flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-blue-300">{question.section} · Question {question.id.slice(1)}</p><p className="mt-1 text-xs text-slate-500">{question.required ? 'Required' : 'Optional'} · {question.scoringDirection} scoring</p></div><div className="flex gap-1"><button type="button" disabled={index === 0 || test.status !== 'DRAFT'} onClick={() => moveQuestion(index, -1)} className="rounded p-2 text-slate-400 hover:bg-slate-800 disabled:opacity-30" aria-label={`Move ${question.id} up`}><ArrowUp size={15} /></button><button type="button" disabled={index === test.questions.length - 1 || test.status !== 'DRAFT'} onClick={() => moveQuestion(index, 1)} className="rounded p-2 text-slate-400 hover:bg-slate-800 disabled:opacity-30" aria-label={`Move ${question.id} down`}><ArrowDown size={15} /></button><button type="button" disabled={test.status !== 'DRAFT' || test.questions.length >= 20} onClick={() => addQuestion(question)} className="rounded p-2 text-slate-400 hover:bg-slate-800 disabled:opacity-30" aria-label={`Duplicate ${question.id}`}><Copy size={15} /></button><button type="button" disabled={test.status !== 'DRAFT'} onClick={() => removeQuestion(question.id)} className="rounded p-2 text-rose-300 hover:bg-rose-950 disabled:opacity-30" aria-label={`Delete ${question.id}`}><Trash2 size={15} /></button></div></div>
            <textarea className="input min-h-20" value={question.text} disabled={test.status !== 'DRAFT'} onChange={(event) => onQuestionChange(question.id, { text: event.target.value })} aria-label={`Question ${question.id} text`} />
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-400"><label className="flex items-center gap-2"><input type="checkbox" checked={question.required} disabled={test.status !== 'DRAFT'} onChange={(event) => onQuestionChange(question.id, { required: event.target.checked })} /> Required</label>{Number(question.id.slice(1)) > 10 && <label className="flex items-center gap-2">Scoring direction <select className="input w-32 py-1" value={question.scoringDirection} disabled={test.status !== 'DRAFT'} onChange={(event) => onQuestionChange(question.id, { scoringDirection: event.target.value })}><option value="positive">Positive</option><option value="negative">Negative</option></select></label>}</div>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {question.options.map((option, optionIndex) => <div key={option.id} className="flex items-center gap-2">
                <span className="w-5 text-xs text-slate-500">{optionIndex + 1}.</span>
                <input className="input" value={option.label} disabled={test.status !== 'DRAFT'} onChange={(event) => updateOption(question, optionIndex, { label: event.target.value })} aria-label={`${question.id} response ${optionIndex + 1}`} />
                <input type="number" className="input w-20" value={option.score} disabled={test.status !== 'DRAFT'} onChange={(event) => updateOption(question, optionIndex, { score: Number(event.target.value) })} aria-label={`${question.id} score ${optionIndex + 1}`} />
              </div>)}
            </div>
          </article>)}
        </div>
      )}
    </section>
  );
}

function ResultsTable({ tests, onBack }) {
  const [results, setResults] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [assessmentId, setAssessmentId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const parameters = () => {
    const params = new URLSearchParams({ page: String(page), pageSize: '25' });
    if (search.trim()) params.set('search', search.trim());
    if (department) params.set('department', department);
    if (assessmentId) params.set('assessmentId', assessmentId);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    return params;
  };

  useEffect(() => {
    let cancelled = false;
    const loadResults = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await adminRequest(`/test-results?${parameters()}`);
        if (cancelled) return;
        setResults(data.results || []);
        setDepartments(data.filters?.departments || []);
        setPagination(data.pagination || { page: 1, pageSize: 25, total: 0, totalPages: 0 });
      } catch (requestError) {
        if (!cancelled) setError(requestError.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadResults();
    return () => { cancelled = true; };
  }, [search, department, assessmentId, dateFrom, dateTo, page]);

  const exportCsv = async () => {
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/admin/test-results/export?${parameters()}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('burnoutguard_token')}` }
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || 'Unable to export assessment results.');
      }
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'assessment-results.csv';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const updateFilter = (setter) => (event) => {
    setter(event.target.value);
    setPage(1);
  };
  const rows = useMemo(() => results, [results]);
  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5"><div><h3 className="font-semibold">Assessment results</h3><p className="mt-1 text-xs text-slate-500">Filter submitted scores or export all matching results as CSV.</p></div><div className="flex gap-2"><button type="button" onClick={exportCsv} className="btn-primary flex items-center gap-2"><Download size={15} /> Export CSV</button><button type="button" onClick={onBack} className="btn-secondary flex items-center gap-2"><ArrowLeft size={15} /> Back</button></div></div>
    <div className="grid gap-3 border-b border-slate-200 p-4 md:grid-cols-5">
      <label className="relative md:col-span-2"><Search size={15} className="absolute left-3 top-3 text-slate-400" /><input aria-label="Search assessment results" className="input pl-9" value={search} onChange={updateFilter(setSearch)} placeholder="Employee, ID, or assessment" /></label>
      <select aria-label="Filter by department" className="input" value={department} onChange={updateFilter(setDepartment)}><option value="">All departments</option>{departments.map((item) => <option key={item} value={item}>{item}</option>)}</select>
      <select aria-label="Filter by assessment" className="input" value={assessmentId} onChange={updateFilter(setAssessmentId)}><option value="">All assessments</option>{tests.map((test) => <option key={test.id} value={test.id}>{test.title}</option>)}</select>
      <div className="flex gap-2"><input aria-label="Results from date" type="date" className="input min-w-0" value={dateFrom} onChange={updateFilter(setDateFrom)} /><input aria-label="Results to date" type="date" className="input min-w-0" value={dateTo} onChange={updateFilter(setDateTo)} /></div>
    </div>
    {error && <p role="alert" className="border-b border-rose-200 bg-rose-50 px-5 py-3 text-sm text-rose-700">{error}</p>}
    <div className="overflow-x-auto"><table className="w-full min-w-[950px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{['Employee', 'Department', 'Assessment', 'Submitted', 'Overtime', 'Project', 'WLB', 'Additional', 'Overall'].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row) => <tr key={row.submissionId}><td className="px-4 py-3">{row.employeeName}<span className="block text-xs text-slate-500">{row.employeeId}</span></td><td className="px-4 py-3">{row.department}</td><td className="px-4 py-3">{row.testTitle}</td><td className="px-4 py-3">{row.submittedAt ? new Date(row.submittedAt).toLocaleString() : 'N/A'}</td>{['overtimeScore', 'projectScore', 'wlbScore', 'additionalRiskPercentage', 'overallScore'].map((key) => <td key={key} className="px-4 py-3">{Number.isFinite(Number(row[key])) ? `${row[key]}${key.endsWith('Percentage') || key === 'overallScore' ? '%' : '/5'}` : 'N/A'}</td>)}</tr>)}{!loading && rows.length === 0 && <tr><td colSpan="9" className="p-8 text-center text-slate-500">No assessment submissions match these filters.</td></tr>}{loading && <tr><td colSpan="9" className="p-8 text-center text-slate-500">Loading results…</td></tr>}</tbody></table></div>
    <footer className="flex items-center justify-between border-t border-slate-200 px-5 py-3 text-sm text-slate-500"><span>{pagination.total} results · Page {pagination.page} of {Math.max(pagination.totalPages, 1)}</span><div className="flex gap-2"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)} className="btn-secondary disabled:opacity-40">Previous</button><button type="button" disabled={page >= pagination.totalPages || loading} onClick={() => setPage((value) => value + 1)} className="btn-secondary disabled:opacity-40">Next</button></div></footer>
  </section>;
}

function Field({ label, children }) {
  return <label className="label">{label}{children}</label>;
}

function Notice({ kind, text }) {
  const style = kind === 'error' ? 'border-rose-900 bg-rose-950/30 text-rose-200' : 'border-emerald-900 bg-emerald-950/30 text-emerald-200';
  return <div className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${style}`}>{kind === 'error' && <TriangleAlert size={16} />}<span>{text}</span></div>;
}

function StatusBadge({ status }) {
  const colors = { LIVE: 'bg-emerald-950 text-emerald-300', SCHEDULED: 'bg-blue-950 text-blue-300', DRAFT: 'bg-slate-800 text-slate-300', STOPPED: 'bg-amber-950 text-amber-300', EXPIRED: 'bg-slate-800 text-slate-400', COMPLETED: 'bg-indigo-950 text-indigo-300' };
  return <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${colors[status] || colors.DRAFT}`}>{status}</span>;
}

function EmptyState({ text }) {
  return <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">{text}</div>;
}

function toDateTimeLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

function createQuestionDefaults(id) {
  const number = Number(id.slice(1));
  const section = number <= 3 ? 'Overtime Assessment'
    : number <= 6 ? 'Project Workload Assessment'
      : number <= 10 ? 'Work-Life Balance Assessment'
        : 'Additional Burnout Assessment';
  const scoringDirection = number <= 6 || number === 8 || number === 12 || number === 18 ? 'negative' : 'positive';
  return {
    id,
    section,
    text: 'Add question text',
    scoringDirection,
    required: true,
    options: ['Never', 'Rarely', 'Sometimes', 'Often', 'Always'].map((label, index) => ({
      id: `${id}-option-${index + 1}`,
      label,
      score: index + 1
    }))
  };
}

export default TestManagementPage;
