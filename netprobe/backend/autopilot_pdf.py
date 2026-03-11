"""
NetProbe - Autopilot PDF Report Generator
Informe PDF específico para resultados del modo Full Auto.
"""
import hashlib as _hashlib
_orig_md5 = _hashlib.md5
def _patched_md5(*a, **kw): kw.pop("usedforsecurity",None); return _orig_md5(*a,**kw)
_hashlib.md5 = _patched_md5

import io, json, re, asyncio
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

# ── Palette ────────────────────────────────────────────────────────
WHITE   = colors.white
BLACK   = colors.HexColor("#1a1a2e")
DARKGR  = colors.HexColor("#2d2d44")
MEDGR   = colors.HexColor("#6b7280")
LIGHTGR = colors.HexColor("#f3f4f6")
BORDER  = colors.HexColor("#e5e7eb")
ACCENT  = colors.HexColor("#1e40af")
ACCENT2 = colors.HexColor("#0ea5e9")
CRIT    = colors.HexColor("#dc2626")
HIGH    = colors.HexColor("#ea580c")
MED     = colors.HexColor("#d97706")
LOW     = colors.HexColor("#16a34a")
INFO    = colors.HexColor("#0891b2")
PURPLE  = colors.HexColor("#7c3aed")
CRIT_BG = colors.HexColor("#fef2f2")
HIGH_BG = colors.HexColor("#fff7ed")
MED_BG  = colors.HexColor("#fffbeb")
LOW_BG  = colors.HexColor("#f0fdf4")
BLUE_BG = colors.HexColor("#eff6ff")
PUR_BG  = colors.HexColor("#f5f3ff")
HDR_BG  = colors.HexColor("#1e3a5f")
COVER_DARK = colors.HexColor("#0f2040")

def P(txt, style):
    s = str(txt) if txt is not None else ""
    # Strip emoji that ReportLab can't render and escape XML chars
    s = s.replace("🧠","[IA]").replace("⚠","[!]").replace("🚀","[>]").replace("⏭","[>>]")
    s = s.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;") if not s.startswith("<") else s
    return Paragraph(s, style)
def st(**kw):      return ParagraphStyle("x", **kw)

SECTION  = st(fontName="Helvetica-Bold",fontSize=12,textColor=HDR_BG,leading=16,spaceBefore=6,spaceAfter=3)
SUBSECT  = st(fontName="Helvetica-Bold",fontSize=10,textColor=DARKGR,leading=14,spaceBefore=4,spaceAfter=2)
BODY     = st(fontName="Helvetica",fontSize=9,textColor=DARKGR,leading=14,spaceAfter=3,alignment=TA_JUSTIFY)
BODY_SM  = st(fontName="Helvetica",fontSize=8,textColor=MEDGR,leading=12,spaceAfter=2)
TABLE_HDR= st(fontName="Helvetica-Bold",fontSize=8,textColor=WHITE,leading=11)
MONO     = st(fontName="Courier",fontSize=7,textColor=colors.HexColor("#374151"),leading=10,spaceAfter=1)
MONO_CMD = st(fontName="Courier",fontSize=7.5,textColor=ACCENT,leading=11)
CAPTION  = st(fontName="Helvetica",fontSize=7,textColor=MEDGR,leading=10)
AI_STYLE = st(fontName="Helvetica",fontSize=8.5,textColor=colors.HexColor("#4c1d95"),leading=13,spaceAfter=2,alignment=TA_JUSTIFY)

RISK_CFG = {
    "LOW":      {"color":LOW,    "bg":LOW_BG,  "label":"Bajo"},
    "MEDIUM":   {"color":MED,    "bg":MED_BG,  "label":"Medio"},
    "HIGH":     {"color":HIGH,   "bg":HIGH_BG, "label":"Alto"},
    "CRITICAL": {"color":CRIT,   "bg":CRIT_BG, "label":"Crítico"},
}

CAT_NAMES = {
    "recon":"Reconocimiento","fingerprint":"Fingerprinting",
    "flood":"Flood/DoS","brute_force":"Fuerza Bruta",
    "protocol":"Protocolo","web":"Web Attacks",
    "dns":"DNS","evasion":"Evasión","firewall":"Firewall",
}

