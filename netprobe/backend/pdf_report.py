"""
NetProbe - PDF Report Generator v3
Clean professional light theme, modeled after real pentest reports.
"""
import hashlib as _hashlib
_orig_md5 = _hashlib.md5
def _patched_md5(*a, **kw): kw.pop("usedforsecurity",None); return _orig_md5(*a,**kw)
_hashlib.md5 = _patched_md5

import io
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, KeepTogether
)

W, H = A4

# ── Palette (light professional) ─────────────────────────────────
WHITE   = colors.white
BLACK   = colors.HexColor("#1a1a2e")
DARKGR  = colors.HexColor("#2d2d44")
MEDGR   = colors.HexColor("#6b7280")
LIGHTGR = colors.HexColor("#f3f4f6")
BORDER  = colors.HexColor("#e5e7eb")
ACCENT  = colors.HexColor("#1e40af")   # deep blue
ACCENT2 = colors.HexColor("#0ea5e9")   # sky blue

CRIT    = colors.HexColor("#dc2626")   # red
HIGH    = colors.HexColor("#ea580c")   # orange
MED     = colors.HexColor("#d97706")   # amber
LOW     = colors.HexColor("#16a34a")   # green
INFO    = colors.HexColor("#0891b2")   # cyan

CRIT_BG = colors.HexColor("#fef2f2")
HIGH_BG = colors.HexColor("#fff7ed")
MED_BG  = colors.HexColor("#fffbeb")
LOW_BG  = colors.HexColor("#f0fdf4")
INFO_BG = colors.HexColor("#ecfeff")
BLUE_BG = colors.HexColor("#eff6ff")
HDR_BG  = colors.HexColor("#1e3a5f")

STATUS_CFG = {
    "BLOCKED":  {"fg": LOW,   "bg": LOW_BG,  "bar": colors.HexColor("#16a34a"), "label": "BLOQUEADO",  "risk": "Bajo"},
    "DETECTED": {"fg": MED,   "bg": MED_BG,  "bar": colors.HexColor("#d97706"), "label": "DETECTADO",  "risk": "Medio"},
    "PARTIAL":  {"fg": HIGH,  "bg": HIGH_BG, "bar": colors.HexColor("#ea580c"), "label": "PARCIAL",    "risk": "Alto"},
    "PASSED":   {"fg": CRIT,  "bg": CRIT_BG, "bar": colors.HexColor("#dc2626"), "label": "VULNERABLE", "risk": "Crítico"},
    "ERROR":    {"fg": MEDGR, "bg": LIGHTGR, "bar": MEDGR,                      "label": "ERROR",      "risk": "N/A"},
}
CAT_CFG = {
    "recon":       {"color": colors.HexColor("#16a34a"), "name": "Reconocimiento"},
    "fingerprint": {"color": ACCENT,                     "name": "Fingerprinting"},
    "flood":       {"color": CRIT,                       "name": "Flood / DoS"},
    "brute_force": {"color": HIGH,                       "name": "Fuerza Bruta"},
    "protocol":    {"color": colors.HexColor("#7c3aed"), "name": "Protocolo"},
    "web":         {"color": INFO,                       "name": "Web Attacks"},
    "dns":         {"color": MED,                        "name": "DNS"},
    "evasion":     {"color": colors.HexColor("#be185d"), "name": "Evasión"},
    "firewall":    {"color": colors.HexColor("#0f766e"), "name": "Firewall"},
}

def score_color(s):
    if s is None: return MEDGR
    if s >= 80: return LOW
    if s >= 60: return MED
    if s >= 35: return HIGH
    return CRIT

def score_label(s):
    if s is None: return "N/A"
    if s >= 80: return "Seguro"
    if s >= 60: return "Aceptable"
    if s >= 35: return "En Riesgo"
    return "Crítico"

def fmt_time(ts):
    if not ts: return "—"
    ts = str(ts).strip()
    try:
        if 'T' in ts: return ts.split('T')[1][:5]   # "2026-03-06T10:07:16" -> "10:07"
        if ' ' in ts and len(ts) > 10: return ts.split(' ')[1][:5]
    except: pass
    return "—"

def P(text, style): return Paragraph(text, style)

# ── Styles ────────────────────────────────────────────────────────
def st(**kw): return ParagraphStyle("_", **kw)

