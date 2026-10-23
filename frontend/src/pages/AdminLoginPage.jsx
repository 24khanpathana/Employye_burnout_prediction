import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function AdminLoginPage() {
  const [form, setForm] = useState({ adminId: '', password: '' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetStep, setResetStep] = useState('request');
  const [resetForm, setResetForm] = useState({ emailOrEmployeeId: '', email: '', otp: '', newPassword: '', confirmPassword: '' });
  const [resetMessage, setResetMessage] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Unable to login');
      }

      localStorage.setItem('burnoutguard_token', data.token);
      localStorage.setItem('burnoutguard_user', JSON.stringify(data.user));
      navigate('/admin/dashboard', { replace: true });
    } catch (submitError) {
      setError(submitError.message || 'Unable to connect to the backend');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateResetForm = (event) => {
    setResetForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const submitResetStep = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    const endpoints = {
      request: ['/api/auth/forgot-password', { emailOrEmployeeId: resetForm.emailOrEmployeeId }],
      verify: ['/api/auth/verify-otp', { email: resetForm.email, otp: resetForm.otp }],
      reset: ['/api/auth/reset-password', resetForm]
    };
    try {
      const [path, payload] = endpoints[resetStep];
      const response = await fetch(`${API_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Password reset request failed.');
      setResetMessage(data.message);
      if (resetStep === 'request') {
        if (resetForm.emailOrEmployeeId.includes('@')) setResetForm((current) => ({ ...current, email: current.emailOrEmployeeId }));
        setResetStep('verify');
      } else if (resetStep === 'verify') {
        setResetStep('reset');
      } else {
        setResetOpen(false);
        setResetStep('request');
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-100">
      <div className="card w-full max-w-md p-8">
        <div className="mb-6 text-center">
          <div className="mb-3 text-2xl font-bold">BurnoutGuard</div>
          <h1 className="text-2xl font-semibold">Admin Login</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Admin ID</label>
            <input className="input" name="adminId" value={form.adminId} onChange={handleChange} placeholder="ADMIN-001" />
          </div>
          <div>
            <label className="label">Password</label>
            <input type="password" className="input" name="password" value={form.password} onChange={handleChange} placeholder="••••••••" />
          </div>
          {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in...' : 'Login'}
          </button>
          <button type="button" onClick={() => { setResetOpen((open) => !open); setError(''); }} className="btn-secondary w-full">Forgot Password</button>
        </form>
        {resetOpen && <form onSubmit={submitResetStep} className="mt-5 space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <h2 className="font-semibold">Reset administrator password</h2>
          {resetStep === 'request' && <><label className="label" htmlFor="admin-reset-id">Admin ID or account email</label><input id="admin-reset-id" name="emailOrEmployeeId" required className="input" value={resetForm.emailOrEmployeeId} onChange={updateResetForm} /><button disabled={isSubmitting} className="btn-secondary w-full">Send reset code</button></>}
          {resetStep === 'verify' && <><label className="label" htmlFor="admin-reset-email">Account email</label><input id="admin-reset-email" name="email" type="email" required className="input" value={resetForm.email} onChange={updateResetForm} /><label className="label" htmlFor="admin-reset-otp">6-digit reset code</label><input id="admin-reset-otp" name="otp" inputMode="numeric" maxLength={6} required className="input" value={resetForm.otp} onChange={updateResetForm} /><button disabled={isSubmitting} className="btn-secondary w-full">Verify code</button></>}
          {resetStep === 'reset' && <><label className="label" htmlFor="admin-new-password">New password</label><input id="admin-new-password" name="newPassword" type="password" minLength={8} required className="input" value={resetForm.newPassword} onChange={updateResetForm} /><label className="label" htmlFor="admin-confirm-password">Confirm new password</label><input id="admin-confirm-password" name="confirmPassword" type="password" minLength={8} required className="input" value={resetForm.confirmPassword} onChange={updateResetForm} /><button disabled={isSubmitting} className="btn-primary w-full">Update password</button></>}
          {resetMessage && <p className="text-xs text-slate-400">{resetMessage}</p>}
        </form>}

        <div className="mt-5 text-center text-sm text-slate-400">
          <Link to="/" className="text-blue-400">Back to home</Link>
        </div>
      </div>
    </div>
  );
}

export default AdminLoginPage;