def _status_color(s):
    s = (s or "").upper()
    if s in ("SUCCESS","OK","DETECTED"):      return MED
    if s in ("ERROR","TIMEOUT"):              return CRIT
    if "BLOCK" in s:                          return LOW
    return MEDGR

def _fmt_dur(ms):
    if not ms: return "—"
    return f"{ms/1000:.1f}s"

# ── Page headers/footers ───────────────────────────────────────────
def _make_cb(target, date_str):
    def cb(canvas, doc):
        if doc.page == 1: return
        canvas.saveState()
        canvas.setFillColor(HDR_BG)
        canvas.rect(0, H-11*mm, W, 11*mm, fill=1, stroke=0)
        canvas.setFillColor(ACCENT2)
        canvas.rect(0, H-11*mm, 4*mm, 11*mm, fill=1, stroke=0)
        canvas.setFont("Helvetica-Bold", 7.5)
        canvas.setFillColor(WHITE)
        canvas.drawString(9*mm, H-5.5*mm, "NetProbe Security Suite — Informe Autopilot Full Auto")
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(colors.HexColor("#94a3b8"))
        canvas.drawString(9*mm, H-9.5*mm, f"Target: {target}  ·  {date_str}")
        canvas.setFont("Helvetica-Bold", 7)
        canvas.setFillColor(colors.HexColor("#fca5a5"))
        canvas.drawRightString(W-7*mm, H-5.5*mm, "CONFIDENCIAL")
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(colors.HexColor("#94a3b8"))
        canvas.drawRightString(W-7*mm, H-9.5*mm, f"Página {doc.page}")
        canvas.setFillColor(BORDER)
        canvas.rect(0, 9*mm, W, 0.3*mm, fill=1, stroke=0)
        canvas.setFont("Helvetica", 6)
        canvas.setFillColor(MEDGR)
        canvas.drawCentredString(W/2, 3.5*mm,
            "Documento confidencial · NetProbe Security Suite · Uso exclusivo en redes propias o con autorización expresa")
        canvas.restoreState()
    return cb

def _make_cover_cb(target, date_str, cycles, total_actions):
    def cb(canvas, doc):
        if doc.page != 1: return
        canvas.saveState()
        canvas.setFillColor(HDR_BG)
        canvas.rect(0, 0, W, H, fill=1, stroke=0)
        canvas.setFillColor(ACCENT2)
        canvas.rect(0, 0, 8*mm, H, fill=1, stroke=0)
        canvas.setStrokeColor(colors.HexColor("#1e4a7a"))
        canvas.setLineWidth(0.3)
        for i in range(0, int(W*3), 20):
            canvas.line(i*mm/3, 0, i*mm/3, H)
        canvas.setFillColor(COVER_DARK)
        canvas.rect(0, 0, W, H*0.4, fill=1, stroke=0)
        # Stats circles bottom right
        for idx, (val, lbl) in enumerate([(str(cycles), "ciclos"), (str(total_actions), "acciones")]):
            cx = W - (40+idx*50)*mm/2
            cy = 55*mm
            canvas.setStrokeColor(colors.HexColor("#1e3a5f"))
            canvas.setLineWidth(5)
            canvas.circle(cx, cy, 20*mm, stroke=1, fill=0)
            canvas.setStrokeColor(PURPLE if idx==0 else ACCENT2)
            canvas.setLineWidth(5)
            canvas.circle(cx, cy, 20*mm, stroke=1, fill=0)
            canvas.setFont("Helvetica-Bold", 18)
            canvas.setFillColor(PURPLE if idx==0 else ACCENT2)
            canvas.drawCentredString(cx, cy+2, val)
            canvas.setFont("Helvetica", 8)
            canvas.setFillColor(colors.HexColor("#94a3b8"))
            canvas.drawCentredString(cx, cy-14, lbl)
        canvas.setFont("Helvetica-Bold", 7)
        canvas.setFillColor(colors.HexColor("#fca5a5"))
        canvas.drawRightString(W-7*mm, H-8*mm, "CONFIDENCIAL")
        canvas.restoreState()
    return cb

