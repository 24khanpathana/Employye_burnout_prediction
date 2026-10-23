import json
from pathlib import Path

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from burnout_score import DEFAULT_MAX_VALUES, calculate_burnout_score, classify_burnout
from sentiment_analysis import analyze_sentiment_text

app = FastAPI(title='BurnoutGuard ML Service')


class PredictionRequest(BaseModel):
    data: dict


MODEL_DIR = Path(__file__).resolve().parent / 'model'
FEATURE_COLUMNS = [
    'Age', 'Department', 'JobRole', 'EducationLevel', 'MonthlySalary', 'OvertimeHoursPerMonth',
    'LeavesTaken', 'ProjectsHandled', 'TrainingHours', 'CustomerSatisfaction', 'YearsAtCompany',
    'WorkLifeBalanceScore', 'PerformanceRating', 'AttendancePercentage', 'TaskCompletionRate',
    'AverageTestScore', 'SentimentScore', 'BurnoutScore'
]
@app.get('/health')
def health():
    return {
        'status': 'ok',
        'models': {
            'burnout': burnout_model is not None,
            'attrition': attrition_model is not None
        }
    }


@app.post('/predict')
def predict(payload: PredictionRequest):
    record = dict(payload.data)
    validate_formula_features(record)
    features = prepare_features(record)
    risk_formula = calculate_burnout_score(features, normalization)
    formula_label, formula_text = classify_burnout(risk_formula)
    features['BurnoutScore'] = risk_formula
    model_features = pd.DataFrame([{name: features.get(name) for name in FEATURE_COLUMNS}], columns=FEATURE_COLUMNS)
    sentiment_score, sentiment_label = analyze_sentiment_text(record.get('Feedback') or record.get('TextResponse') or '')

    burnout_prediction = predict_label(burnout_model, model_features) if burnout_model is not None else None
    attrition_prediction = predict_label(attrition_model, model_features) if attrition_model is not None else None

    return {
        'burnout_score': round(float(risk_formula), 2),
        'formula_burnout_risk': formula_label,
        'formula_burnout_risk_label': formula_text,
        'burnout_prediction': burnout_prediction,
        'attrition_prediction': attrition_prediction,
        'sentiment_score': round(float(sentiment_score), 4),
        'sentiment_label': sentiment_label,
        'model_version': 'xgboost-v1' if burnout_model is not None or attrition_model is not None else None
    }

def validate_formula_features(record):
    required = [
        'OvertimeHoursPerMonth', 'ProjectsHandled', 'LeavesTaken', 'WorkLifeBalanceScore',
        'TrainingHours', 'CustomerSatisfaction'
    ]
    missing = [key for key in required if record.get(key) is None or record.get(key) == '']
    if record.get('YearsSincePromotion') is None and record.get('LastPromotionYear') is None:
        missing.append('YearsSincePromotion or LastPromotionYear')
    if missing:
        raise HTTPException(status_code=422, detail=f'Missing required prediction fields: {", ".join(missing)}')
    for key in required:
        try:
            value = float(record[key])
        except (TypeError, ValueError):
            raise HTTPException(status_code=422, detail=f'{key} must be numeric.')
        if value < 0 or (key in {'WorkLifeBalanceScore', 'CustomerSatisfaction'} and value > 5):
            raise HTTPException(status_code=422, detail=f'{key} is outside its valid range.')


def load_model(filename):
    path = MODEL_DIR / filename
    return joblib.load(path) if path.is_file() else None


def load_normalization():
    path = MODEL_DIR / 'burnout_normalization.json'
    if not path.is_file():
        return DEFAULT_MAX_VALUES
    with path.open(encoding='utf-8') as normalization_file:
        loaded = json.load(normalization_file)
    values = {
        key: max(float(loaded.get(key, DEFAULT_MAX_VALUES[key])), 1.0)
        for key in DEFAULT_MAX_VALUES
    }
    return values


def prepare_features(record):
    features = dict(record)
    if features.get('YearsSincePromotion') is None and features.get('LastPromotionYear') is not None:
        try:
            features['YearsSincePromotion'] = max(0, pd.Timestamp.now().year - int(features['LastPromotionYear']))
        except (TypeError, ValueError):
            features['YearsSincePromotion'] = 0
    for key in [
        'Age', 'MonthlySalary', 'OvertimeHoursPerMonth', 'LeavesTaken', 'ProjectsHandled',
        'TrainingHours', 'CustomerSatisfaction', 'YearsAtCompany', 'WorkLifeBalanceScore',
        'PerformanceRating', 'AttendancePercentage', 'TaskCompletionRate', 'AverageTestScore',
        'SentimentScore', 'BurnoutScore', 'YearsSincePromotion'
    ]:
        if key in features and features[key] is not None:
            try:
                features[key] = float(features[key])
            except (TypeError, ValueError):
                features[key] = None
    return features


def predict_label(model, frame):
    prediction = model.predict(frame)[0]
    probabilities = model.predict_proba(frame)[0]
    classifier = model.named_steps['model'] if hasattr(model, 'named_steps') else model
    label_encoder = getattr(model, 'target_encoder_', None)
    if label_encoder is not None:
        label = str(label_encoder.inverse_transform([int(prediction)])[0]).upper()
        classes = [str(value).upper() for value in label_encoder.classes_]
    else:
        label = str(prediction).upper()
        classes = [str(value).upper() for value in classifier.classes_]
    probability_map = {name: round(float(probability), 6) for name, probability in zip(classes, probabilities)}
    return {
        'risk': label,
        'probabilities': probability_map
    }


burnout_model = load_model('burnout_xgboost.pkl')
attrition_model = load_model('attrition_xgboost.pkl')
normalization = load_normalization()
