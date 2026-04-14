<div align="center">

# 🛡️ NetProbe Security Suite

**Plataforma profesional de pentesting y análisis de seguridad para redes privadas**

[![Version](https://img.shields.io/badge/version-1.0.0-blue?style=for-the-badge)](https://github.com/oihan777/netprobe-security-suite)
[![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.10+-yellow?style=for-the-badge&logo=python)](https://python.org)
[![React](https://img.shields.io/badge/react-18-61dafb?style=for-the-badge&logo=react)](https://react.dev)
[![FastAPI](https://img.shields.io/badge/fastapi-0.111-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com)
[![AI](https://img.shields.io/badge/AI-Groq%20Llama%203.3-orange?style=for-the-badge)](https://console.groq.com)

---

*44 módulos de ataque · IA integrada (Groq) · STRIDE Threat Modeling · Dashboard en tiempo real · Exportación completa*

</div>

---

## ⚠️ Aviso Legal

> **USO EXCLUSIVO EN REDES PROPIAS O CON AUTORIZACIÓN ESCRITA PREVIA.**
> El uso de esta herramienta contra sistemas sin autorización explícita constituye un delito penal en la mayoría de jurisdicciones.
> Solo acepta IPs privadas RFC1918: `192.168.x.x` · `10.x.x.x` · `172.16–31.x.x`

---

## 🚀 Inicio en 3 comandos

```bash
git clone https://github.com/oihan777/netprobe-security-suite.git
cd netprobe-security-suite/netprobe
sudo bash install.sh && sudo bash arrancar.sh
```

Abre **http://localhost:5173** — el instalador se encarga del resto.

---

## ✨ Qué incluye

### 🔍 Reconocimiento e Inteligencia
- **Dashboard** con métricas históricas, evolución del score, tabla de dispositivos y gráficos comparativos por sesión
- **Descubrimiento de red** automático con detección de tipo de dispositivo, OS, puertos y latencia — persistente por caso
- **Mapa de topología** interactivo (D3.js) de la red auditada
- **OSINT Panel** — Shodan, VirusTotal, HIBP, whois, DNS, geolocalización IP
- **CVE Lookup** — correlación automática de vulnerabilidades con los servicios detectados

### 💀 Motor de Ataque (44 módulos)
| Categoría | Módulos | Herramientas |
|---|---|---|
| Fingerprinting | TCP SYN/UDP/XMAS/NULL/FIN Scan, OS FP, Banner Grabbing, Service Enum | nmap, socket |
| Flood / DoS | SYN, UDP, ICMP, HTTP Flood, Slowloris, Fragment Flood | hping3, scapy, httpx |
| Fuerza Bruta | SSH, FTP, HTTP Auth, RDP, SNMP, SMB | hydra, ncrack, SecLists, rockyou |
| Web Attacks | SQLi, XSS, LFI/RFI, Directory Traversal, SSRF, HTTP Smuggling | sqlmap, XSStrike, httpx |
| Protocolo | ARP Spoof, VLAN Hop, IPv6 Flood, Teardrop, TCP RST Injection | scapy |
| DNS | Amplificación, Tunneling, Cache Poison, DGA Queries | scapy, dnspython |
| Evasión | TTL Manip, Decoy Scan, Timing Evasion, Encrypted/Poly Payloads | nmap, hping3 |
| Firewall/ACL | Policy Check, ACL Bypass, Admin Probe, NAT Bypass | nmap, scapy, socket |

### 🤖 IA — Requiere API Key de Groq (gratuita)
- **IA Analyst** — chat contextual con historial del caso; análisis automático al finalizar cada scan
- **Smart Score** — puntuación inteligente ponderada por criticidad y contexto
- **Autopilot** — modo Full Auto que decide qué módulos ejecutar y genera informe PDF
- **STRIDE Threat Modeling** — modelo de amenazas completo con comandos de explotación reales ejecutables en NetProbe

### 🔧 Herramientas de Ofensiva
- **Payload Generator** — ~80 payloads en 7 categorías, 7 encodings, bypass WAF con IA
- **Reverse Shell Generator** — 20+ lenguajes con ofuscación automática
- **IDS/IPS Rule Generator** — reglas Snort/Suricata generadas desde los resultados del scan
- **Log Analyzer** — análisis IA de logs de seguridad (auth.log, nginx, firewall...)

### 📁 Gestión de Proyectos
- **Sistema de Casos** — proyectos completamente aislados con datos, scans e IA independientes
- **Exportar caso** — ZIP con resumen ejecutivo, JSON, CSV para Excel, logs raw y PDF
- **Scheduler** — programación de scans periódicos con SQLite
- **Campaña multi-target** — escaneo masivo con gestión de resultados por IP
- **Informes PDF** — reportes profesionales exportables con gráficos y hallazgos

---

## 📋 Requisitos

| | Mínimo | Recomendado |
|---|---|---|
| **OS** | Ubuntu 20.04+ / Debian 11+ | Kali Linux 2024+ |
| **CPU** | 2 cores | 4+ cores |
| **RAM** | 4 GB | 8 GB |
| **Disco** | 10 GB | 20 GB |
| **Python** | 3.10+ | 3.12 |
| **Node.js** | 18+ | 20 LTS |
| **Permisos** | root (raw sockets) | root |

> Funciona en Ubuntu, Debian, Kali Linux y WSL2. No compatible con macOS/Windows nativo.

---

## 🔑 API Key de Groq (Gratuita)

Las funciones de IA usan [Groq](https://console.groq.com) con el modelo **Llama 3.3-70b-versatile**.

1. Regístrate gratis en [console.groq.com](https://console.groq.com)
2. Crea una API Key
3. Pégala en el sidebar de NetProbe bajo **API KEY (GROQ)**

Sin API Key, los 44 módulos de escaneo y todas las herramientas funcionan igualmente.

---

## 🏗️ Arquitectura

```
netprobe/
├── backend/                    # FastAPI · Python 3.10+
│   ├── main.py                 # Servidor principal, WebSocket, rutas
│   ├── modules/                # 44 módulos de ataque (8 categorías)
│   │   ├── recon.py            # nmap, banner grabbing
│   │   ├── brute_force.py      # hydra, ncrack, snmpget
│   │   ├── web_attacks.py      # sqlmap, XSStrike, httpx
│   │   ├── fingerprint.py      # OS detection, service enum
│   │   ├── flood.py            # hping3, scapy floods
│   │   ├── evasion.py          # nmap decoy, TTL, timing
│   │   ├── dns_attacks.py      # scapy DNS, dnspython
│   │   └── protocol.py         # ARP, VLAN, TCP raw
│   ├── ai_engine.py            # Motor IA (Groq · Llama 3.3)
│   ├── stride.py               # STRIDE Threat Modeling
│   ├── history.py              # Persistencia SQLite (casos, sesiones)
│   ├── case_export.py          # Exportación ZIP
│   ├── payload_generator.py    # ~80 payloads + WAF bypass
│   ├── reverse_shell.py        # 20+ shells + ofuscación
│   ├── ids_rules.py            # Snort/Suricata rule gen
│   ├── pdf_report.py           # Informes PDF (ReportLab)
│   ├── osint.py                # Shodan, VT, HIBP, DNS, GeoIP
│   └── autopilot.py            # Modo Full Auto
│
├── frontend/                   # React 18 · Vite · Tailwind · Framer Motion
│   └── src/
│       ├── App.jsx             # Root + estado global
│       ├── components/         # 20+ componentes
│       └── hooks/              # useWebSocket, useAI, useLocalStorage
│
├── install.sh                  # Instalación completa (~5-10 min)
├── arrancar.sh                 # Arranque backend + frontend
├── parar.sh                    # Parada limpia
└── docs/                       # Documentación completa
```

**Stack:** FastAPI · WebSockets · SQLite · React 18 · Vite · Tailwind CSS · Framer Motion · D3.js · ReportLab · Groq (Llama 3.3-70b)

---

## 📊 Sistema de Scoring

Cada módulo devuelve un estado y puntuación que se agrega al score global del caso:

| Estado | Score | Significado |
|---|---|---|
| `BLOCKED` | **100** | Defensa perfecta — ataque completamente bloqueado |
| `DETECTED` | **60** | Detectado pero no bloqueado |
| `PARTIAL` | **35** | Defensa parcial o inconsistente |
| `VULNERABLE` | **0** | ⚠️ Sin defensa — exposición confirmada |

El **Score Global** es la media ponderada de todos los módulos ejecutados: 0 = completamente expuesto, 100 = completamente protegido.

---

## 🛠️ Scripts

```bash
sudo bash install.sh     # Instalación completa (una sola vez)
sudo bash arrancar.sh    # Arranca backend (8000) + frontend (5173)
bash parar.sh            # Para todos los procesos limpiamente
```

---

## 📚 Documentación

| Documento | Descripción |
|---|---|
| [docs/INSTALACION.md](netprobe/docs/INSTALACION.md) | Guía detallada por OS, troubleshooting |
| [docs/MANUAL.md](netprobe/docs/MANUAL.md) | Manual completo de todas las funcionalidades |
| [docs/MODULOS.md](netprobe/docs/MODULOS.md) | Referencia de los 44 módulos |
| [docs/API.md](netprobe/docs/API.md) | API REST + WebSocket para integraciones |
| [docs/FAQ.md](netprobe/docs/FAQ.md) | Preguntas frecuentes |

---

## 🤝 Contribuir

Las contribuciones son bienvenidas. Lee [CONTRIBUTING.md](.github/CONTRIBUTING.md) antes de abrir un PR.

1. Fork del repositorio
2. Crea una rama: `git checkout -b feature/nueva-funcionalidad`
3. Commit con mensaje descriptivo: `git commit -m 'feat: añade X'`
4. Push y abre un Pull Request

---

## 🔒 Seguridad

Si encuentras una vulnerabilidad en NetProbe, repórtala de forma responsable siguiendo [SECURITY.md](.github/SECURITY.md). No abras issues públicos para vulnerabilidades de seguridad.

---

## 📄 Licencia

[MIT](LICENSE) — libre para uso personal, educativo y comercial con atribución.

---

<div align="center">

Desarrollado con fines educativos y de investigación en ciberseguridad.

**⭐ Si te resulta útil, dale una estrella al repositorio**

</div>