# ── Cover page ─────────────────────────────────────────────────────
def _cover(story, target, date_str, cycles, total_actions, total_modules, total_commands):
    COVER_EYE  = st(fontName="Helvetica-Bold",fontSize=9,textColor=ACCENT2,leading=12,spaceBefore=0,spaceAfter=0)
    COVER_TTL  = st(fontName="Helvetica-Bold",fontSize=26,textColor=WHITE,leading=30,spaceBefore=4,spaceAfter=0)
    COVER_SUB  = st(fontName="Helvetica",fontSize=11,textColor=colors.HexColor("#94a3b8"),leading=15,spaceAfter=0)
    COVER_MK   = st(fontName="Helvetica",fontSize=8.5,textColor=colors.HexColor("#64748b"),leading=13)
    COVER_MV   = st(fontName="Helvetica-Bold",fontSize=8.5,textColor=WHITE,leading=13)

    story.append(Spacer(1, 38*mm))
    story.append(P("NETPROBE FULL AUTO", COVER_EYE))
    story.append(Spacer(1, 3*mm))
    story.append(P("Informe Autopilot", COVER_TTL))
    story.append(Spacer(1, 3*mm))
    story.append(P("Análisis autónomo de seguridad con decisiones en tiempo real por IA", COVER_SUB))
    story.append(Spacer(1, 8*mm))

    def mrow(k, v):
        return [P(k, COVER_MK), P(v, COVER_MV)]

    mt = Table([
        mrow("Target", target or "N/A"),
        mrow("Fecha", date_str),
        mrow("Ciclos completados", str(cycles)),
        mrow("Acciones totales", f"{total_modules} módulos + {total_commands} comandos"),
    ], colWidths=[40*mm, 100*mm])
    mt.setStyle(TableStyle([
        ("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),0),
        ("TOPPADDING",(0,0),(-1,-1),4),("BOTTOMPADDING",(0,0),(-1,-1),4),
        ("LINEBELOW",(0,0),(-1,-1),0.3,colors.HexColor("#1e4a7a")),
    ]))
    story.append(mt)
    story.append(Spacer(1, 90*mm))
    story.append(P(
        "Documento generado automáticamente por NetProbe Security Suite. "
        "Contenido confidencial — uso exclusivo en redes propias o con autorización expresa.",
        st(fontName="Helvetica",fontSize=7,textColor=colors.HexColor("#475569"),leading=10)))
    story.append(PageBreak())

# ── Executive summary ──────────────────────────────────────────────
def _exec_summary(story, target, all_results, ai_summary, cycles):
    story.append(P("1. Resumen Ejecutivo", SECTION))
    story.append(HRFlowable(width="100%", thickness=1, color=ACCENT, spaceAfter=4))

    mods  = [r for r in all_results if r.get("type") == "module"]
    cmds  = [r for r in all_results if r.get("type") == "command"]
    errs  = [r for r in all_results if r.get("status","").upper() in ("ERROR","TIMEOUT")]
    ports = []
    for r in mods:
        ports.extend(r.get("data",{}).get("open_ports",[]))
    ports = list(dict.fromkeys(ports))

    story.append(P(
        f'El análisis Full Auto sobre el objetivo <b>{target}</b> completó <b>{cycles} ciclos</b> '
        f'ejecutando <b>{len(mods)} módulos</b> y <b>{len(cmds)} comandos personalizados</b>. '
        f'Se identificaron <b>{len(ports)} puertos expuestos</b> y {len(errs)} acciones fallidas.',
        BODY))
    story.append(Spacer(1, 3*mm))

    if ai_summary:
        ai_box = Table([[
            P("🧠", st(fontName="Helvetica",fontSize=14,textColor=PURPLE,leading=16)),
            P(f'<b>Análisis IA</b><br/>{ai_summary}',
              st(fontName="Helvetica",fontSize=8.5,textColor=colors.HexColor("#4c1d95"),leading=13)),
        ]], colWidths=[10*mm, 150*mm])
        ai_box.setStyle(TableStyle([
            ("BACKGROUND",(0,0),(-1,-1),PUR_BG),
            ("LINEBEFORE",(0,0),(0,-1),4,PURPLE),
            ("BOX",(0,0),(-1,-1),0.4,PURPLE),
            ("TOPPADDING",(0,0),(-1,-1),8),("BOTTOMPADDING",(0,0),(-1,-1),8),
            ("LEFTPADDING",(0,0),(-1,-1),8),("RIGHTPADDING",(0,0),(-1,-1),8),
            ("VALIGN",(0,0),(-1,-1),"TOP"),
        ]))
        story.append(ai_box)
        story.append(Spacer(1, 4*mm))

    if ports:
        ports_box = Table([[
            P("⚠", st(fontName="Helvetica",fontSize=12,textColor=HIGH,leading=14)),
            P(f'<b>Puertos expuestos encontrados:</b> {", ".join(str(p) for p in ports[:20])}',
              st(fontName="Helvetica",fontSize=8.5,textColor=DARKGR,leading=13)),
        ]], colWidths=[10*mm, 150*mm])
        ports_box.setStyle(TableStyle([
            ("BACKGROUND",(0,0),(-1,-1),HIGH_BG),
            ("LINEBEFORE",(0,0),(0,-1),4,HIGH),
            ("BOX",(0,0),(-1,-1),0.4,HIGH),
            ("TOPPADDING",(0,0),(-1,-1),7),("BOTTOMPADDING",(0,0),(-1,-1),7),
            ("LEFTPADDING",(0,0),(-1,-1),8),
        ]))
        story.append(ports_box)
        story.append(Spacer(1, 4*mm))

    story.append(Spacer(1, 4*mm))

# ── Cycles detail ──────────────────────────────────────────────────
def _cycles_section(story, all_results, cycle_analyses):
    story.append(PageBreak())
    story.append(P("2. Detalle por Ciclo", SECTION))
    story.append(HRFlowable(width="100%", thickness=1, color=ACCENT, spaceAfter=4))

    by_cycle = {}
    for r in all_results:
        c = r.get("cycle", 0)
        by_cycle.setdefault(c, []).append(r)

    for cycle_num in sorted(by_cycle.keys()):
        entries    = by_cycle[cycle_num]
        ai_anal    = cycle_analyses.get(cycle_num, "")
        risk_level = "MEDIUM"
        for e in entries:
            if e.get("risk_level"): risk_level = e["risk_level"]; break

        rcfg = RISK_CFG.get(risk_level, RISK_CFG["MEDIUM"])

        block = []

        # Cycle header
        cyc_hdr = Table([[
            P(f'<b>Ciclo {cycle_num}</b>',
              st(fontName="Helvetica-Bold",fontSize=10,textColor=WHITE,leading=14)),
            P(f'{len(entries)} acción(es) · Riesgo: {rcfg["label"]}',
              st(fontName="Helvetica",fontSize=8,textColor=colors.HexColor("#cbd5e1"),leading=12,alignment=TA_RIGHT)),
        ]], colWidths=[80*mm, 80*mm])
        cyc_hdr.setStyle(TableStyle([
            ("BACKGROUND",(0,0),(-1,-1),HDR_BG),
            ("LINEBEFORE",(0,0),(0,-1),5,rcfg["color"]),
            ("TOPPADDING",(0,0),(-1,-1),7),("BOTTOMPADDING",(0,0),(-1,-1),7),
            ("LEFTPADDING",(0,0),(-1,-1),10),("RIGHTPADDING",(0,0),(-1,-1),8),
        ]))
        block.append(cyc_hdr)

        # AI analysis for this cycle
        if ai_anal:
            ai_row = Table([[
                P("🧠 Análisis IA:", st(fontName="Helvetica-Bold",fontSize=7.5,textColor=PURPLE,leading=11)),
                P(ai_anal, st(fontName="Helvetica",fontSize=8,textColor=colors.HexColor("#4c1d95"),leading=12,alignment=TA_JUSTIFY)),
            ]], colWidths=[28*mm, 132*mm])
            ai_row.setStyle(TableStyle([
                ("BACKGROUND",(0,0),(-1,-1),PUR_BG),
                ("TOPPADDING",(0,0),(-1,-1),6),("BOTTOMPADDING",(0,0),(-1,-1),6),
                ("LEFTPADDING",(0,0),(-1,-1),8),("RIGHTPADDING",(0,0),(-1,-1),8),
                ("VALIGN",(0,0),(-1,-1),"TOP"),
            ]))
            block.append(ai_row)

        # Each action in cycle
        for entry in entries:
            etype = entry.get("type","")
            if etype == "module":
                block.append(_module_row(entry))
            elif etype == "command":
                block.append(_command_row(entry))

        block.append(Spacer(1, 4*mm))
        story.append(KeepTogether(block[:3]))  # keep header + AI + first item together
        for item in block[3:]:
            story.append(item)

# ── Module row ─────────────────────────────────────────────────────
def _module_row(r):
    status = r.get("status","?")
    sc     = _status_color(status)
    data   = r.get("data") or {}
    ports  = data.get("open_ports",[])
    svcs   = data.get("services",[])
    os_m   = data.get("os_matches",[])
    dur    = _fmt_dur(r.get("duration_ms"))
    cat    = CAT_NAMES.get(r.get("category",""), r.get("category",""))
    ai_txt = r.get("ai_analysis","")

    details = []
    if ports: details.append(f"Puertos: {', '.join(str(p) for p in ports[:12])}")
    if svcs:  details.append(f"Servicios: {', '.join(svcs[:5])}")
    if os_m:  details.append(f"OS: {os_m[0]}")

    detail_str = "  |  ".join(details) if details else "Sin datos adicionales"

    rows = [
        [P(f'<b>{r.get("name", r.get("module","?"))}</b>',
           st(fontName="Helvetica-Bold",fontSize=8.5,textColor=BLACK,leading=12)),
         P(cat, st(fontName="Helvetica",fontSize=8,textColor=ACCENT,leading=11)),
         P(f'<b>{status}</b>', st(fontName="Helvetica-Bold",fontSize=8,textColor=sc,leading=11)),
         P(dur, CAPTION)],
    ]
    if detail_str:
        rows.append([
            P(detail_str, st(fontName="Helvetica",fontSize=7.5,textColor=MEDGR,leading=11)),
            "", "", "",
        ])
    if ai_txt:
        rows.append([
            P(f'🧠 {ai_txt}', st(fontName="Helvetica",fontSize=7.5,textColor=colors.HexColor("#6d28d9"),leading=11)),
            "", "", "",
        ])

    spans = [("SPAN",(0,1),(3,1))] if detail_str else []
    if ai_txt: spans.append(("SPAN",(0,len(rows)-1),(3,len(rows)-1)))

    t = Table(rows, colWidths=[65*mm, 35*mm, 30*mm, 30*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1),colors.HexColor("#f9fafb")),
        ("LINEBEFORE",(0,0),(0,-1),3,sc),
        ("GRID",(0,0),(-1,-1),0.2,BORDER),
        ("TOPPADDING",(0,0),(-1,-1),4),("BOTTOMPADDING",(0,0),(-1,-1),4),
        ("LEFTPADDING",(0,0),(-1,-1),7),
        *spans,
    ]))
    return t

