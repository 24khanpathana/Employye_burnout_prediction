import { lazy, Suspense } from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import AdminLoginPage from './pages/AdminLoginPage';
import EmployeeLoginPage from './pages/EmployeeLoginPage';
import RegisterPage from './pages/RegisterPage';

const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'));
const EmployeeDashboardPage = lazy(() => import('./pages/EmployeeDashboardPage'));

function AdminRoute() {
  const token = localStorage.getItem('burnoutguard_token');
  let user = null;
  try { user = JSON.parse(localStorage.getItem('burnoutguard_user') || 'null'); } catch { user = null; }

  if (!token || user?.role !== 'ADMIN') {
    return <Navigate to="/login/admin" replace />;
  }

  return <AdminDashboardPage />;
}

function App() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">Loading dashboard…</div>}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login/admin" element={<AdminLoginPage />} />
        <Route path="/login/employee" element={<EmployeeLoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/admin/dashboard" element={<AdminRoute />} />
        <Route path="/employee/dashboard" element={<EmployeeDashboardPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;
