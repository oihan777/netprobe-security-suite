# ❓ Preguntas Frecuentes — NetProbe Security Suite

## Instalación

**¿Necesito root para instalar y usar NetProbe?**  
Sí. La instalación requiere root para instalar paquetes del sistema. El arranque requiere root porque varios módulos usan raw sockets (nmap SYN scan, scapy, hping3). Si arrancas sin root, estos módulos darán ERROR pero el resto funcionará.

**¿Funciona en Windows?**  
No directamente. Necesitas un sistema Linux. En Windows puedes usar WSL2 (Ubuntu), una VM, o arrancar desde un USB con Kali Linux.

**¿Funciona en macOS?**  
Parcialmente. El frontend y el backend básico funcionan, pero muchos módulos que usan hping3, scapy con raw sockets y herramientas específicas de Linux no estarán disponibles.

**El install.sh tarda mucho, ¿es normal?**  
Sí. SecLists pesa ~1GB y rockyou.txt ~134MB. Con una conexión de 50Mbps puede tardar 5-10 minutos. Con conexiones lentas puede llegar a 30 minutos.

---

## Uso General

**¿Cuál es la diferencia entre "Añadir al scan" e "Iniciar scan"?**  
- **Añadir al scan**: Ejecuta los módulos seleccionados y acumula resultados a los existentes en la sesión actual.  
- **Iniciar scan (borrar N resultados)**: Limpia los resultados actuales e inicia desde cero. Aparece solo cuando ya hay resultados.

**¿Los datos se guardan si cierro el navegador?**  
Sí. El historial de scans se guarda en SQLite en el servidor. Los hosts descubiertos, el análisis STRIDE, el chat con IA y la configuración se guardan en localStorage del navegador, por lo que se restauran al volver a abrir desde el mismo navegador.

**¿Puedo tener varios casos activos simultáneamente?**  
Puedes tener todos los casos que quieras, pero solo puedes trabajar con uno a la vez en la interfaz. Cada caso tiene sus datos completamente aislados.

**¿Por qué algunos módulos siempre dan BLOCKED?**  
BLOCKED significa que la defensa del sistema auditado bloqueó el ataque. Es el resultado esperado en un sistema bien configurado. Si ves BLOCKED en módulos de fuerza bruta, el sistema tiene rate limiting o fail2ban activo.

---

## Módulos y Resultados

**El módulo SSH Brute Force da error "File for passwords not found"**  
Las wordlists no están instaladas. Ejecuta de nuevo `sudo bash install.sh` o descarga manualmente rockyou.txt:
```bash
sudo apt install wordlists
sudo gunzip /usr/share/wordlists/rockyou.txt.gz
```

**Los módulos de flood/DoS no hacen nada visible**  
Los módulos de flood generan tráfico durante el tiempo configurado en "Duración flood". El resultado BLOCKED/DETECTED depende de si el target tiene protecciones activas. Usa la pestaña Terminal para ver el tráfico generado en tiempo real.

**El módulo SQLi tarda mucho y no termina**  
sqlmap con algunos targets puede tardar. El timeout es de 5 minutos. Si el target no tiene ningún parámetro web accesible, sqlmap terminará rápidamente con BLOCKED.

**¿Puedo añadir mis propios módulos?**  
Sí. Mira la estructura de `backend/modules/` y crea un nuevo archivo Python siguiendo el mismo patrón. Registra el módulo en `backend/modules/__init__.py` y añade el nombre en el diccionario `MODULE_NAMES` de `main.py`.

---

## IA y STRIDE

**¿Qué modelo de IA usa NetProbe?**  
Llama 3.3-70b-versatile de Meta, servido via la API de Groq. Es gratuito con límites generosos (~30 peticiones/minuto).

**¿La API Key de Groq es de pago?**  
No. Groq ofrece un tier gratuito con límites más que suficientes para uso personal. Regístrate en [console.groq.com](https://console.groq.com).

**El análisis STRIDE da error "Error parseando respuesta IA"**  
Ocurre cuando la respuesta de la IA contiene caracteres especiales en los comandos de shell que rompen el JSON. El backend tiene un sanitizador robusto, pero si persiste, intenta describir el sistema con menos detalles técnicos en el primer intento.

**¿Los comandos de explotación del STRIDE son peligrosos?**  
Son comandos reales de pentesting (nmap, hydra, sqlmap, curl...). El botón **▶ Ejecutar** los lanza contra el target del caso activo. Asegúrate de que el target es un sistema que tienes autorización para auditar.

---

## Rendimiento

**La herramienta va lenta con muchos módulos**  
Los módulos se ejecutan secuencialmente (uno tras otro), no en paralelo. Con 20+ módulos y targets que responden lento, puede tardar 15-30 minutos. Usa menos módulos o sube la intensidad para reducir timeouts internos.

**¿Cuántos hosts puedo descubrir en el escaneo de red?**  
El descubrimiento funciona bien para subredes /24 (254 hosts) y /23 (510 hosts). Para subredes más grandes puede tardar varios minutos.

---

## Troubleshooting

**El frontend muestra pantalla en blanco**  
Comprueba los logs: `tail -f logs/frontend.log`. Normalmente se debe a un error de compilación de React. Borra `frontend/node_modules` y ejecuta `npm install` de nuevo desde la carpeta frontend.

**El backend no conecta (WebSocket error)**  
Verifica que el backend está corriendo: `curl http://localhost:8000/api/status`. Si no responde, mira `tail -f logs/backend.log` para ver el error.

**"Address already in use" al arrancar**  
```bash
bash parar.sh
sleep 2
sudo bash arrancar.sh
```

**nmap dice "Operation not permitted"**  
Debes ejecutar con root: `sudo bash arrancar.sh`.

