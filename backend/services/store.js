import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { ObjectId } from 'mongodb';
import { getCollection, getDatabase } from '../config/db.js';

export const DEFAULT_DEPARTMENTS = [
  'HR', 'IT', 'Finance & Accounting', 'Sales', 'Marketing', 'Operations', 'R&D', 'Engineering',
  'Customer Support', 'Product Management', 'Business Development', 'Legal & Compliance',
  'Procurement', 'Supply Chain & Logistics', 'QA', 'Administration', 'Security',
  'Data Science & Analytics', 'Project Management', 'PR', 'Manufacturing / Production',
  'Training & Development', 'Design / UI-UX', 'Cybersecurity', 'Facilities Management'
];
const isTestEnvironment = () => process.env.NODE_ENV === 'test'
  || Boolean(process.env.NODE_TEST_CONTEXT)
  || process.argv.some((argument) => /\.test\.[cm]?js$/i.test(argument));

const defaultAdmin = {
  id: 'admin-1',
  adminId: 'ADMIN-001',
  email: 'admin@burnoutguard.com',
  name: 'BurnoutGuard Admin',
  passwordHash: '',
  role: 'ADMIN'
};

const createDefaultStore = async () => {
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH
    || await bcrypt.hash('admin123', 10);
  return {
    admins: [{ ...defaultAdmin, passwordHash: adminPasswordHash }],
    departments: DEFAULT_DEPARTMENTS.map((name) => ({ id: `dept-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, name })),
    employees: [],
    registrations: [],
    tests: [],
    submissions: [],
    predictions: [],
    tasks: [],
    attendance: [],
    notifications: [],
    auditLogs: [],
    otpStore: {}
  };
};

export const initializeStore = async () => {
  if (!isTestEnvironment()) return loadMongoStore();
  if (!globalThis.__burnoutguardStore) {
    globalThis.__burnoutguardStore = await createDefaultStore();
  }
  return globalThis.__burnoutguardStore;
};

export const getStore = async () => initializeStore();

export const persistStore = async (store) => {
  if (isTestEnvironment()) {
    globalThis.__burnoutguardStore = store;
    return store;
  }
  getDatabase();
  const collections = [
    ['admins', store.admins],
    ['departments', store.departments],
    ['employees', store.employees],
    ['registrations', store.registrations],
    ['assessments', store.tests],
    ['submissions', store.submissions],
    ['predictions', store.predictions],
    ['tasks', store.tasks],
    ['attendance', store.attendance],
    ['notifications', store.notifications],
    ['auditlogs', store.auditLogs]
  ];
  await Promise.all(collections.map(([name, records]) => upsertRecords(name, records || [])));

  const otpRecords = Object.entries(store.otpStore || {}).map(([email, record]) => ({ id: email, ...record }));
  await upsertRecords('otps', otpRecords);
  const otpIds = otpRecords.map((record) => record.id);
  await getCollection('otps').deleteMany({ _id: { $nin: otpIds } });

  if (store.dataset) {
    await getCollection('datasets').replaceOne(
      { _id: 'current' },
      { _id: 'current', ...store.dataset },
      { upsert: true }
    );
  }
  return store;
};

async function upsertRecords(collectionName, records) {
  if (!records.length) return;
  const operations = records.map((record) => {
    if (!record.id) throw new Error(`Cannot persist ${collectionName} record without an id.`);
    const { _id, ...data } = record;
    return {
      replaceOne: {
        filter: { _id: mongoId(record.id) },
        replacement: { ...data, _id: mongoId(record.id), id: String(record.id) },
        upsert: true
      }
    };
  });
  await getCollection(collectionName).bulkWrite(operations, { ordered: true });
}

async function loadMongoStore() {
  const [
    admins, departments, employees, registrations, tests, submissions, predictions,
    tasks, attendance, notifications, auditLogs, otpRecords, dataset
  ] = await Promise.all([
    readRecords('admins'),
    readRecords('departments'),
    readRecords('employees'),
    readRecords('registrations'),
    readRecords('assessments'),
    readRecords('submissions'),
    readRecords('predictions'),
    readRecords('tasks'),
    readRecords('attendance'),
    readRecords('notifications'),
    readRecords('auditlogs'),
    readRecords('otps'),
    getCollection('datasets').findOne({ _id: 'current' })
  ]);

  return {
    admins: admins.map((record) => ({ ...record, role: 'ADMIN' })),
    departments: departments.length ? departments : DEFAULT_DEPARTMENTS.map((name) => ({
      id: `dept-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name
    })),
    employees: employees.map((record) => ({ ...record, role: 'EMPLOYEE' })),
    registrations,
    tests,
    submissions,
    predictions,
    tasks,
    attendance,
    notifications,
    auditLogs,
    otpStore: Object.fromEntries(otpRecords.map(({ id, ...record }) => [id, record])),
    dataset: dataset ? omitMongoId(dataset) : undefined
  };
}