# ── Command row ────────────────────────────────────────────────────
def _command_row(r):
    rc      = r.get("rc", -1)
    ok      = rc == 0
    col     = LOW if ok else CRIT
    output  = (r.get("output") or "").strip()
    lines   = [l.rstrip() for l in output.split("\n") if l.strip()][:8]
    dur     = _fmt_dur(r.get("duration_ms"))
    ai_txt  = r.get("ai_analysis","")

    block_rows = [
        [P(f'<b>$ {r.get("label","Comando")}</b>',
           st(fontName="Helvetica-Bold",fontSize=8.5,textColor=BLACK,leading=12)),
         P(f'rc={rc}', st(fontName="Helvetica-Bold",fontSize=8,textColor=col,leading=11)),
         P(dur, CAPTION)],
        [P(r.get("cmd",""),
           st(fontName="Courier",fontSize=7,textColor=ACCENT,leading=10)),
         "",""],
    ]
    spans = [("SPAN",(0,1),(2,1))]

    if lines:
        block_rows.append([
            P("\n".join(lines[:8]),
              st(fontName="Courier",fontSize=6.5,textColor=DARKGR,leading=9)),
            "", "",
        ])
        spans.append(("SPAN",(0,2),(2,2)))

    if ai_txt:
        block_rows.append([
            P(f'🧠 {ai_txt}', st(fontName="Helvetica",fontSize=7.5,textColor=colors.HexColor("#6d28d9"),leading=11)),
            "", "",
        ])
        spans.append(("SPAN",(0,len(block_rows)-1),(2,len(block_rows)-1)))

    t = Table(block_rows, colWidths=[120*mm, 22*mm, 18*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1),colors.HexColor("#fffbeb")),
        ("LINEBEFORE",(0,0),(0,-1),3,MED),
        ("GRID",(0,0),(-1,-1),0.2,BORDER),
        ("TOPPADDING",(0,0),(-1,-1),4),("BOTTOMPADDING",(0,0),(-1,-1),4),
        ("LEFTPADDING",(0,0),(-1,-1),7),
        *spans,
    ]))
    return t