COVER_EYEBROW = st(fontName="Helvetica-Bold", fontSize=9, textColor=ACCENT2, leading=12, spaceAfter=2)
COVER_TITLE   = st(fontName="Helvetica-Bold", fontSize=34, textColor=WHITE,  leading=40)
COVER_SUB     = st(fontName="Helvetica",      fontSize=13, textColor=colors.HexColor("#cbd5e1"), leading=18, spaceAfter=4)
COVER_META_K  = st(fontName="Helvetica",      fontSize=9,  textColor=colors.HexColor("#94a3b8"), leading=13)
COVER_META_V  = st(fontName="Helvetica-Bold", fontSize=9,  textColor=WHITE, leading=13)
SECTION       = st(fontName="Helvetica-Bold", fontSize=13, textColor=HDR_BG, leading=17, spaceBefore=6, spaceAfter=3)
SUBSECT       = st(fontName="Helvetica-Bold", fontSize=10, textColor=DARKGR, leading=14, spaceBefore=4, spaceAfter=2)
BODY          = st(fontName="Helvetica",      fontSize=9,  textColor=DARKGR, leading=14, spaceAfter=3, alignment=TA_JUSTIFY)
BODY_SM       = st(fontName="Helvetica",      fontSize=8,  textColor=MEDGR,  leading=12, spaceAfter=2)
TABLE_HDR     = st(fontName="Helvetica-Bold", fontSize=8,  textColor=WHITE,  leading=11)
TABLE_CELL    = st(fontName="Helvetica",      fontSize=8.5,textColor=DARKGR, leading=12)
TABLE_CELL_B  = st(fontName="Helvetica-Bold", fontSize=8.5,textColor=BLACK,  leading=12)
MONO          = st(fontName="Courier",        fontSize=7.5,textColor=colors.HexColor("#374151"), leading=11, spaceAfter=1)
MONO_CMD      = st(fontName="Courier",        fontSize=7.5,textColor=ACCENT,  leading=11)
CAPTION       = st(fontName="Helvetica",      fontSize=7,  textColor=MEDGR,   leading=10)
LABEL_CRIT    = st(fontName="Helvetica-Bold", fontSize=7.5,textColor=CRIT,    leading=10)
LABEL_HIGH    = st(fontName="Helvetica-Bold", fontSize=7.5,textColor=HIGH,    leading=10)
LABEL_MED     = st(fontName="Helvetica-Bold", fontSize=7.5,textColor=MED,     leading=10)
LABEL_LOW     = st(fontName="Helvetica-Bold", fontSize=7.5,textColor=LOW,     leading=10)

# ── Page callback ─────────────────────────────────────────────────
def make_cb(target, date_str):
    def cb(canvas, doc):
        if doc.page == 1: return  # cover handles its own header
        canvas.saveState()
        # Top rule
        canvas.setFillColor(HDR_BG)
        canvas.rect(0, H-11*mm, W, 11*mm, fill=1, stroke=0)
        canvas.setFillColor(ACCENT2)
        canvas.rect(0, H-11*mm, 4*mm, 11*mm, fill=1, stroke=0)
        canvas.setFont("Helvetica-Bold", 7.5)
        canvas.setFillColor(WHITE)
        canvas.drawString(9*mm, H-5.5*mm, "NetProbe Security Suite — Informe de Seguridad")
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(colors.HexColor("#94a3b8"))
        canvas.drawString(9*mm, H-9.5*mm, f"Target: {target}  ·  {date_str}")
        canvas.setFont("Helvetica-Bold", 7)
        canvas.setFillColor(colors.HexColor("#fca5a5"))
        canvas.drawRightString(W-7*mm, H-5.5*mm, "CONFIDENCIAL")
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(colors.HexColor("#94a3b8"))
        canvas.drawRightString(W-7*mm, H-9.5*mm, f"Página {doc.page}")
        # Bottom
        canvas.setFillColor(BORDER)
        canvas.rect(0, 9*mm, W, 0.3*mm, fill=1, stroke=0)
        canvas.setFont("Helvetica", 6)
        canvas.setFillColor(MEDGR)
        canvas.drawCentredString(W/2, 3.5*mm,
            "Documento confidencial · NetProbe Security Suite · Uso exclusivo en redes propias o con autorización expresa")
        canvas.restoreState()
    return cb

