# 📦 Guía de Instalación — NetProbe Security Suite

## Requisitos del Sistema

| Componente | Mínimo | Recomendado |
|---|---|---|
| OS | Ubuntu 20.04+ / Debian 11+ / Kali Linux | Kali Linux 2024+ |
| CPU | 2 cores | 4+ cores |
| RAM | 4 GB | 8 GB |
| Disco | 10 GB | 20 GB |
| Python | 3.10+ | 3.12 |
| Node.js | 18+ | 20 LTS |
| Permisos | Root (sudo) | Root |
| Red | Acceso a red local | — |

> **Nota:** Requiere root porque varios módulos usan raw sockets (nmap SYN scan, scapy, hping3).

---

## Instalación Completa (Recomendada)

### Paso 1 — Descargar

```bash
# Opción A: Git clone
git clone https://github.com/oihan777/netprobe-security-suite.git
cd netprobe-security-suite/netprobe

# Opción B: Descomprimir ZIP
unzip netprobe-security-suite.zip
cd netprobe-security-suite/netprobe
```

### Paso 2 — Ejecutar el instalador

```bash
sudo bash install.sh
```

El script instala automáticamente todo lo necesario. Duración aproximada: **5-15 minutos** según la conexión.

**Qué instala:**

| Categoría | Herramientas |
|---|---|
| Escáneres | nmap, masscan, arp-scan |
| Ataques | hping3, hydra, nikto |
| Captura | tshark, tcpdump, socat |
| Recon | whois |
| Web | sqlmap (`/opt/sqlmap`), XSStrike (`/opt/xsstrike`) |
| Wordlists | SecLists (`/opt/seclists`), rockyou.txt, listas optimizadas (`/opt/netprobe-wordlists`) |
| Python | Entorno virtual con todas las dependencias |
| Node.js | 20 LTS + dependencias del frontend |

### Paso 3 — Arrancar

```bash
sudo bash arrancar.sh
```

Verás en consola confirmación de que backend y frontend están activos. Abre **http://localhost:5173**.

---

## Verificar la Instalación

Una vez arrancado, puedes verificar que todo funciona:

```bash
# Backend responde
curl http://localhost:8000/api/status

# Frontend responde
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173
```

Ambos deben devolver `200`.

---

## Parar NetProbe

```bash
bash parar.sh
```

O simplemente `Ctrl+C` en la terminal donde ejecutaste `arrancar.sh`.

---

## Actualizar

```bash
git pull
sudo bash install.sh   # actualiza dependencias si hay cambios
sudo bash arrancar.sh
```

---

## Solución de Problemas

### Error: "venv no encontrado"

```bash
sudo bash install.sh   # vuelve a ejecutar el instalador
```

### Error: "Puerto 8000 en uso"

```bash
bash parar.sh
sudo bash arrancar.sh
```

### Error: "Permission denied" en módulos de escaneo

Los módulos de red requieren root. Usa siempre `sudo bash arrancar.sh`, no `bash arrancar.sh`.

### rockyou.txt no se descargó

```bash
# Opción A: desde apt (Kali/Ubuntu)
sudo apt install wordlists
sudo gunzip /usr/share/wordlists/rockyou.txt.gz

# Opción B: manual
sudo wget -O /usr/share/wordlists/rockyou.txt \
  https://github.com/brannondorsey/naive-hashcat/releases/download/data/rockyou.txt
```

### Node.js no encontrado

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
cd frontend && npm install
```

### El frontend no carga en http://localhost:5173

Comprueba los logs:
```bash
tail -f logs/frontend.log
```

---

## Instalación en Kali Linux (Recomendado)

Kali ya incluye nmap, hydra, hping3 y otras herramientas. El `install.sh` lo detecta automáticamente y solo instala lo que falta:

```bash
sudo apt update
git clone https://github.com/oihan777/netprobe-security-suite.git
cd netprobe-security-suite/netprobe
sudo bash install.sh
sudo bash arrancar.sh
```

---

## Instalación en Ubuntu 22.04/24.04

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl
git clone https://github.com/oihan777/netprobe-security-suite.git
cd netprobe-security-suite/netprobe
sudo bash install.sh
sudo bash arrancar.sh
```

---

## Estructura de Puertos

| Servicio | Puerto | Protocolo |
|---|---|---|
| Frontend (React/Vite) | 5173 | HTTP |
| Backend (FastAPI) | 8000 | HTTP + WebSocket |

Ambos puertos deben estar libres antes de arrancar.

