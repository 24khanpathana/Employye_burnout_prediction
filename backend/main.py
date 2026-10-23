from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import pandas as pd
import io
import logging
import requests
from database import init_db, get_db
from ml_model import load_or_train_model, predict_burnout_batch

# Configure server-side debug logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("burnoutguard")

# Initialize database and model
init_db()
load_or_train_model()

app = FastAPI(title="BurnoutGuard API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class UploadResponseResult(BaseModel):
    employee_id: str
    name: str
    email: str
    burnout_score: int
    risk_level: str
    promotion_status: str

class UrlPredictRequest(BaseModel):
    url: str

def get_promotion_status(performance: int, stress: int) -> str:
    """Derive promotion status from performance rating and stress level."""
    if performance >= 4 and stress <= 5:
        return "Recommended"
    elif performance >= 4 and stress > 5:
        return "Hold"
    else:
        return "Not Eligible"

# Required columns for the simplified schema (promotion_status comes from CSV)
REQUIRED_COLUMNS = [
    "employee_id",
    "name",
    "salary",
    "working_hours",
    "stress_level",
    "experience",
    "department",
    "overtime_frequency",
    "work_life_balance_score",
    "leave_taken",
    "performance_rating",
]

# Flexible column name aliases: maps common user variations → canonical name
COLUMN_ALIASES = {
    "emp_id": "employee_id",
    "empid": "employee_id",
    "id": "employee_id",
    "employee id": "employee_id",
    "full_name": "name",
    "fullname": "name",
    "employee_name": "name",
    "annual_salary": "salary",
    "pay": "salary",
    "ctc": "salary",
    "working hours": "working_hours",
    "work_hours": "working_hours",
    "hours_per_week": "working_hours",
    "weekly_hours": "working_hours",
    "stress": "stress_level",
    "stress score": "stress_level",
    "years_experience": "experience",
    "exp": "experience",
    "dept": "department",
    "team": "department",
    "overtime": "overtime_frequency",
    "overtime_hours": "overtime_frequency",
    "work_life_balance": "work_life_balance_score",
    "wlb": "work_life_balance_score",
    "wlb_score": "work_life_balance_score",
    "leaves": "leave_taken",
    "leave_days": "leave_taken",
    "leaves_taken": "leave_taken",
    "performance": "performance_rating",
    "perf_rating": "performance_rating",
    "rating": "performance_rating",
    "promo_status": "promotion_status",
    "promotion": "promotion_status",
}

def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Lowercase + strip all column names, then apply alias remapping."""
    df.columns = df.columns.str.strip().str.lower().str.replace(r'\s+', '_', regex=True)
    # Apply alias mapping
    df.rename(columns=lambda c: COLUMN_ALIASES.get(c, c), inplace=True)
    logger.info(f"Normalized columns: {list(df.columns)}")
    return df

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/upload", response_model=List[UploadResponseResult])
async def upload_csv(file: UploadFile = File(...)):
    """Handles CSV file upload and returns predictions."""
    logger.info(f"📂 CSV Upload received: filename='{file.filename}', content_type='{file.content_type}'")

    if not (file.filename or '').lower().endswith('.csv'):
        raise HTTPException(status_code=400, detail="Invalid file format. Please upload a .csv file.")

    # 1. Read raw bytes with encoding fallback
    try:
        contents = await file.read()
        if not contents:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        # Try UTF-8 first, fall back to latin-1 for Windows-encoded CSVs
        try:
            df = pd.read_csv(io.BytesIO(contents), encoding='utf-8')
        except UnicodeDecodeError:
            logger.warning("UTF-8 decode failed — retrying with latin-1 encoding.")
            df = pd.read_csv(io.BytesIO(contents), encoding='latin-1')

        logger.info(f"📊 Raw columns after read: {list(df.columns)}")
        logger.info(f"📏 Shape: {df.shape[0]} rows × {df.shape[1]} cols")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {str(e)}")

    # 2. Normalize column names (lowercase, strip whitespace, apply aliases)
    df = normalize_columns(df)

    # 3. Validate — report each missing column individually for clarity
    missing_cols = [col for col in REQUIRED_COLUMNS if col not in df.columns]
    if missing_cols:
        missing_detail = "; ".join([f"Missing column: '{c}'" for c in missing_cols])
        logger.error(f"❌ Validation failed — {missing_detail}")
        raise HTTPException(
            status_code=400,
            detail=f"CSV is missing {len(missing_cols)} required column(s): {missing_detail}"
        )

    if df.empty:
        raise HTTPException(status_code=400, detail="Uploaded dataset has no data rows.")

    logger.info(f"✅ Validation passed — {df.shape[0]} employee records ready for processing.")

    # 4. Preprocessing — fill missing values
    numeric_cols = df.select_dtypes(include=['number']).columns
    if len(numeric_cols) > 0:
        df[numeric_cols] = df[numeric_cols].fillna(df[numeric_cols].mean())
    df.ffill(inplace=True)

    # Encode categorical fields
    if df['department'].dtype == 'object':
        df['department_encoded'] = pd.factorize(df['department'])[0]

    # 5. ML Prediction
    try:
        probs = predict_burnout_batch(df)
        logger.info(f"🤖 ML model returned {len(probs)} probability scores.")
    except Exception as e:
        logger.error(f"ML prediction error: {e}")
        raise HTTPException(status_code=500, detail=f"Model prediction failed: {str(e)}")
    
    # 6. Risk Classification — lowercase for consistent frontend handling
    burnout_scores = (probs * 100).astype(int)

    risk_levels = []
    for p in probs:
        if p > 0.7:
            risk_levels.append("high")
        elif p >= 0.4:
            risk_levels.append("medium")
        else:
            risk_levels.append("low")

    df['burnout_score'] = burnout_scores
    df['risk_level'] = risk_levels
    logger.info(f"📈 Risk distribution: {dict(pd.Series(risk_levels).value_counts())}")

    # 7. Store results and build response
    response_list = []

    try:
        with get_db() as conn:
            cursor = conn.cursor()

            for _, row in df.iterrows():
                # Derive promotion_status from CSV column if provided, else compute it
                if 'promotion_status' in df.columns and pd.notna(row.get('promotion_status')):
                    promo_status = str(row['promotion_status'])
                else:
                    promo_status = get_promotion_status(int(row['performance_rating']), int(row['stress_level']))

                # Save into employees (simplified 12-column schema)
                cursor.execute("""
                    INSERT OR REPLACE INTO employees
                    (employee_id, name, salary, working_hours, stress_level, experience,
                     department, overtime_frequency, work_life_balance_score, leave_taken,
                     performance_rating, promotion_status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    str(row['employee_id']), str(row['name']), float(row['salary']),
                    float(row['working_hours']), int(row['stress_level']), float(row['experience']),
                    str(row['department']), int(row['overtime_frequency']),
                    int(row['work_life_balance_score']), int(row['leave_taken']),
                    int(row['performance_rating']), promo_status
                ))

                # Save into predictions
                cursor.execute("""
                    INSERT INTO predictions (employee_id, burnout_score, risk_level)
                    VALUES (?, ?, ?)
                """, (str(row['employee_id']), float(row['burnout_score']), str(row['risk_level'])))

                response_list.append(UploadResponseResult(
                    employee_id=str(row['employee_id']),
                    name=str(row['name']),
                    email=f"{str(row['name']).lower().replace(' ', '.')}@company.com",
                    burnout_score=int(row['burnout_score']),
                    risk_level=str(row['risk_level']),
                    promotion_status=promo_status
                ))

            conn.commit()

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database operation failed: {str(e)}")

    return response_list

