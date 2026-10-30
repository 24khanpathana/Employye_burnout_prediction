# BurnoutGuard

BurnoutGuard is an employee well-being and retention platform with separate admin and employee portals, MongoDB persistence, department analytics, assessment hosting, and a Python machine-learning service.

## Stack

- Frontend: React, Vite, Tailwind CSS, Recharts, React Router
- Backend: Node.js, Express, MongoDB, JWT, bcrypt
- ML: Python, FastAPI, pandas, NumPy, scikit-learn, XGBoost, VADER
- Email: Brevo transactional email API for password-reset codes and hosted assessment invitations

## Requirements

- Node.js 18+
- MongoDB 6+
- Python 3.13
- npm and pip

## Configuration

Copy `.env.example` to `backend/.env` and set values for your environment. Do not commit `.env` files.

Required settings:

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Random signing secret; use at least 32 random bytes |
| `ADMIN_ID` | Initial administrator login ID |
| `ADMIN_PASSWORD_HASH` | bcrypt hash for the initial administrator password |

`MONGODB_DB` optionally selects a database; otherwise the database name in the URI is used (or `burnoutguard`). Optional service settings include `MONGODB_POOL_MAX`, `ADMIN_EMAIL`, `ADMIN_NAME`, `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`, `FRONTEND_URL`, `PYTHON_ML_URL`, and `MAX_CSV_SIZE_MB`. If Brevo is not configured, assessment hosting still succeeds, in-app employee notifications are created, and the admin UI reports that email delivery is unavailable.

Generate a bcrypt hash from the `backend` directory:

```powershell
node -e "console.log(require('bcryptjs').hashSync('replace-with-a-strong-password', 12))"
```

The initial administrator is inserted only when configured and only if that `ADMIN_ID` does not already exist. Development tests use an isolated in-memory administrator; the test credential is not used by the production database.

## MongoDB setup

1. Start MongoDB locally or provision a MongoDB Atlas cluster.
2. Set `MONGODB_URI` in `backend/.env`; optionally set `MONGODB_DB`.
3. Start the backend. It verifies the connection, creates the required indexes, seeds the department directory, and provisions the configured initial administrator before accepting requests.

Runtime data is stored in MongoDB collections for admins, employees, registration requests, departments, assessments, submissions, tasks, attendance, notifications, prediction history, audit logs, password reset codes, and dataset metadata. Assessment questions and results are stored with their parent assessment/submission records.

### Import data from the previous PostgreSQL backend

If you previously ran the PostgreSQL version, the optional importer copies its records into MongoDB. It is additive: existing MongoDB documents are preserved and PostgreSQL is read-only. Back up both databases first, then set `LEGACY_POSTGRES_URL` and `MONGODB_URI` and run:

```powershell
cd backend
npm run db:migrate:postgres-to-mongo
```

Review the inserted counts and verify the destination data before switching traffic. The importer reads the prior BurnoutGuard PostgreSQL schema; it does not delete or modify the source.

## Install and run

Install dependencies:

```powershell
cd backend
npm install
cd ..\frontend
npm install
```

Run the backend and frontend in separate PowerShell windows:

```powershell
cd backend
npm run dev
```

```powershell
cd frontend
npm run dev
```

The frontend defaults to `http://localhost:5000` for its API. Set `VITE_API_URL` in `frontend/.env` to use another backend URL. Backend health is available at `/api/health`.

## Python ML service

Create and activate a virtual environment:

```powershell
cd ml
py -3.13 -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn service:app --reload --host 127.0.0.1 --port 8001
```

`GET /health` reports whether trained burnout and attrition artifacts are available. The prediction API uses the preserved burnout formula and VADER sentiment. XGBoost predictions are returned only when the corresponding trained artifact exists; the service does not invent attrition predictions when no attrition model is trained. Uploading a labeled CSV through the admin dashboard analyzes and trains from that dataset, then displays row/column counts, target-label distribution, and model metrics in Settings. The raw rows are not added to the employee directory. Target columns must contain real labels, with at least two rows per class. The service reloads the newly trained models for subsequent predictions.

Train manually from a real, labeled employee CSV (CSV and Google Sheets uploads from the admin dashboard also trigger this through the running ML service):

```powershell
cd ml
python train_model.py "D:\path with spaces\labeled-employees.csv"
```

The CSV must contain a real `BurnoutRisk` and/or `AttritionRisk` target. Quote the whole file path when it contains spaces. The training script does not create sample employees or synthesize target labels. It reports Accuracy, Precision, Recall, F1, ROC-AUC, and a confusion matrix from a stratified holdout set. Use a dataset with at least two examples per class. Generated models and metrics are excluded from source control. The dashboard uses the uploaded dataset directly for training; failed training does not import it or replace current models.

The formula score is `25% overtime + 20% projects + 15% leave + 15% inverse work-life balance + 10% inverse training + 10% inverse customer satisfaction + 5% promotion gap`, with each component normalized and bounded using the defaults in `ml/burnout_score.py`. Risk bands are low (0–39), medium (40–69), and high (70–100). When training the burnout model, the dataset's normalization values are stored beside the artifact and reused by the service.

## Assessment workflow

1. Sign in to the admin portal and open **Tests**.
2. Create a draft; the default template contains exactly 20 ordered questions.
3. Edit the title, instructions, department, dates, five response labels/scores, and question text; save the draft.
4. Preview the form and choose **Host test**. Publishing validates the required question IDs, section membership, five-option mappings, and scoring weights. Eligible employees receive in-app notifications and, when Brevo is configured, individual email invitations.
5. Eligible employees see the test under **Assessments**, can answer and submit it, review their own notifications, and cannot access another employee's records.
6. Admins can review aggregate submissions under **Test results**. Employee-visible results are opt-in per test.

The server computes scores from answer-option IDs; it ignores any client-provided scores. Scoring weights are 30% overtime, 25% project workload, 25% WLB risk, and 20% additional-assessment risk. Each section uses its answered items; optional unanswered items are excluded, and at least one item in each scored section is required. The WLB calculation reverses Q8 and reports both WLB percentage and its inverse risk percentage. These are workforce well-being measures, not medical diagnoses.

Stopping a test blocks new starts and submissions that have not yet been received. Previously submitted results remain stored. Assessment content is immutable after publishing so historical results remain interpretable.

## Tests and checks

```powershell
cd backend
npm test
cd ..\frontend
npm run build
```

The backend tests cover scoring math, required-answer validation, test hosting/submission, result visibility and export, authentication and OTP reset, registration approval, department filtering/export, additive CSV import, employee-scoped task, attendance, and notification workflows, prediction service failures, and administrator audit logging.

## Current boundaries

- A MongoDB service and valid `MONGODB_URI` are required for non-test backend startup. MongoDB connection, index creation, legacy null-email compatibility, and persistence were verified locally against a disposable database. The PostgreSQL importer was not exercised because no legacy PostgreSQL database is configured.
- XGBoost model output requires training artifacts built from actual labeled data. When absent, the product clearly identifies formula-based burnout scoring and leaves attrition prediction unavailable.
- The PostgreSQL importer targets the previous BurnoutGuard schema; unrelated PostgreSQL tables are not migrated.
- Admins can create and update tasks and record attendance; employees can update their own task status, see attendance summaries, and read their own notifications.
- Department, assessment result, prediction history, attendance, and administrator audit reports support CSV export. Assessment results and audit records support filtering and pagination.
- Administrator mutations are retained in the audit log with actor, route, timestamp, and response status; request bodies and credentials are deliberately excluded. The log is capped at 5,000 records.
- Brevo email delivery requires valid service credentials and was not integration-tested in this environment.
