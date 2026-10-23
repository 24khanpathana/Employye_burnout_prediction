import joblib
import pandas as pd


def save_object(path, obj):
    joblib.dump(obj, path)


def load_object(path):
    return joblib.load(path)


def normalize_dataset(df):
    data = df.copy()
    for col in list(data.columns):
        if hasattr(data[col], 'dtype') and pd.api.types.is_object_dtype(data[col]):
            data[col] = data[col].astype(str)
    return data