@app.post("/predict-from-url", response_model=List[UploadResponseResult])
async def predict_from_url(request: UrlPredictRequest):
    """Fetches CSV from Google Sheets export URL, validates, and returns burnout predictions."""
    logger.info(f"🌐 Google Sheets request received: url='{request.url}'")
    
    if not request.url:
        raise HTTPException(status_code=400, detail="URL is required.")
    
    # Validate Google Sheets URL
    if not request.url.startswith("https://docs.google.com"):
        raise HTTPException(status_code=400, detail="Invalid URL. Only Google Sheets URLs are accepted.")
    
    # 1. Fetch CSV from URL
    try:
        response = requests.get(request.url, timeout=15)
        if response.status_code != 200:
            raise HTTPException(status_code=400, detail=f"Failed to fetch URL: HTTP {response.status_code}. Ensure the Google Sheet is public.")
        
        contents = response.content
        if not contents:
            raise HTTPException(status_code=400, detail="Fetched content is empty.")
        
        logger.info(f"✅ Successfully fetched {len(contents)} bytes from Google Sheet")
        
    except requests.exceptions.Timeout:
        raise HTTPException(status_code=400, detail="Request timeout. Google Sheet took too long to respond.")
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch from Google Sheet: {str(e)}")
    
    # 2. Parse CSV with encoding fallback
    try:
        try:
            df = pd.read_csv(io.BytesIO(contents), encoding='utf-8')
        except UnicodeDecodeError:
            logger.warning("UTF-8 decode failed — retrying with latin-1 encoding.")
            df = pd.read_csv(io.BytesIO(contents), encoding='latin-1')
        
        logger.info(f"📊 Raw columns from Google Sheet: {list(df.columns)}")
        logger.info(f"📏 Shape: {df.shape[0]} rows × {df.shape[1]} cols")
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV from Google Sheet: {str(e)}")
    
    # 3. Normalize column names
    df = normalize_columns(df)
    
    # 4. Validate required columns
    missing_cols = [col for col in REQUIRED_COLUMNS if col not in df.columns]
    if missing_cols:
        missing_detail = "; ".join([f"Missing column: '{c}'" for c in missing_cols])
        logger.error(f"❌ Validation failed — {missing_detail}")
        raise HTTPException(
            status_code=400,
            detail=f"CSV is missing {len(missing_cols)} required column(s): {missing_detail}"
        )
    
    if df.empty:
        raise HTTPException(status_code=400, detail="Google Sheet has no data rows.")
    
    logger.info(f"✅ Validation passed — {df.shape[0]} employee records ready for processing.")
    
    # 5. Preprocessing — fill missing values
    numeric_cols = df.select_dtypes(include=['number']).columns
    if len(numeric_cols) > 0:
        df[numeric_cols] = df[numeric_cols].fillna(df[numeric_cols].mean())
    df.ffill(inplace=True)
    
    # Encode categorical fields
    if df['department'].dtype == 'object':
        df['department_encoded'] = pd.factorize(df['department'])[0]
    
    # 6. ML Prediction
    try:
        probs = predict_burnout_batch(df)
        logger.info(f"🤖 ML model returned {len(probs)} probability scores.")
    except Exception as e:
        logger.error(f"ML prediction error: {e}")
        raise HTTPException(status_code=500, detail=f"Model prediction failed: {str(e)}")
    
    # 7. Risk Classification
    burnout_scores = (probs * 100).astype(int)
    
    risk_levels = []
    for p in probs:
        if p > 0.7:
            risk_levels.append("high")
        elif p >= 0.4:
            risk_levels.append("medium")
        else:
            risk_levels.append("low")
    
    df['burnout_score'] = burnout_scores
    df['risk_level'] = risk_levels
    logger.info(f"📈 Risk distribution: {dict(pd.Series(risk_levels).value_counts())}")
    
    # 8. Store results and build response
    response_list = []
    
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            for _, row in df.iterrows():
                # Derive promotion_status from CSV column if provided, else compute it
                if 'promotion_status' in df.columns and pd.notna(row.get('promotion_status')):
                    promo_status = str(row['promotion_status'])
                else:
                    promo_status = get_promotion_status(int(row['performance_rating']), int(row['stress_level']))
                
                # Save into employees
                cursor.execute("""
                    INSERT OR REPLACE INTO employees
                    (employee_id, name, salary, working_hours, stress_level, experience,
                     department, overtime_frequency, work_life_balance_score, leave_taken,
                     performance_rating, promotion_status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    str(row['employee_id']), str(row['name']), float(row['salary']),
                    float(row['working_hours']), int(row['stress_level']), float(row['experience']),
                    str(row['department']), int(row['overtime_frequency']),
                    int(row['work_life_balance_score']), int(row['leave_taken']),
                    int(row['performance_rating']), promo_status
                ))
                
                # Save into predictions
                cursor.execute("""
                    INSERT INTO predictions (employee_id, burnout_score, risk_level)
                    VALUES (?, ?, ?)
                """, (str(row['employee_id']), float(row['burnout_score']), str(row['risk_level'])))
                
                response_list.append(UploadResponseResult(
                    employee_id=str(row['employee_id']),
                    name=str(row['name']),
                    email=f"{str(row['name']).lower().replace(' ', '.')}@company.com",
                    burnout_score=int(row['burnout_score']),
                    risk_level=str(row['risk_level']),
                    promotion_status=promo_status
                ))
            
            conn.commit()
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database operation failed: {str(e)}")
    
    return response_list

@app.get("/health")
async def health():
    return {"status": "ok"}
    
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            for _, row in df.iterrows():
                # Derive promotion_status from CSV column if provided, else compute it
                if 'promotion_status' in df.columns and pd.notna(row.get('promotion_status')):
                    promo_status = str(row['promotion_status'])
                else:
                    promo_status = get_promotion_status(int(row['performance_rating']), int(row['stress_level']))
                
                # Save into employees
                cursor.execute("""
                    INSERT OR REPLACE INTO employees
                    (employee_id, name, salary, working_hours, stress_level, experience,
                     department, overtime_frequency, work_life_balance_score, leave_taken,
                     performance_rating, promotion_status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    str(row['employee_id']), str(row['name']), float(row['salary']),
                    float(row['working_hours']), int(row['stress_level']), float(row['experience']),
                    str(row['department']), int(row['overtime_frequency']),
                    int(row['work_life_balance_score']), int(row['leave_taken']),
                    int(row['performance_rating']), promo_status
                ))
                
                # Save into predictions
                cursor.execute("""
                    INSERT INTO predictions (employee_id, burnout_score, risk_level)
                    VALUES (?, ?, ?)
                """, (str(row['employee_id']), float(row['burnout_score']), str(row['risk_level'])))
                
                response_list.append(UploadResponseResult(
                    employee_id=str(row['employee_id']),
                    name=str(row['name']),
                    email=f"{str(row['name']).lower().replace(' ', '.')}@company.com",
                    burnout_score=int(row['burnout_score']),
                    risk_level=str(row['risk_level']),
                    promotion_status=promo_status
                ))
            
            conn.commit()
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database operation failed: {str(e)}")
    
    return response_list

