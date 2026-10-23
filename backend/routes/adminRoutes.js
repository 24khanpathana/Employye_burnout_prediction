import express from 'express';
import multer from 'multer';
import axios from 'axios';
import { randomUUID } from 'node:crypto';
import { authenticateAdmin } from '../middleware/auth.js';
import { getStore, persistStore, createNotification, importEmployeeDataset } from '../services/store.js';
import {
  createDefaultQuestions,
  DEFAULT_SCORING_WEIGHTS,
  validateAssessmentQuestions,
  validateScoringWeights
} from '../services/assessmentScoring.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Number(process.env.MAX_CSV_SIZE_MB || 100) * 1024 * 1024 }
});
const uploadCsv = (req, res, next) => upload.single('file')(req, res, (error) => {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    const maxSize = Number(process.env.MAX_CSV_SIZE_MB || 100);
    return res.status(413).json({ message: `CSV file is too large. Maximum allowed size is ${maxSize} MB.` });
  }
  if (error) return res.status(400).json({ message: error.message });
  return next();
});

router.use(authenticateAdmin);
router.use((req, res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  res.once('finish', () => {
    void getStore().then(async (store) => {
      store.auditLogs ||= [];
      store.auditLogs.unshift({
        id: randomUUID(),
        actorId: req.user.userId,
        actor: req.user.adminId || req.user.userId,
        action: `${req.method} ${req.baseUrl}${req.path}`,
        statusCode: res.statusCode,
        occurredAt: new Date().toISOString()
      });
      store.auditLogs.length = Math.min(store.auditLogs.length, 5000);
      await persistStore(store);
    }).catch((error) => console.error('Failed to persist administrator audit log:', error.message));
  });
  return next();
});

router.get('/dashboard', async (req, res) => {
  const store = await getStore();
  const activeEmployees = store.employees.filter((employee) => employee.status === 'APPROVED');
  const knownBurnoutScores = activeEmployees
    .map((employee) => employee.burnoutScore)
    .filter((score) => score !== null && score !== undefined && Number.isFinite(Number(score)))
    .map(Number);
  const now = Date.now();
  res.json({
    stats: {
      totalEmployees: activeEmployees.length,
      highBurnoutRisk: activeEmployees.filter((emp) => emp.burnoutRisk === 'HIGH').length,
      highAttritionRisk: activeEmployees.filter((emp) => emp.attritionRisk === 'HIGH').length,
      employeesRetained: activeEmployees.filter((emp) => ['LOW', 'MEDIUM'].includes(emp.attritionRisk)).length,
      pendingRegistrations: store.registrations.filter((item) => item.status === 'PENDING').length,
      averageBurnoutScore: knownBurnoutScores.length
        ? Number((knownBurnoutScores.reduce((sum, score) => sum + score, 0) / knownBurnoutScores.length).toFixed(2))
        : null,
      burnoutScoreCoverage: activeEmployees.length
        ? Number(((knownBurnoutScores.length / activeEmployees.length) * 100).toFixed(1))
        : null,
      openTasks: store.tasks.filter((task) => !['COMPLETED'].includes(taskStatus(task))).length,
      overdueTasks: store.tasks.filter((task) => taskStatus(task) === 'OVERDUE').length,
      submissionsThisMonth: store.submissions.filter((submission) => {
        const submittedAt = Date.parse(submission.submittedAt || '');
        const date = new Date(now);
        return Number.isFinite(submittedAt)
          && new Date(submittedAt).getFullYear() === date.getFullYear()
          && new Date(submittedAt).getMonth() === date.getMonth();
      }).length,
      activeTests: store.tests.filter((test) => {
        const starts = test.startAt ? Date.parse(test.startAt) : 0;
        const expires = test.expiresAt ? Date.parse(test.expiresAt) : Number.POSITIVE_INFINITY;
        return ['LIVE', 'SCHEDULED'].includes(test.status)
          && Number.isFinite(starts) && starts <= now
          && (!test.expiresAt || (Number.isFinite(expires) && expires > now));
      }).length
    },
    employees: activeEmployees.map(withoutPasswordHash),
    requests: store.registrations.map(withoutPasswordHash),
    notifications: store.notifications,
    departments: groupDepartments(activeEmployees, store.departments),
    recentActivity: [...(store.auditLogs || [])]
      .sort((first, second) => Date.parse(second.occurredAt || 0) - Date.parse(first.occurredAt || 0))
      .slice(0, 8)
  });
});

router.get('/employees', async (req, res) => {
  const store = await getStore();
  res.json({ employees: store.employees.map(withoutPasswordHash) });
});

router.get('/tasks', async (req, res) => {
  const store = await getStore();
  const employees = new Map(store.employees.map((employee) => [employee.id, employee]));
  return res.json({
    tasks: store.tasks.map((task) => ({
      ...task,
      status: taskStatus(task),
      employee: employees.get(task.assignedToId)
        ? { employeeId: employees.get(task.assignedToId).employeeId, fullName: employees.get(task.assignedToId).fullName }
        : null
    }))
  });
});

router.put('/tasks/:id', async (req, res) => {
  const store = await getStore();
  const task = store.tasks.find((item) => item.id === req.params.id);
  if (!task) return res.status(404).json({ message: 'Task not found.' });
  if (req.body.status !== undefined) {
    const status = String(req.body.status).toUpperCase();
    if (!['PENDING', 'IN_PROGRESS', 'COMPLETED'].includes(status)) {
      return res.status(400).json({ message: 'Task status must be PENDING, IN_PROGRESS, or COMPLETED. Overdue is determined by its due date.' });
    }
    task.status = status;
  }
  if (req.body.title !== undefined) {
    if (typeof req.body.title !== 'string' || !req.body.title.trim()) return res.status(400).json({ message: 'Task title cannot be empty.' });
    task.title = req.body.title.trim();
  }
  if (req.body.dueDate !== undefined) {
    const due = Date.parse(req.body.dueDate);
    if (!Number.isFinite(due)) return res.status(400).json({ message: 'Task due date is invalid.' });
    task.dueDate = new Date(due).toISOString();
  }
  task.updatedAt = new Date().toISOString();
  await persistStore(store);
  return res.json({ task: { ...task, status: taskStatus(task) } });
});

