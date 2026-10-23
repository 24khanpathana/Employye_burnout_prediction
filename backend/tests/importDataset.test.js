import test from 'node:test';
import assert from 'node:assert/strict';
import { importEmployeeDataset, getStore } from '../services/store.js';

test('CSV import is additive and leaves unavailable risk metrics unset', async () => {
  const csv = [
    'employee_id,name,department,job_role,monthly_salary,attrition_risk',
    'IMPORT-CASE-01,Verified Person,IT,Analyst,64000,',
    'IMPORT-CASE-01,Duplicate Person,IT,Analyst,64000,',
    'IMPORT-CASE-02,,HR,Coordinator,50000,'
  ].join('\n');

  const result = await importEmployeeDataset(csv, 'test fixture');
  const store = await getStore();
  const imported = store.employees.find((employee) => employee.employeeId === 'IMPORT-CASE-01');

  assert.equal(result.count, 1);
  assert.equal(result.duplicates, 1);
  assert.equal(result.rejected, 1);
  assert.equal(imported.email, null);
  assert.equal(imported.burnoutScore, null);
  assert.equal(imported.burnoutRisk, null);
  assert.equal(imported.attritionRisk, null);
  assert.equal(imported.monthlySalary, 64000);
});