@app.post("/upload", response_model=List[UploadResponseResult])
async def upload_csv(file: UploadFile = File(...)):
    logger.info(f"📂 Upload received: filename='{file.filename}', content_type='{file.content_type}'")

    if not (file.filename or '').lower().endswith('.csv'):
        raise HTTPException(status_code=400, detail="Invalid file format. Please upload a .csv file.")

    # 1. Read raw bytes with encoding fallback
    try:
        contents = await file.read()
        if not contents:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        # Try UTF-8 first, fall back to latin-1 for Windows-encoded CSVs
        try:
            df = pd.read_csv(io.BytesIO(contents), encoding='utf-8')
        except UnicodeDecodeError:
            logger.warning("UTF-8 decode failed — retrying with latin-1 encoding.")
            df = pd.read_csv(io.BytesIO(contents), encoding='latin-1')

        logger.info(f"📊 Raw columns after read: {list(df.columns)}")
        logger.info(f"📏 Shape: {df.shape[0]} rows × {df.shape[1]} cols")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {str(e)}")

    # 2. Normalize column names (lowercase, strip whitespace, apply aliases)
    df = normalize_columns(df)

    # 3. Validate — report each missing column individually for clarity
    missing_cols = [col for col in REQUIRED_COLUMNS if col not in df.columns]
    if missing_cols:
        missing_detail = "; ".join([f"Missing column: '{c}'" for c in missing_cols])
        logger.error(f"❌ Validation failed — {missing_detail}")
        raise HTTPException(
            status_code=400,
            detail=f"CSV is missing {len(missing_cols)} required column(s): {missing_detail}"
        )

    if df.empty:
        raise HTTPException(status_code=400, detail="Uploaded dataset has no data rows.")

    logger.info(f"✅ Validation passed — {df.shape[0]} employee records ready for processing.")

    # 4. Preprocessing — fill missing values
    numeric_cols = df.select_dtypes(include=['number']).columns
    if len(numeric_cols) > 0:
        df[numeric_cols] = df[numeric_cols].fillna(df[numeric_cols].mean())
    df.ffill(inplace=True)

    # Encode categorical fields
    if df['department'].dtype == 'object':
        df['department_encoded'] = pd.factorize(df['department'])[0]

    # 5. ML Prediction
    try:
        probs = predict_burnout_batch(df)
        logger.info(f"🤖 ML model returned {len(probs)} probability scores.")
    except Exception as e:
        logger.error(f"ML prediction error: {e}")
        raise HTTPException(status_code=500, detail=f"Model prediction failed: {str(e)}")
    
    # 6. Risk Classification — lowercase for consistent frontend handling
    burnout_scores = (probs * 100).astype(int)

    risk_levels = []
    for p in probs:
        if p > 0.7:
            risk_levels.append("high")
        elif p >= 0.4:
            risk_levels.append("medium")
        else:
            risk_levels.append("low")

    df['burnout_score'] = burnout_scores
    df['risk_level'] = risk_levels
    logger.info(f"📈 Risk distribution: {dict(pd.Series(risk_levels).value_counts())}")

    # 7. Store results and build response
    response_list = []

    try:
        with get_db() as conn:
            cursor = conn.cursor()

            for _, row in df.iterrows():
                # Derive promotion_status from CSV column if provided, else compute it
                if 'promotion_status' in df.columns and pd.notna(row.get('promotion_status')):
                    promo_status = str(row['promotion_status'])
                else:
                    promo_status = get_promotion_status(int(row['performance_rating']), int(row['stress_level']))

                # Save into employees (simplified 12-column schema)
                cursor.execute("""
                    INSERT OR REPLACE INTO employees
                    (employee_id, name, salary, working_hours, stress_level, experience,
                     department, overtime_frequency, work_life_balance_score, leave_taken,
                     performance_rating, promotion_status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    str(row['employee_id']), str(row['name']), float(row['salary']),
                    float(row['working_hours']), int(row['stress_level']), float(row['experience']),
                    str(row['department']), int(row['overtime_frequency']),
                    int(row['work_life_balance_score']), int(row['leave_taken']),
                    int(row['performance_rating']), promo_status
                ))

                # Save into predictions
                cursor.execute("""
                    INSERT INTO predictions (employee_id, burnout_score, risk_level)
                    VALUES (?, ?, ?)
                """, (str(row['employee_id']), float(row['burnout_score']), str(row['risk_level'])))

                response_list.append(UploadResponseResult(
                    employee_id=str(row['employee_id']),
                    name=str(row['name']),
                    email=f"{str(row['name']).lower().replace(' ', '.')}@company.com",
                    burnout_score=int(row['burnout_score']),
                    risk_level=str(row['risk_level']),
                    promotion_status=promo_status
                ))

            conn.commit()

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database operation failed: {str(e)}")

    return response_list

@app.post("/predict-from-url", response_model=List[UploadResponseResult])
async def predict_from_url(request: UrlPredictRequest):
    """Fetches CSV from URL (e.g., Google Sheets export), processes it, and returns predictions."""
    logger.info(f"🌐 Google Sheets request received: url='{request.url}'")
    
    if not request.url:
        raise HTTPException(status_code=400, detail="URL is required.")
    
    # 1. Fetch CSV from URL
    try:
        response = requests.get(request.url, timeout=15)
        if response.status_code != 200:
            raise HTTPException(status_code=400, detail=f"Failed to fetch URL: HTTP {response.status_code}. Ensure the Google Sheet is public.")
        
        contents = response.content
        if not contents:
            raise HTTPException(status_code=400, detail="Fetched content is empty.")
        
        logger.info(f"✅ Successfully fetched {len(contents)} bytes from URL")
        
    except requests.exceptions.Timeout:
        raise HTTPException(status_code=400, detail="Request timeout. URL took too long to respond.")
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch from URL: {str(e)}")
    
    # 2. Parse CSV with encoding fallback
    try:
        try:
            df = pd.read_csv(io.BytesIO(contents), encoding='utf-8')
        except UnicodeDecodeError:
            logger.warning("UTF-8 decode failed — retrying with latin-1 encoding.")
            df = pd.read_csv(io.BytesIO(contents), encoding='latin-1')
        
        logger.info(f"📊 Raw columns from URL: {list(df.columns)}")
        logger.info(f"📏 Shape: {df.shape[0]} rows × {df.shape[1]} cols")
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV from URL: {str(e)}")
    
    # 3. Normalize column names
    df = normalize_columns(df)
    
    # 4. Validate required columns
    missing_cols = [col for col in REQUIRED_COLUMNS if col not in df.columns]
    if missing_cols:
        missing_detail = "; ".join([f"Missing column: '{c}'" for c in missing_cols])
        logger.error(f"❌ Validation failed — {missing_detail}")
        raise HTTPException(
            status_code=400,
            detail=f"CSV is missing {len(missing_cols)} required column(s): {missing_detail}"
        )
    
    if df.empty:
        raise HTTPException(status_code=400, detail="Google Sheet has no data rows.")
    
    logger.info(f"✅ Validation passed — {df.shape[0]} employee records ready for processing.")
    
    # 5. Preprocessing — fill missing values
    numeric_cols = df.select_dtypes(include=['number']).columns
    if len(numeric_cols) > 0:
        df[numeric_cols] = df[numeric_cols].fillna(df[numeric_cols].mean())
    df.ffill(inplace=True)
    
    # Encode categorical fields
    if df['department'].dtype == 'object':
        df['department_encoded'] = pd.factorize(df['department'])[0]
    
    # 6. ML Prediction
    try:
        probs = predict_burnout_batch(df)
        logger.info(f"🤖 ML model returned {len(probs)} probability scores.")
    except Exception as e:
        logger.error(f"ML prediction error: {e}")
        raise HTTPException(status_code=500, detail=f"Model prediction failed: {str(e)}")
    
    # 7. Risk Classification
    burnout_scores = (probs * 100).astype(int)
    
    risk_levels = []
    for p in probs:
        if p > 0.7:
            risk_levels.append("high")
        elif p >= 0.4:
            risk_levels.append("medium")
        else:
            risk_levels.append("low")
    
    df['burnout_score'] = burnout_scores
    df['risk_level'] = risk_levels
    logger.info(f"📈 Risk distribution: {dict(pd.Series(risk_levels).value_counts())}")
    
    # 8. Store results and build response
    response_list = []
    
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            for _, row in df.iterrows():
                # Derive promotion_status from CSV column if provided, else compute it
                if 'promotion_status' in df.columns and pd.notna(row.get('promotion_status')):
                    promo_status = str(row['promotion_status'])
                else:
                    promo_status = get_promotion_status(int(row['performance_rating']), int(row['stress_level']))
                
                # Save into employees
                cursor.execute("""
                    INSERT OR REPLACE INTO employees
                    (employee_id, name, salary, working_hours, stress_level, experience,
                     department, overtime_frequency, work_life_balance_score, leave_taken,
                     performance_rating, promotion_status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    str(row['employee_id']), str(row['name']), float(row['salary']),
                    float(row['working_hours']), int(row['stress_level']), float(row['experience']),
                    str(row['department']), int(row['overtime_frequency']),
                    int(row['work_life_balance_score']), int(row['leave_taken']),
                    int(row['performance_rating']), promo_status
                ))
                
                # Save into predictions
                cursor.execute("""
                    INSERT INTO predictions (employee_id, burnout_score, risk_level)
                    VALUES (?, ?, ?)
                """, (str(row['employee_id']), float(row['burnout_score']), str(row['risk_level'])))
                
                response_list.append(UploadResponseResult(
                    employee_id=str(row['employee_id']),
                    name=str(row['name']),
                    email=f"{str(row['name']).lower().replace(' ', '.')}@company.com",
                    burnout_score=int(row['burnout_score']),
                    risk_level=str(row['risk_level']),
                    promotion_status=promo_status
                ))
            
            conn.commit()
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database operation failed: {str(e)}")
    
    return response_list

