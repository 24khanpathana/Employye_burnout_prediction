import express from 'express';
import { randomUUID } from 'node:crypto';
import { authenticate, authorizeEmployee } from '../middleware/auth.js';
import { getStore, findEmployeeById, persistStore } from '../services/store.js';
import { calculateAssessmentResults, DEFAULT_SCORING_WEIGHTS } from '../services/assessmentScoring.js';

const router = express.Router();

router.use(authenticate);
router.use(authorizeEmployee);

router.get('/me', async (req, res) => {
  const store = await getStore();
  const employee = store.employees.find((item) => item.id === req.user.userId);

  if (!employee) {
    return res.status(404).json({ message: 'Employee not found' });
  }

  const { passwordHash, ...safeEmployee } = employee;
  return res.json({ employee: safeEmployee });
});

router.get('/me/tests', async (req, res) => {
  const store = await getStore();
  const employee = store.employees.find((item) => item.id === req.user.userId);
  if (!employee) return res.status(404).json({ message: 'Employee not found.' });
  const now = Date.now();
  const tests = store.tests.filter((test) => {
    if (!['LIVE', 'SCHEDULED'].includes(test.status)) return false;
    if (test.targetDepartment && test.targetDepartment !== employee.department) return false;
    const startAt = test.startAt ? Date.parse(test.startAt) : 0;
    const expiresAt = test.expiresAt ? Date.parse(test.expiresAt) : null;
    return Number.isFinite(startAt) && (!test.expiresAt || (Number.isFinite(expiresAt) && expiresAt > now)) && startAt <= now;
  }).map((test) => ({
    id: test.id,
    title: test.title,
    description: test.description,
    instructions: test.instructions,
    targetDepartment: test.targetDepartment,
    startAt: test.startAt,
    expiresAt: test.expiresAt,
    durationMinutes: test.durationMinutes,
    status: test.status,
    questions: test.questions.map(({ id, section, text, required, options }) => ({
      id, section, text, required, options: options.map(({ id: optionId, label }) => ({ id: optionId, label }))
    })),
    alreadySubmitted: store.submissions.some((submission) => submission.assessmentId === test.id && submission.employeeId === req.user.userId),
    allowRetakes: test.allowRetakes
  }));
  return res.json({ tests });
});

router.post('/me/tests/:testId/start', async (req, res) => {
  const store = await getStore();
  const employee = store.employees.find((item) => item.id === req.user.userId);
  const test = store.tests.find((item) => item.id === req.params.testId);
  if (!employee) return res.status(404).json({ message: 'Employee not found.' });
  const error = assessmentAvailabilityError(test, employee, store.submissions, req.user.userId);
  if (error) return res.status(409).json({ message: error });

  return res.json({
    test: {
      id: test.id,
      title: test.title,
      description: test.description,
      instructions: test.instructions,
      durationMinutes: test.durationMinutes,
      questions: test.questions.map(({ id, section, text, required, options }) => ({
        id, section, text, required, options: options.map(({ id: optionId, label }) => ({ id: optionId, label }))
      }))
    }
  });
});

router.post('/me/tests/:testId/submit', async (req, res) => {
  const store = await getStore();
  const employee = store.employees.find((item) => item.id === req.user.userId);
  const test = store.tests.find((item) => item.id === req.params.testId);
  if (!employee) return res.status(404).json({ message: 'Employee not found.' });
  const error = assessmentAvailabilityError(test, employee, store.submissions, req.user.userId);
  if (error) return res.status(409).json({ message: error });

  let results;
  try {
    results = calculateAssessmentResults(test.questions, req.body.answers, test.scoringWeights || DEFAULT_SCORING_WEIGHTS);
  } catch (scoringError) {
    return res.status(400).json({ message: scoringError.message });
  }
  const attemptNumber = store.submissions.filter((submission) =>
    submission.assessmentId === test.id && submission.employeeId === req.user.userId
  ).length + 1;
  const submission = {
    id: randomUUID(),
    assessmentId: test.id,
    assessmentVersion: Number(test.version || 1),
    employeeId: req.user.userId,
    attemptNumber,
    answers: req.body.answers,
    results,
    timeTakenSeconds: Number.isInteger(req.body.timeTakenSeconds) && req.body.timeTakenSeconds >= 0 ? req.body.timeTakenSeconds : null,
    submittedAt: new Date().toISOString()
  };
  store.submissions.unshift(submission);
  await persistStore(store);
  return res.status(201).json({
    message: 'Assessment submitted successfully.',
    submission: { id: submission.id, submittedAt: submission.submittedAt },
    results: test.allowEmployeeResults ? results : undefined
  });
});

