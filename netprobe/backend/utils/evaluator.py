"""
NetProbe Security Suite - Result Evaluator
"""

STATUS_SCORES = {
    "BLOCKED": 100,
    "DETECTED": 60,
    "PARTIAL": 35,
    "PASSED": 0,
    "ERROR": None,
}

def evaluate_result(status: str):
    return STATUS_SCORES.get(status)

def calculate_global_score(results: list) -> int:
    valid = [r["score"] for r in results if r.get("score") is not None]
    if not valid:
        return 0
    return round(sum(valid) / len(valid))

def get_score_label(score: int) -> str:
    if score >= 75:
        return "SEGURO"
    elif score >= 50:
        return "MODERADO"
    elif score >= 25:
        return "RIESGO"
    return "CRÍTICO"
