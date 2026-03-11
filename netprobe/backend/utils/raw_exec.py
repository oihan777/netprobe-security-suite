"""
Utility: run a shell command, emit CMD + RAW logs, return (stdout, stderr, returncode)
"""
import asyncio

async def raw_exec(cmd: str, log_fn, module_id: str, timeout: int = 120):
    """Execute cmd, log it as CMD, stream output as RAW, return (stdout, stderr, rc)."""
    await log_fn("CMD", cmd, module_id)
    proc = None
    try:
        proc = await asyncio.create_subprocess_shell(
            cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        out = stdout.decode("utf-8", errors="ignore")
        err = stderr.decode("utf-8", errors="ignore")

        if out.strip():
            await log_fn("RAW", out.rstrip(), module_id)
        if err.strip():
            await log_fn("RAW", f"[stderr]\n{err.rstrip()}", module_id)

        return out, err, proc.returncode

    except asyncio.TimeoutError:
        # Timeout interno del módulo — matar proceso y continuar
        if proc:
            try:
                proc.kill()
                await proc.wait()
            except Exception:
                pass
        await log_fn("RAW", f"[TIMEOUT] El comando superó {timeout}s", module_id)
        return "", "", -1

    except asyncio.CancelledError:
        # Cancelación externa (ej: autopilot timeout) — matar proceso y re-lanzar
        if proc:
            try:
                proc.kill()
                await proc.wait()
            except Exception:
                pass
        raise  # Re-lanzar para que wait_for lo convierta en TimeoutError

    except Exception as e:
        if proc:
            try:
                proc.kill()
            except Exception:
                pass
        await log_fn("RAW", f"[ERROR] {e}", module_id)
        return "", str(e), -1