def make_cover_cb(target, date_str, score):
    """Full dark cover page."""
    def cb(canvas, doc):
        if doc.page != 1: return
        canvas.saveState()
        # Dark background
        canvas.setFillColor(HDR_BG)
        canvas.rect(0, 0, W, H, fill=1, stroke=0)
        # Blue accent stripe left
        canvas.setFillColor(ACCENT2)
        canvas.rect(0, 0, 8*mm, H, fill=1, stroke=0)
        # Subtle grid lines decoration
        canvas.setStrokeColor(colors.HexColor("#1e4a7a"))
        canvas.setLineWidth(0.3)
        for i in range(0, int(W), 20):
            canvas.line(i*mm/3, 0, i*mm/3, H)
        canvas.setFillColor(colors.HexColor("#0f2544"))
        canvas.rect(0, 0, W, H*0.38, fill=1, stroke=0)
        # Score circle bottom right
        cx, cy, r = W-35*mm, 60*mm, 28*mm
        # Ring bg
        canvas.setStrokeColor(colors.HexColor("#1e3a5f"))
        canvas.setLineWidth(6)
        canvas.circle(cx, cy, r, stroke=1, fill=0)
        # Colored ring
        sc_col = score_color(score)
        canvas.setStrokeColor(sc_col)
        canvas.setLineWidth(6)
        canvas.circle(cx, cy, r, stroke=1, fill=0)
        # Score text
        canvas.setFont("Helvetica-Bold", 22)
        canvas.setFillColor(sc_col)
        canvas.drawCentredString(cx, cy+2, str(score))
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(colors.HexColor("#94a3b8"))
        canvas.drawCentredString(cx, cy-12, f"/ 100  {score_label(score)}")
        # Confidential top right
        canvas.setFont("Helvetica-Bold", 7)
        canvas.setFillColor(colors.HexColor("#fca5a5"))
        canvas.drawRightString(W-7*mm, H-8*mm, "CONFIDENCIAL")
        canvas.restoreState()
    return cb

# ── Cover ─────────────────────────────────────────────────────────
def cover(story, target, score, date_str, results):
    by_st = {k:0 for k in STATUS_CFG}
    for r in results:
        by_st[r.get("status","ERROR")] = by_st.get(r.get("status","ERROR"),0)+1

    story.append(Spacer(1, 38*mm))
    story.append(P("NETPROBE", COVER_EYEBROW))
    story.append(Spacer(1, 3*mm))
    story.append(P("Informe de Seguridad", COVER_TITLE))
    story.append(Spacer(1, 3*mm))
    story.append(P("Análisis de postura de seguridad y evaluación de vulnerabilidades", COVER_SUB))
    story.append(Spacer(1, 8*mm))

    # Meta info in two columns
    def mrow(k, v):
        return [P(k, COVER_META_K), P(v, COVER_META_V)]
    mt = Table([mrow("Target", target or "N/A"), mrow("Fecha", date_str),
                mrow("Módulos evaluados", str(len(results))),
                mrow("Clasificación", score_label(score))],
               colWidths=[32*mm, 90*mm])
    mt.setStyle(TableStyle([
        ("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),0),
        ("TOPPADDING",(0,0),(-1,-1),3),("BOTTOMPADDING",(0,0),(-1,-1),3),
        ("LINEBELOW",(0,0),(-1,-1),0.3,colors.HexColor("#1e4a7a")),
    ]))
    story.append(mt)
    story.append(Spacer(1, 10*mm))

    # Status summary row
    cells = []
    for st_key, cfg in STATUS_CFG.items():
        cnt = by_st.get(st_key, 0)
        cells.append(Table([[
            P(str(cnt), st(fontName="Helvetica-Bold",fontSize=20,textColor=cfg["fg"] if cnt>0 else colors.HexColor("#64748b"),leading=24,alignment=TA_CENTER)),
            P(cfg["label"], st(fontName="Helvetica-Bold",fontSize=6.5,textColor=colors.HexColor("#94a3b8"),leading=9,alignment=TA_CENTER)),
        ]], colWidths=[34*mm]))
    row = Table([cells], colWidths=[34*mm]*5)
    row.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1),colors.HexColor("#0f2040")),
        ("INNERGRID",(0,0),(-1,-1),0.3,colors.HexColor("#1e3a5f")),
        ("BOX",(0,0),(-1,-1),0.3,colors.HexColor("#1e3a5f")),
        ("TOPPADDING",(0,0),(-1,-1),6),("BOTTOMPADDING",(0,0),(-1,-1),6),
        ("ALIGN",(0,0),(-1,-1),"CENTER"),
    ]))
    story.append(row)
    story.append(Spacer(1, 95*mm))
    story.append(P(
        "Documento generado automáticamente por NetProbe Security Suite. "
        "Contenido confidencial — uso exclusivo en redes propias o con autorización expresa.",
        st(fontName="Helvetica",fontSize=7,textColor=colors.HexColor("#475569"),leading=10)))
    story.append(PageBreak())