async function readRecords(collectionName) {
  const documents = await getCollection(collectionName).find({}).toArray();
  return documents.map((document) => {
    const { _id, ...record } = document;
    return { ...record, id: record.id || String(_id) };
  });
}

function mongoId(value) {
  const stringValue = String(value);
  return /^[a-f\d]{24}$/i.test(stringValue) ? new ObjectId(stringValue) : stringValue;
}

function omitMongoId(document) {
  const { _id, ...record } = document;
  return record;
}

export const createEmployeeRecord = async (payload) => {
  const store = await getStore();
  const employee = {
    id: `emp-${randomUUID()}`,
    employeeId: payload.employeeId,
    fullName: payload.fullName,
    email: payload.email,
    passwordHash: await bcrypt.hash(payload.password, 10),
    position: payload.position,
    department: payload.department,
    gender: payload.gender,
    age: Number(payload.age),
    educationLevel: payload.educationLevel,
    joiningDate: payload.joiningDate || new Date().toISOString(),
    countryCode: payload.countryCode,
    country: payload.country,
    phoneNumber: payload.phoneNumber,
    monthlySalary: Number(payload.monthlySalary),
    status: 'PENDING',
    role: 'EMPLOYEE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  store.employees.push(employee);
  await persistStore(store);
  return employee;
};

export const findEmployeeByEmail = async (email) => {
  const store = await getStore();
  return store.employees.find((employee) => employee.email?.toLowerCase() === String(email).toLowerCase());
};

export const findEmployeeById = async (employeeId) => {
  const store = await getStore();
  return store.employees.find((employee) => employee.id === employeeId || employee.employeeId === employeeId);
};

export const findEmployeeByEmployeeId = async (employeeId) => {
  const store = await getStore();
  return store.employees.find((employee) => employee.employeeId?.toLowerCase() === String(employeeId).toLowerCase());
};

export const adminLoginFallback = async (adminId, password) => {
  const store = await getStore();
  const normalized = String(adminId || '').toLowerCase();
  const admin = store.admins.find((entry) =>
    entry.adminId?.toLowerCase() === normalized || entry.email?.toLowerCase() === normalized
  );
  if (!admin) return null;
  const valid = await bcrypt.compare(password, admin.passwordHash);
  return valid ? admin : null;
};

export const employeeLoginFallback = async (employeeId, password) => {
  const store = await getStore();
  const normalized = String(employeeId || '').toLowerCase();
  const employee = store.employees.find((entry) =>
    entry.employeeId?.toLowerCase() === normalized || entry.email?.toLowerCase() === normalized
  );
  if (!employee || employee.status !== 'APPROVED') return null;
  const valid = await bcrypt.compare(password, employee.passwordHash);
  return valid ? employee : null;
};

export const getEmployeeByIdSafe = async (userId, employeeId) => {
  const store = await getStore();
  return store.employees.find((entry) => entry.id === userId || entry.employeeId === employeeId);
};

export const createNotification = async (payload) => {
  const store = await getStore();
  const notification = {
    id: `notif-${randomUUID()}`,
    ...payload,
    read: false,
    createdAt: new Date().toISOString()
  };
  store.notifications.push(notification);
  await persistStore(store);
  return notification;
};

export const createRegistrationRequest = async (payload) => {
  const store = await getStore();
  const registration = {
    id: `req-${randomUUID()}`,
    ...payload,
    status: 'PENDING',
    createdAt: new Date().toISOString()
  };
  store.registrations.push(registration);
  await persistStore(store);
  return registration;
};

export const importEmployeeDataset = async (csvText, source) => {
  const rows = parseCsv(csvText);
  if (rows.length < 2) throw new Error('The CSV must contain a header row and at least one employee record.');

  const headers = rows[0].map(normalizeHeader);
  const index = resolveColumnIndexes(headers);
  if (index.employeeId === undefined) throw new Error('CSV must include an employee ID column, such as employee_id or Employee ID.');
  if (index.name === undefined) throw new Error('CSV must include an employee name column, such as full_name or Name.');
  const store = await getStore();
  const seenIds = new Set(store.employees.map((employee) => String(employee.employeeId || '').toLowerCase()));
  const seenEmails = new Set(store.employees.map((employee) => String(employee.email || '').toLowerCase()).filter(Boolean));
  const importedEmployees = [];
  const rejectedRows = [];
  let duplicates = 0;
  for (const [rowIndex, row] of rows.slice(1).entries()) {
    if (!row.some((value) => value.trim())) continue;
    const csvRow = rowIndex + 2;
    const employeeId = valueAt(row, index.employeeId);
    const fullName = valueAt(row, index.name);
    if (!employeeId || !fullName) {
      rejectedRows.push({ row: csvRow, reason: !employeeId ? 'Employee ID is required.' : 'Employee name is required.' });
      continue;
    }
    const email = valueAt(row, index.email) || null;
    if (seenIds.has(employeeId.toLowerCase()) || (email && seenEmails.has(email.toLowerCase()))) {
      duplicates += 1;
      continue;
    }

    const numberFields = {
      age: [index.age, 0, 120],
      monthlySalary: [index.salary, 0, Number.MAX_VALUE],
      overtimeHoursPerMonth: [index.overtime, 0, Number.MAX_VALUE],
      leavesTaken: [index.leaves, 0, Number.MAX_VALUE],
      projectsHandled: [index.projects, 0, Number.MAX_VALUE],
      trainingHours: [index.training, 0, Number.MAX_VALUE],
      customerSatisfaction: [index.customerSatisfaction, 0, 5],
      lastPromotionYear: [index.lastPromotionYear, 0, new Date().getFullYear()],
      yearsAtCompany: [index.yearsAtCompany, 0, Number.MAX_VALUE],
      workLifeBalanceScore: [index.workLifeBalance, 0, 5],
      performanceRating: [index.performanceRating, 0, 5]
    };
    const numericValues = {};
    let invalidNumber = null;
    for (const [field, [columnIndex, minimum, maximum]] of Object.entries(numberFields)) {
      const rawValue = valueAt(row, columnIndex);
      if (!rawValue) {
        numericValues[field] = null;
        continue;
      }
      const parsed = Number(rawValue.replaceAll(',', ''));
      if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
        invalidNumber = `${field} must be a number between ${minimum} and ${maximum}.`;
        break;
      }
      numericValues[field] = parsed;
    }
    if (invalidNumber) {
      rejectedRows.push({ row: csvRow, reason: invalidNumber });
      continue;
    }

    const attritionRisk = valueAt(row, index.attritionRisk).toUpperCase() || null;
    if (attritionRisk && !['LOW', 'MEDIUM', 'HIGH'].includes(attritionRisk)) {
      rejectedRows.push({ row: csvRow, reason: 'AttritionRisk must be LOW, MEDIUM, or HIGH.' });
      continue;
    }
    const now = new Date().toISOString();
    const employee = {
      id: `import-${randomUUID()}`,
      employeeId,
      fullName,
      email,
      passwordHash: '',
      position: valueAt(row, index.position) || null,
      department: valueAt(row, index.department) || null,
      gender: valueAt(row, index.gender) || null,
      ...numericValues,
      educationLevel: valueAt(row, index.educationLevel) || null,
      joiningDate: valueAt(row, index.joiningDate) || null,
      countryCode: valueAt(row, index.countryCode) || null,
      country: valueAt(row, index.country) || null,
      phoneNumber: valueAt(row, index.phoneNumber) || null,
      lastLeaveDate: valueAt(row, index.lastLeaveDate) || null,
      leaveDayName: valueAt(row, index.leaveDayName) || null,
      lastPromotionYear: numericValues.lastPromotionYear,
      attritionRisk,
      burnoutRisk: null,
      burnoutScore: null,
      status: 'APPROVED',
      createdAt: now,
      updatedAt: now,
      role: 'EMPLOYEE'
    };
    importedEmployees.push(employee);
    seenIds.add(employeeId.toLowerCase());
    if (email) seenEmails.add(email.toLowerCase());
  }
  if (!importedEmployees.length && rejectedRows.length === 0) throw new Error('The CSV does not contain any employee records.');
  store.employees.push(...importedEmployees);
  store.dataset = { source, count: importedEmployees.length, rejected: rejectedRows.length, duplicates, importedAt: new Date().toISOString() };
  await persistStore(store);
  return {
    count: importedEmployees.length,
    rejected: rejectedRows.length,
    duplicates,
    rejectionDetails: rejectedRows,
    dataset: store.dataset
  };
};

