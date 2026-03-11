# 🗂️ Referencia de Módulos — NetProbe Security Suite

44 módulos organizados en 8 categorías. Cada módulo devuelve un estado y puntuación que contribuye al score global del caso.

## Sistema de Scoring

| Estado | Score | Significado |
|---|---|---|
| `BLOCKED` | 100 | La defensa es sólida, ataque completamente bloqueado |
| `DETECTED` | 60 | El ataque fue detectado pero no bloqueado |
| `PARTIAL` | 35 | La defensa es parcial o inconsistente |
| `VULNERABLE` / `PASSED` | 0 | **Sin defensa detectada — crítico** |
| `ERROR` | — | No aplica (herramienta no disponible o error técnico) |

---

## 🔍 Fingerprinting (8 módulos)

| ID | Nombre | Herramienta | Descripción |
|---|---|---|---|
| `syn_scan` | TCP SYN Scan | nmap | Escaneo de puertos TCP en modo stealth (half-open) |
| `udp_scan` | UDP Port Scan | nmap | Detección de servicios UDP activos |
| `xmas_scan` | XMAS Scan | nmap | Escaneo con flags FIN+PSH+URG para evadir firewalls básicos |
| `null_scan` | NULL Scan | nmap | Escaneo sin flags TCP para detección pasiva |
| `fin_scan` | FIN Scan | nmap | Escaneo solo con flag FIN |
| `os_fp` | OS Fingerprinting | nmap -O | Detección del sistema operativo por análisis de pila TCP/IP |
| `banner` | Banner Grabbing | nmap + socket | Captura de banners de servicios (SSH, FTP, HTTP, SMTP...) |
| `svc_enum` | Service Enumeration | nmap -sV + scripts | Identificación de versiones y scripts NSE de detección |

**Intensidad recomendada:** 2-3 para sigilo, 4-5 para completitud.

---

## 🌊 Flood / DoS (6 módulos)

> ⚠️ Estos módulos generan tráfico intenso. Úsalos solo en redes propias y con autorización.

| ID | Nombre | Herramienta | Descripción |
|---|---|---|---|
| `syn_flood` | SYN Flood | hping3 | Inundación de paquetes TCP SYN para agotar la tabla de conexiones |
| `udp_flood` | UDP Flood | hping3 | Inundación de paquetes UDP a puertos aleatorios |
| `icmp_flood` | ICMP Flood | hping3 | Ping flood para saturar el ancho de banda |
| `http_flood` | HTTP Flood | httpx | Peticiones HTTP concurrentes para saturar el servidor web |
| `slowloris` | Slowloris | Python socket | Ataque de conexiones lentas para agotar workers del servidor HTTP |
| `fragflood` | Fragment Flood | scapy | Fragmentación IP maliciosa para sobrecargar el stack de reensamblado |

**Duración:** configurada en el slider "Duración flood" del sidebar (por defecto 30s).

---

## 🔑 Fuerza Bruta (6 módulos)

| ID | Nombre | Herramienta | Puertos | Timeout |
|---|---|---|---|---|
| `ssh_brute` | SSH Brute Force | hydra | 22 | Dinámico (según wordlist) |
| `ftp_brute` | FTP Brute Force | hydra | 21 | Dinámico |
| `http_auth` | HTTP Basic Auth | hydra | 80/443 | Dinámico |
| `rdp_brute` | RDP Brute Force | ncrack / hydra | 3389 | 120s |
| `snmp_brute` | SNMP Community String | snmpget/snmpwalk | 161/UDP | 6s por community |
| `smb_brute` | SMB Auth Brute | hydra | 445 | Dinámico |

**Wordlists utilizadas:**

El módulo selecciona automáticamente la mejor lista disponible en este orden de prioridad:
1. `/opt/netprobe-wordlists/` — listas optimizadas generadas por el instalador
2. `/opt/seclists/` — SecLists si está instalado
3. `/usr/share/wordlists/rockyou.txt` — para passwords
4. Lista interna de fallback (20 usuarios + 20 passwords comunes)

Para SSH se usa la lista específica de SSH (menos entradas, más precisa). Para SMB/FTP se usa la lista top-1000.

---

## 🔌 Protocolo (5 módulos)

