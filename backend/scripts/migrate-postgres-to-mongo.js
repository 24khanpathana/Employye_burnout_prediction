import 'dotenv/config';
import pg from 'pg';
import { MongoClient, ObjectId } from 'mongodb';

const { Pool } = pg;
const postgresUrl = process.env.LEGACY_POSTGRES_URL;
const mongoUri = process.env.MONGODB_URI;
if (!postgresUrl) throw new Error('Set LEGACY_POSTGRES_URL to the previous PostgreSQL connection string.');
if (!mongoUri) throw new Error('Set MONGODB_URI to the destination MongoDB connection string.');

const postgres = new Pool({ connectionString: postgresUrl, connectionTimeoutMillis: 10000 });
const mongo = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 10000 });

try {
  await mongo.connect();
  const dbName = process.env.MONGODB_DB || databaseNameFromUri(mongoUri);
  const database = mongo.db(dbName);
  const source = await readPostgresSnapshot(postgres);
  const counts = {};

  for (const [collectionName, records] of Object.entries(source.collections)) {
    counts[collectionName] = await insertMissing(database.collection(collectionName), records);
  }
  counts.otps = await insertMissing(database.collection('otps'), source.otps);
  if (source.dataset) counts.datasets = await insertMissing(database.collection('datasets'), [{ ...source.dataset, id: 'current' }]);

  console.log(`PostgreSQL records copied additively to MongoDB; existing destination documents were preserved: ${JSON.stringify(counts)}`);
} finally {
  await Promise.all([mongo.close(), postgres.end()]);
}

async function readPostgresSnapshot(pool) {
  const [
    admins, departments, employees, registrations, appRecords, assessments, questions, submissions, results
  ] = await Promise.all([
    pool.query('SELECT id, admin_id, email, name, password_hash FROM administrators'),
    pool.query('SELECT id, name FROM departments'),
    pool.query('SELECT id, employee_id, full_name, email, password_hash, position, department, status, profile, created_at, updated_at FROM employees'),
    pool.query('SELECT id, status, data, created_at, processed_at FROM registration_requests'),
    pool.query('SELECT kind, id, data FROM app_records'),
    pool.query('SELECT id, title, status, target_department, version, settings, created_at, updated_at FROM assessments'),
    pool.query('SELECT id, assessment_id, assessment_version, question_order, section, prompt, scoring_direction, required, options FROM assessment_questions ORDER BY assessment_id, assessment_version, question_order'),
    pool.query('SELECT id, assessment_id, assessment_version, employee_id, attempt_number, answers, time_taken_seconds, submitted_at FROM assessment_submissions'),
    pool.query('SELECT submission_id, overtime_score, overtime_percentage, project_score, project_percentage, wlb_score, wlb_percentage, wlb_risk_percentage, additional_risk_percentage, overall_score, components FROM assessment_results')
  ]);

  const questionGroups = new Map();
  for (const row of questions.rows) {
    const key = `${row.assessment_id}:${row.assessment_version}`;
    const grouped = questionGroups.get(key) || [];
    grouped.push({
      id: row.id,
      section: row.section,
      text: row.prompt,
      scoringDirection: row.scoring_direction,
      required: row.required,
      options: row.options
    });
    questionGroups.set(key, grouped);
  }
  const assessmentsById = new Map(assessments.rows.map((row) => [row.id, {
    ...(row.settings || {}),
    id: row.id,
    title: row.title,
    status: row.status,
    targetDepartment: row.target_department,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    questions: questionGroups.get(`${row.id}:${row.version}`) || []
  }]));
  const resultsBySubmission = new Map(results.rows.map((row) => [row.submission_id, {
    overtimeScore: Number(row.overtime_score),
    overtimePercentage: Number(row.overtime_percentage),
    projectScore: Number(row.project_score),
    projectPercentage: Number(row.project_percentage),
    wlbScore: Number(row.wlb_score),
    wlbPercentage: Number(row.wlb_percentage),
    wlbRiskPercentage: Number(row.wlb_risk_percentage),
    additionalRiskPercentage: Number(row.additional_risk_percentage),
    overallScore: Number(row.overall_score),
    components: row.components
  }]));

  const employeeRecords = employees.rows.map((row) => ({
    ...(row.profile || {}),
    id: row.id,
    employeeId: row.employee_id,
    fullName: row.full_name,
    email: row.email,
    passwordHash: row.password_hash,
    position: row.position,
    department: row.department,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    role: 'EMPLOYEE'
  }));
  const appKinds = {
    notifications: 'notifications',
    tasks: 'tasks',
    attendance: 'attendance',
    predictions: 'predictions',
    audit_logs: 'auditlogs'
  };
  const collections = {
    admins: admins.rows.map((row) => ({
      id: row.id, adminId: row.admin_id, email: row.email, name: row.name, passwordHash: row.password_hash, role: 'ADMIN'
    })),
    departments: departments.rows.map((row) => ({ id: row.id, name: row.name })),
    employees: employeeRecords,
    registrationrequests: registrations.rows.map((row) => ({
      ...(row.data || {}), id: row.id, status: row.status, createdAt: row.created_at, processedAt: row.processed_at
    })),
    assessments: [...assessmentsById.values()],
    submissions: submissions.rows.map((row) => ({
      id: row.id,
      assessmentId: row.assessment_id,
      assessmentVersion: row.assessment_version,
      employeeId: row.employee_id,
      attemptNumber: row.attempt_number,
      answers: row.answers,
      timeTakenSeconds: row.time_taken_seconds,
      submittedAt: row.submitted_at,
      results: resultsBySubmission.get(row.id)
    }))
  };
  for (const [kind, collectionName] of Object.entries(appKinds)) {
    collections[collectionName] = appRecords.rows.filter((row) => row.kind === kind).map((row) => ({
      ...row.data,
      id: row.id
    }));
  }
  const otps = appRecords.rows.filter((row) => row.kind === 'otp').map((row) => ({ ...row.data, id: row.id }));
  const dataset = appRecords.rows.find((row) => row.kind === 'dataset')?.data;
  return { collections, otps, dataset };
}

async function insertMissing(collection, records) {
  let inserted = 0;
  for (const record of records) {
    if (!record.id) continue;
    const id = mongoId(record.id);
    const { id: _idField, _id: _mongoId, ...data } = record;
    const result = await collection.updateOne(
      { _id: id },
      { $setOnInsert: { ...data, _id: id, id: String(record.id) } },
      { upsert: true }
    );
    inserted += result.upsertedCount;
  }
  return inserted;
}

function mongoId(value) {
  const stringValue = String(value);
  return /^[a-f\d]{24}$/i.test(stringValue) ? new ObjectId(stringValue) : stringValue;
}

function databaseNameFromUri(uri) {
  try {
    const pathname = new URL(uri).pathname.replace(/^\/+/, '');
    return decodeURIComponent(pathname.split('/')[0] || 'burnoutguard');
  } catch {
    return 'burnoutguard';
  }
}
