import { useEffect, useState } from 'react';
import { Check, RefreshCw, X } from 'lucide-react';

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

function RegistrationRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminRequest('/registration-requests');
      setRequests(data.requests || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const processRequest = async (request, decision) => {
    setBusyId(request.id);
    setError('');
    setMessage('');
    try {
      const data = await adminRequest(`/registration-requests/${request.id}/${decision}`, { method: 'PUT', body: '{}' });
      setMessage(data.message);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId('');
    }
  };

  return <section className="space-y-5">
    <header className="flex items-end justify-between gap-3"><div><p className="text-sm font-semibold uppercase tracking-widest text-blue-400">Workforce</p><h2 className="mt-1 text-2xl font-bold">Registration requests</h2><p className="mt-1 text-sm text-slate-400">Review employee account requests before granting portal access.</p></div><button type="button" onClick={load} className="btn-secondary flex items-center gap-2"><RefreshCw size={15} /> Refresh</button></header>
    {error && <div role="alert" className="rounded-lg border border-rose-900 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">{error}</div>}
    {message && <div className="rounded-lg border border-emerald-900 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">{message}</div>}
    <div className="grid gap-3">{requests.map((request) => <article key={request.id} className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-5 md:flex-row md:items-center"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{request.fullName}</h3><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${request.status === 'PENDING' ? 'bg-amber-950 text-amber-300' : request.status === 'APPROVED' ? 'bg-emerald-950 text-emerald-300' : 'bg-rose-950 text-rose-300'}`}>{request.status}</span></div><p className="mt-1 text-sm text-slate-400">{request.email} · {request.employeeId}</p><p className="mt-1 text-xs text-slate-500">{request.position || 'N/A'} · {request.department || 'N/A'}{request.createdAt ? ` · Requested ${new Date(request.createdAt).toLocaleDateString()}` : ''}</p></div>{request.status === 'PENDING' && <div className="flex gap-2"><button type="button" disabled={Boolean(busyId)} onClick={() => processRequest(request, 'approve')} className="btn-primary flex items-center gap-2 disabled:opacity-50"><Check size={15} /> Approve</button><button type="button" disabled={Boolean(busyId)} onClick={() => processRequest(request, 'reject')} className="btn-secondary flex items-center gap-2 disabled:opacity-50"><X size={15} /> Reject</button></div>}</article>)}{!loading && requests.length === 0 && <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">No registration requests are available.</div>}{loading && <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center text-sm text-slate-400">Loading requests…</div>}</div>
  </section>;
}

export default RegistrationRequestsPage;
