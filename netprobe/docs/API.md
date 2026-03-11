# 🔌 API Reference — NetProbe Backend

El backend de NetProbe expone una API REST + WebSocket en `http://localhost:8000`.

## WebSocket Principal

```
ws://localhost:8000/ws
```

### Mensajes de entrada (cliente → servidor)

#### START_SCAN
```json
{
  "action": "START_SCAN",
  "target": "192.168.1.1",
  "modules": ["syn_scan", "os_fp", "banner"],
  "intensity": 3,
  "duration": 30,
  "case_id": "uuid-del-caso"
}
```

#### STOP_SCAN
```json
{ "action": "STOP_SCAN" }
```

#### RUN_COMMAND
```json
{
  "action": "RUN_COMMAND",
  "command": "nmap -sV 192.168.1.1"
}
```
Timeout: 600 segundos.

### Mensajes de salida (servidor → cliente)

```json
// Log en tiempo real
{ "type": "LOG", "log_type": "CMD|RAW|WARN|ERROR|SYSTEM", "message": "...", "module": "syn_scan", "timestamp": "..." }

// Inicio de módulo
{ "type": "MODULE_START", "module": "syn_scan", "module_name": "TCP SYN Scan", "current": 1, "total": 5 }

// Resultado de módulo
{ "type": "MODULE_RESULT", "module": "syn_scan", "module_name": "...", "category": "...",
  "status": "BLOCKED|DETECTED|PARTIAL|VULNERABLE|ERROR", "score": 100,
  "data": {}, "duration_ms": 1234, "commands": [], "raw_output": "", "timestamp": "..." }

// Fin del scan
{ "type": "SCAN_COMPLETE", "total": 5, "results": [...] }
```

---

## REST API

### Sistema

```
GET  /api/status          Estado del servidor
GET  /api/interfaces      Interfaces de red disponibles
GET  /api/ping/{target}   Ping + TCP port probe rápido
```

### Historial y Casos

```
GET    /api/cases                           Lista todos los casos
POST   /api/cases                           Crear caso
DELETE /api/cases/{id}                      Eliminar caso
GET    /api/cases/{id}/dashboard            Dashboard stats del caso
GET    /api/cases/{id}/sessions?limit=50    Sesiones del caso

GET    /api/history/sessions/{id}           Detalle de sesión
DELETE /api/history/sessions/{id}           Eliminar sesión
POST   /api/history/sessions/{id}/note      Añadir nota a sesión
POST   /api/history/results/{id}/note       Añadir nota a resultado
```

### IA

```
POST /api/ai/chat             Chat con IA
POST /api/ai/analyze-result   Análisis individual de un resultado
POST /api/score/smart         Smart Score con IA
```

#### Body /api/ai/chat
```json
{
  "messages": [{"role": "user", "content": "Analiza estos resultados..."}],
  "api_key": "gsk_xxx",
  "model": "llama-3.3-70b-versatile",
  "context": { "results": [], "target": "192.168.1.1" }
}
```

### STRIDE

```
GET  /api/stride/meta        Metadatos STRIDE (categorías, colores)
POST /api/stride/analyze     Generar análisis STRIDE completo
```

#### Body /api/stride/analyze
```json
{
  "system_name": "Portal corporativo",
  "system_description": "Aplicación web de gestión interna...",
  "components": "Frontend React, API REST, PostgreSQL, Nginx",
  "tech_stack": "Node.js, AWS, Docker",
  "trust_boundaries": "Internet → WAF → API → BD privada",
  "data_flows": "Usuario → Login → JWT → API → BD",
  "scan_results": [],
  "target": "192.168.1.10",
  "open_ports": [80, 443, 22, 5432],
  "api_key": "gsk_xxx"
}
```

### Payloads

```
GET  /api/payloads/categories   Lista categorías y subcategorías
POST /api/payloads/generate     Generar payloads con encoding
POST /api/payloads/obfuscate    Bypass WAF con IA
```

#### Body /api/payloads/generate
```json
{
  "category": "sqli",
  "encoding": "url",
  "lhost": "192.168.1.100",
  "lport": "4444",
  "subcategory": "all"
}
```

### Red

```
GET  /api/discovery/networks          Interfaces y subredes locales
WS   /api/discovery/scan              Escaneo de red en tiempo real
POST /api/network/discover            Descubrimiento REST (sin WebSocket)
```

#### Body /api/network/discover
```json
{ "subnet": "192.168.1.0/24" }
```

### CVEs

```
GET  /api/cve/search?q=OpenSSH+7.4    Búsqueda de CVEs
POST /api/cve/correlate               Correlación con resultados de scan
```

### OSINT

```
POST /api/osint/shodan      Consulta Shodan
POST /api/osint/virustotal  Consulta VirusTotal
POST /api/osint/hibp        Consulta Have I Been Pwned
POST /api/osint/whois       Whois lookup
POST /api/osint/dns         DNS enumeration
POST /api/osint/geoip       Geolocalización
```

### Reverse Shell

```
GET  /api/revshell/languages     Lista de lenguajes disponibles
POST /api/revshell/generate      Generar reverse shell
```

### IDS Rules

```
POST /api/ids/generate    Generar reglas Snort/Suricata
POST /api/ids/export      Exportar reglas
```

### Autopilot

```
POST /api/autopilot/start    Iniciar análisis autopilot
POST /api/autopilot/pdf      Generar PDF del autopilot
```

### PDF

```
POST /api/pdf/generate    Generar informe PDF del scan
```

### Scheduler

```
GET    /api/scheduler/tasks           Lista tareas programadas
POST   /api/scheduler/tasks           Crear tarea
DELETE /api/scheduler/tasks/{id}      Eliminar tarea
POST   /api/scheduler/tasks/{id}/run  Ejecutar ahora
```

### Log Analyzer

```
POST /api/logs/analyze    Analizar log con IA
```

---

## Autenticación

La API no requiere autenticación — está diseñada para uso local en red privada. Las funciones de IA requieren que el cliente pase su API Key de Groq en el body de la petición.

## CORS

El backend acepta peticiones desde cualquier origen (`allow_origins=["*"]`). Ajusta esto en `backend/main.py` si lo despliegas en un entorno compartido.