# ── Findings summary table ─────────────────────────────────────────
def _findings_table(story, all_results):
    mods = [r for r in all_results if r.get("type") == "module"]
    if not mods: return

    story.append(PageBreak())
    story.append(P("3. Tabla Resumen de Módulos", SECTION))
    story.append(HRFlowable(width="100%", thickness=1, color=ACCENT, spaceAfter=4))

    rows = [[
        P("<b>Ciclo</b>", TABLE_HDR),
        P("<b>Módulo</b>", TABLE_HDR),
        P("<b>Categoría</b>", TABLE_HDR),
        P("<b>Estado</b>", TABLE_HDR),
        P("<b>Puertos</b>", TABLE_HDR),
        P("<b>Duración</b>", TABLE_HDR),
    ]]
    styles = [
        ("BACKGROUND",(0,0),(-1,0),HDR_BG),
        ("GRID",(0,0),(-1,-1),0.3,BORDER),
        ("TOPPADDING",(0,0),(-1,-1),4),("BOTTOMPADDING",(0,0),(-1,-1),4),
        ("LEFTPADDING",(0,0),(-1,-1),6),
        ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
    ]
    for i, r in enumerate(mods):
        sc   = _status_color(r.get("status",""))
        ports= r.get("data",{}).get("open_ports",[])
        bg   = colors.HexColor("#f9fafb") if i%2==0 else WHITE
        styles += [("BACKGROUND",(0,i+1),(-1,i+1),bg)]
        rows.append([
            P(str(r.get("cycle","?")), CAPTION),
            P(f'<b>{r.get("name",r.get("module","?"))}</b>',
              st(fontName="Helvetica-Bold",fontSize=8,textColor=BLACK,leading=11)),
            P(CAT_NAMES.get(r.get("category",""),r.get("category","")),
              st(fontName="Helvetica",fontSize=7.5,textColor=ACCENT,leading=10)),
            P(f'<b>{r.get("status","?")}</b>',
              st(fontName="Helvetica-Bold",fontSize=8,textColor=sc,leading=11)),
            P(", ".join(str(p) for p in ports[:6]) or "—", CAPTION),
            P(_fmt_dur(r.get("duration_ms")), CAPTION),
        ])

    tbl = Table(rows, colWidths=[14*mm, 55*mm, 32*mm, 24*mm, 22*mm, 13*mm], repeatRows=1)
    tbl.setStyle(TableStyle(styles))
    story.append(tbl)
    story.append(Spacer(1, 6*mm))

