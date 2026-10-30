import re
from typing import Any, Dict, Iterable, List


ALIAS_MAP = {
    'emp_id': 'EmployeeID',
    'employee_id': 'EmployeeID',
    'employee id': 'EmployeeID',
    'full_name': 'Name',
    'employee_name': 'Name',
    'name': 'Name',
    'department': 'Department',
    'dept': 'Department',
    'job_role': 'JobRole',
    'role': 'JobRole',
    'job_level': 'EducationLevel',
    'tenure_months': 'YearsAtCompany',
    'position': 'JobRole',
    'salary': 'MonthlySalary',
    'monthly_salary': 'MonthlySalary',
    'performance_score': 'PerformanceRating',
    'satisfaction_score': 'CustomerSatisfaction',
    'team_sentiment': 'SentimentScore',
    'project_completion_rate': 'TaskCompletionRate',
    'recent_feedback': 'TextResponse',
    'left_company': 'AttritionRisk',
    'overtime_hours': 'OvertimeHoursPerMonth',
    'overtime': 'OvertimeHoursPerMonth',
    'leaves': 'LeavesTaken',
    'leave_taken': 'LeavesTaken',
    'work_life_balance': 'WorkLifeBalanceScore',
    'work_life_balance_score': 'WorkLifeBalanceScore',
    'burnoutrisk': 'BurnoutRisk',
    'burnout_risk': 'BurnoutRisk',
    'attritionrisk': 'AttritionRisk',
    'attrition_risk': 'AttritionRisk',
    'burnout_score': 'BurnoutScore',
}


def normalize_column_name(column: str) -> str:
    if not isinstance(column, str):
        return str(column)
    lowered = column.strip().lower().replace(' ', '_')
    return ALIAS_MAP.get(lowered, lowered)


def alias_columns(columns: Iterable[str]) -> Dict[str, str]:
    mapping = {}
    for col in columns:
        key = str(col).strip()
        clean = normalize_column_name(key)
        mapping[key] = clean
    return mapping


def clean_text(value: Any) -> str:
    if value is None:
        return ''
    return re.sub(r'\s+', ' ', str(value)).strip()


def safe_numeric(value: Any, default: float = 0.0) -> float:
    try:
        if value is None or value == '':
            return default
        if isinstance(value, str):
            cleaned = value.replace(',', '').strip()
            return float(cleaned)
        return float(value)
    except (TypeError, ValueError):
        return default
