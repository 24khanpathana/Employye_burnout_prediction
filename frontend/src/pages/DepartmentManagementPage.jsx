import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Download, RefreshCw, Search, Users } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const PAGE_SIZES = [10, 25, 50, 100];

async function adminRequest(path, options = {}) {
  const response = await fetch(`${API_URL}/api/admin${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${localStorage.getItem('burnoutguard_token')}`, ...(options.headers || {}) }
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || 'The request could not be completed.');
  }
  return response;
}

function DepartmentManagementPage() {
  const [departments, setDepartments] = useState([]);
  const [selected, setSelected] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState({ jobRoles: [] });
  const [query, setQuery] = useState('');
  const [jobRole, setJobRole] = useState('');
  const [attritionRisk, setAttritionRisk] = useState('');
  const [sortBy, setSortBy] = useState('Name');
  const [direction, setDirection] = useState('asc');
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDepartments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await adminRequest('/departments');
      const data = await response.json();
      setDepartments(data.departments || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadEmployees = useCallback(async (page = pagination.page) => {
    if (!selected) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        search: query,
        jobRole,
        attritionRisk,
        sortBy,
        direction
      });
      const response = await adminRequest(`/departments/${encodeURIComponent(selected.id)}/employees?${params}`);
      const data = await response.json();
      setEmployees(data.employees || []);
      setPagination(data.pagination);
      setFilters(data.filters || { jobRoles: [] });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [selected, pagination.page, pageSize, query, jobRole, attritionRisk, sortBy, direction]);

  useEffect(() => { loadDepartments(); }, [loadDepartments]);
  useEffect(() => { if (selected) loadEmployees(1); }, [selected, pageSize, query, jobRole, attritionRisk, sortBy, direction]);

  const exportCsv = async () => {
    if (!selected) return;
    try {
      const response = await adminRequest(`/departments/${encodeURIComponent(selected.id)}/export`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${selected.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-employees.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  return (
    <section className="space-y-5">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-sm font-semibold uppercase tracking-widest text-blue-400">Workforce</p><h2 className="mt-1 text-2xl font-bold">{selected ? selected.name : 'Departments'}</h2><p className="mt-1 text-sm text-slate-400">{selected ? `${selected.employeeCount} employee records` : 'Browse available departments and their current workforce risk metrics.'}</p></div>
        <div className="flex gap-2">
          {selected && <button type="button" onClick={() => { setSelected(null); setEmployees([]); }} className="btn-secondary flex items-center gap-2"><ArrowLeft size={15} /> Departments</button>}
          <button type="button" onClick={selected ? () => loadEmployees() : loadDepartments} className="btn-secondary flex items-center gap-2"><RefreshCw size={15} /> Refresh</button>
          {selected && <button type="button" onClick={exportCsv} className="btn-primary flex items-center gap-2"><Download size={15} /> Export CSV</button>}
        </div>
      </header>

      {error && <div role="alert" className="rounded-lg border border-rose-900 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">{error}</div>}
      {!selected ? (
        loading ? <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-sm text-slate-400">Loading departments…</div> : departments.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {departments.map((department) => <button key={department.id} type="button" onClick={() => { setSelected(department); setQuery(''); setJobRole(''); setAttritionRisk(''); }} className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 text-left transition hover:border-blue-700 hover:bg-slate-900">
              <div className="flex items-start justify-between"><div><h3 className="font-semibold">{department.name}</h3><p className="mt-1 flex items-center gap-1 text-xs text-slate-400"><Users size={13} /> {department.employeeCount} employees</p></div><span className="rounded-lg bg-blue-950 p-2 text-blue-300">{department.riskCounts.HIGH} high risk</span></div>
              <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs"><RiskCount label="Low" value={department.riskCounts.LOW} color="text-emerald-300" /><RiskCount label="Medium" value={department.riskCounts.MEDIUM} color="text-amber-300" /><RiskCount label="High" value={department.riskCounts.HIGH} color="text-rose-300" /></div>
              <div className="mt-4 flex justify-between border-t border-slate-800 pt-4 text-xs"><span className="text-slate-400">Avg burnout</span><strong>{department.averageBurnoutScore === null ? 'N/A' : `${department.averageBurnoutScore}/100`}</strong><span className="text-slate-400">High attrition</span><strong className="text-rose-300">{department.highAttritionCount}</strong></div>
            </button>)}
          </div>
        ) : <Empty text="No department records are available yet." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/90">
          <div className="grid gap-3 border-b border-slate-800 p-4 md:grid-cols-4">
            <label className="relative md:col-span-2"><Search size={15} className="absolute left-3 top-3 text-slate-500" /><input className="input pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search employee ID or name" /></label>
            <select className="input" value={jobRole} onChange={(event) => setJobRole(event.target.value)}><option value="">All job roles</option>{filters.jobRoles.map((role) => <option key={role} value={role}>{role}</option>)}</select>
            <select className="input" value={attritionRisk} onChange={(event) => setAttritionRisk(event.target.value)}><option value="">All attrition risks</option><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option></select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[2200px] text-left text-xs">
              <thead className="sticky top-0 bg-slate-950 text-[10px] uppercase tracking-wide text-slate-400"><tr>{EMPLOYEE_FIELDS.map((field) => <th key={field} className="px-3 py-3"><button type="button" onClick={() => { setSortBy(field); setDirection((value) => sortBy === field && value === 'asc' ? 'desc' : 'asc'); }} className="whitespace-nowrap hover:text-white">{field}{sortBy === field ? direction === 'asc' ? ' ↑' : ' ↓' : ''}</button></th>)}</tr></thead>
              <tbody className="divide-y divide-slate-800">{employees.map((employee) => <tr key={employee.EmployeeID} className="text-slate-200">{EMPLOYEE_FIELDS.map((field) => <td key={field} className="whitespace-nowrap px-3 py-3">{employee[field] === null || employee[field] === '' ? 'N/A' : employee[field]}</td>)}</tr>)}{!loading && employees.length === 0 && <tr><td colSpan={EMPLOYEE_FIELDS.length} className="p-8 text-center text-slate-400">No matching employees in this department.</td></tr>}{loading && <tr><td colSpan={EMPLOYEE_FIELDS.length} className="p-8 text-center text-slate-400">Loading employee records…</td></tr>}</tbody>
            </table>
          </div>
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 p-4 text-xs text-slate-400">
            <span>{pagination.total ? `${(pagination.page - 1) * pagination.pageSize + 1}–${Math.min(pagination.page * pagination.pageSize, pagination.total)} of ${pagination.total}` : '0 employees'}</span>
            <div className="flex items-center gap-2"><label htmlFor="page-size">Rows</label><select id="page-size" className="input w-20 py-1" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>{PAGE_SIZES.map((size) => <option key={size}>{size}</option>)}</select><button type="button" disabled={pagination.page <= 1 || loading} onClick={() => loadEmployees(pagination.page - 1)} className="btn-secondary px-3 py-1 disabled:opacity-40">Previous</button><span>Page {pagination.page} of {Math.max(pagination.totalPages, 1)}</span><button type="button" disabled={pagination.page >= pagination.totalPages || loading} onClick={() => loadEmployees(pagination.page + 1)} className="btn-secondary px-3 py-1 disabled:opacity-40">Next</button></div>
          </footer>
        </div>
      )}
    </section>
  );
}

const EMPLOYEE_FIELDS = ['EmployeeID', 'Name', 'Gender', 'Age', 'Department', 'JobRole', 'EducationLevel', 'JoiningDate', 'CountryCode', 'Country', 'PhoneNumber', 'MonthlySalary', 'OvertimeHoursPerMonth', 'LeavesTaken', 'LastLeaveDate', 'LeaveDayName', 'ProjectsHandled', 'TrainingHours', 'CustomerSatisfaction', 'LastPromotionYear', 'YearsAtCompany', 'WorkLifeBalanceScore', 'PerformanceRating', 'AttritionRisk'];

function RiskCount({ label, value, color }) {
  return <div className="rounded-lg bg-slate-950/60 py-2"><strong className={`block text-base ${color}`}>{value}</strong><span className="text-slate-500">{label}</span></div>;
}

function Empty({ text }) {
  return <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">{text}</div>;
}

export default DepartmentManagementPage;
