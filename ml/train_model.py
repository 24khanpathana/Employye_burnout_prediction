import os
import json
import argparse
from io import StringIO
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


def load_dataset(source):
    if hasattr(source, 'read'):
        return pd.read_csv(source)
    if isinstance(source, str) and ('\n' in source or '\r' in source):
        return pd.read_csv(StringIO(source))
    return pd.read_csv(source)


def summarize_dataset(source):
    df = load_dataset(source)
    aliases = alias_columns(df.columns)
    column_for = {}
    for original, normalized in aliases.items():
        column_for.setdefault(normalized, original)
    targets = {}
    rare_classes = {}
    for original, normalized in aliases.items():
        if normalized not in {'BurnoutRisk', 'AttritionRisk'}:
            continue
        counts = df[original].fillna('Unknown').astype(str).str.strip().str.upper().value_counts()
        targets[normalized] = [{'label': label, 'count': int(count)} for label, count in counts.items()]
        rare_classes[normalized] = [label for label, count in counts.items() if count < 2]
    department_column = next((original for original, normalized in aliases.items() if normalized == 'Department'), None)
    departments = []
    if department_column:
        department_values = df[department_column].fillna('Unknown').astype(str).str.strip().replace('', 'Unknown')
        for department, indices in department_values.groupby(department_values).groups.items():
            row = {'department': str(department), 'count': int(len(indices)), 'risks': {}}
            for original, normalized in aliases.items():
                if normalized not in {'BurnoutRisk', 'AttritionRisk'}:
                    continue
                values = df.loc[indices, original].fillna('Unknown').astype(str).str.strip().str.upper()
                row['risks'][normalized] = {str(label): int(count) for label, count in values.value_counts().items()}
            departments.append(row)
        departments.sort(key=lambda item: item['count'], reverse=True)
    average_aliases = {
        'salary': 'MonthlySalary', 'performance': 'PerformanceRating',
        'satisfaction': 'CustomerSatisfaction', 'overtime': 'OvertimeHoursPerMonth',
        'tenure': 'YearsAtCompany'
    }
    averages = {}
    for label, canonical in average_aliases.items():
        original = next((column for column, normalized in aliases.items() if normalized == canonical), None)
        if original:
            values = pd.to_numeric(df[original], errors='coerce').dropna()
            if not values.empty:
                average = float(values.mean())
                if label == 'tenure' and str(original).strip().lower() == 'tenure_months':
                    average /= 12
                averages[label] = round(average, 2)
    preview_rows = []
    preview_df = df.copy()
    score_column = column_for.get('BurnoutScore')
    if score_column:
        preview_df['_preview_rank'] = pd.to_numeric(preview_df[score_column], errors='coerce')
    else:
        risk_column = column_for.get('BurnoutRisk')
        risk_order = {'HIGH': 3, 'MEDIUM': 2, 'LOW': 1}
        preview_df['_preview_rank'] = preview_df[risk_column].fillna('').astype(str).str.upper().map(risk_order) if risk_column else 0
    preview_df = preview_df.sort_values('_preview_rank', ascending=False, na_position='last')
    for row_index, (_, row) in enumerate(preview_df.head(25).iterrows(), start=1):
        employee_id = row.get(column_for.get('EmployeeID')) if column_for.get('EmployeeID') else None
        employee_name = row.get(column_for.get('Name')) if column_for.get('Name') else None
        if pd.isna(employee_id) if employee_id is not None else True:
            employee_id = f'RECORD-{row_index:04d}'
        if pd.isna(employee_name) if employee_name is not None else True:
            employee_name = str(employee_id)
        name_is_id = not bool(column_for.get('Name')) or str(employee_name) == str(employee_id)
        entry = {
            'employee_id': str(employee_id),
            'name': str(employee_name),
            'name_is_id': name_is_id,
            'role': row.get(column_for.get('JobRole')) if column_for.get('JobRole') else None,
            'department': row.get(column_for.get('Department')) if column_for.get('Department') else None,
            'persona': row.get(column_for.get('persona_name')) if column_for.get('persona_name') else None,
            'salary': row.get(column_for.get('MonthlySalary')) if column_for.get('MonthlySalary') else None,
            'performance': row.get(column_for.get('PerformanceRating')) if column_for.get('PerformanceRating') else None,
            'satisfaction': row.get(column_for.get('CustomerSatisfaction')) if column_for.get('CustomerSatisfaction') else None,
            'overtime': row.get(column_for.get('OvertimeHoursPerMonth')) if column_for.get('OvertimeHoursPerMonth') else None,
            'burnout_score': row.get(column_for.get('BurnoutScore')) if column_for.get('BurnoutScore') else None,
            'burnout_risk': row.get(column_for.get('BurnoutRisk')) if column_for.get('BurnoutRisk') else None,
            'attrition_risk': row.get(column_for.get('AttritionRisk')) if column_for.get('AttritionRisk') else None
        }
        preview_rows.append({key: None if value is None or pd.isna(value) else value.item() if hasattr(value, 'item') else value for key, value in entry.items()})
    return {
        'rows': int(len(df)),
        'columns': int(len(df.columns)),
        'column_names': [str(column) for column in df.columns],
        'target_distributions': targets,
        'rare_classes': rare_classes,
        'departments': departments[:30],
        'averages': averages,
        'employee_preview': preview_rows
    }