@app.post("/predict", response_model=List[UploadResponseResult])
async def run_predictions():
    """Fetches all employees from DB, runs ML model, updates predictions, and returns results."""
    try:
        with get_db() as conn:
            df = pd.read_sql_query("SELECT * FROM employees", conn)

            if df.empty:
                return []

            probs = predict_burnout_batch(df)
            burnout_scores = (probs * 100).astype(int)
            risk_levels = []
            for p in probs:
                if p > 0.7:
                    risk_levels.append("high")
                elif p >= 0.4:
                    risk_levels.append("medium")
                else:
                    risk_levels.append("low")

            df['burnout_score'] = burnout_scores
            df['risk_level']    = risk_levels

            response_list = []
            cursor = conn.cursor()

            for _, row in df.iterrows():
                cursor.execute("""
                    INSERT INTO predictions (employee_id, burnout_score, risk_level)
                    VALUES (?, ?, ?)
                """, (str(row['employee_id']), float(row['burnout_score']), str(row['risk_level'])))

                # Use stored promotion_status from DB; recompute if missing
                promo_status = str(row.get('promotion_status') or get_promotion_status(
                    int(row['performance_rating']), int(row['stress_level'])
                ))
                response_list.append(UploadResponseResult(
                    employee_id=str(row['employee_id']),
                    name=str(row['name']),
                    email=f"{str(row['name']).lower().replace(' ', '.')}@company.com",
                    burnout_score=int(row['burnout_score']),
                    risk_level=str(row['risk_level']),
                    promotion_status=promo_status
                ))

            conn.commit()
            return response_list
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")

