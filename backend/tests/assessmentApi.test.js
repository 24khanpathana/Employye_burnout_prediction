import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { app } from '../server.js';
import { createDefaultQuestions } from '../services/assessmentScoring.js';

test('admin-hosted assessment is submitted, scored, and only disclosed when enabled', async () => {
  const suffix = randomUUID();
  const adminLogin = await request(app)
    .post('/api/auth/admin/login')
    .send({ adminId: 'ADMIN-001', password: 'admin123' });
  assert.equal(adminLogin.status, 200);
  const adminAuth = `Bearer ${adminLogin.body.token}`;

  const registration = await request(app).post('/api/auth/register').send({
    employeeId: `EMP-${suffix}`,
    fullName: 'Assessment Test Employee',
    email: `${suffix}@example.test`,
    password: 'secure-password-123',
    confirmPassword: 'secure-password-123',
    position: 'Analyst',
    department: 'IT'
  });
  assert.equal(registration.status, 201);

  const requests = await request(app).get('/api/admin/registration-requests').set('Authorization', adminAuth);
  const registrationRequest = requests.body.requests.find((item) => item.employeeId === `EMP-${suffix}`);
  assert.ok(registrationRequest);
  const approval = await request(app).put(`/api/admin/registration-requests/${registrationRequest.id}/approve`).set('Authorization', adminAuth);
  assert.equal(approval.status, 200);

  const testCreation = await request(app).post('/api/admin/tests').set('Authorization', adminAuth).send({
    title: 'Assessment API acceptance',
    allowEmployeeResults: true,
    questions: createDefaultQuestions()
  });
  assert.equal(testCreation.status, 201);
  assert.equal(testCreation.body.test.questions.length, 20);
  const testId = testCreation.body.test.id;
  const hosted = await request(app).put(`/api/admin/tests/${testId}/host`).set('Authorization', adminAuth).send({});
  assert.equal(hosted.status, 200);
  assert.equal(hosted.body.test.status, 'LIVE');

  const employeeLogin = await request(app).post('/api/auth/employee/login').send({
    employeeId: `EMP-${suffix}`,
    password: 'secure-password-123'
  });
  assert.equal(employeeLogin.status, 200);
  const employeeAuth = `Bearer ${employeeLogin.body.token}`;
  const available = await request(app).get('/api/employees/me/tests').set('Authorization', employeeAuth);
  assert.equal(available.status, 200);
  assert.equal(available.body.tests.length, 1);
  assert.equal(Object.hasOwn(available.body.tests[0].questions[0].options[0], 'score'), false);

  const started = await request(app).post(`/api/employees/me/tests/${testId}/start`).set('Authorization', employeeAuth).send({});
  assert.equal(started.status, 200);
  const answers = Object.fromEntries(started.body.test.questions.map((question) => [question.id, question.options[0].id]));
  const submitted = await request(app).post(`/api/employees/me/tests/${testId}/submit`).set('Authorization', employeeAuth).send({ answers });
  assert.equal(submitted.status, 201);
  assert.equal(submitted.body.results.overtimeScore, 1);
  assert.equal(submitted.body.results.wlbScore, 2);
  assert.equal(submitted.body.results.wlbRiskPercentage, 60);

  const repeat = await request(app).post(`/api/employees/me/tests/${testId}/submit`).set('Authorization', employeeAuth).send({ answers });
  assert.equal(repeat.status, 409);

  const employeeResults = await request(app).get('/api/employees/me/results').set('Authorization', employeeAuth);
  assert.equal(employeeResults.status, 200);
  assert.equal(employeeResults.body.results.length, 1);
  const adminResults = await request(app).get('/api/admin/test-results').set('Authorization', adminAuth);
  assert.equal(adminResults.status, 200);
  assert.equal(adminResults.body.results.some((result) => result.employeeId === `EMP-${suffix}`), true);
  const filteredResults = await request(app)
    .get(`/api/admin/test-results?assessmentId=${encodeURIComponent(testId)}&department=IT&page=1&pageSize=1`)
    .set('Authorization', adminAuth);
  assert.equal(filteredResults.status, 200);
  assert.equal(filteredResults.body.pagination.total, 1);
  assert.equal(filteredResults.body.results[0].assessmentId, testId);
  const csvResults = await request(app)
    .get(`/api/admin/test-results/export?assessmentId=${encodeURIComponent(testId)}`)
    .set('Authorization', adminAuth);
  assert.equal(csvResults.status, 200);
  assert.match(csvResults.headers['content-type'], /text\/csv/);
  assert.match(csvResults.text, /Assessment API acceptance/);
  const invalidDates = await request(app)
    .get('/api/admin/test-results?dateFrom=not-a-date')
    .set('Authorization', adminAuth);
  assert.equal(invalidDates.status, 400);
});
