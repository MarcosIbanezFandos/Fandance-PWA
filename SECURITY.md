# Premisas de seguridad — Fandance-PWA

Reglas que **todo cambio en este repositorio debe cumplir** antes de mergear.
Aplica igual a código escrito a mano y a código generado por un asistente de IA.

Stack: React/Vite (frontend) · FastAPI sobre funciones serverless de Vercel (`api/`) · Supabase (Postgres + Auth).

> Este repositorio es **público**. Todo lo que se commitea es visible para
> cualquiera, para siempre, aunque se borre después.

---

## 1. Secretos y claves

**Nunca** un secreto en el código, ni en un comentario, ni en un test, ni en un
script "de usar y tirar", ni en el README.

| Clave | Dónde vive | Puede ir al cliente |
|---|---|---|
| `VITE_SUPABASE_URL` | env del build (Vercel) | ✅ sí |
| `VITE_SUPABASE_ANON_KEY` | env del build (Vercel) | ✅ sí — protegida por RLS |
| `SUPABASE_URL` | env del servidor | ❌ no |
| `SUPABASE_KEY` (**service_role**) | env del servidor | ❌ **nunca** |

- Todo lo que lleve el prefijo `VITE_` **se empaqueta en el bundle del navegador**.
  Cualquiera lo lee con F12. Nunca pongas ahí nada que no sea público.
- La `service_role` key **bypassa Row Level Security**: quien la tenga es
  administrador de la base de datos entera. Solo en `os.getenv` dentro de `api/`.
- En Python, lee siempre así — que reviente al arrancar es lo correcto:
  ```python
  SUPABASE_KEY = os.environ["SUPABASE_KEY"]   # ✅
  SUPABASE_KEY = "eyJhbGci..."                # ❌ nunca
  ```
- `.env` está en `.gitignore`. Solo se versiona `.env.example`, **con valores de
  relleno**, jamás reales.
- Antes de commitear: `git diff --cached` y busca `eyJ`, `sk-`, `postgres://`,
  `password`, `secret`.

### Si se filtra una clave

1. **Rotarla ya** en el proveedor. Es lo único que de verdad la desactiva.
2. Quitarla del código.
3. Asumir que el histórico de git sigue teniéndola: borrar el fichero **no** la borra.
4. Revisar los logs del proveedor por si hubo accesos raros.

---

## 2. Autenticación: siempre en el servidor, siempre desde el JWT

La regla de oro: **el `user_id` nunca puede venir del cliente.**

Un `user_id` en el body o en la query es un dato que el atacante controla. Si el
endpoint se fía de él, cualquiera lee y borra los datos de cualquiera —
especialmente grave aquí, donde el servidor usa la `service_role` key y RLS no
protege nada.

```python
# ❌ IDOR: el cliente dice quién es
@app.get("/api/portfolios/list")
def list_portfolios(user_id: str):
    return supabase.table("portfolios").select("*").eq("user_id", user_id).execute()

# ✅ el servidor lo deriva del token firmado por Supabase
@app.get("/api/portfolios/list")
def list_portfolios(user = Depends(current_user)):
    return supabase.table("portfolios").select("*").eq("user_id", user.id).execute()
```

Con una dependencia de FastAPI que valide el JWT en cada petición:

```python
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

bearer = HTTPBearer()

def current_user(cred: HTTPAuthorizationCredentials = Depends(bearer)):
    res = supabase.auth.get_user(cred.credentials)   # valida la firma
    if not res or not res.user:
        raise HTTPException(401, "Token inválido")
    return res.user
```

Y en el frontend, adjuntar el token en cada llamada:

```js
const { data: { session } } = await supabase.auth.getSession()
fetch(url, { headers: { Authorization: `Bearer ${session.access_token}` } })
```

Reglas:

- **Ningún endpoint nuevo sin `Depends(current_user)`.** Si de verdad es público,
  déjalo escrito en un comentario y justifícalo en la PR.