# ── Executive summary ─────────────────────────────────────────────
def exec_summary(story, results, score, target):
    story.append(P("1. Resumen Ejecutivo", SECTION))
    story.append(HRFlowable(width="100%", thickness=1, color=ACCENT, spaceAfter=4))

    by_st = {k:[] for k in STATUS_CFG}
    for r in results: (by_st.get(r.get("status","ERROR")) or by_st["ERROR"]).append(r)

    sc_col = score_color(score)
    story.append(P(
        f'El análisis de seguridad realizado sobre el objetivo <b>{target}</b> ha concluido con una '
        f'puntuación global de <b>{score}/100</b>, clasificada como <b>{score_label(score)}</b>. '
        f'Se evaluaron <b>{len(results)} módulos</b> de seguridad distribuidos en múltiples categorías.',
        BODY))
    story.append(Spacer(1, 3*mm))

    # Findings summary boxes
    vulns   = len(by_st["PASSED"])
    partial = len(by_st["PARTIAL"])
    detect  = len(by_st["DETECTED"])
    blocked = len(by_st["BLOCKED"])

    if vulns:
        names = ", ".join(r.get("name",r.get("module","?")) for r in by_st["PASSED"][:3])
        extra = f" y {vulns-3} más" if vulns > 3 else ""
        _alert_box(story, "CRÍTICO", CRIT, CRIT_BG,
            f"Se confirmaron <b>{vulns} vectores vulnerables</b>: {names}{extra}. "
            f"Estos módulos no encontraron detección ni bloqueo activo. Se requiere remediación inmediata.")
    if partial:
        _alert_box(story, "ALTO", HIGH, HIGH_BG,
            f"<b>{partial} módulo(s)</b> obtuvieron resultados parciales, "
            f"indicando defensas incompletas o inconsistentes ante los vectores probados.")
    if detect:
        _alert_box(story, "MEDIO", MED, MED_BG,
            f"<b>{detect} módulo(s)</b> fueron detectados pero no bloqueados activamente, "
            f"lo que sugiere capacidad de alertas sin prevención efectiva.")
    if blocked and not vulns and not partial:
        _alert_box(story, "OK", LOW, LOW_BG,
            f"Todos los <b>{blocked} módulos</b> evaluados fueron bloqueados correctamente. "
            f"La postura de seguridad es sólida para los vectores probados.")

    story.append(Spacer(1, 4*mm))

def _alert_box(story, level, fg, bg, text):
    lbl_style = {
        "CRÍTICO": LABEL_CRIT, "ALTO": LABEL_HIGH,
        "MEDIO": LABEL_MED, "OK": LABEL_LOW,
    }.get(level, BODY_SM)
    t = Table([[
        P(level, lbl_style),
        P(text, st(fontName="Helvetica",fontSize=8.5,textColor=DARKGR,leading=13)),
    ]], colWidths=[18*mm, 142*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1),bg),
        ("LINEBEFORE",(0,0),(0,-1),3,fg),
        ("TOPPADDING",(0,0),(-1,-1),6),("BOTTOMPADDING",(0,0),(-1,-1),6),
        ("LEFTPADDING",(0,0),(-1,-1),7),("RIGHTPADDING",(0,0),(-1,-1),7),
        ("VALIGN",(0,0),(-1,-1),"TOP"),("ALIGN",(0,0),(0,-1),"CENTER"),
        ("BOX",(0,0),(-1,-1),0.3,fg),
    ]))
    story.append(t)
    story.append(Spacer(1, 2*mm))