router.post('/tasks', async (req, res) => {
  const { title, description, assignedToId, dueDate, priority } = req.body;
  if (typeof title !== 'string' || !title.trim() || typeof assignedToId !== 'string') {
    return res.status(400).json({ message: 'Task title and assigned employee are required.' });
  }
  if (!['LOW', 'MEDIUM', 'HIGH'].includes(String(priority || '').toUpperCase())) {
    return res.status(400).json({ message: 'Priority must be LOW, MEDIUM, or HIGH.' });
  }
  const due = dueDate ? Date.parse(dueDate) : NaN;
  if (!Number.isFinite(due)) return res.status(400).json({ message: 'A valid task due date is required.' });
  const store = await getStore();
  const employee = store.employees.find((item) => item.id === assignedToId && item.status === 'APPROVED');
  if (!employee) return res.status(404).json({ message: 'Approved employee not found.' });
  const task = {
    id: randomUUID(),
    title: title.trim(),
    description: String(description || ''),
    assignedToId: employee.id,
    assignedById: req.user.userId,
    dueDate: new Date(due).toISOString(),
    priority: String(priority).toUpperCase(),
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  store.tasks.unshift(task);
  await persistStore(store);
  await createNotification({ employeeId: employee.id, type: 'TASK_ASSIGNED', message: `A new task was assigned: ${task.title}.` });
  return res.status(201).json({ task });
});

router.get('/attendance', async (req, res) => {
  const store = await getStore();
  const employeeId = String(req.query.employeeId || '');
  const month = String(req.query.month || '');
  const attendance = store.attendance.filter((entry) => {
    if (employeeId && entry.employeeId !== employeeId) return false;
    if (month && String(entry.date || '').slice(0, 7) !== month) return false;
    return true;
  });
  const counts = { PRESENT: 0, ABSENT: 0, LATE: 0, LEAVE: 0 };
  for (const entry of attendance) {
    if (Object.hasOwn(counts, entry.status)) counts[entry.status] += 1;
  }
  return res.json({ attendance, summary: counts });
});

router.get('/attendance/export', async (req, res) => {
  const store = await getStore();
  const employeeId = String(req.query.employeeId || '');
  const month = String(req.query.month || '');
  if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return res.status(400).json({ message: 'Month must use YYYY-MM format.' });
  }
  const employees = new Map(store.employees.map((employee) => [employee.id, employee]));
  const rows = store.attendance.filter((entry) =>
    (!employeeId || entry.employeeId === employeeId)
    && (!month || String(entry.date || '').slice(0, 7) === month)
  );
  const columns = [
    ['Employee ID', (entry) => employees.get(entry.employeeId)?.employeeId || 'N/A'],
    ['Employee Name', (entry) => employees.get(entry.employeeId)?.fullName || 'N/A'],
    ['Department', (entry) => employees.get(entry.employeeId)?.department || 'N/A'],
    ['Date', (entry) => entry.date], ['Status', (entry) => entry.status],
    ['Note', (entry) => entry.note], ['Recorded At', (entry) => entry.createdAt]
  ];
  const csv = [columns.map(([label]) => csvCell(label)).join(','), ...rows.map((entry) =>
    columns.map(([, value]) => csvCell(value(entry))).join(',')
  )].join('\r\n');
  return res.type('text/csv').attachment('attendance-report.csv').send(csv);
});

router.post('/attendance', async (req, res) => {
  const { employeeId, date, status, note } = req.body;
  if (typeof employeeId !== 'string' || !date || !['PRESENT', 'ABSENT', 'LATE', 'LEAVE'].includes(String(status || '').toUpperCase())) {
    return res.status(400).json({ message: 'Employee, date, and a valid attendance status are required.' });
  }
  const timestamp = Date.parse(date);
  if (!Number.isFinite(timestamp)) return res.status(400).json({ message: 'Attendance date is invalid.' });
  const store = await getStore();
  const employee = store.employees.find((item) => item.id === employeeId && item.status === 'APPROVED');
  if (!employee) return res.status(404).json({ message: 'Approved employee not found.' });
  const day = new Date(timestamp).toISOString().slice(0, 10);
  const duplicate = store.attendance.find((entry) =>
    entry.employeeId === employee.id && String(entry.date || '').slice(0, 10) === day
  );
  if (duplicate) return res.status(409).json({ message: 'An attendance record already exists for this employee and date.' });
  const attendance = {
    id: randomUUID(),
    employeeId: employee.id,
    date: day,
    status: String(status).toUpperCase(),
    note: typeof note === 'string' ? note.trim() : '',
    recordedById: req.user.userId,
    createdAt: new Date().toISOString()
  };
  store.attendance.unshift(attendance);
  await persistStore(store);
  return res.status(201).json({ attendance });
});

router.get('/employees/:id', async (req, res) => {
  const store = await getStore();
  const employee = store.employees.find((item) => item.id === req.params.id || item.employeeId === req.params.id);
  if (!employee) return res.status(404).json({ message: 'Employee not found.' });
  const { passwordHash, ...safeEmployee } = employee;
  return res.json({ employee: safeEmployee });
});

router.get('/predictions', async (req, res) => {
  const store = await getStore();
  return res.json({ predictions: store.predictions || [] });
});