- Para recursos que no son del usuario directamente (`portfolio_id`, `item_id`),
  **comprobar la propiedad** antes de tocarlos: primero `select` filtrando por
  `user_id`, y si no aparece → 404.
- Delegar la autenticación en Supabase Auth. No escribir login, sesiones ni
  hashing propios.
- **Preferir RLS a la service_role key.** Si el servidor crea el cliente con el
  JWT del usuario en lugar de la service_role, Postgres aplica las políticas y
  un fallo de lógica deja de ser una fuga total.

---

## 3. Validación de entradas

Todo lo que llega de fuera es hostil hasta que se demuestre lo contrario.

- **Validar en el servidor.** La validación del frontend es UX, no seguridad: se
  salta con `curl`.
- Modelos Pydantic **con restricciones**, no solo con tipos:
  ```python
  class SimulationInput(BaseModel):
      years: int = Field(ge=1, le=60)              # sin esto, years=10**9 tumba la función
      initial_capital: float = Field(ge=0, le=1e9)
      period: Literal["1mo", "3mo", "1y", "5y"]    # lista blanca, no str libre
  ```
- Tickers y cualquier valor que acabe en una llamada externa: **lista blanca** o
  regex estricta (`^[A-Z0-9.\-]{1,12}$`), nunca concatenación directa.
- Longitud máxima en todos los strings y en todas las listas. Una lista de
  10.000 posiciones en `/api/portfolio/xray` es un DoS gratis.
- **SQL injection:** usar siempre el cliente de Supabase / consultas
  parametrizadas. Nunca construir SQL con f-strings o concatenación. Si algún día
  hace falta SQL crudo, parámetros ligados (`%s`), nunca interpolación.
- Nada de `eval`, `exec`, `pickle.load` sobre datos que vengan del usuario.
- Los errores hacia el cliente son genéricos. El stacktrace va al log, no a la
  respuesta.

---

## 4. Rate limiting

Sin límites, un bucle de peticiones agota la cuota de Vercel, la de yfinance y la
factura. Los endpoints que llaman a APIs externas o hacen cálculo pesado
(`/api/simulations/run`, `/api/portfolio/history_chart`, `/api/portfolio/benchmark`,
`/api/assets/search`) son los primeros objetivos.

- Límite **por usuario autenticado**, con la IP solo como respaldo para lo público.
- Orientación: ~60 req/min para lecturas normales, ~5-10 req/min para lo pesado.
- Devolver `429` con cabecera `Retry-After`.
- En serverless el estado no se comparte entre instancias: usar un contador
  externo (Upstash Redis, o una tabla en Supabase) — un `dict` en memoria no sirve.
- Añadir también un límite de tamaño de body.

---

## 5. CORS y cabeceras

- **`allow_origins=["*"]` junto a `allow_credentials=True` no es válido.** Listar
  los orígenes reales:
  ```python
  allow_origins=["https://fandance.vercel.app", "http://localhost:5173"]
  ```
- Restringir `allow_methods` y `allow_headers` a lo que se usa de verdad.
- HTTPS siempre; nunca desactivar la verificación de certificados.

---

## 6. Dependencias

- Dependabot o `npm audit` / `pip-audit` de forma periódica.
- Versiones fijadas (`requirements.txt` ya lo hace).
- Antes de añadir una dependencia nueva: ¿está mantenida? ¿hace falta de verdad?

---

## 7. Checklist antes de abrir una PR

- [ ] Cero secretos en el diff (`git diff --cached | grep -iE "eyJ|sk-|password|secret|postgres://"`).
- [ ] Los endpoints nuevos validan el JWT y derivan el `user_id` del token.
- [ ] Se comprueba la propiedad de todo recurso al que se accede por id.
- [ ] Los inputs tienen tipo **y** rango/longitud máxima.
- [ ] Los endpoints costosos están limitados.
- [ ] Los mensajes de error no filtran detalles internos.
- [ ] No se ha ampliado la superficie de la `service_role` key.

---

## Reportar un problema

Si encuentras un fallo de seguridad, no abras un issue público: escribe a
marcos.elbosque@gmail.com.
