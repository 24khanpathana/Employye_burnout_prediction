import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function EmployeeLoginPage() {
  const [form, setForm] = useState({ employeeId: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
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
    setBusy(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/employee/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Unable to sign in.');
      localStorage.setItem('burnoutguard_token', data.token);
      localStorage.setItem('burnoutguard_user', JSON.stringify(data.user));
      navigate('/employee/dashboard', { replace: true });
    } catch (submitError) {
      setError(submitError.message || 'Unable to connect to the backend.');
    } finally {
      setBusy(false);
    }
  };

  const requestReset = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOrEmployeeId: resetForm.emailOrEmployeeId })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Unable to request a reset code.');
      setResetForm((current) => ({ ...current, email: current.emailOrEmployeeId.includes('@') ? current.emailOrEmployeeId : '' }));
      setResetStep('verify');
      setResetMessage(data.message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetForm.email, otp: resetForm.otp })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Unable to verify the reset code.');
      setResetStep('reset');
      setResetMessage(data.message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resetForm)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Unable to reset the password.');
      setResetMessage(data.message);
      setResetOpen(false);
      setResetStep('request');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-100">
      <div className="card w-full max-w-md p-8">
        <div className="mb-6 text-center">
          <div className="mb-3 text-2xl font-bold">BurnoutGuard</div>
          <h1 className="text-2xl font-semibold">Employee Login</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Employee ID</label>
            <input required autoComplete="username" className="input" name="employeeId" value={form.employeeId} onChange={handleChange} placeholder="EMP1024" />
          </div>
          <div>
            <label className="label">Password</label>
            <input required autoComplete="current-password" type="password" className="input" name="password" value={form.password} onChange={handleChange} placeholder="••••••••" />
          </div>
          {error && <p className="text-sm text-rose-400" role="alert">{error}</p>}
          <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-50">{busy ? 'Signing in…' : 'Login'}</button>
        </form>
        <button type="button" onClick={() => { setResetOpen((open) => !open); setError(''); }} className="mt-4 w-full text-center text-sm text-blue-400 hover:text-blue-300">Forgot password?</button>
        {resetOpen && <form onSubmit={resetStep === 'request' ? requestReset : resetStep === 'verify' ? verifyCode : resetPassword} className="mt-5 space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <h2 className="font-semibold">Reset employee password</h2>
          {resetStep === 'request' && <><label className="label" htmlFor="reset-account">Email or employee ID</label><input id="reset-account" required className="input" value={resetForm.emailOrEmployeeId} onChange={(event) => setResetForm((current) => ({ ...current, emailOrEmployeeId: event.target.value }))} /><button disabled={busy} className="btn-secondary w-full">{busy ? 'Sending…' : 'Send reset code'}</button></>}
          {resetStep === 'verify' && <><label className="label" htmlFor="reset-email">Account email</label><input id="reset-email" type="email" required className="input" value={resetForm.email} onChange={(event) => setResetForm((current) => ({ ...current, email: event.target.value }))} /><label className="label" htmlFor="reset-otp">6-digit reset code</label><input id="reset-otp" required inputMode="numeric" maxLength={6} className="input" value={resetForm.otp} onChange={(event) => setResetForm((current) => ({ ...current, otp: event.target.value }))} /><button disabled={busy} className="btn-secondary w-full">{busy ? 'Verifying…' : 'Verify code'}</button></>}
          {resetStep === 'reset' && <><label className="label" htmlFor="new-password">New password</label><input id="new-password" required minLength={8} type="password" className="input" value={resetForm.newPassword} onChange={(event) => setResetForm((current) => ({ ...current, newPassword: event.target.value }))} /><label className="label" htmlFor="confirm-password">Confirm new password</label><input id="confirm-password" required minLength={8} type="password" className="input" value={resetForm.confirmPassword} onChange={(event) => setResetForm((current) => ({ ...current, confirmPassword: event.target.value }))} /><button disabled={busy} className="btn-primary w-full">{busy ? 'Updating…' : 'Update password'}</button></>}
          {resetMessage && <p className="text-xs text-slate-400">{resetMessage}</p>}
        </form>}

        <div className="mt-5 text-center text-sm text-slate-400">
          <Link to="/" className="text-blue-400">Back to home</Link>
        </div>
      </div>
    </div>
  );
}

export default EmployeeLoginPage;
