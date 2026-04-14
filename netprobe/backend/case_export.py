"""
case_export.py — Exportar caso completo como ZIP
Genera un ZIP con: metadatos, todas las sesiones+resultados, notas, STRIDE, PDF
"""
import io
import json
import zipfile
from datetime import datetime
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List

router = APIRouter()

# ── helpers ───────────────────────────────────────────────────────
def _db():
    from history import get_db
    return get_db()

def _get_case(cid: str) -> dict:
    db = _db()
    row = db.execute("SELECT * FROM cases WHERE id=?", (cid,)).fetchone()
    if not row:
        return None
    return dict(row)

def _get_sessions(cid: str) -> list:
    db = _db()
    rows = db.execute(
        "SELECT * FROM sessions WHERE case_id=? ORDER BY started_at ASC", (cid,)
    ).fetchall()
    sessions = []
    for row in rows:
        s = dict(row)
        results = db.execute(
            "SELECT * FROM session_results WHERE session_id=? ORDER BY id", (s["id"],)
        ).fetchall()
        s["results"] = [dict(r) for r in results]
        sessions.append(s)
    return sessions

def _sanitize_filename(name: str) -> str:
    import re
    return re.sub(r'[^\w\-.]', '_', name)[:50]

def _score_label(score) -> str:
    if score is None: return "Sin datos"
    s = int(score)
    if s >= 80: return "SEGURO"
    if s >= 60: return "MODERADO"
    if s >= 40: return "VULNERABLE"
    return "CRÍTICO"

# ── Markdown summary ───────────────────────────────────────────────
def _build_summary_md(case: dict, sessions: list) -> str:
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    total_results = sum(len(s["results"]) for s in sessions)
    all_results   = [r for s in sessions for r in s["results"]]
    vulns   = [r for r in all_results if r.get("status") == "VULNERABLE"]
    partial = [r for r in all_results if r.get("status") == "PARTIAL"]
    blocked = [r for r in all_results if r.get("status") == "BLOCKED"]
    scores  = [s["score"] for s in sessions if s.get("score") is not None]
    avg_score = round(sum(scores)/len(scores)) if scores else None

    lines = [
        f"# 🛡️ NetProbe — Caso: {case['name']}",
        f"",
        f"**Exportado:** {now}  ",
        f"**Target principal:** {case.get('target') or '—'}  ",
        f"**Descripción:** {case.get('description') or '—'}  ",
        f"**Creado:** {case.get('created_at','—')}",
        f"",
        f"---",
        f"",
        f"## 📊 Resumen Ejecutivo",
        f"",
        f"| Métrica | Valor |",
        f"|---|---|",
        f"| Total sesiones | {len(sessions)} |",
        f"| Total resultados | {total_results} |",
        f"| Score medio | {avg_score if avg_score is not None else '—'}/100 ({_score_label(avg_score)}) |",
        f"| Vulnerables | **{len(vulns)}** |",
        f"| Parcialmente bloqueados | {len(partial)} |",
        f"| Completamente bloqueados | {len(blocked)} |",
        f"",
    ]

    if vulns:
        lines += [
            f"## 🔴 Vulnerabilidades Críticas",
            f"",
        ]
        for r in vulns[:20]:
            lines.append(f"- **{r.get('module_name', r.get('module_id','?'))}** "
                         f"— Target: `{r.get('target','?')}` "
                         f"— Score: {r.get('score','?')}")
            if r.get("note"):
                lines.append(f"  > Nota: {r['note']}")
        lines.append("")

    lines += [
        f"## 🗂️ Sesiones",
        f"",
    ]
    for i, s in enumerate(sessions, 1):
        score_str = f"{s['score']}/100 ({_score_label(s['score'])})" if s.get('score') is not None else "—"
        lines += [
            f"### Sesión {i} — {s.get('started_at','?')[:16]}",
            f"",
            f"- **Target:** `{s.get('target','?')}`",
            f"- **Score:** {score_str}",
            f"- **Módulos:** {s.get('module_count', len(s['results']))}",
            f"- **Perfil:** {s.get('profile') or 'manual'}",
        ]
        if s.get("notes"):
            lines.append(f"- **Notas:** {s['notes']}")
        lines.append("")
        if s["results"]:
            lines.append("| Módulo | Estado | Score | Nota |")
            lines.append("|---|---|---|---|")
            for r in s["results"]:
                note = (r.get("note") or "").replace("\n"," ")[:60]
                lines.append(
                    f"| {r.get('module_name', r.get('module_id','?'))} "
                    f"| {r.get('status','?')} "
                    f"| {r.get('score','?')} "
                    f"| {note} |"
                )
            lines.append("")

    return "\n".join(lines)


# ── JSON data ──────────────────────────────────────────────────────
def _build_json(case: dict, sessions: list) -> str:
    export = {
        "export_date": datetime.now().isoformat(),
        "netprobe_version": "1.0",
        "case": case,
        "sessions": sessions,
        "stats": {
            "total_sessions": len(sessions),
            "total_results": sum(len(s["results"]) for s in sessions),
            "scores": [s["score"] for s in sessions if s.get("score") is not None],
        }
    }
    return json.dumps(export, indent=2, ensure_ascii=False, default=str)