# ── Results table ─────────────────────────────────────────────────
def results_table(story, results):
    story.append(P("2. Detalle de Módulos Evaluados", SECTION))
    story.append(HRFlowable(width="100%", thickness=1, color=ACCENT, spaceAfter=4))

    sev_order = {"PASSED":0,"PARTIAL":1,"DETECTED":2,"BLOCKED":3,"ERROR":4}
    sorted_r  = sorted(results, key=lambda r: sev_order.get(r.get("status","ERROR"),5))

    rows = [[
        P("<b>Módulo</b>", TABLE_HDR),
        P("<b>Categoría</b>", TABLE_HDR),
        P("<b>Estado</b>", TABLE_HDR),
        P("<b>Riesgo</b>", TABLE_HDR),
        P("<b>Score</b>", TABLE_HDR),
        P("<b>Hora</b>", TABLE_HDR),
    ]]
    styles = [
        ("BACKGROUND",(0,0),(-1,0), HDR_BG),
        ("GRID",(0,0),(-1,-1), 0.3, BORDER),
        ("TOPPADDING",(0,0),(-1,-1), 5),
        ("BOTTOMPADDING",(0,0),(-1,-1), 5),
        ("LEFTPADDING",(0,0),(-1,-1), 6),
        ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
    ]
    for i, r in enumerate(sorted_r):
        st_key = r.get("status","ERROR")
        cfg    = STATUS_CFG.get(st_key, STATUS_CFG["ERROR"])
        cat    = r.get("category","")
        ccfg   = CAT_CFG.get(cat, {"color":MEDGR,"name":cat})
        s      = r.get("score")
        sc_c   = score_color(s)
        bg     = cfg["bg"] if st_key in ("PASSED","PARTIAL") else (LIGHTGR if i%2==0 else WHITE)
        row_n  = i+1
        styles += [
            ("BACKGROUND",(0,row_n),(-1,row_n), bg),
            ("LINEBEFORE",(0,row_n),(0,row_n), 3, cfg["bar"]),
        ]
        rows.append([
            P(f'<b>{r.get("name",r.get("module","?"))}</b>',
              st(fontName="Helvetica-Bold",fontSize=8.5,textColor=BLACK,leading=12)),
            P(ccfg["name"],
              st(fontName="Helvetica",fontSize=8,textColor=ccfg["color"],leading=11)),
            P(f'<b>{cfg["label"]}</b>',
              st(fontName="Helvetica-Bold",fontSize=8,textColor=cfg["fg"],leading=11)),
            P(cfg["risk"],
              st(fontName="Helvetica",fontSize=8,textColor=cfg["fg"],leading=11)),
            P(f'<b>{s if s is not None else "N/A"}</b>',
              st(fontName="Helvetica-Bold",fontSize=9,textColor=sc_c,leading=12)),
            P(fmt_time(r.get("timestamp","")),
              st(fontName="Courier",fontSize=8,textColor=MEDGR,leading=11)),
        ])

    tbl = Table(rows, colWidths=[56*mm, 30*mm, 25*mm, 18*mm, 14*mm, 22*mm], repeatRows=1)
    tbl.setStyle(TableStyle(styles))
    story.append(tbl)
    story.append(Spacer(1, 6*mm))

