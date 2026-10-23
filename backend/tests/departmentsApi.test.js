import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { app } from '../server.js';
import { getStore } from '../services/store.js';

test('department summaries, filtering, pagination, sorting, and export use approved employee data', async () => {
  const adminLogin = await request(app).post('/api/auth/admin/login').send({ adminId: 'ADMIN-001', password: 'admin123' });
  const authorization = `Bearer ${adminLogin.body.token}`;
  const store = await getStore();
  const id = randomUUID();
  const departmentName = `Test Department ${id.slice(0, 8)}`;
  store.employees.push(
    { id: `dept-a-${id}`, employeeId: `DEPT-A-${id}`, fullName: 'Avery Analyst', email: `${id}-a@test.local`, department: departmentName, position: 'Analyst', status: 'APPROVED', burnoutRisk: 'HIGH', burnoutScore: 78, attritionRisk: 'HIGH' },
    { id: `dept-z-${id}`, employeeId: `DEPT-Z-${id}`, fullName: 'Zara Engineer', email: `${id}-z@test.local`, department: departmentName, position: 'Engineer', status: 'APPROVED', burnoutRisk: 'LOW', burnoutScore: null, attritionRisk: null },
    { id: `dept-p-${id}`, employeeId: `DEPT-P-${id}`, fullName: 'Pending Person', department: departmentName, position: 'Engineer', status: 'PENDING', burnoutRisk: 'HIGH', burnoutScore: 99 }
  );

  const overview = await request(app).get('/api/admin/departments').set('Authorization', authorization);
  assert.equal(overview.status, 200);
  const department = overview.body.departments.find((item) => item.name === departmentName);
  assert.equal(department.employeeCount, 2);
  assert.equal(department.riskCounts.HIGH, 1);
  assert.equal(department.highAttritionCount, 1);

  const page = await request(app)
    .get(`/api/admin/departments/${encodeURIComponent(department.id)}/employees?page=1&pageSize=1&sortBy=Name&direction=desc&jobRole=Engineer`)
    .set('Authorization', authorization);
  assert.equal(page.status, 200);
  assert.equal(page.body.pagination.total, 1);
  assert.equal(page.body.employees[0].Name, 'Zara Engineer');

  const exportResponse = await request(app)
    .get(`/api/admin/departments/${encodeURIComponent(department.id)}/export`)
    .set('Authorization', authorization);
  assert.equal(exportResponse.status, 200);
  assert.match(exportResponse.headers['content-type'], /text\/csv/);
  assert.match(exportResponse.text, /Avery Analyst/);
  assert.match(exportResponse.text, /Zara Engineer/);
  assert.doesNotMatch(exportResponse.text, /Pending Person/);
});
