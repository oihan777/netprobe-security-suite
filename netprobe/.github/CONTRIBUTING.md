# Contribuir a NetProbe Security Suite

¡Gracias por tu interés en contribuir! Este documento explica cómo hacerlo correctamente.

## Antes de empezar

- Lee el [Código de Conducta](CODE_OF_CONDUCT.md)
- Asegúrate de que tu contribución es para uso ético y legal
- Para cambios grandes, abre primero un **Issue** para discutirlo

## Tipos de contribución bienvenidos

- 🐛 **Bug fixes** — errores en módulos, frontend o backend
- ✨ **Nuevos módulos de ataque** — siguiendo la estructura existente en `backend/modules/`
- 📖 **Documentación** — mejoras, traducciones, ejemplos
- 🎨 **UI/UX** — mejoras visuales en el frontend
- 🔧 **Herramientas** — nuevos generadores de payloads, shells, reglas IDS
- 🌍 **Traducciones** — internacionalización del frontend

## Proceso

### 1. Fork y rama

```bash
git fork https://github.com/oihan777/netprobe-security-suite
git checkout -b feature/nombre-descriptivo
# o: fix/descripcion-del-bug
```

### 2. Desarrolla

**Convenciones de código:**
- Python: sigue PEP8, usa async/await para I/O, documenta con docstrings
- React: componentes funcionales con hooks, Tailwind para estilos
- Nombres en inglés para variables/funciones, comentarios en español si prefieres

**Para nuevos módulos de ataque:**
```python
# backend/modules/mi_modulo.py
async def run_mi_modulo(module_id, target, intensity, duration, log_fn):
    await log_fn("MODULE", f"▶ Nombre del módulo", module_id)
    # ... lógica ...
    return data_dict, "BLOCKED|DETECTED|PARTIAL|VULNERABLE|ERROR", score
```
Registra el módulo en `backend/modules/__init__.py` y añade su entrada en `frontend/src/data/modules.js`.

### 3. Commit

Usa [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: añade módulo de detección Heartbleed
fix: corrige crash en brute_force cuando wordlist no existe
docs: actualiza guía de instalación para Kali 2024
refactor: simplifica lógica de timeout en raw_exec
```

### 4. Pull Request

- Describe claramente **qué** hace y **por qué**
- Menciona los issues relacionados con `Closes #123`
- Asegúrate de que `sudo bash install.sh && sudo bash arrancar.sh` funciona con tu cambio

## Lo que NO aceptamos

- Código que desactiva el filtro de IPs RFC1918
- Módulos diseñados para evadir detección de forma que facilite uso malicioso
- Dependencias con licencias incompatibles con MIT
- Cambios que eliminen el aviso legal

## ¿Dudas?

Abre un [Issue](https://github.com/oihan777/netprobe-security-suite/issues) con la etiqueta `question`.