def prepare_features(df):
    mapping = alias_columns(df.columns)
    renamed = df.rename(columns=mapping)
    renamed = renamed.applymap(lambda x: np.nan if str(x).strip().lower() in {'nan', 'none', 'null', ''} else x)
    if 'tenure_months' in {str(column).strip().lower() for column in df.columns}:
        renamed['YearsAtCompany'] = pd.to_numeric(renamed['YearsAtCompany'], errors='coerce') / 12

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

    class_counts = y.value_counts()
    if class_counts.min() >= 2:
        test_size = max(0.2, y.nunique() / len(y))
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=42, stratify=y
        )
        evaluation_note = None
    else:
        # Keep singleton labels in training; they cannot appear in both splits.
        test_indices = []
        for class_id, count in class_counts.items():
            if count < 2:
                continue
            class_indices = y[y == class_id].sample(frac=1, random_state=42).index
            holdout_count = min(count - 1, max(1, int(round(count * 0.2))))
            test_indices.extend(class_indices[:holdout_count])
        if not test_indices:
            raise ValueError(f'{target} needs at least one class with two examples to evaluate a holdout set.')
        X_test = X.loc[test_indices]
        y_test = y.loc[test_indices]
        X_train = X.drop(index=test_indices)
        y_train = y.drop(index=test_indices)
        evaluation_note = 'Classes with only one labeled row were kept in training and are absent from holdout metrics.'
    pipeline.fit(X_train, y_train)

    preds = pipeline.predict(X_test)
    probs = pipeline.predict_proba(X_test)
    class_ids = pipeline.named_steps['model'].classes_.astype(int)
    classes = label_encoder.inverse_transform(class_ids)
    y_test_labels = label_encoder.inverse_transform(y_test)
    predicted_labels = label_encoder.inverse_transform(preds.astype(int))
    test_class_ids = np.unique(y_test.to_numpy())
    if len(test_class_ids) == 2 and len(class_ids) == 2:
        positive_column = int(np.where(class_ids == test_class_ids[1])[0][0])
        roc_auc = roc_auc_score(y_test == test_class_ids[1], probs[:, positive_column])
    elif len(test_class_ids) > 1:
        class_auc = []
        supports = []
        for class_id in test_class_ids:
            positive = (y_test.to_numpy() == class_id).astype(int)
            column = int(np.where(class_ids == class_id)[0][0])
            class_auc.append(roc_auc_score(positive, probs[:, column]))
            supports.append(int(positive.sum()))
        roc_auc = float(np.average(class_auc, weights=supports))
    else:
        roc_auc = None

    metrics = {
        'accuracy': accuracy_score(y_test_labels, predicted_labels),
        'precision': precision_score(y_test_labels, predicted_labels, average='weighted', zero_division=0),
        'recall': recall_score(y_test_labels, predicted_labels, average='weighted', zero_division=0),
        'f1': f1_score(y_test_labels, predicted_labels, average='weighted', zero_division=0),
        'roc_auc': roc_auc,
        'classes': classes.tolist(),
        'confusion_matrix': confusion_matrix(y_test_labels, predicted_labels, labels=classes).tolist(),
        'evaluation_note': evaluation_note
    }

    save_object(os.path.join(MODEL_DIR, f'{model_name}_xgboost.pkl'), pipeline)
    with open(os.path.join(MODEL_DIR, f'{model_name}_metrics.json'), 'w', encoding='utf-8') as metrics_file:
        json.dump(metrics, metrics_file, indent=2)
    if model_name == 'burnout':
        with open(os.path.join(MODEL_DIR, 'burnout_normalization.json'), 'w', encoding='utf-8') as normalization_file:
            json.dump(df.attrs.get('burnout_max_values', DEFAULT_MAX_VALUES), normalization_file, indent=2)
    return metrics


def train_dataset(source):
    df = load_dataset(source)
    prepared = prepare_features(df)
    targets = [name for name in ('BurnoutRisk', 'AttritionRisk') if name in prepared.columns]
    if not targets:
        raise ValueError(
            'The CSV must include a real BurnoutRisk or AttritionRisk target column. '
            'Upload a dataset with at least one real target column. '
            'Targets are never generated from formula scores.'
        )

    # Validate every requested target before writing any replacement model artifacts.
    for target in targets:
        target_values = prepared[target]
        if target_values.isna().any() or target_values.astype(str).str.strip().str.lower().isin({'', 'nan', 'none', 'null'}).any():
            raise ValueError(f'{target} contains missing labels; clean or remove those rows before training.')
        labels = target_values.astype(str).str.strip().str.upper()
        if labels.nunique() < 2:
            raise ValueError(f'{target} must contain at least two distinct labeled classes.')

    metrics = {name.replace('Risk', '').lower(): build_model(prepared, name, name.replace('Risk', '').lower()) for name in targets}
    for model_name in {'burnout', 'attrition'} - set(metrics):
        remove_model_artifacts(model_name)
    return metrics


def remove_model_artifacts(model_name):
    for suffix in ('_xgboost.pkl', '_metrics.json'):
        path = os.path.join(MODEL_DIR, f'{model_name}{suffix}')
        if os.path.isfile(path):
            os.remove(path)


def main():
    parser = argparse.ArgumentParser(description='Train XGBoost employee risk models using a labeled CSV dataset.')
    parser.add_argument('dataset', help='Path to a CSV containing real, labeled employee records.')
    args = parser.parse_args()
    dataset_path = os.path.abspath(args.dataset)
    if not os.path.isfile(dataset_path):
        raise FileNotFoundError(
            f'Dataset file not found: {dataset_path}\n'
            'In PowerShell, quote paths that contain spaces, e.g. '
            'python train_model.py "D:\\IDEA LAB SEM-5 DETAILS\\BurnoutGuard_Employee_Dataset_5000 (2).csv".'
        )
    print(json.dumps(train_dataset(dataset_path), indent=2))


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