function valueAt(row, position) {
  return position === undefined ? '' : String(row[position] || '').trim();
}

function normalizeHeader(header) {
  return String(header || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function resolveColumnIndexes(headers) {
  const find = (...aliases) => aliases.map(normalizeHeader).map((alias) => headers.indexOf(alias)).find((candidate) => candidate >= 0);
  return {
    employeeId: find('employee_id', 'employee id', 'employee_identifier', 'emp_id', 'id'),
    name: find('name', 'full_name', 'employee_name', 'employee name', 'staff_name'),
    salary: find('salary', 'monthly_salary', 'monthly income', 'monthly_income', 'income'),
    age: find('age'),
    gender: find('gender'),
    educationLevel: find('education_level', 'education level'),
    joiningDate: find('joining_date', 'joining date'),
    countryCode: find('country_code', 'country code'),
    country: find('country'),
    phoneNumber: find('phone_number', 'phone number'),
    overtime: find('overtime_hours_per_month', 'overtime hours per month', 'overtime_hours', 'overtime'),
    leaves: find('leaves_taken', 'leaves taken', 'leaves'),
    lastLeaveDate: find('last_leave_date', 'last leave date'),
    leaveDayName: find('leave_day_name', 'leave day name'),
    projects: find('projects_handled', 'projects handled'),
    training: find('training_hours', 'training hours'),
    customerSatisfaction: find('customer_satisfaction', 'customer satisfaction'),
    lastPromotionYear: find('last_promotion_year', 'last promotion year'),
    yearsAtCompany: find('years_at_company', 'years at company'),
    workLifeBalance: find('work_life_balance_score', 'work life balance score', 'work_life_balance'),
    performanceRating: find('performance_rating', 'performance rating'),
    attritionRisk: find('attrition_risk', 'attrition risk'),
    department: find('department', 'team', 'business_unit', 'company_type', 'company type'),
    email: find('email', 'email_address', 'email address'),
    position: find('position', 'job_role', 'job role', 'designation', 'role')
  };
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let position = 0; position < text.length; position += 1) {
    const character = text[position];
    const nextCharacter = text[position + 1];
    if (character === '"' && quoted && nextCharacter === '"') { cell += '"'; position += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && nextCharacter === '\n') position += 1;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += character;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
