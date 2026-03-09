"""
NetProbe - Historial de scans persistente
Guarda sesiones completas en SQLite para análisis histórico y dashboard.
"""
import sqlite3, json, os
from datetime import datetime
from typing import Optional

DB_PATH = os.path.join(os.path.dirname(__file__), "history.db")

# ── Init ──────────────────────────────────────────────────────────
def get_db():
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    return db

def init_db():
    db = get_db()
    db.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            id          TEXT PRIMARY KEY,
            target      TEXT NOT NULL,
            started_at  TEXT NOT NULL,
            finished_at TEXT,
            score       INTEGER,
            total_modules INTEGER DEFAULT 0,
            blocked     INTEGER DEFAULT 0,
            detected    INTEGER DEFAULT 0,
            partial     INTEGER DEFAULT 0,
            vulnerable  INTEGER DEFAULT 0,
            errors      INTEGER DEFAULT 0,
            profile     TEXT,
            notes       TEXT DEFAULT '',
            tags        TEXT DEFAULT '[]'
        )
    """)
    db.execute("""
        CREATE TABLE IF NOT EXISTS session_results (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id  TEXT NOT NULL,
            module_id   TEXT NOT NULL,
            module_name TEXT,
            category    TEXT,
            status      TEXT,
            score       INTEGER,
            data        TEXT DEFAULT '{}',
            commands    TEXT DEFAULT '[]',
            raw_output  TEXT DEFAULT '',
            duration_ms INTEGER,
            timestamp   TEXT,
            note        TEXT DEFAULT '',
            note_status TEXT DEFAULT '',
            FOREIGN KEY (session_id) REFERENCES sessions(id)
        )
    """)
    db.commit()
    db.close()

# ── Sessions CRUD ─────────────────────────────────────────────────
def create_session(target: str, profile: str = None) -> str:
    import uuid
    sid = str(uuid.uuid4())[:12]
    now = datetime.now().isoformat()
    db  = get_db()
    db.execute("""INSERT INTO sessions
        (id, target, started_at, profile) VALUES (?,?,?,?)""",
        (sid, target, now, profile))
    db.commit()
    db.close()
    return sid

def finish_session(sid: str, results: list, score: int):
    now    = datetime.now().isoformat()
    counts = {"BLOCKED":0,"DETECTED":0,"PARTIAL":0,"PASSED":0,"ERROR":0}
    for r in results:
        counts[r.get("status","ERROR")] = counts.get(r.get("status","ERROR"),0) + 1
    db = get_db()
    db.execute("""UPDATE sessions SET
        finished_at=?, score=?, total_modules=?,
        blocked=?, detected=?, partial=?, vulnerable=?, errors=?
        WHERE id=?""",
        (now, score, len(results),
         counts["BLOCKED"], counts["DETECTED"], counts["PARTIAL"],
         counts["PASSED"], counts["ERROR"], sid))
    db.commit()
    db.close()

def save_result(sid: str, r: dict):
    db = get_db()
    db.execute("""INSERT INTO session_results
        (session_id, module_id, module_name, category, status, score,
         data, commands, raw_output, duration_ms, timestamp)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
        (sid,
         r.get("module") or r.get("id",""),
         r.get("name",""),
         r.get("category",""),
         r.get("status","ERROR"),
         r.get("score"),
         json.dumps(r.get("data",{})),
         json.dumps(r.get("commands",[])),
         r.get("raw_output","")[:8000],
         r.get("duration_ms"),
         r.get("timestamp") or datetime.now().isoformat()))
    db.commit()
    db.close()

def list_sessions(target: str = None, limit: int = 50) -> list:
    db = get_db()
    if target:
        rows = db.execute(
            "SELECT * FROM sessions WHERE target=? ORDER BY started_at DESC LIMIT ?",
            (target, limit)).fetchall()
    else:
        rows = db.execute(
            "SELECT * FROM sessions ORDER BY started_at DESC LIMIT ?",
            (limit,)).fetchall()
    db.close()
    return [dict(r) for r in rows]

def get_session(sid: str) -> Optional[dict]:
    db  = get_db()
    row = db.execute("SELECT * FROM sessions WHERE id=?", (sid,)).fetchone()
    db.close()
    return dict(row) if row else None

def get_session_results(sid: str) -> list:
    db   = get_db()
    rows = db.execute(
        "SELECT * FROM session_results WHERE session_id=? ORDER BY id",
        (sid,)).fetchall()
    db.close()
    out = []
    for r in rows:
        d = dict(r)
        try: d["data"]     = json.loads(d["data"])
        except: d["data"]  = {}
        try: d["commands"] = json.loads(d["commands"])
        except: d["commands"] = []
        out.append(d)
    return out

def update_session_note(sid: str, notes: str):
    db = get_db()
    db.execute("UPDATE sessions SET notes=? WHERE id=?", (notes, sid))
    db.commit()
    db.close()

def update_result_note(result_id: int, note: str, note_status: str):
    db = get_db()
    db.execute("UPDATE session_results SET note=?, note_status=? WHERE id=?",
               (note, note_status, result_id))
    db.commit()
    db.close()

