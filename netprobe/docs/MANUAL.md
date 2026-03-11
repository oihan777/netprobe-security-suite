# 📖 Manual de Uso — NetProbe Security Suite

## Índice

1. [Primeros pasos — Sistema de Casos](#1-primeros-pasos--sistema-de-casos)
2. [Configurar Target y API Key](#2-configurar-target-y-api-key)
3. [Descubrimiento de Red](#3-descubrimiento-de-red)
4. [Ejecutar un Scan](#4-ejecutar-un-scan)
5. [Dashboard](#5-dashboard)
6. [Terminal y Resultados](#6-terminal-y-resultados)
7. [IA Analyst](#7-ia-analyst)
8. [Autopilot](#8-autopilot)
9. [STRIDE Threat Modeling](#9-stride-threat-modeling)
10. [OSINT Panel](#10-osint-panel)
11. [Payload Generator](#11-payload-generator)
12. [Reverse Shell Generator](#12-reverse-shell-generator)
13. [IDS/IPS Rule Generator](#13-idsips-rule-generator)
14. [Log Analyzer](#14-log-analyzer)
15. [Informe PDF](#15-informe-pdf)
16. [Campaña Multi-target](#16-campaña-multi-target)
17. [Scheduler](#17-scheduler)
18. [CVE Lookup](#18-cve-lookup)

---

## 1. Primeros Pasos — Sistema de Casos

Al abrir NetProbe lo primero que verás es la **pantalla de Casos**. Cada caso es un proyecto de pentesting aislado: tiene sus propios scans, historial, chat con IA, resultados del STRIDE y datos de red descubiertos.

### Crear un caso

1. Haz clic en **+ Nuevo caso**
2. Escribe el nombre (ej: "Auditoría red corporativa")
3. Opcionalmente añade una descripción y selecciona un color
4. Clic en **Crear**

### Seleccionar un caso existente

Haz clic sobre el nombre del caso en la lista. Entrarás directamente a la herramienta con todos los datos de ese caso cargados.

### Cambiar de caso

Haz clic en el botón **Casos** (esquina superior izquierda del sidebar) para volver a la pantalla de selección.

> **Todo es persistente por caso.** Los hosts descubiertos, el historial de scans, el chat con IA y el análisis STRIDE se guardan por separado para cada caso y se restauran automáticamente al volver.

---

## 2. Configurar Target y API Key

### Target IP

En el sidebar izquierdo, bajo **TARGET IP**, introduce la IP del sistema que quieres auditar. Solo acepta IPs privadas RFC1918 (`192.168.x.x`, `10.x.x.x`, `172.16-31.x.x`).

Si ya descubriste hosts en la red (ver sección 3), puedes hacer clic en cualquier host del panel de descubrimiento para establecerlo como target automáticamente.

### API Key de Groq

Bajo **API KEY (GROQ)** pega tu clave de Groq (formato `gsk_xxxx`). La clave se guarda automáticamente en el navegador — no necesitas introducirla cada vez.

- **Indicador verde** = clave guardada y válida
- **Indicador naranja** = campo vacío
- Botón **✕** = borra la clave guardada

Sin clave, todos los módulos de escaneo funcionan. Solo se deshabilitan las funciones de IA.

---

## 3. Descubrimiento de Red

El botón **Descubrir red** en el sidebar escanea tu red local y detecta todos los dispositivos activos.

### Uso

1. Haz clic en **Descubrir red** para abrir el panel
2. Selecciona la interfaz/subred detectada automáticamente (o escríbela manualmente)
3. Elige el método: **nmap** (más preciso) o **ping** (más rápido)
4. Clic en **Escanear**

### Resultado

Por cada host encontrado verás:
- IP y hostname (si está disponible)
- Tipo de dispositivo (router, servidor Linux/Windows, IoT, móvil...)
- Puertos abiertos detectados
- Latencia en ms

Haz clic en cualquier host para establecerlo como **Target** automáticamente.

Los resultados se guardan automáticamente para el caso activo y aparecen en el **Dashboard** en la tabla de dispositivos.

---

## 4. Ejecutar un Scan

### Seleccionar módulos

En la pestaña **Módulos** (sección Ataque) verás los 44 módulos disponibles organizados por categoría:

- **Fingerprinting** — reconocimiento pasivo
- **Reconocimiento** — nmap, banner grabbing
- **Flood/DoS** — pruebas de resistencia
- **Fuerza Bruta** — SSH, FTP, HTTP, RDP, SMB, SNMP
- **Protocolo** — ataques de capa 2/3
- **Web Attacks** — SQLi, XSS, LFI, SSRF
- **DNS** — ataques DNS
- **Evasión** — técnicas de bypass de IDS
- **Firewall** — pruebas de ACL

Haz clic en un módulo para seleccionarlo/deseleccionarlo. Usa los filtros de categoría para ver solo los de un tipo. El botón **Lim par** selecciona los más relevantes automáticamente.

### Configurar intensidad y duración

- **Intensidad (1-5)** — controla agresividad, número de threads y timeouts. Empieza con 2-3.
- **Duración flood (seg)** — tiempo de los ataques de flood. Por defecto 30s.

### Iniciar scan

Clic en **Añadir al scan** (o **Iniciar scan** si ya hay resultados y quieres empezar desde cero). La herramienta pasará automáticamente a la pestaña **Terminal**.

---

## 5. Dashboard

El Dashboard muestra el estado completo del caso activo:

### Tarjetas de métricas (parte superior)

- **Score actual** — puntuación del último scan (o sesión activa)
- **Score medio** — media histórica de todos los scans
- **Vulnerables** — total acumulado de hallazgos vulnerables
- **Total scans** — número de sesiones guardadas
- **Hosts en red** — dispositivos descubiertos, con cuántos tienen puertos abiertos
- **Puertos abiertos** — total de puertos abiertos en todos los hosts

### Tabla de dispositivos

Aparece cuando hay hosts descubiertos. Muestra IP, hostname, tipo de dispositivo, puertos abiertos, OS detectado y latencia. Puedes ordenar por cualquier columna y filtrar por IP, hostname o tipo.

### Gráficos

- **Evolución del score** — historial de puntuaciones a lo largo del tiempo
- **Distribución de resultados** — donut con BLOCKED/DETECTED/PARTIAL/VULNERABLE
- **Módulos más problemáticos** — top de módulos con más vulnerabilidades encontradas
- **Resultados por categoría** — barras comparativas por categoría de ataque

### Vista Historial

Cambia a la vista **Historial** para ver todas las sesiones guardadas. Puedes expandir cada sesión para ver sus resultados, añadir notas y eliminarla.

---

## 6. Terminal y Resultados

### Terminal

La pestaña **Terminal** muestra en tiempo real los logs del scan en curso:

- **SYSTEM** — mensajes del sistema (gris)
- **CMD** — comandos ejecutados (azul, clickable para copiar)
- **RAW** — salida de herramientas externas (verde)
- **WARN** — advertencias / hallazgos (amarillo)
- **ERROR** — errores (rojo)

También puedes ejecutar comandos directamente en el campo de entrada inferior. Los resultados de STRIDE con el botón **▶ Ejecutar** se lanzan aquí.

### Resultados

La pestaña **Resultados** muestra cada módulo ejecutado con:

- Badge de estado (BLOCKED / DETECTED / PARTIAL / VULNERABLE)
- Score individual
- Datos técnicos del módulo
- Comandos ejecutados
- Botón de análisis IA individual (requiere API Key)
- Campo de notas

---

## 7. IA Analyst

Chat contextual con un modelo LLM (Llama 3.3-70b via Groq) que conoce todos los resultados del scan activo.

### Análisis automático

Al terminar un scan, la IA analiza automáticamente los resultados y genera un resumen ejecutivo.

### Chat libre

Puedes preguntarle cualquier cosa sobre los resultados:
- *"¿Cuál es la vulnerabilidad más crítica?"*
- *"Explícame cómo explotar el resultado de SSH brute force"*
- *"Genera un plan de remediación priorizado"*
- *"¿Qué significan los puertos abiertos encontrados?"*

### Prompts rápidos

Usa los botones de acceso rápido para análisis frecuentes: resumen ejecutivo, plan de remediación, análisis de riesgo, comparativa con benchmark.

### Generar informe

El botón **Generar informe** produce un informe completo en formato texto dentro del chat.

---

## 8. Autopilot

Modo automatizado donde la IA decide qué módulos ejecutar y en qué orden basándose en el target.

### Full Auto

1. Introduce el target en el sidebar
2. Ve a **IA → Autopilot**
3. Selecciona el perfil: **Reconocimiento**, **Completo** o **Sigilo**
4. Clic en **Iniciar Autopilot**

La IA ejecuta los módulos en fases, analiza los resultados intermedios y ajusta la estrategia. Al terminar genera un informe PDF descargable.

---

## 9. STRIDE Threat Modeling

Genera un modelo de amenazas completo para cualquier sistema usando la metodología STRIDE.

### Cómo usarlo

1. Ve a **IA → STRIDE**
2. Rellena el formulario:
   - **Nombre del sistema** — ej: "API de pagos", "Portal corporativo"
   - **Descripción** — qué hace, quién lo usa, qué datos maneja
   - **Componentes** — lista separada por comas (ej: "Frontend React, API REST, PostgreSQL, Redis, Nginx")
   - **Stack tecnológico** — ej: "Node.js, AWS, Docker"
   - *(Opcional)* Fronteras de confianza y flujos de datos
3. Clic en **Generar Threat Model STRIDE**

Si tienes scans previos en el caso, se incluyen automáticamente como contexto (target IP, puertos abiertos, vulnerabilidades confirmadas).

### Resultado

El análisis genera para cada componente amenazas en 6 categorías:

| Letra | Categoría | Descripción |
|---|---|---|
| **S** | Spoofing | Suplantación de identidad |
| **T** | Tampering | Modificación de datos |
| **R** | Repudiation | Negación de acciones |
| **I** | Information Disclosure | Exposición de información |
| **D** | Denial of Service | Interrupción del servicio |
| **E** | Elevation of Privilege | Escalada de privilegios |

Cada amenaza incluye descripción, vector de ataque, impacto, CVSS estimado, mitigaciones técnicas y **comandos de explotación reales** usando el target y los datos del caso.

### Ejecutar comandos desde STRIDE

Los comandos marcados como **NetProbe ✓** tienen un botón **▶ Ejecutar** que los lanza directamente en la terminal y te redirige a ella automáticamente.

### Vistas

- **Componentes** — acordeón por componente con todas sus amenazas
- **Matriz STRIDE** — distribución visual + top riesgos priorizados
- **Recomendaciones** — acciones ordenadas por esfuerzo e impacto

Los resultados se guardan automáticamente para el caso activo.

---

## 10. OSINT Panel

Recopilación de información de fuentes abiertas sobre un target.

### Configurar API Keys de OSINT

Haz clic en el botón **🔑 API Keys** (esquina superior derecha del panel):

- **Shodan** — obtén tu key en [account.shodan.io](https://account.shodan.io)
- **VirusTotal** — obtén tu key en [virustotal.com](https://virustotal.com)
- **HIBP** — obtén tu key en [haveibeenpwned.com/API/Key](https://haveibeenpwned.com/API/Key)

Las keys son opcionales. Sin ellas funcionan whois, DNS, geolocalización y otros módulos.

### Módulos disponibles

- **Shodan** — puertos, servicios, vulnerabilidades conocidas, historial
- **VirusTotal** — reputación de IP/dominio, detecciones de malware
- **HIBP** — emails comprometidos en brechas de datos
- **Whois** — datos de registro del dominio/IP
- **DNS** — resolución, registros MX/TXT/NS, zone transfer
- **GeoIP** — ubicación geográfica, ASN, ISP
- **Reverse DNS** — hostname → IP mapping

---

## 11. Payload Generator

Biblioteca de payloads de ataque con codificación y bypass WAF mediante IA.

### Categorías disponibles

| Categoría | Subcategorías |
|---|---|
| SQL Injection | Auth Bypass, UNION Based, Blind/Time, Error Based, WAF Bypass |
| XSS | Reflected, Stored/DOM, WAF Bypass |
| LFI/Path Traversal | Basic, Log Poisoning, WAF Bypass, RFI |
| SSTI | Detección, Jinja2, Twig, Freemarker |
| Command Injection | Basic, Blind/Time, Reverse Shell, WAF Bypass |
| XXE / SSRF | XXE Basic, SSRF AWS/GCP metadata |
| Open Redirect | Basic + 6 técnicas de bypass |

### Uso

1. Selecciona la categoría en el panel izquierdo
2. Configura:
   - **Encoding** — None, URL, Double URL, Base64, HTML, HEX, Unicode
   - **LHOST / LPORT** — tu IP y puerto para payloads con callback
3. Opcionalmente filtra por subcategoría o busca (nombre, técnica, contexto)
4. Clic en **Generar**

### Bypass WAF con IA

El botón **⚡** en cualquier payload genera 3 variantes ofuscadas con técnicas de evasión de WAF modernas (Cloudflare, ModSecurity, AWS WAF).

### Buscar payloads

El campo de búsqueda filtra en tiempo real por nombre de técnica, fragmento del payload o contexto de uso. Ejemplos: `union`, `sleep`, `bypass`, `jinja`, `etc/passwd`.

---

## 12. Reverse Shell Generator

Genera reverse shells en 20+ lenguajes/métodos con ofuscación IA opcional.

### Uso

1. Introduce tu **LHOST** (IP donde recibirás la conexión) y **LPORT**
2. Selecciona el lenguaje/método (Bash, Python, PHP, PowerShell, Ruby, Perl, netcat, socat...)
3. Clic en **Generar**
4. Opcionalmente clic en **Ofuscar con IA** para una versión evasiva

Para recibir la conexión usa: `nc -lvnp <LPORT>` o `socat TCP-LISTEN:<LPORT>,reuseaddr,fork EXEC:bash`

---

## 13. IDS/IPS Rule Generator

Genera reglas Snort/Suricata basadas en los resultados del scan activo.

### Uso

1. Ejecuta un scan primero (necesita resultados para generar reglas relevantes)
2. Ve a **Herramientas → IDS Rules**
3. Selecciona el formato: Snort, Suricata o ambos
4. Clic en **Generar reglas**

Las reglas se generan para los módulos que produjeron resultados VULNERABLE o PARTIAL, con las firmas técnicas exactas del tráfico detectado.

---

## 14. Log Analyzer

Analiza logs de seguridad con IA para detectar patrones de ataque, anomalías y eventos relevantes.

### Uso

1. Ve a **Resultados → Logs**
2. Pega el contenido del log en el campo de texto (syslog, auth.log, nginx access.log, firewall logs...)
3. Clic en **Analizar**

La IA identifica IPs sospechosas, patrones de brute force, escaneos, exploits intentados y genera un resumen con severidad y recomendaciones.

---

## 15. Informe PDF

Genera un informe profesional con todos los resultados del scan.

### Desde Resultados → Informe

1. Ve a la pestaña **Informe**
2. Rellena los campos opcionales: nombre del auditor, empresa, cliente
3. Clic en **Generar PDF**

El informe incluye: resumen ejecutivo, score global, tabla de resultados por módulo, hallazgos críticos y recomendaciones de remediación.

### Desde Autopilot

El Autopilot genera su propio informe PDF más detallado al finalizar el análisis completo.

---

## 16. Campaña Multi-target

Ejecuta el mismo conjunto de módulos contra múltiples IPs de forma secuencial.

### Uso

1. Ve a **Ataque → Campaña**
2. Añade los targets (uno por línea o importa desde un archivo)
3. Selecciona los módulos en el sidebar principal
4. Configura intensidad
5. Clic en **Iniciar campaña**

Los resultados se agrupan por target con el score individual de cada uno.

---

## 17. Scheduler

Programa scans periódicos para monitorización continua.

### Uso

1. Ve a **Ataque → Scheduler**
2. Clic en **+ Nueva tarea**
3. Configura:
   - Target IP
   - Módulos a ejecutar
   - Frecuencia: cada X horas/días
   - Hora de inicio
4. Clic en **Guardar**

Las tareas se ejecutan automáticamente mientras NetProbe esté arrancado. Los resultados se guardan en el historial del caso.

---

## 18. CVE Lookup

Busca vulnerabilidades conocidas para los servicios detectados en el scan.

### Búsqueda manual

Introduce el nombre del software y versión (ej: `OpenSSH 7.4`, `Apache 2.4.49`) para obtener las CVEs asociadas con CVSS, descripción y referencias.

### Correlación automática

Si tienes resultados de scan con banners de servicio, el panel correlaciona automáticamente con CVEs conocidas.