@app.get("/results", response_model=List[UploadResponseResult])
async def get_results():
    """Returns the latest prediction results for all employees."""
    try:
        with get_db() as conn:
            query = """
                SELECT e.*, p.burnout_score, p.risk_level
                FROM employees e
                LEFT JOIN (
                    SELECT employee_id, burnout_score, risk_level, MAX(created_at)
                    FROM predictions
                    GROUP BY employee_id
                ) p ON e.employee_id = p.employee_id
            """
            cursor = conn.cursor()
            cursor.execute(query)
            rows = cursor.fetchall()

            response_list = []
            for row in rows:
                if row['burnout_score'] is None:
                    continue
                # Read promotion_status stored in DB; recompute if blank
                promo_status = row['promotion_status'] or get_promotion_status(
                    int(row['performance_rating'] or 0), int(row['stress_level'] or 5)
                )
                response_list.append(UploadResponseResult(
                    employee_id=str(row['employee_id']),
                    name=str(row['name']),
                    email=f"{str(row['name']).lower().replace(' ', '.')}@company.com",
                    burnout_score=int(row['burnout_score']),
                    risk_level=str(row['risk_level']).lower(),
                    promotion_status=promo_status
                ))
            return response_list
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch results: {str(e)}")

@app.get("/stats")
async def get_stats():
    """Calculates and returns dashboard statistics."""
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Total employees
            cursor.execute("SELECT COUNT(*) as cnt FROM employees")
            total_employees = cursor.fetchone()['cnt']
            
            if total_employees == 0:
                return {
                    "total_employees": 0, "high_risk": 0, "medium_risk": 0, "low_risk": 0,
                    "avg_burnout_score": 0, "avg_salary": 0, "patterns_found": 0, "health_score": 100
                }
                
            # Avg salary
            cursor.execute("SELECT AVG(salary) as avg_sal FROM employees")
            avg_salary = cursor.fetchone()['avg_sal'] or 0
            
            # Risk counts
            query = """
                SELECT p.risk_level, COUNT(*) as cnt
                FROM (
                    SELECT employee_id, risk_level, MAX(created_at)
                    FROM predictions
                    GROUP BY employee_id
                ) p
                GROUP BY p.risk_level
            """
            cursor.execute(query)
            risk_counts = {row['risk_level'].lower(): row['cnt'] for row in cursor.fetchall()}
            
            high_risk = risk_counts.get('high', 0)
            medium_risk = risk_counts.get('medium', 0)
            low_risk = risk_counts.get('low', 0)
            
            # Avg burnout score
            query = """
                SELECT AVG(p.burnout_score) as avg_score
                FROM (
                    SELECT employee_id, burnout_score, MAX(created_at)
                    FROM predictions
                    GROUP BY employee_id
                ) p
            """
            cursor.execute(query)
            avg_burnout_score = cursor.fetchone()['avg_score'] or 0
            
            # Patterns found heuristic (just a nice display number based on risk + score)
            patterns_found = int((high_risk * 1.2) + (medium_risk * 0.5))

            # Health score (less aggressive penalty so it doesn't bottom out at 0 so easily)
            # 1.0 penalty factor for high risk % and 0.5 penalty for medium risk %
            health_score = max(0, 100 - (high_risk / total_employees * 100) - (medium_risk / total_employees * 50))
            
            return {
                "total_employees": total_employees,
                "high_risk": high_risk,
                "medium_risk": medium_risk,
                "low_risk": low_risk,
                "avg_burnout_score": int(avg_burnout_score),
                "avg_salary": int(avg_salary),
                "patterns_found": patterns_found,
                "health_score": int(health_score)
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch stats: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