# ── Findings ──────────────────────────────────────────────────────
def findings(story, results):
    critical = [r for r in results if r.get("status") in ("PASSED","PARTIAL","DETECTED")]
    if not critical: return

    story.append(PageBreak())
    story.append(P("3. Hallazgos Detallados", SECTION))
    story.append(HRFlowable(width="100%", thickness=1, color=ACCENT, spaceAfter=4))

    for idx, r in enumerate(critical, 1):
        st_key = r.get("status","ERROR")
        cfg    = STATUS_CFG.get(st_key, STATUS_CFG["ERROR"])
        cat    = r.get("category","")
        ccfg   = CAT_CFG.get(cat, {"color":MEDGR,"name":cat})
        s      = r.get("score")
        data   = r.get("data") or {}
        cmds   = r.get("commands") or []
        raw    = (r.get("raw_output") or "")

        block = []

        # Finding header
        hdr = Table([[
            P(f'<b>Hallazgo {idx:02d} — {r.get("name",r.get("module","?"))}</b>',
              st(fontName="Helvetica-Bold",fontSize=10,textColor=WHITE,leading=14)),
            P(f'<b>{cfg["label"]}</b>  ·  {ccfg["name"]}  ·  Score: {s if s is not None else "N/A"}',
              st(fontName="Helvetica",fontSize=8,textColor=colors.HexColor("#cbd5e1"),leading=12,alignment=TA_RIGHT)),
        ]], colWidths=[90*mm, 70*mm])
        hdr.setStyle(TableStyle([
            ("BACKGROUND",(0,0),(-1,-1),HDR_BG),
            ("LINEBEFORE",(0,0),(0,-1),5,cfg["bar"]),
            ("TOPPADDING",(0,0),(-1,-1),7),("BOTTOMPADDING",(0,0),(-1,-1),7),
            ("LEFTPADDING",(0,0),(-1,-1),8),("RIGHTPADDING",(0,0),(-1,-1),8),
        ]))
        block.append(hdr)

        # Detail rows
        details = []
        if data.get("open_ports"):
            details.append(("Puertos expuestos", "  ".join(str(p) for p in data["open_ports"][:20]), CRIT))
        if data.get("filtered_ports"):
            details.append(("Puertos filtrados", "  ".join(str(p) for p in data["filtered_ports"][:15]), MED))
        if data.get("services"):
            details.append(("Servicios detectados", " · ".join(data["services"][:8]), ACCENT))
        if data.get("os_matches"):
            details.append(("Sistema operativo", data["os_matches"][0], INFO))
        if data.get("vuln_count") or data.get("vulns"):
            vc = data.get("vuln_count") or len(data.get("vulns",[]))
            details.append(("Vulnerabilidades CVE", f"{vc} identificadas", CRIT))

        # Always show score + duration even if no detailed data
        dur = r.get("duration_ms")
        if dur:
            details.append(("Duración", f"{dur/1000:.1f}s", MEDGR))
        details.append(("Puntuación", f"{s}/100 — {score_label(s)}" if s is not None else "N/A", score_color(s)))
        if not [d for d in details if d[0] not in ("Puntuación","Duración")]:
            details.insert(0, ("Resultado", f"Módulo ejecutado — sin datos estructurados adicionales", MEDGR))

        drows = [[
            P(lbl, st(fontName="Helvetica",fontSize=8,textColor=MEDGR,leading=12)),
            P(f'<b>{val}</b>', st(fontName="Helvetica-Bold",fontSize=8.5,textColor=fg,leading=12)),
        ] for lbl, val, fg in details]
        dt = Table(drows, colWidths=[40*mm, 120*mm])
        dt.setStyle(TableStyle([
            ("BACKGROUND",(0,0),(-1,-1),BLUE_BG),
            ("LINEBELOW",(0,0),(-1,-1),0.3,BORDER),
            ("TOPPADDING",(0,0),(-1,-1),5),("BOTTOMPADDING",(0,0),(-1,-1),5),
            ("LEFTPADDING",(0,0),(-1,-1),8),
        ]))
        block.append(dt)

        # Command
        if cmds:
            cmd_tbl = Table([[
                P("$ ", st(fontName="Courier-Bold",fontSize=8,textColor=ACCENT,leading=11)),
                P(cmds[0][:110]+("…" if len(cmds[0])>110 else ""),
                  st(fontName="Courier",fontSize=8,textColor=DARKGR,leading=11)),
            ]], colWidths=[6*mm, 154*mm])
            cmd_tbl.setStyle(TableStyle([
                ("BACKGROUND",(0,0),(-1,-1),colors.HexColor("#f8fafc")),
                ("BOX",(0,0),(-1,-1),0.3,BORDER),
                ("TOPPADDING",(0,0),(-1,-1),5),("BOTTOMPADDING",(0,0),(-1,-1),5),
                ("LEFTPADDING",(0,0),(-1,-1),8),
            ]))
            block.append(cmd_tbl)

        # Raw output (first meaningful lines)
        if raw.strip():
            lines = [l.rstrip() for l in raw.strip().split('\n') if l.strip()][:10]
            if lines:
                raw_tbl = Table([[
                    P("\n".join(lines),
                      st(fontName="Courier",fontSize=7,textColor=colors.HexColor("#4b5563"),leading=10)),
                ]], colWidths=[160*mm])
                raw_tbl.setStyle(TableStyle([
                    ("BACKGROUND",(0,0),(-1,-1),colors.HexColor("#f9fafb")),
                    ("BOX",(0,0),(-1,-1),0.3,BORDER),
                    ("TOPPADDING",(0,0),(-1,-1),5),("BOTTOMPADDING",(0,0),(-1,-1),5),
                    ("LEFTPADDING",(0,0),(-1,-1),8),
                ]))
                block.append(raw_tbl)

        story.append(KeepTogether(block))
        story.append(Spacer(1, 5*mm))

