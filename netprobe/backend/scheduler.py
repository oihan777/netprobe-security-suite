"""
NetProbe - Scan Scheduler
Persistent scheduled scans using asyncio + SQLite (no external deps).
"""
import asyncio
import sqlite3
import json
import os
from datetime import datetime, timedelta
from typing import Optional

DB_PATH = os.path.join(os.path.dirname(__file__), "scheduler.db")

# ── DB setup ──────────────────────────────────────────────────────
def get_db():
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    return db

def init_db():
    db = get_db()
    db.execute("""
        CREATE TABLE IF NOT EXISTS schedules (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            target      TEXT NOT NULL,
            modules     TEXT NOT NULL,
            intensity   INTEGER DEFAULT 3,
            duration    INTEGER DEFAULT 30,
            cron_type   TEXT NOT NULL,
            cron_value  TEXT NOT NULL,
            enabled     INTEGER DEFAULT 1,
            last_run    TEXT,
            next_run    TEXT,
            run_count   INTEGER DEFAULT 0,
            last_score  INTEGER,
            alert_below INTEGER,
            created_at  TEXT NOT NULL
        )
    """)
    db.execute("""
        CREATE TABLE IF NOT EXISTS schedule_history (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            schedule_id TEXT NOT NULL,
            run_at      TEXT NOT NULL,
            score       INTEGER,
            status      TEXT,
            modules_run INTEGER,
            duration_s  INTEGER,
            FOREIGN KEY (schedule_id) REFERENCES schedules(id)
        )
    """)
    db.commit()
    db.close()

# ── Cron helpers ──────────────────────────────────────────────────
CRON_TYPES = {
    "hourly":   "Cada hora",
    "daily":    "Diario",
    "weekly":   "Semanal",
    "manual":   "Manual",
    "interval": "Cada X minutos",
}

def calc_next_run(cron_type: str, cron_value: str, from_dt: datetime = None) -> datetime:
    """Calculate next run datetime from now or given base."""
    base = from_dt or datetime.now()
    if cron_type == "hourly":
        return base.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
    elif cron_type == "daily":
        # cron_value = "HH:MM"
        try:
            h, m = map(int, cron_value.split(":"))
        except Exception:
            h, m = 3, 0
        candidate = base.replace(hour=h, minute=m, second=0, microsecond=0)
        if candidate <= base:
            candidate += timedelta(days=1)
        return candidate
    elif cron_type == "weekly":
        # cron_value = "MON 03:00" or "0 03:00" (0=Monday)
        parts = cron_value.split()
        day_map = {"MON":0,"TUE":1,"WED":2,"THU":3,"FRI":4,"SAT":5,"SUN":6}
        try:
            target_dow = day_map.get(parts[0].upper(), int(parts[0]))
            h, m       = map(int, parts[1].split(":")) if len(parts) > 1 else (3, 0)
        except Exception:
            target_dow, h, m = 0, 3, 0
        days_ahead = (target_dow - base.weekday()) % 7
        if days_ahead == 0:
            days_ahead = 7
        candidate = (base + timedelta(days=days_ahead)).replace(hour=h, minute=m, second=0, microsecond=0)
        return candidate
    elif cron_type == "interval":
        # cron_value = minutes as string
        try:
            mins = int(cron_value)
        except Exception:
            mins = 60
        return base + timedelta(minutes=mins)
    else:  # manual
        return base + timedelta(days=3650)  # far future


def is_due(next_run_str: str) -> bool:
    if not next_run_str:
        return False
    try:
        next_run = datetime.fromisoformat(next_run_str)
        return datetime.now() >= next_run
    except Exception:
        return False


# ── CRUD ──────────────────────────────────────────────────────────
def list_schedules():
    db  = get_db()
    rows = db.execute("SELECT * FROM schedules ORDER BY next_run").fetchall()
    db.close()
    return [dict(r) for r in rows]


def get_schedule(sid: str):
    db  = get_db()
    row = db.execute("SELECT * FROM schedules WHERE id=?", (sid,)).fetchone()
    db.close()
    return dict(row) if row else None


