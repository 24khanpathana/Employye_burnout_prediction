import { MongoClient } from 'mongodb';

let client;
let database;
let collectionNames = {};

export const getDatabase = () => {
  if (!database) throw new Error('MongoDB is not connected. Call connectDB() before accessing application data.');
  return database;
};

export const getCollection = (name) => getDatabase().collection(collectionNames[name] || name);

const connectDB = async () => {
  if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET must be configured in production.');
  }
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI must be configured to connect to MongoDB.');

  if (!client) {
    client = new MongoClient(uri, {
      maxPoolSize: Number(process.env.MONGODB_POOL_MAX || 10),
      minPoolSize: 0,
      serverSelectionTimeoutMS: 10000
    });
  }
  await client.connect();
  const databaseName = process.env.MONGODB_DB || databaseNameFromUri(uri);
  database = client.db(databaseName);
  await database.command({ ping: 1 });
  const existingCollections = await database.listCollections({}, { nameOnly: true }).toArray();
  const existingNames = new Set(existingCollections.map(({ name }) => name));
  collectionNames = {
    admins: existingNames.has('admins') ? 'admins' : existingNames.has('administrators') ? 'administrators' : 'admins',
    registrations: existingNames.has('registrationrequests')
      ? 'registrationrequests'
      : existingNames.has('registration_requests') ? 'registration_requests' : 'registrationrequests'
  };
  await ensureIndexes(database);
  await seedDepartments(database);
  await seedAdministrator(database);
  console.log(`MongoDB connected (${database.databaseName})`);
};

async function ensureIndexes(db) {
  const caseInsensitive = { locale: 'en', strength: 2 };
  await Promise.all([
    db.collection(collectionNames.admins).createIndex({ adminId: 1 }, { unique: true, partialFilterExpression: { adminId: { $type: 'string' } }, collation: caseInsensitive }),
    db.collection(collectionNames.admins).createIndex({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: 'string' } }, collation: caseInsensitive }),
    db.collection('employees').createIndex({ employeeId: 1 }, { name: 'employeeId_ci_unique_v2', unique: true, partialFilterExpression: { employeeId: { $type: 'string' } }, collation: caseInsensitive }),
    db.collection('employees').createIndex({ email: 1 }, { name: 'email_ci_unique_v2', unique: true, partialFilterExpression: { email: { $type: 'string' } }, collation: caseInsensitive }),
    db.collection('employees').createIndex({ status: 1, department: 1 }),
    db.collection(collectionNames.registrations).createIndex({ employeeId: 1 }, { unique: true, partialFilterExpression: { employeeId: { $type: 'string' } }, collation: caseInsensitive }),
    db.collection('departments').createIndex({ name: 1 }, { unique: true, partialFilterExpression: { name: { $type: 'string' } }, collation: caseInsensitive }),
    db.collection('assessments').createIndex({ status: 1, targetDepartment: 1 }),
    db.collection('submissions').createIndex(
      { assessmentId: 1, employeeId: 1, attemptNumber: 1 },
      { unique: true, partialFilterExpression: { assessmentId: { $type: 'string' }, employeeId: { $type: 'string' }, attemptNumber: { $type: 'number' } } }
    ),
    db.collection('tasks').createIndex({ assignedToId: 1, dueDate: 1 }),
    db.collection('attendance').createIndex(
      { employeeId: 1, date: 1 },
      { unique: true, partialFilterExpression: { employeeId: { $type: 'string' }, date: { $type: 'string' } } }
    ),
    db.collection('notifications').createIndex({ employeeId: 1, createdAt: -1 }),
    db.collection('auditlogs').createIndex({ occurredAt: -1 })
  ]);
}

async function seedDepartments(db) {
  const departments = [
    'HR', 'IT', 'Finance & Accounting', 'Sales', 'Marketing', 'Operations', 'R&D', 'Engineering',
    'Customer Support', 'Product Management', 'Business Development', 'Legal & Compliance',
    'Procurement', 'Supply Chain & Logistics', 'QA', 'Administration', 'Security',
    'Data Science & Analytics', 'Project Management', 'PR', 'Manufacturing / Production',
    'Training & Development', 'Design / UI-UX', 'Cybersecurity', 'Facilities Management'
  ];
  await db.collection('departments').bulkWrite(departments.map((name) => ({
    updateOne: {
      filter: { name },
      update: { $setOnInsert: { _id: `dept-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, name } },
      upsert: true
    }
  })));
}

async function seedAdministrator(db) {
  const adminId = process.env.ADMIN_ID;
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;
  if (!adminId || !passwordHash) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ADMIN_ID and ADMIN_PASSWORD_HASH must be configured in production.');
    }
    return;
  }
  await db.collection(collectionNames.admins).updateOne(
    { adminId },
    { $setOnInsert: {
      _id: 'admin-initial',
      adminId,
      email: process.env.ADMIN_EMAIL || adminId,
      name: process.env.ADMIN_NAME || 'BurnoutGuard Admin',
      passwordHash,
      role: 'ADMIN',
      createdAt: new Date().toISOString()
    } },
    { upsert: true }
  );
}

function databaseNameFromUri(uri) {
  try {
    const pathname = new URL(uri).pathname.replace(/^\/+/, '');
    return decodeURIComponent(pathname.split('/')[0] || 'burnoutguard');
  } catch {
    return 'burnoutguard';
  }
}

export const closeDB = async () => {
  if (!client) return;
  await client.close();
  client = undefined;
  database = undefined;
  collectionNames = {};
};

export default connectDB;
