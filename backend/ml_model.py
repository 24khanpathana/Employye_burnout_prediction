import pickle
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
import os

MODEL_PATH = "burnout_model.pkl"
SCALER_PATH = "burnout_scaler.pkl"

# Core feature list (8 features for the simplified ML model)
FEATURES = [
    'salary',
    'working_hours',
    'stress_level',
    'experience',
    'overtime_frequency',
    'work_life_balance_score',
    'leave_taken',
    'performance_rating',
]

def generate_synthetic_training_data():
    """Generate synthetic employee data for 8 core features."""
    np.random.seed(42)
    n_samples = 500

    salary   = np.random.normal(70000, 20000, n_samples)
    hours    = np.random.normal(48, 8, n_samples)
    stress   = np.random.randint(1, 11, n_samples)
    exp      = np.clip(np.random.normal(5, 4, n_samples), 1, 25)
    overtime = np.random.randint(1, 6, n_samples)
    wlb      = np.random.randint(1, 11, n_samples)
    leave    = np.random.normal(12, 5, n_samples)
    perf     = np.random.randint(1, 6, n_samples)

    X = np.column_stack((salary, hours, stress, exp, overtime, wlb, leave, perf))

    # Burnout heuristic: increases with hours/stress/overtime, decreases with wlb/leave
    burnout_score = (
        (hours   / 70) * 25 +
        (stress  / 10) * 30 +
        (overtime / 5) * 20 -
        (wlb     / 10) * 20 -
        (leave   / 30) * 15
    )
    y = np.where(burnout_score > 30, 1, 0)

    return X, y

def train_model():
    """Train the Logistic Regression model."""
    X, y = generate_synthetic_training_data()
    
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    model = LogisticRegression(random_state=42, max_iter=1000)
    model.fit(X_scaled, y)
    
    with open(MODEL_PATH, 'wb') as f:
        pickle.dump(model, f)
    with open(SCALER_PATH, 'wb') as f:
        pickle.dump(scaler, f)
        
    return model, scaler

def load_or_train_model():
    """Load existing model or train new one."""
    if os.path.exists(MODEL_PATH) and os.path.exists(SCALER_PATH):
        try:
            with open(MODEL_PATH, 'rb') as f:
                model = pickle.load(f)
            with open(SCALER_PATH, 'rb') as f:
                scaler = pickle.load(f)
            # Check if scaler feature count matches
            if scaler.n_features_in_ != len(FEATURES):
                raise ValueError("Model feature count mismatch")
        except:
            model, scaler = train_model()
    else:
        model, scaler = train_model()
    return model, scaler

def predict_burnout_batch(df: pd.DataFrame):
    """Predict burnout array for a pandas DataFrame containing the exact features."""
    model, scaler = load_or_train_model()
    
    # Select only the features the model was trained on
    X = df[FEATURES].values
    X_scaled = scaler.transform(X)
    
    probs = model.predict_proba(X_scaled)[:, 1]
    
    return probs