# ── Recommendations ───────────────────────────────────────────────
RECS_DB = {
    "recon":       ("ALTA",    "Reducir superficie de ataque",
                    "Implementar firewall con política deny-all + allowlist. Cerrar puertos no necesarios. "
                    "Usar port-knocking para acceso a servicios de administración."),
    "fingerprint": ("ALTA",    "Ocultar información del sistema",
                    "Desactivar banners de versión en todos los servicios. Configurar cabeceras HTTP de seguridad "
                    "(Server, X-Powered-By). Implementar OS fingerprint obfuscation."),
    "brute_force": ("CRÍTICA", "Proteger contra ataques de credenciales",
                    "Habilitar autenticación multifactor (MFA). Configurar bloqueo de cuenta tras 5 intentos fallidos. "
                    "Implementar rate limiting y fail2ban. Usar claves SSH en lugar de contraseñas."),
    "web":         ("CRÍTICA", "Remediar vulnerabilidades de aplicación web",
                    "Desplegar Web Application Firewall (WAF). Sanitizar y validar todos los inputs. "
                    "Actualizar frameworks y dependencias. Configurar CSP, HSTS y X-Frame-Options."),
    "flood":       ("ALTA",    "Implementar protección DoS/DDoS",
                    "Habilitar SYN cookies en el kernel. Configurar rate limiting en el firewall perimetral. "
                    "Evaluar servicio de mitigación DDoS upstream (Cloudflare, Akamai)."),
    "protocol":    ("MEDIA",   "Endurecer protocolos de red",
                    "Deshabilitar protocolos legacy (Telnet, FTP, SNMPv1). Segmentar VLANs. "
                    "Habilitar Dynamic ARP Inspection y DHCP Snooping."),
    "evasion":     ("MEDIA",   "Mejorar capacidades de detección",
                    "Actualizar firmas de IDS/IPS. Habilitar deep packet inspection. "
                    "Revisar reglas de anomalía TTL y detección de técnicas de evasión."),
    "dns":         ("ALTA",    "Asegurar infraestructura DNS",
                    "Implementar DNSSEC. Restringir transferencias de zona. "
                    "Configurar Response Policy Zones (RPZ) para filtrado de dominios maliciosos."),
    "firewall":    ("MEDIA",   "Revisar y endurecer política de firewall",
                    "Auditar todas las ACLs y eliminar reglas permisivas innecesarias. "
                    "Aplicar principio de mínimo privilegio. Documentar cada regla con justificación."),
}

PRIO_ORDER = {"CRÍTICA":0,"ALTA":1,"MEDIA":2,"BAJA":3}
PRIO_CFG   = {"CRÍTICA":(CRIT,CRIT_BG),"ALTA":(HIGH,HIGH_BG),"MEDIA":(MED,MED_BG),"BAJA":(LOW,LOW_BG)}

