from datetime import date


def months_since_hire(hire_date: date) -> int:
    """
    Equivalente a ROUNDDOWN(YEARFRAC(hire_date, TODAY())*12, 0) de Excel.
    Calcula meses completos transcurridos desde la fecha de ingreso.
    """
    today = date.today()
    return (today.year - hire_date.year) * 12 + today.month - hire_date.month


def _seniority_from_years(years: float) -> int:
    """Regla convenio colectivo — Ley 20.744."""
    if years >= 10:
        return 28
    if years >= 5:
        return 21
    return 14


def vacation_days_by_seniority(hire_date: date, reference_year: int) -> int:
    """
    Antigüedad al 1° de enero del año de referencia.
    Usado por init-year para calcular las vacaciones correspondientes al inicio del año.
    Ley 20.744 — Convenio Madereros y SEC 12.
    < 5 años → 14 días · 5–10 años → 21 días · ≥ 10 años → 28 días
    """
    years = (date(reference_year, 1, 1) - hire_date).days / 365.25
    return _seniority_from_years(years)


def vacation_days_today(hire_date: date) -> int:
    """
    Antigüedad a la fecha de hoy — equivale a la fórmula Excel
    IF(MESES < 60, 14, IF(MESES < 120, 21, 28)) donde MESES = YEARFRAC*12.
    Se usa para mostrar las vacaciones actuales en la sección Datos Empleados.
    """
    months = months_since_hire(hire_date)
    years  = months / 12
    return _seniority_from_years(years)


def month_to_number(month: str) -> int:
    MONTHS = {
        "ENERO": 1, "FEBRERO": 2, "MARZO": 3, "ABRIL": 4,
        "MAYO": 5, "JUNIO": 6, "JULIO": 7, "AGOSTO": 8,
        "SEPTIEMBRE": 9, "OCTUBRE": 10, "NOVIEMBRE": 11, "DICIEMBRE": 12,
    }
    return MONTHS.get(month.upper(), 1)


def calculate_avg_ticket(total: float, tickets: int) -> float | None:
    if tickets and tickets > 0:
        return round(total / tickets, 2)
    return None


def calculate_gross_salary(base: float, plus_pct: float, incentive: float) -> float:
    plus = round(base * plus_pct, 2)
    return round(base + plus + incentive, 2)


def calculate_net_salary(gross: float, bank_deposit: float, advance: float) -> float:
    return round(gross - bank_deposit - advance, 2)
