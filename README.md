# Fandance PWA 💸

Aplicación web progresiva (PWA) de **rebalanceo de carteras y planificación
financiera**. Es un monorepo *full-stack* con un frontend React y un backend
Python (FastAPI) que consulta precios de mercado y noticias en tiempo real.

> Versión full-stack y precursora del proyecto
> [Portfolio-Rebalancer](https://github.com/MarcosIbanezFandos/Portfolio-Rebalancer)
> (que reimplementa la idea como app Streamlit de un solo fichero).

---

## ¿De qué trata?

- **Construcción y rebalanceo de carteras** por pesos objetivo.
- **Datos de mercado en vivo** vía `yfinance`.
- **Noticias financieras** integradas mediante `feedparser` (RSS).
- **Persistencia en la nube** con Supabase (carteras y activos personalizados).
- Interfaz **mobile-first** instalable como PWA (`vite-plugin-pwa`).

## Arquitectura

```
fandance-pwa/
├─ frontend_rebalanceo/   # SPA React 18 + Vite + Tailwind
├─ backend-rebalanceo/    # API FastAPI (main.py) — título interno "Fandance API"
└─ server.js              # Servidor Express que sirve el build del frontend
```

- **Frontend:** React 18, Vite 5, TailwindCSS, Recharts, Framer Motion, Axios.
- **Backend:** FastAPI, Supabase, `yfinance`, `pandas`, `numpy`, `feedparser`.
- **Servidor de producción:** `server.js` (Express) sirve `frontend_rebalanceo/dist`
  e incluye un endpoint `/health` pensado para el *health check* de Railway.

---

## Estado actual

⚠️ **No hay un despliegue público activo.** El proyecto estaba preparado para
desplegarse en **Railway** (lo delatan `server.js` y su endpoint `/health`),
pero actualmente no hay ningún servicio en marcha, por lo que **no existe una
URL en vivo** que visitar. Funciona en local siguiendo los pasos de abajo.

> **Nota de seguridad:** este repositorio contiene ficheros `.env` versionados
> con credenciales de Supabase. Antes de reutilizar el proyecto, **rota esas
> claves** y sácalas del control de versiones (`git rm --cached`, añade `.env`
> a `.gitignore`).

---

## Ejecución en local

### 1. Backend (FastAPI)

```bash
cd backend-rebalanceo
python -m venv .venv && source .venv/bin/activate
pip install fastapi uvicorn supabase yfinance pandas numpy feedparser python-dotenv
# Crea backend-rebalanceo/.env con:
#   SUPABASE_URL=...
#   SUPABASE_KEY=...
uvicorn main:app --reload --port 8000
```

### 2. Frontend (React + Vite)

```bash
cd frontend_rebalanceo
npm install
# Configura frontend_rebalanceo/.env.development con:
#   VITE_API_URL=http://localhost:8000
#   VITE_SUPABASE_URL=...
#   VITE_SUPABASE_ANON_KEY=...   (clave ANON, nunca la service_role)
npm run dev        # http://localhost:5173
```

### 3. Servir el build como en producción (opcional)

```bash
npm run build      # genera frontend_rebalanceo/dist
node server.js     # sirve el SPA en http://localhost:3000
```

---

## Autor

Marcos Ibáñez Fandos — [@MarcosIbanezFandos](https://github.com/MarcosIbanezFandos)
