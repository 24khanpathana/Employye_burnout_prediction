import { useCallback, useEffect, useState } from 'react';
import { Download, RefreshCw, Search } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 50, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ page: String(page), pageSize: '50' });
    if (search.trim()) params.set('search', search.trim());
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    try {
      const response = await fetch(`${API_URL}/api/admin/audit-logs?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('burnoutguard_token')}` }
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || 'Unable to load administrator activity.');
      setLogs(body.logs || []);
      setPagination(body.pagination || { page: 1, pageSize: 50, total: 0, totalPages: 0 });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [page, search, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const exportCsv = async () => {
    setError('');
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    try {
      const response = await fetch(`${API_URL}/api/admin/audit-logs/export?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('burnoutguard_token')}` }
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || 'Unable to export administrator activity.');
      }
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'administrator-audit-log.csv';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  return <section className="space-y-5">
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><p className="text-sm font-semibold uppercase tracking-widest text-blue-500">Governance</p><h2 className="mt-1 text-2xl font-bold">Administrator audit log</h2><p className="mt-1 text-sm text-slate-500">Administrative changes and their response status. Request bodies and credentials are never recorded.</p></div>
      <div className="flex gap-2"><button type="button" onClick={exportCsv} className="btn-primary flex items-center gap-2"><Download size={15} /> Export CSV</button><button type="button" onClick={load} disabled={loading} className="btn-secondary flex items-center gap-2"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh</button></div>
    </header>
    <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[minmax(220px,1fr)_180px_180px]">
      <label className="relative"><Search size={15} className="absolute left-3 top-3 text-slate-400" /><input aria-label="Search administrator activity" className="input pl-9" value={search} onChange={(event) => { setPage(1); setSearch(event.target.value); }} placeholder="Search action or admin ID" /></label>
      <label className="label mb-0">From<input aria-label="Audit log start date" type="date" className="input mt-1" value={dateFrom} onChange={(event) => { setPage(1); setDateFrom(event.target.value); }} /></label>
      <label className="label mb-0">To<input aria-label="Audit log end date" type="date" className="input mt-1" value={dateTo} onChange={(event) => { setPage(1); setDateTo(event.target.value); }} /></label>
    </div>
    {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Time</th><th className="px-5 py-3">Administrator</th><th className="px-5 py-3">Action</th><th className="px-5 py-3">Status</th></tr></thead>
        <tbody className="divide-y divide-slate-100">{logs.map((log) => <tr key={log.id}><td className="whitespace-nowrap px-5 py-4 text-slate-500">{log.occurredAt ? new Date(log.occurredAt).toLocaleString() : 'N/A'}</td><td className="px-5 py-4 font-medium">{log.actor || log.actorId}</td><td className="px-5 py-4 font-mono text-xs">{log.action}</td><td className="px-5 py-4"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${log.statusCode < 400 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{log.statusCode}</span></td></tr>)}
          {!loading && logs.length === 0 && <tr><td colSpan="4" className="p-10 text-center text-slate-500">No administrator changes match these filters.</td></tr>}
          {loading && <tr><td colSpan="4" className="p-10 text-center text-slate-500">Loading audit records…</td></tr>}
        </tbody>
      </table></div>
      <footer className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm text-slate-500"><span>{pagination.total} records · Page {pagination.page} of {Math.max(pagination.totalPages, 1)}</span><div className="flex gap-2"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)} className="btn-secondary disabled:opacity-40">Previous</button><button type="button" disabled={page >= pagination.totalPages || loading} onClick={() => setPage((value) => value + 1)} className="btn-secondary disabled:opacity-40">Next</button></div></footer>
    </div>
  </section>;
}

export default AuditLogsPage;