def recommendations(story, results):
    story.append(PageBreak())
    story.append(P("4. Recomendaciones de Remediación", SECTION))
    story.append(HRFlowable(width="100%", thickness=1, color=ACCENT, spaceAfter=4))
    story.append(P(
        "Las siguientes recomendaciones están priorizadas en función de los hallazgos obtenidos "
        "durante la evaluación. Se sugiere abordarlas en el orden indicado.",
        BODY))
    story.append(Spacer(1, 3*mm))

    recs, seen_cats = [], set()
    for r in results:
        if r.get("status") not in ("PASSED","PARTIAL","DETECTED"): continue
        cat  = r.get("category","")
        name = r.get("name",r.get("module","?"))
        if cat in seen_cats: continue
        seen_cats.add(cat)
        if cat in RECS_DB:
            p, title, detail = RECS_DB[cat]
            recs.append((p, title, detail, name))
        else:
            recs.append(("MEDIA", f"Revisar configuración de {name}",
                         "Aplicar hardening según CIS Benchmark para el componente afectado. "
                         "Consultar la guía de seguridad del fabricante.", name))

    if not recs:
        recs.append(("BAJA","Mantener y monitorizar postura actual",
                     "Continuar con escaneos periódicos. Mantener todos los sistemas actualizados "
                     "y revisar logs de seguridad regularmente.", "—"))

    recs.sort(key=lambda x: PRIO_ORDER.get(x[0],9))

    for i, (prio, title, detail, module_name) in enumerate(recs, 1):
        fg, bg = PRIO_CFG.get(prio, (MEDGR, LIGHTGR))
        lbl_st = st(fontName="Helvetica-Bold",fontSize=8,textColor=fg,leading=10,alignment=TA_CENTER)
        rec_t  = Table([[
            Table([[P(prio,lbl_st)],[P(f"#{i}",CAPTION)]], colWidths=[18*mm]),
            P(f'<b>{title}</b><br/><font size="8" color="#6b7280">Módulo: {module_name}</font><br/><br/>{detail}',
              st(fontName="Helvetica",fontSize=8.5,textColor=DARKGR,leading=13)),
        ]], colWidths=[20*mm, 140*mm])
        rec_t.setStyle(TableStyle([
            ("BACKGROUND",(0,0),(-1,-1),bg),
            ("BACKGROUND",(0,0),(0,-1),colors.white),
            ("LINEBEFORE",(0,0),(0,-1),4,fg),
            ("BOX",(0,0),(-1,-1),0.3,fg),
            ("TOPPADDING",(0,0),(-1,-1),8),("BOTTOMPADDING",(0,0),(-1,-1),8),
            ("LEFTPADDING",(0,0),(-1,-1),7),("RIGHTPADDING",(0,0),(-1,-1),7),
            ("VALIGN",(0,0),(-1,-1),"TOP"),("ALIGN",(0,0),(0,-1),"CENTER"),
        ]))
        story.append(rec_t)
        story.append(Spacer(1, 2.5*mm))

# ── Commands appendix ─────────────────────────────────────────────
def commands_appendix(story, results):
    with_cmds = [r for r in results if r.get("commands")]
    if not with_cmds: return
    story.append(PageBreak())
    story.append(P("Apéndice A — Comandos Ejecutados", SECTION))
    story.append(HRFlowable(width="100%", thickness=1, color=ACCENT, spaceAfter=4))
    story.append(P("Listado completo de comandos ejecutados durante la evaluación de seguridad.", BODY))
    story.append(Spacer(1, 3*mm))
    for r in with_cmds:
        story.append(P(f'<b>{r.get("name","?")}</b>  '
            f'<font color="#6b7280" size="8">{fmt_time(r.get("timestamp",""))}</font>', SUBSECT))
        for cmd in r.get("commands",[]):
            story.append(P(f'$ {cmd}', MONO_CMD))
        story.append(Spacer(1, 2*mm))

# ── Main ──────────────────────────────────────────────────────────
def generate_pdf(target, score, results, date_str=None):
    if date_str is None:
        date_str = datetime.now().strftime("%d/%m/%Y %H:%M")

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
        leftMargin=15*mm, rightMargin=15*mm,
        topMargin=16*mm, bottomMargin=13*mm,
        title=f"NetProbe Report — {target}",
        author="NetProbe Security Suite",
        subject="Security Audit Report",
    )
    page_cb = make_cb(target, date_str)
    cover_bg = make_cover_cb(target, date_str, score)

    def combined_cb(canvas, doc):
        if doc.page == 1: cover_bg(canvas, doc)
        else: page_cb(canvas, doc)

    story = []
    cover(story, target, score, date_str, results)
    exec_summary(story, results, score, target)
    results_table(story, results)
    findings(story, results)
    recommendations(story, results)
    commands_appendix(story, results)

    doc.build(story, onFirstPage=combined_cb, onLaterPages=combined_cb)
    buf.seek(0)
    return buf.read()

def register_pdf_routes(app):
    from fastapi import Response
    from pydantic import BaseModel

    class PDFRequest(BaseModel):
        target:   str  = "N/A"
        score:    int  = 0
        results:  list = []
        date_str: str  = ""

    @app.post("/api/report/pdf")
    async def generate_report(req: PDFRequest):
        try:
            pdf   = generate_pdf(req.target or "N/A", req.score, req.results, req.date_str or None)
            fname = f"netprobe-{(req.target or 'report').replace('.','_')}-{datetime.now().strftime('%Y%m%d')}.pdf"
            return Response(content=pdf, media_type="application/pdf",
                headers={"Content-Disposition": f'attachment; filename="{fname}"'})
        except Exception as e:
            import traceback
            return Response(content=f"Error generando PDF: {e}\n{traceback.format_exc()}",
                media_type="text/plain", status_code=500)