router.get('/me/tasks', async (req, res) => {
  const store = await getStore();
  const tasks = store.tasks.filter((task) => task.assignedToId === req.user.userId).map((task) => ({
    ...task,
    status: taskStatus(task)
  }));
  return res.json({ tasks });
});

router.put('/me/tasks/:taskId', async (req, res) => {
  const store = await getStore();
  const task = store.tasks.find((item) => item.id === req.params.taskId && item.assignedToId === req.user.userId);
  if (!task) return res.status(404).json({ message: 'Task not found.' });
  const status = String(req.body.status || '').toUpperCase();
  if (!['IN_PROGRESS', 'COMPLETED'].includes(status)) {
    return res.status(400).json({ message: 'Task status must be IN_PROGRESS or COMPLETED.' });
  }
  task.status = status;
  task.updatedAt = new Date().toISOString();
  await persistStore(store);
  return res.json({ task: { ...task, status: taskStatus(task) } });
});

router.get('/me/attendance', async (req, res) => {
  const store = await getStore();
  const attendance = store.attendance.filter((entry) => entry.employeeId === req.user.userId);
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const summary = { PRESENT: 0, ABSENT: 0, LATE: 0, LEAVE: 0 };
  for (const entry of attendance.filter((item) => String(item.date || '').slice(0, 7) === currentMonth)) {
    if (Object.hasOwn(summary, entry.status)) summary[entry.status] += 1;
  }
  return res.json({ attendance, summary, month: currentMonth });
});

router.get('/me/notifications', async (req, res) => {
  const store = await getStore();
  const notifications = store.notifications
    .filter((notification) => notification.employeeId === req.user.userId)
    .sort((first, second) => Date.parse(second.createdAt || 0) - Date.parse(first.createdAt || 0));
  return res.json({ notifications });
});

router.put('/me/notifications/:notificationId/read', async (req, res) => {
  const store = await getStore();
  const notification = store.notifications.find((item) =>
    item.id === req.params.notificationId && item.employeeId === req.user.userId
  );
  if (!notification) return res.status(404).json({ message: 'Notification not found.' });
  notification.read = true;
  await persistStore(store);
  return res.json({ notification });
});

router.get('/me/results', async (req, res) => {
  const store = await getStore();
  const visibleTestIds = new Set(store.tests.filter((test) => test.allowEmployeeResults).map((test) => test.id));
  return res.json({
    results: store.submissions.filter((submission) =>
      submission.employeeId === req.user.userId && visibleTestIds.has(submission.assessmentId)
    )
  });
});

export default router;

function assessmentAvailabilityError(test, employee, submissions, employeeId) {
  if (!test) return 'Test not found.';
  if (!['LIVE', 'SCHEDULED'].includes(test.status)) return 'This test is not accepting submissions.';
  if (test.targetDepartment && test.targetDepartment !== employee.department) return 'This test is not available to your department.';
  const now = Date.now();
  const startAt = test.startAt ? Date.parse(test.startAt) : 0;
  const expiresAt = test.expiresAt ? Date.parse(test.expiresAt) : null;
  if (!Number.isFinite(startAt) || startAt > now) return 'This test is not available yet.';
  if (test.expiresAt && (!Number.isFinite(expiresAt) || expiresAt <= now)) return 'This test has expired.';
  const priorSubmissions = submissions.filter((submission) =>
    submission.assessmentId === test.id && submission.employeeId === employeeId
  );
  if (priorSubmissions.length && !test.allowRetakes) return 'You have already submitted this test.';
  return null;
}

function taskStatus(task) {
  if (task.status === 'COMPLETED') return 'COMPLETED';
  const due = task.dueDate ? Date.parse(task.dueDate) : NaN;
  return Number.isFinite(due) && due < Date.now() ? 'OVERDUE' : task.status || 'PENDING';
}