def delete_session(sid: str):
    db = get_db()
    db.execute("DELETE FROM session_results WHERE session_id=?", (sid,))
    db.execute("DELETE FROM sessions WHERE id=?", (sid,))
    db.commit()
    db.close()

# ── Stats for dashboard ───────────────────────────────────────────
def get_dashboard_stats(target: str = None) -> dict:
    db = get_db()
    q  = "WHERE target=?" if target else ""
    p  = (target,) if target else ()

    sessions = db.execute(
        f"SELECT * FROM sessions {q} ORDER BY started_at DESC LIMIT 30", p
    ).fetchall()

    if not sessions:
        db.close()
        return {"sessions": [], "score_history": [], "status_totals": {}, "top_vulnerable": [], "total_sessions": 0}

    # Score over time
    score_history = [
        {"date": s["started_at"][:10], "score": s["score"], "target": s["target"], "id": s["id"]}
        for s in sessions if s["score"] is not None
    ]

    # Aggregate status totals
    totals = {"BLOCKED":0,"DETECTED":0,"PARTIAL":0,"VULNERABLE":0,"ERROR":0}
    for s in sessions:
        totals["BLOCKED"]   += s["blocked"]   or 0
        totals["DETECTED"]  += s["detected"]  or 0
        totals["PARTIAL"]   += s["partial"]   or 0
        totals["VULNERABLE"]+= s["vulnerable"] or 0
        totals["ERROR"]     += s["errors"]    or 0

    # Top vulnerable modules across all sessions
    rows = db.execute(f"""
        SELECT sr.module_name, sr.module_id, sr.category,
               COUNT(*) as hits, AVG(sr.score) as avg_score
        FROM session_results sr
        JOIN sessions s ON sr.session_id = s.id
        {f"WHERE s.target=?" if target else ""}
        AND sr.status IN ('PASSED','PARTIAL')
        GROUP BY sr.module_id
        ORDER BY hits DESC, avg_score ASC
        LIMIT 8
    """, p if target else ()).fetchall()
    top_vulnerable = [dict(r) for r in rows]

    # Category breakdown
    cat_rows = db.execute(f"""
        SELECT sr.category, sr.status, COUNT(*) as cnt
        FROM session_results sr
        JOIN sessions s ON sr.session_id = s.id
        {f"WHERE s.target=?" if target else ""}
        GROUP BY sr.category, sr.status
    """, p if target else ()).fetchall()
    cat_stats = {}
    for r in cat_rows:
        c = r["category"] or "unknown"
        if c not in cat_stats: cat_stats[c] = {"BLOCKED":0,"DETECTED":0,"PARTIAL":0,"PASSED":0,"ERROR":0}
        cat_stats[c][r["status"]] = r["cnt"]

    db.close()
    return {
        "total_sessions":  len(sessions),
        "sessions":        [dict(s) for s in sessions[:10]],
        "score_history":   list(reversed(score_history)),
        "status_totals":   totals,
        "top_vulnerable":  top_vulnerable,
        "category_stats":  cat_stats,
        "latest_score":    sessions[0]["score"] if sessions else None,
        "avg_score":       round(sum(s["score"] for s in sessions if s["score"]) /
                           max(1, sum(1 for s in sessions if s["score"])), 1),
    }

# ── FastAPI routes ─────────────────────────────────────────────────
def register_history_routes(app):
    from fastapi import Response
    from pydantic import BaseModel
    from typing import List, Optional as Opt

    init_db()

    class SaveSessionRequest(BaseModel):
        target:  str
        score:   int
        results: list
        profile: Opt[str] = None

    class NoteRequest(BaseModel):
        note:        str = ""
        note_status: str = ""

    class SessionNoteRequest(BaseModel):
        notes: str = ""

    @app.post("/api/history/sessions")
    def save_session(body: SaveSessionRequest):
        sid = create_session(body.target, body.profile)
        for r in body.results:
            save_result(sid, r)
        finish_session(sid, body.results, body.score)
        return {"id": sid, "ok": True}

    @app.get("/api/history/sessions")
    def list_all(target: str = None, limit: int = 50):
        return {"sessions": list_sessions(target, limit)}

    @app.get("/api/history/sessions/{sid}")
    def get_one(sid: str):
        s = get_session(sid)
        if not s: return {"error": "Not found"}
        s["results"] = get_session_results(sid)
        return s

    @app.delete("/api/history/sessions/{sid}")
    def delete_one(sid: str):
        delete_session(sid)
        return {"ok": True}

    @app.patch("/api/history/sessions/{sid}/note")
    def session_note(sid: str, body: SessionNoteRequest):
        update_session_note(sid, body.notes)
        return {"ok": True}

    @app.patch("/api/history/results/{rid}/note")
    def result_note(rid: int, body: NoteRequest):
        update_result_note(rid, body.note, body.note_status)
        return {"ok": True}

    @app.get("/api/history/dashboard")
    def dashboard(target: str = None):
        return get_dashboard_stats(target)