| ID | Nombre | Herramienta | Descripción |
|---|---|---|---|
| `arp_spoof` | ARP Spoofing | scapy | Envenenamiento de caché ARP para intercepción de tráfico |
| `vlan_hop` | VLAN Hopping | scapy | Salto de VLAN mediante 802.1Q double tagging |
| `ipv6_flood` | IPv6 ND Flood | scapy | Inundación de Neighbor Discovery para agotar tablas ND |
| `frag_attack` | Teardrop Attack | scapy | Fragmentos IP malformados con offsets solapados |
| `tcp_reset` | TCP RST Injection | scapy | Inyección de paquetes RST para interrumpir conexiones activas |

---

## 🌐 Web Attacks (6 módulos)

| ID | Nombre | Herramienta | Timeout | Descripción |
|---|---|---|---|---|
| `sqli` | SQL Injection | sqlmap | 300s | Detección y explotación automática de SQLi |
| `xss` | XSS Attack | XSStrike + httpx | 180s | Cross-Site Scripting reflected y DOM |
| `lfi_rfi` | LFI/RFI | httpx | 90s | Local/Remote File Inclusion path traversal |
| `dir_trav` | Directory Traversal | httpx | 90s | Traversal de directorios y acceso a archivos del sistema |
| `ssrf` | SSRF Probing | httpx | 90s | Server-Side Request Forgery hacia metadatos y servicios internos |
| `http_smug` | HTTP Smuggling | httpx | 90s | Detección de vulnerabilidades de request smuggling CL.TE / TE.CL |

---

## 🌍 DNS Attacks (4 módulos)

| ID | Nombre | Herramienta | Descripción |
|---|---|---|---|
| `dns_amplif` | DNS Amplification | scapy | Prueba de amplificación DNS para detección de resolvers abiertos |
| `dns_tunnel` | DNS Tunneling | dnspython | Detección de canales de exfiltración DNS |
| `dns_poison` | DNS Cache Poison | scapy | Envenenamiento de caché DNS mediante respuestas forjadas |
| `dga_query` | DGA Domain Queries | dnspython | Generación de dominios DGA y análisis de resolución |

---

## 🥷 Evasión (5 módulos)

| ID | Nombre | Herramienta | Timeout | Descripción |
|---|---|---|---|---|
| `ttl_manip` | TTL Manipulation | hping3 | 120s | Fragmentación con TTL bajo para evadir análisis de IDS |
| `decoy_scan` | Decoy Scanning | nmap -D | 180s | Escaneo con IPs señuelo para ocultar el origen real |
| `timing_ev` | Timing Evasion | nmap -T0 | 400s | Escaneo ultra-lento para evadir detección por umbral de tiempo |
| `enc_payload` | Encrypted Payload | Python | 90s | Payloads con cifrado básico para evadir inspección de contenido |
| `poly_payload` | Polymorphic Payload | Python | 90s | Payloads con estructura variable para evadir firmas estáticas |

---

## 🔥 Firewall / ACL (4 módulos)

| ID | Nombre | Herramienta | Descripción |
|---|---|---|---|
| `policy_chk` | Policy Compliance | nmap + socket | Verificación de reglas de firewall contra política esperada |
| `acl_bypass` | ACL Bypass | nmap + scapy | Intento de bypass de listas de control de acceso mediante fragmentación |
| `admin_probe` | Admin Interface Probe | httpx + nmap | Detección de interfaces de administración expuestas (puertos altos, /admin, etc.) |
| `nat_bypass` | NAT Bypass | scapy | Técnicas de bypass de NAT mediante protocolo manipulation |

---

## ⚙️ Configuración de Intensidad

La intensidad (1-5) afecta a todos los módulos:

| Nivel | Descripción | Threads hydra | Velocidad nmap |
|---|---|---|---|
| 1 | Mínimo, casi sin ruido | 2 | T1 (paranoico) |
| 2 | Bajo, sigilo moderado | 4 | T2 (discreto) |
| 3 | Normal (por defecto) | 8 | T3 (normal) |
| 4 | Agresivo | 16 | T4 (agresivo) |
| 5 | Máximo, máximo ruido | 32 | T5 (insano) |

> **Recomendación:** Usa intensidad 2-3 para auditorías reales. Niveles 4-5 son detectables fácilmente por cualquier IDS/IPS.

