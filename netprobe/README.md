# NetProbe Security Suite v1.0

Herramienta profesional de pentesting y validacion de seguridad para redes locales.

## ADVERTENCIA LEGAL

USO EXCLUSIVO EN REDES PROPIAS O CON AUTORIZACION ESCRITA PREVIA.
El uso no autorizado constituye un delito penal.

IPs permitidas (RFC1918): 192.168.0.0/16, 10.0.0.0/8, 172.16.0.0/12

## Inicio Rapido

    sudo bash install.sh
    sudo ./start.sh

Frontend: http://localhost:5173
Backend:  http://localhost:8000

## Modulos (44 total)

Reconocimiento (8): nmap
Flood/DoS (6): hping3, scapy, httpx
Fuerza Bruta (6): hydra, SecLists
Protocolo (5): scapy raw sockets
Web Attacks (6): sqlmap, XSStrike, httpx
DNS (4): scapy, dnspython
Evasion (5): nmap, scapy
Firewall (4): socket, scapy

## Scoring

BLOCKED  = 100 pts (defensa perfecta)
DETECTED = 60  pts (detectado)
PARTIAL  = 35  pts (parcial)
PASSED   = 0   pts (vulnerable)

## IA Analyst

Configura tu API Key de Z.ai (open.bigmodel.cn) en el campo del sidebar para
habilitar el analisis inteligente con GLM-4.