router.get('/predictions/export', async (req, res) => {
  const store = await getStore();
  const from = req.query.dateFrom ? Date.parse(`${req.query.dateFrom}T00:00:00.000Z`) : null;
  const to = req.query.dateTo ? Date.parse(`${req.query.dateTo}T23:59:59.999Z`) : null;
  if ((req.query.dateFrom && !Number.isFinite(from)) || (req.query.dateTo && !Number.isFinite(to))) {
    return res.status(400).json({ message: 'Prediction report date filters must be valid dates.' });
  }
  if (from !== null && to !== null && from > to) {
    return res.status(400).json({ message: 'Start date must not be later than end date.' });
  }
  const employeeId = String(req.query.employeeId || '');
  const employeeById = new Map(store.employees.map((employee) => [employee.id, employee]));
  const rows = (store.predictions || []).filter((prediction) => {
    const time = Date.parse(prediction.predictionDate || '');
    if (employeeId && prediction.employeeId !== employeeId && prediction.employeeIdentifier !== employeeId) return false;
    if (from !== null && (!Number.isFinite(time) || time < from)) return false;
    if (to !== null && (!Number.isFinite(time) || time > to)) return false;
    return true;
  });
  const columns = [
    ['Employee ID', (row) => row.employeeIdentifier || employeeById.get(row.employeeId)?.employeeId || 'N/A'],
    ['Employee Name', (row) => employeeById.get(row.employeeId)?.fullName || 'N/A'],
    ['Department', (row) => employeeById.get(row.employeeId)?.department || 'N/A'],
    ['Prediction Date', (row) => row.predictionDate], ['Burnout Score', (row) => row.burnoutScore],
    ['Burnout Risk', (row) => row.burnoutRisk], ['Method', (row) => row.burnoutPredictionMethod],
    ['Attrition Risk', (row) => row.attritionRisk], ['Attrition Probability', (row) => row.attritionProbability],
    ['Sentiment Score', (row) => row.sentimentScore], ['Model Version', (row) => row.modelVersion]
  ];
  const csv = [columns.map(([label]) => csvCell(label)).join(','), ...rows.map((row) =>
    columns.map(([, value]) => csvCell(value(row))).join(',')
  )].join('\r\n');
  return res.type('text/csv').attachment('prediction-history.csv').send(csv);
});

router.post('/predictions/run', async (req, res) => {
  const store = await getStore();
  const serviceUrl = String(process.env.PYTHON_ML_URL || 'http://localhost:8000').replace(/\/+$/, '');
  let health;
  try {
    health = await axios.get(`${serviceUrl}/health`, { timeout: 5000 });
  } catch (error) {
    return res.status(503).json({ message: 'Python ML service is unavailable.', detail: axios.isAxiosError(error) ? error.message : 'Health check failed.' });
  }
  const approvedEmployees = store.employees.filter((employee) => employee.status === 'APPROVED');
  const predictions = [];
  const skipped = [];

  try {
    for (let index = 0; index < approvedEmployees.length; index += 10) {
      const batch = approvedEmployees.slice(index, index + 10);
      const outcomes = await Promise.all(batch.map(async (employee) => {
        try {
          const response = await axios.post(`${serviceUrl}/predict`, { data: toMLRecord(employee) }, { timeout: 15000 });
          return { employee, result: response.data };
        } catch (error) {
          if (axios.isAxiosError(error) && error.response?.status === 422) {
            return { employee, skipped: error.response.data?.detail || 'Required prediction data is missing.' };
          }
          throw error;
        }
      }));
      for (const outcome of outcomes) {
        if (outcome.skipped) {
          skipped.push({ employeeId: outcome.employee.employeeId, reason: outcome.skipped });
          continue;
        }
        const employee = outcome.employee;
        const result = outcome.result;
        const modelBurnoutRisk = normalizedRisk(result.burnout_prediction?.risk);
        const formulaBurnoutRisk = normalizedRisk(result.formula_burnout_risk);
        const modelAttritionRisk = attritionRiskCategory(result.attrition_prediction);
        employee.burnoutScore = Number(result.burnout_score);
        employee.burnoutRisk = modelBurnoutRisk || formulaBurnoutRisk;
        employee.burnoutPredictionMethod = modelBurnoutRisk ? 'XGBOOST' : 'BURNOUT_FORMULA';
        employee.predictionModelVersion = result.model_version || null;
        employee.averageSentimentScore = Number.isFinite(Number(result.sentiment_score)) ? Number(result.sentiment_score) : null;
        employee.updatedAt = new Date().toISOString();
        if (modelAttritionRisk) {
          employee.attritionRisk = modelAttritionRisk;
          employee.attritionProbability = attritionProbability(result.attrition_prediction);
          employee.retentionProbability = employee.attritionProbability === null ? null : 100 - employee.attritionProbability;
        }
        const prediction = {
          id: randomUUID(),
          employeeId: employee.id,
          employeeIdentifier: employee.employeeId,
          modelVersion: result.model_version,
          burnoutScore: employee.burnoutScore,
          burnoutRisk: employee.burnoutRisk,
          burnoutPredictionMethod: employee.burnoutPredictionMethod,
          attritionRisk: modelAttritionRisk,
          attritionProbability: employee.attritionProbability ?? null,
          sentimentScore: employee.averageSentimentScore,
          predictionDate: new Date().toISOString()
        };
        predictions.push(prediction);
        store.predictions.unshift(prediction);
      }
    }
  } catch (error) {
    return res.status(502).json({
      message: 'The Python ML service failed while processing predictions. No partial run was saved.',
      detail: axios.isAxiosError(error) ? error.message : 'Prediction request failed.'
    });
  }

  await persistStore(store);
  return res.json({
    processed: predictions.length,
    skipped,
    models: health.data.models || {},
    message: `${predictions.length} employees processed; ${skipped.length} skipped because required fields were missing.`
  });
});

router.get('/departments', async (req, res) => {
  const store = await getStore();
  const employees = store.employees.filter((employee) => employee.status === 'APPROVED');
  const departments = groupDepartments(employees, store.departments);
  return res.json({ departments });
});

router.get('/departments/:departmentId', async (req, res) => {
  const store = await getStore();
  const employees = store.employees.filter((employee) => employee.status === 'APPROVED');
  const department = findDepartment(employees, store.departments, req.params.departmentId);
  if (!department) return res.status(404).json({ message: 'Department not found.' });
  return res.json({ department });
});