# ── Commands appendix ──────────────────────────────────────────────
def _commands_appendix(story, all_results):
    cmds = [r for r in all_results if r.get("type") == "command"]
    if not cmds: return

    story.append(PageBreak())
    story.append(P("Apéndice — Comandos Personalizados Ejecutados por la IA", SECTION))
    story.append(HRFlowable(width="100%", thickness=1, color=ACCENT, spaceAfter=4))
    story.append(P(
        "Listado de comandos shell generados y ejecutados autónomamente por la IA durante el análisis.",
        BODY))
    story.append(Spacer(1, 3*mm))

    for r in cmds:
        ok  = (r.get("rc") or -1) == 0
        col = LOW if ok else CRIT
        story.append(P(
            f'<b>Ciclo {r.get("cycle","?")} · {r.get("label","Comando")}</b>'
            f'  <font color="#6b7280" size="7">rc={r.get("rc","?")} · {_fmt_dur(r.get("duration_ms"))}</font>',
            SUBSECT))
        story.append(P(f'$ {r.get("cmd","")}', MONO_CMD))
        output = (r.get("output") or "").strip()
        if output:
            lines = [l.rstrip() for l in output.split("\n") if l.strip()][:12]
            story.append(P("\n".join(lines), MONO))
        if r.get("ai_analysis"):
            story.append(P(f'🧠 {r["ai_analysis"]}', AI_STYLE))
        story.append(Spacer(1, 3*mm))

