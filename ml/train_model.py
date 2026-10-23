import os
import json
import argparse
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, confusion_matrix
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder, OneHotEncoder, StandardScaler
from xgboost import XGBClassifier

from feature_engineering import alias_columns, safe_numeric
from burnout_score import DEFAULT_MAX_VALUES, calculate_burnout_score
from sentiment_analysis import analyze_sentiment_text
from preprocessing import save_object

MODEL_DIR = os.path.join(os.path.dirname(__file__), 'model')

os.makedirs(MODEL_DIR, exist_ok=True)


def load_dataset(path):
    df = pd.read_csv(path)
    return df


def prepare_features(df):
    mapping = alias_columns(df.columns)
    renamed = df.rename(columns=mapping)
    renamed = renamed.applymap(lambda x: np.nan if str(x).strip().lower() in {'nan', 'none', 'null', ''} else x)

    core_features = [
        'Age', 'Department', 'JobRole', 'EducationLevel', 'MonthlySalary', 'OvertimeHoursPerMonth',
        'LeavesTaken', 'ProjectsHandled', 'TrainingHours', 'CustomerSatisfaction', 'YearsAtCompany',
        'WorkLifeBalanceScore', 'PerformanceRating', 'AttendancePercentage', 'TaskCompletionRate',
        'AverageTestScore', 'SentimentScore', 'BurnoutScore', 'YearsSincePromotion'
    ]

    for feature in core_features:
        if feature not in renamed.columns:
            renamed[feature] = np.nan

    for column in ['MonthlySalary', 'OvertimeHoursPerMonth', 'LeavesTaken', 'ProjectsHandled', 'TrainingHours',
                   'CustomerSatisfaction', 'YearsAtCompany', 'WorkLifeBalanceScore', 'PerformanceRating',
                   'AttendancePercentage', 'TaskCompletionRate', 'AverageTestScore', 'SentimentScore',
                   'BurnoutScore', 'Age', 'YearsSincePromotion']:
        renamed[column] = pd.to_numeric(renamed[column], errors='coerce')

    max_values = {
        key: max(finite_max(renamed.get(key)), 1)
        for key in DEFAULT_MAX_VALUES
    }

    renamed['BurnoutScore'] = renamed.apply(
        lambda row: calculate_burnout_score(row.to_dict(), max_values), axis=1
    )
    renamed.attrs['burnout_max_values'] = max_values

    if 'TextResponse' in renamed.columns:
        sentiment_scores = []
        for value in renamed['TextResponse'].fillna(''):
            score, _ = analyze_sentiment_text(value)
            sentiment_scores.append(score)
        renamed['SentimentScore'] = sentiment_scores

    return renamed


