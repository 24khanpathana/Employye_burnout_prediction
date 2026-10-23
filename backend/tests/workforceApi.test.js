import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { app } from '../server.js';

test('task and attendance records require admin access and remain employee-scoped', async () => {
  const suffix = randomUUID();
  const adminLogin = await request(app).post('/api/auth/admin/login').send({ adminId: 'ADMIN-001', password: 'admin123' });
  const adminAuth = `Bearer ${adminLogin.body.token}`;
  const registration = await request(app).post('/api/auth/register').send({
    employeeId: `OPS-${suffix}`,
    fullName: 'Operations Test Employee',
    email: `${suffix}@ops.test`,
    password: 'secure-password-456',
    confirmPassword: 'secure-password-456',
    position: 'Coordinator',
    department: 'Operations'
  });
  assert.equal(registration.status, 201);
  const requestList = await request(app).get('/api/admin/registration-requests').set('Authorization', adminAuth);
  const accountRequest = requestList.body.requests.find((item) => item.employeeId === `OPS-${suffix}`);
  const approval = await request(app).put(`/api/admin/registration-requests/${accountRequest.id}/approve`).set('Authorization', adminAuth);
  const employee = approval.body.employee;

  const taskResponse = await request(app).post('/api/admin/tasks').set('Authorization', adminAuth).send({
    title: 'Review quarterly goals',
    description: 'Submit your review.',
    assignedToId: employee.id,
    dueDate: new Date(Date.now() + 86400000).toISOString(),
    priority: 'HIGH'
  });
  assert.equal(taskResponse.status, 201);
  const employeeLogin = await request(app).post('/api/auth/employee/login').send({
    employeeId: `OPS-${suffix}`,
    password: 'secure-password-456'
  });
  const employeeAuth = `Bearer ${employeeLogin.body.token}`;
  const tasks = await request(app).get('/api/employees/me/tasks').set('Authorization', employeeAuth);
  assert.equal(tasks.body.tasks.length, 1);
  const employeeNotifications = await request(app).get('/api/employees/me/notifications').set('Authorization', employeeAuth);
  const taskNotification = employeeNotifications.body.notifications.find((notification) => notification.type === 'TASK_ASSIGNED');
  assert.ok(taskNotification);
  const notificationId = taskNotification.id;
  const markedRead = await request(app).put(`/api/employees/me/notifications/${notificationId}/read`).set('Authorization', employeeAuth).send({});
  assert.equal(markedRead.status, 200);
  assert.equal(markedRead.body.notification.read, true);
  const adminCannotAccessEmployeeNotifications = await request(app).get('/api/employees/me/notifications').set('Authorization', adminAuth);
  assert.equal(adminCannotAccessEmployeeNotifications.status, 403);
  const updatedTask = await request(app).put(`/api/employees/me/tasks/${taskResponse.body.task.id}`).set('Authorization', employeeAuth).send({ status: 'COMPLETED' });
  assert.equal(updatedTask.status, 200);
  assert.equal(updatedTask.body.task.status, 'COMPLETED');

  const attendance = await request(app).post('/api/admin/attendance').set('Authorization', adminAuth).send({
    employeeId: employee.id,
    date: new Date().toISOString().slice(0, 10),
    status: 'PRESENT'
  });
  assert.equal(attendance.status, 201);
  const employeeAttendance = await request(app).get('/api/employees/me/attendance').set('Authorization', employeeAuth);
  assert.equal(employeeAttendance.body.attendance.length, 1);
  const attendanceCsv = await request(app).get(`/api/admin/attendance/export?employeeId=${encodeURIComponent(employee.id)}`).set('Authorization', adminAuth);
  assert.equal(attendanceCsv.status, 200);
  assert.match(attendanceCsv.headers['content-type'], /text\/csv/);
  assert.match(attendanceCsv.text, new RegExp(`OPS-${suffix}`));
  const forbiddenAdminView = await request(app).get('/api/admin/departments').set('Authorization', employeeAuth);
  assert.equal(forbiddenAdminView.status, 403);
  const audit = await request(app).get('/api/admin/audit-logs?search=POST%20%2Fapi%2Fadmin%2Ftasks').set('Authorization', adminAuth);
  assert.equal(audit.status, 200);
  assert.equal(audit.body.logs.some((log) => log.action === 'POST /api/admin/tasks' && log.actorId === 'admin-1'), true);
  const auditCsv = await request(app).get('/api/admin/audit-logs/export?search=POST%20%2Fapi%2Fadmin%2Ftasks').set('Authorization', adminAuth);
  assert.equal(auditCsv.status, 200);
  assert.match(auditCsv.text, /POST \/api\/admin\/tasks/);
});