router.get('/departments/:departmentId/employees', async (req, res) => {
  const store = await getStore();
  const approvedEmployees = store.employees.filter((employee) => employee.status === 'APPROVED');
  const department = findDepartment(approvedEmployees, store.departments, req.params.departmentId);
  if (!department) return res.status(404).json({ message: 'Department not found.' });

  const page = boundedInteger(req.query.page, 1, 1, Number.MAX_SAFE_INTEGER);
  const pageSize = boundedInteger(req.query.pageSize, 25, 1, 100);
  const search = String(req.query.search || '').trim().toLowerCase();
  const jobRole = String(req.query.jobRole || '').trim().toLowerCase();
  const attritionRisk = String(req.query.attritionRisk || '').trim().toUpperCase();
  const sortBy = String(req.query.sortBy || 'Name');
  const direction = String(req.query.direction || 'asc').toLowerCase() === 'desc' ? -1 : 1;
  const validSortFields = new Set(EMPLOYEE_FIELD_NAMES);
  if (!validSortFields.has(sortBy)) return res.status(400).json({ message: 'Unsupported sort field.' });

  const filtered = approvedEmployees
    .filter((employee) => String(employee.department || '').toLowerCase() === department.name.toLowerCase())
    .filter((employee) => !search || `${employee.employeeId} ${employee.fullName}`.toLowerCase().includes(search))
    .filter((employee) => !jobRole || String(employee.position || '').toLowerCase() === jobRole)
    .filter((employee) => !attritionRisk || String(employee.attritionRisk || '').toUpperCase() === attritionRisk)
    .sort((first, second) => compareEmployeeField(employeeField(first, sortBy), employeeField(second, sortBy)) * direction);
  const start = (page - 1) * pageSize;
  const employees = filtered.slice(start, start + pageSize).map((employee) =>
    Object.fromEntries(EMPLOYEE_FIELD_NAMES.map((field) => [field, employeeField(employee, field)]))
  );

  return res.json({
    department,
    employees,
    pagination: { page, pageSize, total: filtered.length, totalPages: Math.ceil(filtered.length / pageSize) },
    filters: { jobRoles: [...new Set(approvedEmployees.filter((item) => item.department === department.name).map((item) => item.position).filter(Boolean))].sort() }
  });
});

router.get('/departments/:departmentId/export', async (req, res) => {
  const store = await getStore();
  const approvedEmployees = store.employees.filter((employee) => employee.status === 'APPROVED');
  const department = findDepartment(approvedEmployees, store.departments, req.params.departmentId);
  if (!department) return res.status(404).json({ message: 'Department not found.' });
  const rows = approvedEmployees
    .filter((employee) => String(employee.department || '').toLowerCase() === department.name.toLowerCase())
    .map((employee) => EMPLOYEE_FIELD_NAMES.map((field) => csvCell(employeeField(employee, field))).join(','));
  return res
    .type('text/csv')
    .attachment(`${safeFilename(department.name)}-employees.csv`)
    .send([EMPLOYEE_FIELD_NAMES.join(','), ...rows].join('\r\n'));
});

router.get('/registration-requests', async (req, res) => {
  const store = await getStore();
  res.json({ requests: store.registrations.map(withoutPasswordHash) });
});

router.post('/dataset/csv', uploadCsv, async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Choose a CSV file to upload.' });

  try {
    const result = await importEmployeeDataset(req.file.buffer.toString('utf8'), req.file.originalname);
    return res.json({ message: `Imported ${result.count} records; ${result.duplicates} duplicates and ${result.rejected} invalid rows were skipped.`, ...result });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.post('/dataset/google-sheets', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ message: 'Enter a Google Sheets URL.' });

  try {
    const sheetUrl = toCsvUrl(url);
    const response = await axios.get(sheetUrl, { responseType: 'text', timeout: 15000 });
    const contentType = String(response.headers['content-type'] || '').toLowerCase();
    const bodyStart = String(response.data || '').trimStart().slice(0, 100).toLowerCase();
    if (contentType.includes('text/html') || bodyStart.startsWith('<!doctype') || bodyStart.startsWith('<html')) {
      throw new Error('Google Sheet could not be read. Set sharing to “Anyone with the link” as Viewer and try again.');
    }
    const result = await importEmployeeDataset(response.data, 'Google Sheets');
    return res.json({ message: `Imported ${result.count} records; ${result.duplicates} duplicates and ${result.rejected} invalid rows were skipped.`, ...result });
  } catch (error) {
    const message = error.response?.status === 404
      ? 'Google Sheet was not found. Check the URL and make sure the sheet is public.'
      : error.message || 'Unable to fetch the Google Sheet.';
    return res.status(400).json({ message });
  }
});

router.put('/registration-requests/:id/approve', async (req, res) => {
  const store = await getStore();
  const request = store.registrations.find((item) => item.id === req.params.id);
  if (!request) return res.status(404).json({ message: 'Request not found' });
  if (request.status !== 'PENDING') return res.status(409).json({ message: 'Only pending registration requests can be approved.' });

  request.status = 'APPROVED';
  request.processedAt = new Date().toISOString();

  const employee = {
    id: `emp-${Date.now()}`,
    employeeId: request.employeeId,
    fullName: request.fullName,
    email: request.email,
    passwordHash: request.passwordHash,
    position: request.position,
    department: request.department,
    gender: request.gender || null,
    age: request.age !== undefined && request.age !== null && request.age !== ''
      && Number.isFinite(Number(request.age)) ? Number(request.age) : null,
    educationLevel: request.educationLevel || null,
    joiningDate: request.joiningDate || null,
    countryCode: request.countryCode || null,
    country: request.country || null,
    phoneNumber: request.phoneNumber || null,
    monthlySalary: request.monthlySalary !== undefined && request.monthlySalary !== null && request.monthlySalary !== ''
      && Number.isFinite(Number(request.monthlySalary)) ? Number(request.monthlySalary) : null,
    status: 'APPROVED',
    burnoutRisk: null,
    attritionRisk: null,
    burnoutScore: null,
    attritionProbability: null,
    retentionProbability: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    role: 'EMPLOYEE'
  };

  store.employees.push(employee);
  await persistStore(store);
  await createNotification({ employeeId: employee.id, type: 'APPROVED', message: 'Your registration has been approved.' });

  return res.json({ message: 'Registration approved', employee: withoutPasswordHash(employee) });
});

