import { useState } from 'react';
import { Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const departments = ['HR', 'IT', 'Finance & Accounting', 'Sales', 'Marketing', 'Operations', 'R&D', 'Engineering', 'Customer Support', 'Product Management', 'Business Development', 'Legal & Compliance', 'Procurement', 'Supply Chain & Logistics', 'QA', 'Administration', 'Security', 'Data Science & Analytics', 'Project Management', 'PR', 'Manufacturing / Production', 'Training & Development', 'Design / UI-UX', 'Cybersecurity', 'Facilities Management'];

function RegisterPage() {
  const [form, setForm] = useState({
    employeeId: '',
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    position: '',
    department: departments[0],
    gender: 'Male',
    age: '',
    educationLevel: '',
    joiningDate: '',
    countryCode: '+1',
    country: 'United States',
    phoneNumber: '',
    monthlySalary: ''
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Unable to submit your registration.');
      setSuccess(data.message);
    } catch (submitError) {
      setError(submitError.message || 'Unable to connect to the registration service.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-4xl card p-8">
        <h1 className="mb-6 text-3xl font-bold">Employee Registration</h1>

        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="employeeId">Employee ID</label>
            <input id="employeeId" required className="input" name="employeeId" value={form.employeeId} onChange={handleChange} />
          </div>
          <div>
            <label className="label" htmlFor="fullName">Full Name</label>
            <input id="fullName" required autoComplete="name" className="input" name="fullName" value={form.fullName} onChange={handleChange} />
          </div>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" required autoComplete="email" type="email" className="input" name="email" value={form.email} onChange={handleChange} />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" required minLength={8} autoComplete="new-password" type="password" className="input" name="password" value={form.password} onChange={handleChange} />
          </div>
          <div>
            <label className="label" htmlFor="confirmPassword">Confirm Password</label>
            <input id="confirmPassword" required minLength={8} autoComplete="new-password" type="password" className="input" name="confirmPassword" value={form.confirmPassword} onChange={handleChange} />
          </div>
          <div>
            <label className="label" htmlFor="position">Position / Job Role</label>
            <input id="position" required className="input" name="position" value={form.position} onChange={handleChange} />
          </div>
          <div>
            <label className="label" htmlFor="department">Department</label>
            <select id="department" required className="input" name="department" value={form.department} onChange={handleChange}>
              {departments.map((dep) => <option key={dep} value={dep}>{dep}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="gender">Gender</label>
            <select id="gender" required className="input" name="gender" value={form.gender} onChange={handleChange}>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="age">Age</label>
            <input id="age" required type="number" min="16" max="120" className="input" name="age" value={form.age} onChange={handleChange} />
          </div>
          <div>
            <label className="label" htmlFor="educationLevel">Education Level</label>
            <input id="educationLevel" required className="input" name="educationLevel" value={form.educationLevel} onChange={handleChange} />
          </div>
          <div>
            <label className="label" htmlFor="joiningDate">Joining Date</label>
            <input id="joiningDate" required type="date" className="input" name="joiningDate" value={form.joiningDate} onChange={handleChange} />
          </div>
          <div>
            <label className="label" htmlFor="countryCode">Country Code</label>
            <input id="countryCode" required className="input" name="countryCode" value={form.countryCode} onChange={handleChange} />
          </div>
          <div>
            <label className="label" htmlFor="country">Country</label>
            <input id="country" required className="input" name="country" value={form.country} onChange={handleChange} />
          </div>
          <div>
            <label className="label" htmlFor="phoneNumber">Phone Number</label>
            <input id="phoneNumber" required autoComplete="tel" className="input" name="phoneNumber" value={form.phoneNumber} onChange={handleChange} />
          </div>
          <div>
            <label className="label" htmlFor="monthlySalary">Monthly Salary</label>
            <input id="monthlySalary" required min="0" type="number" className="input" name="monthlySalary" value={form.monthlySalary} onChange={handleChange} />
          </div>

          {error && <p role="alert" className="text-sm text-rose-400 md:col-span-2">{error}</p>}
          {success && <div role="status" className="rounded-lg border border-emerald-800 bg-emerald-950/30 p-4 text-sm text-emerald-200 md:col-span-2">{success} <Link className="ml-2 font-semibold text-emerald-100 underline" to="/login/employee">Go to employee login</Link></div>}
          <div className="md:col-span-2 flex justify-end">
            <button type="submit" disabled={busy} className="btn-primary disabled:opacity-50">{busy ? 'Submitting…' : 'Submit Registration'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default RegisterPage;
