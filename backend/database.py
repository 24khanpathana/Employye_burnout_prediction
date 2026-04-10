import sqlite3
from contextlib import contextmanager

DB_PATH = "burnout_guard.db"

def init_db():
    """Initialize the SQLite database with the simplified 12-column schema."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Drop and recreate tables on every startup to match current schema
    cursor.execute("DROP TABLE IF EXISTS employees")
    cursor.execute("DROP TABLE IF EXISTS predictions")

    # Employees table — simplified schema (12 columns)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS employees (
            employee_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            salary REAL,
            working_hours REAL,
            stress_level INTEGER,
            experience REAL,
            department TEXT,
            overtime_frequency INTEGER,
            work_life_balance_score INTEGER,
            leave_taken INTEGER,
            performance_rating INTEGER,
            promotion_status TEXT
        )
    """)

    # Predictions table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS predictions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id TEXT NOT NULL,
            burnout_score REAL NOT NULL,
            risk_level TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
        )
    """)

    conn.commit()
    conn.close()

@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

def dict_from_row(row):
    if row is None:
        return None
    return dict(row)