def build_model(df, target, model_name):
    features = ['Age', 'Department', 'JobRole', 'EducationLevel', 'MonthlySalary', 'OvertimeHoursPerMonth',
                'LeavesTaken', 'ProjectsHandled', 'TrainingHours', 'CustomerSatisfaction', 'YearsAtCompany',
                'WorkLifeBalanceScore', 'PerformanceRating', 'AttendancePercentage', 'TaskCompletionRate',
                'AverageTestScore', 'SentimentScore', 'BurnoutScore']
    X = df[features].copy()
    target_values = df[target]
    if target_values.isna().any() or target_values.astype(str).str.strip().str.lower().isin({'', 'nan', 'none', 'null'}).any():
        raise ValueError(f'{target} contains missing labels; clean or remove those rows before training.')
    labels = target_values.astype(str).str.strip().str.upper()
    if labels.nunique() < 2:
        raise ValueError(f'{target} must contain at least two distinct labeled classes.')
    if labels.value_counts().min() < 2:
        raise ValueError(f'{target} needs at least two examples in every class for a stratified evaluation.')
    label_encoder = LabelEncoder()
    y = pd.Series(label_encoder.fit_transform(labels), index=labels.index)

    num_cols = X.select_dtypes(include=['number']).columns.tolist()
    cat_cols = [col for col in X.columns if col not in num_cols]

    numeric_transformer = Pipeline(steps=[('imputer', SimpleImputer(strategy='median')), ('scaler', StandardScaler())])
    categorical_transformer = Pipeline(steps=[('imputer', SimpleImputer(strategy='most_frequent')), ('onehot', OneHotEncoder(handle_unknown='ignore'))])

    preprocessor = ColumnTransformer(transformers=[('num', numeric_transformer, num_cols), ('cat', categorical_transformer, cat_cols)])

    model = XGBClassifier(eval_metric='mlogloss', n_estimators=100, max_depth=5)
    pipeline = Pipeline(steps=[('preprocessor', preprocessor), ('model', model)])
    pipeline.target_encoder_ = label_encoder

    test_size = max(0.2, y.nunique() / len(y))
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size, random_state=42, stratify=y)
    pipeline.fit(X_train, y_train)

    preds = pipeline.predict(X_test)
    probs = pipeline.predict_proba(X_test)
    class_ids = pipeline.named_steps['model'].classes_.astype(int)
    classes = label_encoder.inverse_transform(class_ids)
    y_test_labels = label_encoder.inverse_transform(y_test)
    predicted_labels = label_encoder.inverse_transform(preds.astype(int))
    if len(class_ids) == 2:
        roc_auc = roc_auc_score(y_test == class_ids[1], probs[:, 1])
    else:
        roc_auc = roc_auc_score(y_test, probs, labels=class_ids, multi_class='ovr', average='weighted')

    metrics = {
        'accuracy': accuracy_score(y_test_labels, predicted_labels),
        'precision': precision_score(y_test_labels, predicted_labels, average='weighted', zero_division=0),
        'recall': recall_score(y_test_labels, predicted_labels, average='weighted', zero_division=0),
        'f1': f1_score(y_test_labels, predicted_labels, average='weighted', zero_division=0),
        'roc_auc': roc_auc,
        'classes': classes.tolist(),
        'confusion_matrix': confusion_matrix(y_test_labels, predicted_labels, labels=classes).tolist()
    }

    save_object(os.path.join(MODEL_DIR, f'{model_name}_xgboost.pkl'), pipeline)
    with open(os.path.join(MODEL_DIR, f'{model_name}_metrics.json'), 'w', encoding='utf-8') as metrics_file:
        json.dump(metrics, metrics_file, indent=2)
    if model_name == 'burnout':
        with open(os.path.join(MODEL_DIR, 'burnout_normalization.json'), 'w', encoding='utf-8') as normalization_file:
            json.dump(df.attrs.get('burnout_max_values', DEFAULT_MAX_VALUES), normalization_file, indent=2)
    return metrics


def main():
    parser = argparse.ArgumentParser(description='Train XGBoost employee risk models using a labeled CSV dataset.')
    parser.add_argument('dataset', help='Path to a CSV containing real, labeled employee records.')
    args = parser.parse_args()
    dataset_path = os.path.abspath(args.dataset)
    if not os.path.isfile(dataset_path):
        raise FileNotFoundError(f'Dataset file not found: {dataset_path}')
    df = load_dataset(dataset_path)
    prepared = prepare_features(df)
    metrics = {}
    if 'BurnoutRisk' in prepared.columns:
        metrics['burnout'] = build_model(prepared, 'BurnoutRisk', 'burnout')
    if 'AttritionRisk' in prepared.columns:
        metrics['attrition'] = build_model(prepared, 'AttritionRisk', 'attrition')
    if not metrics:
        raise ValueError('The CSV must include a real BurnoutRisk or AttritionRisk target column. Targets are never generated from formula scores.')
    print(json.dumps(metrics, indent=2))


def finite_max(values):
    if values is None:
        return 1.0
    numeric = pd.to_numeric(values, errors='coerce').dropna()
    if numeric.empty:
        return 1.0
    maximum = float(numeric.max())
    return maximum if np.isfinite(maximum) else 1.0


if __name__ == '__main__':
    main()