router.put('/registration-requests/:id/reject', async (req, res) => {
  const store = await getStore();
  const request = store.registrations.find((item) => item.id === req.params.id);
  if (!request) return res.status(404).json({ message: 'Request not found' });
  if (request.status !== 'PENDING') return res.status(409).json({ message: 'Only pending registration requests can be rejected.' });

  request.status = 'REJECTED';
  request.rejectionReason = req.body.rejectionReason || 'Not approved';
  request.processedAt = new Date().toISOString();
  await persistStore(store);

  return res.json({ message: 'Registration rejected', request });
});

router.get('/tests', async (req, res) => {
  const store = await getStore();
  if (refreshAssessmentStatuses(store)) await persistStore(store);
  const tests = store.tests.map((test) => ({
    ...test,
    submissionCount: store.submissions.filter((submission) => submission.assessmentId === test.id).length
  }));
  return res.json({ tests });
});

router.post('/tests', async (req, res) => {
  const title = String(req.body.title || '').trim();
  if (!title) return res.status(400).json({ message: 'Test title is required.' });
  const questions = req.body.questions || createDefaultQuestions();
  const weights = req.body.scoringWeights || DEFAULT_SCORING_WEIGHTS;
  try {
    validateAssessmentQuestions(questions);
    validateScoringWeights(weights);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  const store = await getStore();
  const now = new Date().toISOString();
  const test = {
    id: randomUUID(),
    title,
    description: String(req.body.description || ''),
    instructions: String(req.body.instructions || ''),
    startAt: req.body.startAt || null,
    expiresAt: req.body.expiresAt || null,
    targetDepartment: req.body.targetDepartment || null,
    durationMinutes: positiveIntegerOrNull(req.body.durationMinutes),
    allowRetakes: req.body.allowRetakes === true,
    allowEmployeeResults: req.body.allowEmployeeResults === true,
    scoringWeights: weights,
    status: 'DRAFT',
    version: 1,
    questions,
    createdAt: now,
    updatedAt: now
  };
  store.tests.unshift(test);
  await persistStore(store);
  return res.status(201).json({ test });
});

router.get('/tests/:id', async (req, res) => {
  const store = await getStore();
  const test = store.tests.find((item) => item.id === req.params.id);
  if (!test) return res.status(404).json({ message: 'Test not found.' });
  return res.json({ test });
});

router.put('/tests/:id', async (req, res) => {
  const store = await getStore();
  const test = store.tests.find((item) => item.id === req.params.id);
  if (!test) return res.status(404).json({ message: 'Test not found.' });
  if (test.status !== 'DRAFT') return res.status(409).json({ message: 'Only draft tests can be edited. Create a new test version for published content.' });

  const questions = req.body.questions || test.questions;
  const weights = req.body.scoringWeights || test.scoringWeights;
  try {
    validateAssessmentQuestions(questions);
    validateScoringWeights(weights);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
  Object.assign(test, {
    title: req.body.title === undefined ? test.title : String(req.body.title).trim(),
    description: req.body.description === undefined ? test.description : String(req.body.description),
    instructions: req.body.instructions === undefined ? test.instructions : String(req.body.instructions),
    startAt: req.body.startAt === undefined ? test.startAt : req.body.startAt,
    expiresAt: req.body.expiresAt === undefined ? test.expiresAt : req.body.expiresAt,
    targetDepartment: req.body.targetDepartment === undefined ? test.targetDepartment : req.body.targetDepartment,
    durationMinutes: req.body.durationMinutes === undefined ? test.durationMinutes : positiveIntegerOrNull(req.body.durationMinutes),
    allowRetakes: req.body.allowRetakes === undefined ? test.allowRetakes : req.body.allowRetakes === true,
    allowEmployeeResults: req.body.allowEmployeeResults === undefined ? test.allowEmployeeResults : req.body.allowEmployeeResults === true,
    scoringWeights: weights,
    questions,
    updatedAt: new Date().toISOString()
  });
  if (!test.title) return res.status(400).json({ message: 'Test title is required.' });
  await persistStore(store);
  return res.json({ test });
});

router.put('/tests/:id/host', async (req, res) => {
  const store = await getStore();
  const test = store.tests.find((item) => item.id === req.params.id);
  if (!test) return res.status(404).json({ message: 'Test not found.' });
  if (!['DRAFT', 'SCHEDULED', 'STOPPED'].includes(test.status)) {
    return res.status(409).json({ message: 'This test cannot be hosted from its current state.' });
  }
  try {
    validateAssessmentQuestions(test.questions, { requireComplete: true });
    validateScoringWeights(test.scoringWeights);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
  const now = Date.now();
  const startAt = test.startAt ? Date.parse(test.startAt) : now;
  const expiresAt = test.expiresAt ? Date.parse(test.expiresAt) : null;
  if (!Number.isFinite(startAt) || (expiresAt !== null && !Number.isFinite(expiresAt))) {
    return res.status(400).json({ message: 'Start and expiry dates must be valid timestamps.' });
  }
  if (expiresAt !== null && expiresAt <= startAt) {
    return res.status(400).json({ message: 'Expiry must be later than the start time.' });
  }
  if (expiresAt !== null && expiresAt <= now) {
    return res.status(400).json({ message: 'An expired test cannot be hosted.' });
  }
  test.status = startAt > now ? 'SCHEDULED' : 'LIVE';
  test.hostedAt = new Date().toISOString();
  test.updatedAt = new Date().toISOString();
  const eligibleEmployees = store.employees.filter((employee) =>
    employee.status === 'APPROVED'
    && (!test.targetDepartment || employee.department === test.targetDepartment)
  );
  for (const employee of eligibleEmployees) {
    store.notifications.unshift({
      id: randomUUID(),
      employeeId: employee.id,
      type: 'ASSESSMENT_AVAILABLE',
      message: `New assessment available: ${test.title}.`,
      read: false,
      createdAt: new Date().toISOString()
    });
  }
  await persistStore(store);
  const notification = await notifyAssessmentEligibleEmployees(test, eligibleEmployees);
  return res.json({ test, notification });
});

router.put('/tests/:id/stop', async (req, res) => {
  const store = await getStore();
  const test = store.tests.find((item) => item.id === req.params.id);
  if (!test) return res.status(404).json({ message: 'Test not found.' });
  if (!['LIVE', 'SCHEDULED'].includes(test.status)) {
    return res.status(409).json({ message: 'Only a live or scheduled test can be stopped.' });
  }
  test.status = 'STOPPED';
  test.stoppedAt = new Date().toISOString();
  test.updatedAt = test.stoppedAt;
  await persistStore(store);
  return res.json({ test });
});

router.get('/test-results', async (req, res) => {
  const store = await getStore();
  const { rows, error } = filteredAssessmentResults(store, req.query);
  if (error) return res.status(400).json({ message: error });
  const page = boundedInteger(req.query.page, 1, 1, Number.MAX_SAFE_INTEGER);
  const pageSize = boundedInteger(req.query.pageSize, 25, 1, 100);
  const start = (page - 1) * pageSize;
  return res.json({
    results: rows.slice(start, start + pageSize),
    pagination: { page, pageSize, total: rows.length, totalPages: Math.ceil(rows.length / pageSize) },
    filters: {
      assessments: [...new Map(store.tests.map((test) => [test.id, { id: test.id, title: test.title }])).values()],
      departments: [...new Set(store.employees.map((employee) => employee.department).filter(Boolean))].sort()
    }
  });
});

router.get('/test-results/export', async (req, res) => {
  const store = await getStore();
  const { rows, error } = filteredAssessmentResults(store, req.query);
  if (error) return res.status(400).json({ message: error });
  const columns = [
    ['Employee ID', 'employeeId'], ['Employee Name', 'employeeName'], ['Department', 'department'],
    ['Assessment', 'testTitle'], ['Submitted At', 'submittedAt'], ['Overtime Score', 'overtimeScore'],
    ['Overtime Percentage', 'overtimePercentage'], ['Project Score', 'projectScore'],
    ['Project Percentage', 'projectPercentage'], ['WLB Score', 'wlbScore'],
    ['WLB Percentage', 'wlbPercentage'], ['WLB Risk Percentage', 'wlbRiskPercentage'],
    ['Additional Risk Percentage', 'additionalRiskPercentage'], ['Overall Score', 'overallScore']
  ];
  const csv = [columns.map(([label]) => csvCell(label)).join(','), ...rows.map((row) =>
    columns.map(([, key]) => csvCell(row[key])).join(',')
  )].join('\r\n');
  return res.type('text/csv').attachment('assessment-results.csv').send(csv);
});

router.get('/audit-logs', async (req, res) => {
  const store = await getStore();
  const { rows, error } = filteredAuditLogs(store.auditLogs || [], req.query);
  if (error) return res.status(400).json({ message: error });
  const page = boundedInteger(req.query.page, 1, 1, Number.MAX_SAFE_INTEGER);
  const pageSize = boundedInteger(req.query.pageSize, 50, 1, 100);
  const start = (page - 1) * pageSize;
  return res.json({
    logs: rows.slice(start, start + pageSize),
    pagination: { page, pageSize, total: rows.length, totalPages: Math.ceil(rows.length / pageSize) }
  });
});

router.get('/audit-logs/export', async (req, res) => {
  const store = await getStore();
  const { rows, error } = filteredAuditLogs(store.auditLogs || [], req.query);
  if (error) return res.status(400).json({ message: error });
  const columns = [
    ['Timestamp', 'occurredAt'], ['Administrator', 'actor'], ['Action', 'action'], ['Status Code', 'statusCode']
  ];
  const csv = [columns.map(([label]) => csvCell(label)).join(','), ...rows.map((row) =>
    columns.map(([, key]) => csvCell(row[key])).join(',')
  )].join('\r\n');
  return res.type('text/csv').attachment('administrator-audit-log.csv').send(csv);
});

export default router;

const EMPLOYEE_FIELD_NAMES = [
  'EmployeeID', 'Name', 'Gender', 'Age', 'Department', 'JobRole', 'EducationLevel', 'JoiningDate',
  'CountryCode', 'Country', 'PhoneNumber', 'MonthlySalary', 'OvertimeHoursPerMonth', 'LeavesTaken',
  'LastLeaveDate', 'LeaveDayName', 'ProjectsHandled', 'TrainingHours', 'CustomerSatisfaction',
  'LastPromotionYear', 'YearsAtCompany', 'WorkLifeBalanceScore', 'PerformanceRating', 'AttritionRisk'
];

function employeeField(employee, field) {
  const fields = {
    EmployeeID: employee.employeeId,
    Name: employee.fullName,
    Gender: employee.gender,
    Age: employee.age,
    Department: employee.department,
    JobRole: employee.position,
    EducationLevel: employee.educationLevel,
    JoiningDate: employee.joiningDate,
    CountryCode: employee.countryCode,
    Country: employee.country,
    PhoneNumber: employee.phoneNumber,
    MonthlySalary: employee.monthlySalary,
    OvertimeHoursPerMonth: employee.overtimeHoursPerMonth,
    LeavesTaken: employee.leavesTaken,
    LastLeaveDate: employee.lastLeaveDate,
    LeaveDayName: employee.leaveDayName,
    ProjectsHandled: employee.projectsHandled,
    TrainingHours: employee.trainingHours,
    CustomerSatisfaction: employee.customerSatisfaction,
    LastPromotionYear: employee.lastPromotionYear,
    YearsAtCompany: employee.yearsAtCompany,
    WorkLifeBalanceScore: employee.workLifeBalanceScore,
    PerformanceRating: employee.performanceRating,
    AttritionRisk: employee.attritionRisk
  };
  return fields[field] ?? null;
}

function groupDepartments(employees, departmentRecords = []) {
  const groups = new Map();
  for (const department of departmentRecords) {
    const name = String(department.name || '').trim();
    if (name) groups.set(name, {
      id: department.id || encodeURIComponent(name),
      name,
      employeeCount: 0,
      riskCounts: { LOW: 0, MEDIUM: 0, HIGH: 0 },
      highAttritionCount: 0,
      burnoutTotal: 0,
      burnoutCount: 0
    });
  }
  for (const employee of employees) {
    const name = String(employee.department || '').trim();
    if (!name) continue;
    const group = groups.get(name) || { id: encodeURIComponent(name), name, employeeCount: 0, riskCounts: { LOW: 0, MEDIUM: 0, HIGH: 0 }, highAttritionCount: 0, burnoutTotal: 0, burnoutCount: 0 };
    group.employeeCount += 1;
    const risk = String(employee.burnoutRisk || '').toUpperCase();
    if (Object.hasOwn(group.riskCounts, risk)) group.riskCounts[risk] += 1;
    if (String(employee.attritionRisk || '').toUpperCase() === 'HIGH') group.highAttritionCount += 1;
    if (Number.isFinite(Number(employee.burnoutScore))) {
      group.burnoutTotal += Number(employee.burnoutScore);
      group.burnoutCount += 1;
    }
    groups.set(name, group);
  }
  return [...groups.values()].map((group) => ({
    ...group,
    averageBurnoutScore: group.burnoutCount ? Number((group.burnoutTotal / group.burnoutCount).toFixed(2)) : null
  })).sort((first, second) => first.name.localeCompare(second.name));
}

function findDepartment(employees, departmentRecords, departmentId) {
  return groupDepartments(employees, departmentRecords).find((department) =>
    department.name === departmentId || department.id === departmentId
  );
}

function withoutPasswordHash(record) {
  if (!record) return record;
  const { passwordHash, ...safeRecord } = record;
  return safeRecord;
}

function refreshAssessmentStatuses(store) {
  const now = Date.now();
  let changed = false;
  for (const test of store.tests) {
    if (!['LIVE', 'SCHEDULED'].includes(test.status)) continue;
    const expiry = test.expiresAt ? Date.parse(test.expiresAt) : null;
    const start = test.startAt ? Date.parse(test.startAt) : 0;
    if (expiry !== null && Number.isFinite(expiry) && expiry <= now) {
      test.status = 'EXPIRED';
      test.updatedAt = new Date(now).toISOString();
      changed = true;
    } else if (test.status === 'SCHEDULED' && Number.isFinite(start) && start <= now) {
      test.status = 'LIVE';
      test.updatedAt = new Date(now).toISOString();
      changed = true;
    }
  }
  return changed;
}

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(Math.max(parsed, minimum), maximum);
}

function compareEmployeeField(first, second) {
  const firstNumber = Number(first);
  const secondNumber = Number(second);
  if (Number.isFinite(firstNumber) && Number.isFinite(secondNumber)) return firstNumber - secondNumber;
  return String(first ?? '').localeCompare(String(second ?? ''), undefined, { numeric: true, sensitivity: 'base' });
}

function csvCell(value) {
  let cell = value === null || value === undefined ? '' : String(value);
  if (/^[\s]*[=+\-@]/.test(cell)) cell = `'${cell}`;
  return `"${cell.replaceAll('"', '""')}"`;
}

function filteredAssessmentResults(store, query) {
  const from = query.dateFrom ? Date.parse(`${query.dateFrom}T00:00:00.000Z`) : null;
  const to = query.dateTo ? Date.parse(`${query.dateTo}T23:59:59.999Z`) : null;
  if ((query.dateFrom && !Number.isFinite(from)) || (query.dateTo && !Number.isFinite(to))) {
    return { rows: [], error: 'Assessment result date filters must be valid dates.' };
  }
  if (from !== null && to !== null && from > to) return { rows: [], error: 'Start date must not be later than end date.' };
  const employeeById = new Map(store.employees.map((employee) => [employee.id, employee]));
  const testById = new Map(store.tests.map((test) => [test.id, test]));
  const search = String(query.search || '').trim().toLowerCase();
  const rows = store.submissions.map((submission) => {
    const employee = employeeById.get(submission.employeeId);
    const test = testById.get(submission.assessmentId);
    return {
      submissionId: submission.id,
      assessmentId: submission.assessmentId,
      employeeId: employee?.employeeId || 'N/A',
      employeeName: employee?.fullName || 'N/A',
      department: employee?.department || 'N/A',
      testTitle: test?.title || 'N/A',
      submittedAt: submission.submittedAt,
      ...submission.results
    };
  }).filter((row) => {
    const submittedAt = Date.parse(row.submittedAt);
    if (query.assessmentId && row.assessmentId !== query.assessmentId) return false;
    if (query.department && row.department !== query.department) return false;
    if (search && !`${row.employeeId} ${row.employeeName} ${row.testTitle}`.toLowerCase().includes(search)) return false;
    if (from !== null && (!Number.isFinite(submittedAt) || submittedAt < from)) return false;
    if (to !== null && (!Number.isFinite(submittedAt) || submittedAt > to)) return false;
    return true;
  }).sort((first, second) => Date.parse(second.submittedAt || 0) - Date.parse(first.submittedAt || 0));
  return { rows };
}

function filteredAuditLogs(logs, query) {
  const from = query.dateFrom ? Date.parse(`${query.dateFrom}T00:00:00.000Z`) : null;
  const to = query.dateTo ? Date.parse(`${query.dateTo}T23:59:59.999Z`) : null;
  if ((query.dateFrom && !Number.isFinite(from)) || (query.dateTo && !Number.isFinite(to))) {
    return { rows: [], error: 'Audit log date filters must be valid dates.' };
  }
  if (from !== null && to !== null && from > to) return { rows: [], error: 'Start date must not be later than end date.' };
  const search = String(query.search || '').trim().toLowerCase();
  const rows = logs.filter((log) => {
    const occurredAt = Date.parse(log.occurredAt);
    if (query.actorId && log.actorId !== query.actorId) return false;
    if (query.statusCode && String(log.statusCode) !== String(query.statusCode)) return false;
    if (search && !`${log.actor} ${log.action}`.toLowerCase().includes(search)) return false;
    if (from !== null && (!Number.isFinite(occurredAt) || occurredAt < from)) return false;
    if (to !== null && (!Number.isFinite(occurredAt) || occurredAt > to)) return false;
    return true;
  }).sort((first, second) => Date.parse(second.occurredAt || 0) - Date.parse(first.occurredAt || 0));
  return { rows };
}

function safeFilename(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'department';
}

function positiveIntegerOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function toMLRecord(employee) {
  const yearsSincePromotion = employee.yearsSincePromotion
    ?? (employee.lastPromotionYear ? Math.max(0, new Date().getFullYear() - Number(employee.lastPromotionYear)) : undefined);
  return {
    Age: employee.age,
    Department: employee.department,
    JobRole: employee.position,
    EducationLevel: employee.educationLevel,
    MonthlySalary: employee.monthlySalary,
    OvertimeHoursPerMonth: employee.overtimeHoursPerMonth,
    LeavesTaken: employee.leavesTaken,
    ProjectsHandled: employee.projectsHandled,
    TrainingHours: employee.trainingHours,
    CustomerSatisfaction: employee.customerSatisfaction,
    YearsAtCompany: employee.yearsAtCompany,
    YearsSincePromotion: yearsSincePromotion,
    LastPromotionYear: employee.lastPromotionYear,
    WorkLifeBalanceScore: employee.workLifeBalanceScore,
    PerformanceRating: employee.performanceRating,
    AttendancePercentage: employee.attendancePercentage,
    TaskCompletionRate: employee.taskCompletionRate,
    AverageTestScore: employee.averageTestScore,
    BurnoutScore: employee.burnoutScore,
    SentimentScore: employee.averageSentimentScore,
    Feedback: employee.feedback
  };
}

function normalizedRisk(value) {
  const risk = String(value || '').toUpperCase();
  return ['LOW', 'MEDIUM', 'HIGH'].includes(risk) ? risk : null;
}

function attritionProbability(prediction) {
  const probabilities = prediction?.probabilities;
  if (!probabilities) return null;
  const positiveLabels = new Set(['HIGH', 'YES', 'TRUE', '1', '1.0', 'ATTRITION', 'LEFT', 'EXITED']);
  const values = Object.entries(probabilities)
    .filter(([label]) => positiveLabels.has(label.toUpperCase()))
    .map(([, probability]) => Number(probability))
    .filter(Number.isFinite);
  return values.length ? Number((Math.min(1, values.reduce((sum, value) => sum + value, 0)) * 100).toFixed(2)) : null;
}

function attritionRiskCategory(prediction) {
  const normalized = normalizedRisk(prediction?.risk);
  if (normalized) return normalized;
  const label = String(prediction?.risk || '').toUpperCase();
  if (['YES', 'TRUE', '1', '1.0', 'ATTRITION', 'LEFT', 'EXITED'].includes(label)) return 'HIGH';
  if (['NO', 'FALSE', '0', '0.0', 'RETAINED', 'STAYED'].includes(label)) return 'LOW';
  const probability = attritionProbability(prediction);
  if (probability === null) return null;
  return probability >= 67 ? 'HIGH' : probability >= 34 ? 'MEDIUM' : 'LOW';
}

async function notifyAssessmentEligibleEmployees(test, employees) {
  const recipients = employees.filter((employee) => employee.email);
  if (!process.env.BREVO_API_KEY || !process.env.BREVO_SENDER_EMAIL) {
    return { status: 'not_configured', eligible: recipients.length, sent: 0, failed: 0 };
  }
  const results = [];
  const frontendUrl = String(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
  for (let index = 0; index < recipients.length; index += 10) {
    const batchResults = await Promise.all(recipients.slice(index, index + 10).map(async (employee) => {
      try {
        await axios.post('https://api.brevo.com/v3/smtp/email', {
          sender: { email: process.env.BREVO_SENDER_EMAIL, name: process.env.BREVO_SENDER_NAME || 'BurnoutGuard' },
          to: [{ email: employee.email, name: employee.fullName }],
          subject: 'New Employee Assessment Available',
          htmlContent: `<p>Hello ${escapeHtml(employee.fullName)},</p><p><strong>${escapeHtml(test.title)}</strong> is available for you.</p><p>${escapeHtml(test.description || '')}</p><p>Start: ${escapeHtml(test.startAt || 'Now')}<br>Expires: ${escapeHtml(test.expiresAt || 'No expiry configured')}</p><p><a href="${frontendUrl}/employee/dashboard">Open your employee portal</a></p>`
        }, {
          headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json' },
          timeout: 10000
        });
        return { sent: true };
      } catch (error) {
        if (!axios.isAxiosError(error)) throw error;
        console.error('Brevo assessment notification failed:', error.message);
        return { sent: false };
      }
    }));
    results.push(...batchResults);
  }
  return {
    status: results.some((result) => !result.sent) ? 'partial' : 'sent',
    eligible: recipients.length,
    sent: results.filter((result) => result.sent).length,
    failed: results.filter((result) => !result.sent).length
  };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}
function taskStatus(task) {
  if (task.status === 'COMPLETED') return 'COMPLETED';
  const due = task.dueDate ? Date.parse(task.dueDate) : NaN;
  return Number.isFinite(due) && due < Date.now() ? 'OVERDUE' : task.status || 'PENDING';
}

function toCsvUrl(url) {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/spreadsheets\/d\/([^/]+)/);
    if (!match) throw new Error('Use a Google Sheets URL such as https://docs.google.com/spreadsheets/d/SHEET_ID/edit.');
    const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ''));
    const gid = parsed.searchParams.get('gid') || hashParams.get('gid') || '0';
    return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv&gid=${encodeURIComponent(gid)}`;
  } catch (error) {
    if (error.message.startsWith('Use a Google Sheets')) throw error;
    throw new Error('Enter a valid Google Sheets URL.');
  }
}