def create_schedule(data: dict) -> dict:
    import uuid
    sid      = str(uuid.uuid4())[:8]
    now      = datetime.now().isoformat()
    next_run = calc_next_run(data["cron_type"], data.get("cron_value","03:00")).isoformat()

    db = get_db()
    db.execute("""INSERT INTO schedules
        (id, name, target, modules, intensity, duration, cron_type, cron_value,
         enabled, next_run, run_count, alert_below, created_at)
        VALUES (?,?,?,?,?,?,?,?,1,?,0,?,?)""",
        (sid, data["name"], data["target"],
         json.dumps(data.get("modules", [])),
         data.get("intensity", 3), data.get("duration", 30),
         data["cron_type"], data.get("cron_value", "03:00"),
         next_run, data.get("alert_below"), now))
    db.commit()
    db.close()
    return get_schedule(sid)


def update_schedule(sid: str, data: dict):
    db  = get_db()
    row = db.execute("SELECT * FROM schedules WHERE id=?", (sid,)).fetchone()
    if not row:
        db.close(); return None

    fields, vals = [], []
    for k in ("name","target","intensity","duration","cron_type","cron_value","enabled","alert_below"):
        if k in data:
            fields.append(f"{k}=?")
            vals.append(data[k])
    if "modules" in data:
        fields.append("modules=?")
        vals.append(json.dumps(data["modules"]))
    if "cron_type" in data or "cron_value" in data:
        ct  = data.get("cron_type",  row["cron_type"])
        cv  = data.get("cron_value", row["cron_value"])
        nr  = calc_next_run(ct, cv).isoformat()
        fields.append("next_run=?"); vals.append(nr)

    if fields:
        vals.append(sid)
        db.execute(f"UPDATE schedules SET {','.join(fields)} WHERE id=?", vals)
        db.commit()
    db.close()
    return get_schedule(sid)


def delete_schedule(sid: str):
    db = get_db()
    db.execute("DELETE FROM schedules WHERE id=?", (sid,))
    db.execute("DELETE FROM schedule_history WHERE schedule_id=?", (sid,))
    db.commit()
    db.close()


def get_history(sid: str, limit: int = 20):
    db   = get_db()
    rows = db.execute(
        "SELECT * FROM schedule_history WHERE schedule_id=? ORDER BY run_at DESC LIMIT ?",
        (sid, limit)
    ).fetchall()
    db.close()
    return [dict(r) for r in rows]


def record_run(sid: str, score: Optional[int], status: str, modules_run: int, duration_s: int):
    now = datetime.now().isoformat()
    db  = get_db()
    db.execute("""INSERT INTO schedule_history
        (schedule_id, run_at, score, status, modules_run, duration_s)
        VALUES (?,?,?,?,?,?)""",
        (sid, now, score, status, modules_run, duration_s))
    # Update schedule
    row       = db.execute("SELECT * FROM schedules WHERE id=?", (sid,)).fetchone()
    if row:
        next_run = calc_next_run(row["cron_type"], row["cron_value"]).isoformat()
        db.execute("""UPDATE schedules
            SET last_run=?, next_run=?, run_count=run_count+1, last_score=?
            WHERE id=?""", (now, next_run, score, sid))
    db.commit()
    db.close()


# ── Background checker loop ───────────────────────────────────────
_running_scans = set()  # track schedule IDs currently scanning

async def scheduler_loop(scan_fn, interval_s: int = 30):
    """
    Background task — checks every interval_s seconds for due schedules.
    scan_fn: async callable(target, modules, intensity, duration) -> (score, results)
    """
    init_db()
    while True:
        await asyncio.sleep(interval_s)
        try:
            schedules = list_schedules()
            for sched in schedules:
                sid = sched["id"]
                if not sched["enabled"]:
                    continue
                if sid in _running_scans:
                    continue
                if not is_due(sched.get("next_run","")):
                    continue

                _running_scans.add(sid)
                modules = json.loads(sched.get("modules","[]"))
                asyncio.create_task(_run_scheduled_scan(
                    sid, sched["target"], modules,
                    sched.get("intensity", 3), sched.get("duration", 30),
                    sched.get("alert_below"), scan_fn
                ))
        except Exception as e:
            print(f"[Scheduler] Error in loop: {e}")


