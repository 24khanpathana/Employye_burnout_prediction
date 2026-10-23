import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import axios from 'axios';
import request from 'supertest';
import { app } from '../server.js';
import { getStore } from '../services/store.js';

test('prediction run skips incomplete profiles and keeps formula predictions distinct from trained models', async () => {
  const adminLogin = await request(app).post('/api/auth/admin/login').send({ adminId: 'ADMIN-001', password: 'admin123' });
  const authorization = `Bearer ${adminLogin.body.token}`;
  const store = await getStore();
  const suffix = randomUUID();
  store.employees.push(
    { id: `valid-${suffix}`, employeeId: `ML-${suffix}`, fullName: 'Labeled Profile', department: 'IT', status: 'APPROVED', overtimeHoursPerMonth: 20, projectsHandled: 4, leavesTaken: 3, workLifeBalanceScore: 3, trainingHours: 20, customerSatisfaction: 4, lastPromotionYear: new Date().getFullYear() - 2 },
    { id: `missing-${suffix}`, employeeId: `ML-MISSING-${suffix}`, fullName: 'Incomplete Profile', department: 'IT', status: 'APPROVED' }
  );
  const originalGet = axios.get;
  const originalPost = axios.post;
  axios.get = async () => ({ data: { models: { burnout: false, attrition: false } } });
  axios.post = async (_url, payload) => {
    if (!payload.data.OvertimeHoursPerMonth) {
      const error = new Error('Missing prediction data');
      error.isAxiosError = true;
      error.response = { status: 422, data: { detail: 'Missing required prediction fields: OvertimeHoursPerMonth.' } };
      throw error;
    }
    return { data: {
      burnout_score: 41.25,
      formula_burnout_risk: 'MEDIUM',
      burnout_prediction: null,
      attrition_prediction: null,
      sentiment_score: 0.125,
      model_version: null
    } };
  };
  try {
    const response = await request(app).post('/api/admin/predictions/run').set('Authorization', authorization);
    assert.equal(response.status, 200);
    assert.ok(response.body.processed >= 1);
    assert.ok(response.body.skipped.some((item) => item.employeeId === `ML-MISSING-${suffix}`));
    assert.equal(response.body.models.burnout, false);
    const valid = (await getStore()).employees.find((employee) => employee.id === `valid-${suffix}`);
    assert.equal(valid.burnoutScore, 41.25);
    assert.equal(valid.burnoutPredictionMethod, 'BURNOUT_FORMULA');
    assert.equal(valid.attritionRisk, undefined);
    const exported = await request(app)
      .get(`/api/admin/predictions/export?employeeId=ML-${suffix}`)
      .set('Authorization', authorization);
    assert.equal(exported.status, 200);
    assert.match(exported.headers['content-type'], /text\/csv/);
    assert.match(exported.text, new RegExp(`ML-${suffix}`));
  } finally {
    axios.get = originalGet;
    axios.post = originalPost;
  }
});

test('prediction service failure returns an explicit error and saves no partial batch', async () => {
  const adminLogin = await request(app).post('/api/auth/admin/login').send({ adminId: 'ADMIN-001', password: 'admin123' });
  const authorization = `Bearer ${adminLogin.body.token}`;
  const store = await getStore();
  const suffix = randomUUID();
  store.employees.push({ id: `failure-${suffix}`, employeeId: `ML-FAIL-${suffix}`, fullName: 'Failure Profile', department: 'IT', status: 'APPROVED', overtimeHoursPerMonth: 20, projectsHandled: 4, leavesTaken: 3, workLifeBalanceScore: 3, trainingHours: 20, customerSatisfaction: 4, lastPromotionYear: new Date().getFullYear() - 2 });
  const originalGet = axios.get;
  const originalPost = axios.post;
  axios.get = async () => ({ data: { models: { burnout: false, attrition: false } } });
  axios.post = async () => { throw new Error('Simulated service failure'); };
  try {
    const before = store.predictions.length;
    axios.get = async () => { throw new Error('Simulated health check failure'); };
    const unavailable = await request(app).post('/api/admin/predictions/run').set('Authorization', authorization);
    assert.equal(unavailable.status, 503);
    axios.get = async () => ({ data: { models: { burnout: false, attrition: false } } });
    const response = await request(app).post('/api/admin/predictions/run').set('Authorization', authorization);
    assert.equal(response.status, 502);
    assert.match(response.body.message, /No partial run was saved/);
    assert.equal((await getStore()).predictions.length, before);
  } finally {
    axios.get = originalGet;
    axios.post = originalPost;
  }
});