# ── AI Analysis via Groq ───────────────────────────────────────────
async def _ask_groq_analysis(prompt, api_key, model="llama-3.3-70b-versatile"):
    try:
        import httpx
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "model": model,
                    "messages": [{"role":"user","content":prompt}],
                    "max_tokens": 600,
                    "temperature": 0.2,
                },
            )
            d = r.json()
            return d["choices"][0]["message"]["content"].strip()
    except Exception as e:
        return f"[Error IA: {e}]"

async def analyze_autopilot_results(all_results, target, api_key, model="llama-3.3-70b-versatile"):
    """
    Genera análisis IA para:
    - Resumen global
    - Cada ciclo (basado en los resultados de ese ciclo)
    - Cada módulo/comando (qué encontró, qué significa)
    """
    if not api_key:
        return {}, {}, ""

    # 1. Resumen global
    context_lines = []
    by_cycle = {}
    for r in all_results:
        c = r.get("cycle",0)
        by_cycle.setdefault(c,[]).append(r)
        name   = r.get("name",r.get("module",r.get("label","?")))
        status = r.get("status","?")
        ports  = r.get("data",{}).get("open_ports",[])
        out    = r.get("output","")[:150] if r.get("type")=="command" else ""
        line   = f"  [{r.get('type','?')}] {name}: {status}"
        if ports: line += f" | puertos: {','.join(str(p) for p in ports[:6])}"
        if out:   line += f" | salida: {out[:100]}"
        context_lines.append(line)

    global_prompt = (
        f"Eres un experto en ciberseguridad. Analiza los resultados de un test de penetración automático sobre {target}:\n\n"
        + "\n".join(context_lines[:40])
        + "\n\nEscribe un párrafo ejecutivo conciso (3-4 frases) resumiendo: qué se encontró, el nivel de riesgo general, y la recomendación principal. Sin listas, solo texto."
    )
    global_summary = await _ask_groq_analysis(global_prompt, api_key, model)

    # 2. Análisis por ciclo
    cycle_analyses = {}
    for cycle_num, entries in by_cycle.items():
        lines = []
        for r in entries:
            name   = r.get("name",r.get("module",r.get("label","?")))
            status = r.get("status","?")
            ports  = r.get("data",{}).get("open_ports",[])
            out    = r.get("output","")[:200] if r.get("type")=="command" else ""
            l = f"  {name}: {status}"
            if ports: l += f" | puertos: {','.join(str(p) for p in ports[:6])}"
            if out:   l += f" | salida: {out[:120]}"
            lines.append(l)

        prompt = (
            f"Ciclo {cycle_num} de pentest sobre {target}. Resultados:\n"
            + "\n".join(lines)
            + "\n\nEn 1-2 frases: ¿qué reveló este ciclo y qué implica para la seguridad del objetivo? Directo y técnico."
        )
        cycle_analyses[cycle_num] = await _ask_groq_analysis(prompt, api_key, model)

    # 3. Análisis por acción individual
    action_analyses = {}
    for r in all_results:
        rtype  = r.get("type","")
        name   = r.get("name",r.get("module",r.get("label","?")))
        status = r.get("status","?")
        ports  = r.get("data",{}).get("open_ports",[])
        svcs   = r.get("data",{}).get("services",[])
        os_m   = r.get("data",{}).get("os_matches",[])
        output = r.get("output","")[:300] if rtype=="command" else ""

        if rtype == "module":
            details = ""
            if ports: details += f"Puertos abiertos: {','.join(str(p) for p in ports[:8])}. "
            if svcs:  details += f"Servicios: {','.join(svcs[:4])}. "
            if os_m:  details += f"OS: {os_m[0]}. "
            if not details: details = f"Estado: {status}."

            prompt = (
                f"Módulo de pentest '{name}' ejecutado contra {target}. {details}\n"
                f"En 1 frase técnica: ¿qué significa este resultado para la seguridad del objetivo?"
            )
        elif rtype == "command":
            rc = r.get("rc","?")
            prompt = (
                f"Comando ejecutado contra {target}: {r.get('cmd','')[:100]}\n"
                f"Código de retorno: {rc}\n"
                f"Salida (primeras líneas): {output[:200]}\n"
                f"En 1 frase técnica: ¿qué revela esta salida sobre la seguridad del objetivo?"
            )
        else:
            continue

        key = f"{r.get('cycle','0')}_{rtype}_{name}"
        action_analyses[key] = await _ask_groq_analysis(prompt, api_key, model)

    return cycle_analyses, action_analyses, global_summary