async def _run_scheduled_scan(sid, target, modules, intensity, duration, alert_below, scan_fn):
    t0 = datetime.now()
    try:
        score, results = await scan_fn(target, modules, intensity, duration)
        elapsed = int((datetime.now() - t0).total_seconds())
        record_run(sid, score, "OK", len(results), elapsed)
        if alert_below and score is not None and score < alert_below:
            print(f"[Scheduler] ⚠ ALERT: {target} scored {score} < threshold {alert_below}")
    except Exception as e:
        elapsed = int((datetime.now() - t0).total_seconds())
        record_run(sid, None, f"ERROR: {e}", 0, elapsed)
    finally:
        _running_scans.discard(sid)


# ── FastAPI routes ─────────────────────────────────────────────────
def register_scheduler_routes(app):
    from pydantic import BaseModel
    from typing import List, Optional as Opt

    init_db()

    class ScheduleCreate(BaseModel):
        name:        str
        target:      str
        modules:     list     = []
        intensity:   int      = 3
        duration:    int      = 30
        cron_type:   str      = "daily"
        cron_value:  str      = "03:00"
        alert_below: Opt[int] = None

    class ScheduleUpdate(BaseModel):
        name:        Opt[str]  = None
        target:      Opt[str]  = None
        modules:     Opt[list] = None
        intensity:   Opt[int]  = None
        duration:    Opt[int]  = None
        cron_type:   Opt[str]  = None
        cron_value:  Opt[str]  = None
        enabled:     Opt[int]  = None
        alert_below: Opt[int]  = None

    @app.get("/api/scheduler/schedules")
    def list_all():
        rows = list_schedules()
        for r in rows:
            try: r["modules"] = json.loads(r["modules"])
            except Exception: r["modules"] = []
        return {"schedules": rows}

    @app.post("/api/scheduler/schedules")
    def create(body: ScheduleCreate):
        s = create_schedule(body.dict())
        if s:
            try: s["modules"] = json.loads(s["modules"])
            except Exception: s["modules"] = []
        return s

    @app.get("/api/scheduler/schedules/{sid}")
    def get_one(sid: str):
        s = get_schedule(sid)
        if not s: return {"error": "Not found"}, 404
        try: s["modules"] = json.loads(s["modules"])
        except Exception: s["modules"] = []
        return s

    @app.patch("/api/scheduler/schedules/{sid}")
    def update(sid: str, body: ScheduleUpdate):
        data = {k: v for k, v in body.dict().items() if v is not None}
        s    = update_schedule(sid, data)
        if not s: return {"error": "Not found"}
        try: s["modules"] = json.loads(s["modules"])
        except Exception: s["modules"] = []
        return s

    @app.delete("/api/scheduler/schedules/{sid}")
    def delete(sid: str):
        delete_schedule(sid)
        return {"ok": True}

    @app.get("/api/scheduler/schedules/{sid}/history")
    def history(sid: str):
        return {"history": get_history(sid)}

    @app.post("/api/scheduler/schedules/{sid}/toggle")
    def toggle(sid: str):
        s = get_schedule(sid)
        if not s: return {"error": "Not found"}
        update_schedule(sid, {"enabled": 0 if s["enabled"] else 1})
        return get_schedule(sid)

    @app.get("/api/scheduler/cron-types")
    def cron_types():
        return {"types": [
            {"id": "hourly",   "label": "Cada hora",       "placeholder": ""},
            {"id": "daily",    "label": "Diario",          "placeholder": "03:00"},
            {"id": "weekly",   "label": "Semanal",         "placeholder": "MON 03:00"},
            {"id": "interval", "label": "Cada X minutos",  "placeholder": "60"},
            {"id": "manual",   "label": "Solo manual",     "placeholder": ""},
        ]}