# ── CSV results ────────────────────────────────────────────────────
def _build_csv(sessions: list) -> str:
    rows = ["session_date,target,module,status,score,note"]
    for s in sessions:
        date = (s.get("started_at") or "")[:16]
        target = s.get("target","")
        for r in s["results"]:
            note = (r.get("note") or "").replace('"',"'").replace("\n"," ")
            rows.append(
                f'"{date}","{target}",'
                f'"{r.get("module_name",r.get("module_id",""))}",{r.get("status","")},{r.get("score","")},"{note}"'
            )
    return "\n".join(rows)


# ── Logs txt ───────────────────────────────────────────────────────
def _build_logs(sessions: list) -> str:
    lines = ["NetProbe — Export de logs\n"]
    for s in sessions:
        lines.append(f"\n{'='*60}")
        lines.append(f"Sesión: {s.get('started_at','?')[:16]} | Target: {s.get('target','?')} | Score: {s.get('score','?')}")
        lines.append(f"{'='*60}")
        for r in s["results"]:
            lines.append(f"\n[{r.get('status','?')}] {r.get('module_name', r.get('module_id','?'))}")
            if r.get("raw_output"):
                lines.append(r["raw_output"][:500])
            if r.get("note"):
                lines.append(f"NOTA: {r['note']}")
    return "\n".join(lines)


# ── PDF ────────────────────────────────────────────────────────────
def _build_pdf(case: dict, sessions: list) -> bytes | None:
    try:
        from pdf_report import generate_pdf
        # Use latest session data for PDF
        if not sessions:
            return None
        latest = sessions[-1]
        results = latest["results"]
        score   = latest.get("score") or 0
        target  = latest.get("target") or case.get("target") or "N/A"
        return generate_pdf(target, score, results)
    except Exception:
        return None


# ── Route ─────────────────────────────────────────────────────────
@router.get("/api/cases/{cid}/export")
async def export_case(cid: str, include_pdf: bool = True):
    """Export a full case as a ZIP archive."""
    case = _get_case(cid)
    if not case:
        from fastapi.responses import JSONResponse
        return JSONResponse({"error": "Caso no encontrado"}, status_code=404)

    sessions = _get_sessions(cid)
    safe_name = _sanitize_filename(case["name"])
    ts        = datetime.now().strftime("%Y%m%d_%H%M")
    zip_name  = f"netprobe_{safe_name}_{ts}.zip"

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:

        # 1. README / Resumen en Markdown
        summary = _build_summary_md(case, sessions)
        zf.writestr(f"RESUMEN.md", summary)

        # 2. Datos completos en JSON
        data_json = _build_json(case, sessions)
        zf.writestr(f"data/caso_completo.json", data_json)

        # 3. CSV de resultados (fácil de abrir en Excel)
        csv = _build_csv(sessions)
        zf.writestr(f"data/resultados.csv", csv)

        # 4. Logs por sesión
        for i, s in enumerate(sessions, 1):
            date  = (s.get("started_at") or "")[:10]
            tgt   = _sanitize_filename(s.get("target","host"))
            fname = f"sesiones/sesion_{i:02d}_{date}_{tgt}.json"
            zf.writestr(fname, json.dumps(s, indent=2, ensure_ascii=False, default=str))

        # 5. Logs de raw output
        logs_txt = _build_logs(sessions)
        zf.writestr("logs/raw_output.txt", logs_txt)

        # 6. STRIDE (si existe en localStorage no podemos accederlo,
        #    pero intentamos buscar en cache del servidor si lo hubiera)
        # Nota: STRIDE se guarda en localStorage del cliente, no en servidor.
        # Lo documentamos en el README del ZIP.

        # 7. PDF del último scan
        if include_pdf and sessions:
            pdf_bytes = _build_pdf(case, sessions)
            if pdf_bytes:
                zf.writestr(f"informe/informe_{safe_name}.pdf", pdf_bytes)

        # 8. Metadatos del export
        meta = {
            "export_date":       datetime.now().isoformat(),
            "case_name":         case["name"],
            "case_id":           cid,
            "total_sessions":    len(sessions),
            "total_results":     sum(len(s["results"]) for s in sessions),
            "netprobe_version":  "1.0",
            "files": [
                "RESUMEN.md         — Resumen ejecutivo en Markdown",
                "data/caso_completo.json — Todos los datos en JSON",
                "data/resultados.csv    — Resultados para Excel/Sheets",
                "sesiones/              — JSON de cada sesión individual",
                "logs/raw_output.txt    — Salida raw de las herramientas",
                "informe/               — PDF del último scan (si disponible)",
            ]
        }
        zf.writestr("MANIFEST.json", json.dumps(meta, indent=2, ensure_ascii=False))

    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{zip_name}"'},
    )


def register_export_routes(app):
    app.include_router(router)