def generate_autopilot_pdf(target, all_results, cycle_analyses, action_analyses,
                            global_summary, cycles_done, date_str=None):
    if not date_str:
        date_str = datetime.now().strftime("%d/%m/%Y %H:%M")

    # Attach AI analyses to individual results
    enriched = []
    for r in all_results:
        rc = r.copy()
        rtype = r.get("type","")
        name  = r.get("name",r.get("module",r.get("label","?")))
        key   = f"{r.get('cycle','0')}_{rtype}_{name}"
        rc["ai_analysis"] = action_analyses.get(key, "")
        enriched.append(rc)

    mods = [r for r in enriched if r.get("type") == "module"]
    cmds = [r for r in enriched if r.get("type") == "command"]

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
        leftMargin=15*mm, rightMargin=15*mm, topMargin=16*mm, bottomMargin=13*mm,
        title=f"NetProbe Autopilot — {target}", author="NetProbe Security Suite",
    )

    page_cb  = _make_cb(target, date_str)
    cover_cb = _make_cover_cb(target, date_str, cycles_done, len(enriched))

    def combined_cb(canvas, doc):
        if doc.page == 1: cover_cb(canvas, doc)
        else: page_cb(canvas, doc)

    story = []
    _cover(story, target, date_str, cycles_done, len(enriched), len(mods), len(cmds))
    _exec_summary(story, target, enriched, global_summary, cycles_done)
    _cycles_section(story, enriched, cycle_analyses)
    _findings_table(story, enriched)
    _commands_appendix(story, enriched)

    doc.build(story, onFirstPage=combined_cb, onLaterPages=combined_cb)
    buf.seek(0)
    return buf.read()


def register_autopilot_pdf_routes(app):
    from fastapi import Response
    from pydantic import BaseModel

    class AutopilotPDFRequest(BaseModel):
        target:      str  = "N/A"
        results:     list = []
        cycles_done: int  = 0
        api_key:     str  = ""
        model:       str  = "llama-3.3-70b-versatile"
        date_str:    str  = ""

    @app.post("/api/autopilot/pdf")
    async def autopilot_pdf_report(req: AutopilotPDFRequest):
        try:
            cycle_analyses, action_analyses, global_summary = await analyze_autopilot_results(
                req.results, req.target, req.api_key, req.model,
            )
            pdf = generate_autopilot_pdf(
                req.target, req.results,
                cycle_analyses, action_analyses, global_summary,
                req.cycles_done, req.date_str or None,
            )
            fname = f"netprobe-autopilot-{(req.target or 'report').replace('.','_')}-{datetime.now().strftime('%Y%m%d')}.pdf"
            return Response(content=pdf, media_type="application/pdf",
                headers={"Content-Disposition": f'attachment; filename="{fname}"'})
        except Exception as e:
            import traceback
            return Response(content=f"Error: {e}\n{traceback.format_exc()}",
                media_type="text/plain", status_code=500)
