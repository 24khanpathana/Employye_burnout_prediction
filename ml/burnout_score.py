import math

DEFAULT_MAX_VALUES = {
    'OvertimeHoursPerMonth': 160,
    'ProjectsHandled': 20,
    'LeavesTaken': 30,
    'TrainingHours': 40,
    'YearsSincePromotion': 20
}


def calculate_burnout_score(row, max_values):
    overtime = _number(row.get('OvertimeHoursPerMonth')) / _maximum(max_values, 'OvertimeHoursPerMonth')
    projects = _number(row.get('ProjectsHandled')) / _maximum(max_values, 'ProjectsHandled')
    leaves = _number(row.get('LeavesTaken')) / _maximum(max_values, 'LeavesTaken')
    work_life_balance = 1 - (_bounded(_number(row.get('WorkLifeBalanceScore')), 0, 5) / 5)
    training = 1 - (_number(row.get('TrainingHours')) / _maximum(max_values, 'TrainingHours'))
    customer_satisfaction = 1 - (_bounded(_number(row.get('CustomerSatisfaction')), 0, 5) / 5)
    promotion_gap = _number(row.get('YearsSincePromotion')) / _maximum(max_values, 'YearsSincePromotion')

    o = max(0, min(1, overtime))
    p = max(0, min(1, projects))
    l = max(0, min(1, leaves))
    w = max(0, min(1, work_life_balance))
    t = max(0, min(1, training))
    s = max(0, min(1, customer_satisfaction))
    r = max(0, min(1, promotion_gap))

    score = 25 * o + 20 * p + 15 * l + 15 * w + 10 * t + 10 * s + 5 * r
    return max(0, min(100, score))


def classify_burnout(score):
    if score <= 39:
        return 'LOW', 'Low Burnout'
    if score <= 69:
        return 'MEDIUM', 'Medium Burnout'
    return 'HIGH', 'High Burnout'


def _number(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return 0.0
    return number if math.isfinite(number) else 0.0


def _maximum(max_values, key):
    return max(_number(max_values.get(key)), 1.0)


def _bounded(value, minimum, maximum):
    return max(minimum, min(maximum, value))
