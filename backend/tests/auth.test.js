import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../server.js';

test('admin login works with default admin', async () => {
  const response = await request(app)
    .post('/api/auth/admin/login')
    .send({ adminId: 'ADMIN-001', password: 'admin123' });

  assert.equal(response.status, 200);
  assert.ok(response.body.token);
});

test('employee registration works', async () => {
  const response = await request(app)
    .post('/api/auth/register')
    .send({
      employeeId: 'EMP-TEST-001',
      fullName: 'Test Employee',
      email: 'employee@test.com',
      password: 'Passw0rd!',
      confirmPassword: 'Passw0rd!',
      position: 'Developer',
      department: 'Information Technology',
      gender: 'Male',
      age: 26,
      educationLevel: 'Bachelor',
      joiningDate: '2024-01-01',
      countryCode: '+1',
      country: 'United States',
      phoneNumber: '1234567890',
      monthlySalary: 60000
    });

  assert.equal(response.status, 201);
  assert.match(response.body.message, /submitted/i);
});

test('registration approval changes status', async () => {
  const login = await request(app)
    .post('/api/auth/admin/login')
    .send({ adminId: 'ADMIN-001', password: 'admin123' });

  const list = await request(app)
    .get('/api/admin/registration-requests')
    .set('Authorization', `Bearer ${login.body.token}`);

  const requestId = list.body.requests[0].id;
  const response = await request(app)
    .put(`/api/admin/registration-requests/${requestId}/approve`)
    .set('Authorization', `Bearer ${login.body.token}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.message.includes('approved'), true);
});
