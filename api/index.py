import os
import time as _time
import urllib.parse
import math
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field, StringConstraints
import yfinance as yf
import pandas as pd
import numpy as np
import feedparser
from typing import Annotated, List, Literal, Optional, Dict, Any
from supabase import create_client, Client
# --- CONFIG ---
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

# Orígenes autorizados. "*" junto a allow_credentials=True no es válido y deja
# que cualquier web haga peticiones autenticadas en nombre del usuario.
# Umbral de VIX a partir del cual Indexa ensancha la banda de reajuste.
VIX_UMBRAL = 35.0

ALLOWED_ORIGINS = [
    o.strip() for o in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",") if o.strip()
]

app = FastAPI(title="Fandance API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

supabase: Client = None
try:
    if SUPABASE_URL and SUPABASE_KEY:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception as e:
    print(f"Supabase init error: {e}")

# --- UTILS ---
def safe_float(val):
    if val is None: return 0.0
    try:
        f = float(val)
        if math.isnan(f) or math.isinf(f): return 0.0
        return f
    except: return 0.0

# --- AUTENTICACIÓN Y AUTORIZACIÓN ---
# El servidor usa la service_role key, que bypassa Row Level Security: aquí no
# hay red de seguridad debajo. La identidad sale SIEMPRE del JWT firmado por
# Supabase, nunca de un user_id que mande el cliente, y todo acceso a un
# recurso por id comprueba antes que pertenece a quien llama.

bearer_scheme = HTTPBearer(auto_error=False)


def current_user_id(
    cred: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> str:
    """Valida el access token de Supabase y devuelve el id del usuario."""
    if cred is None or not cred.credentials:
        raise HTTPException(401, "Falta el token de autenticación")
    if supabase is None:
        raise HTTPException(503, "Servicio no disponible")
    try:
        res = supabase.auth.get_user(cred.credentials)
    except Exception:
        raise HTTPException(401, "Token inválido o expirado")
    user = getattr(res, "user", None)
    if user is None or not getattr(user, "id", None):
        raise HTTPException(401, "Token inválido o expirado")
    return user.id


# --- RATE LIMITING ---
# El contador vive en Postgres (ver supabase/rate_limits.sql), no en memoria:
# en serverless cada petición puede caer en una instancia distinta, así que un
# dict de proceso no limitaría nada.
#
# Si la función RPC no está creada, se deja pasar la petición y se registra el
# aviso: preferimos una app que funciona sin límites a una app caída entera por
# un error de configuración. Revisa los logs si ves este mensaje.
_RATE_LIMIT_WARNED = False

# Reserva en memoria para cuando la función de Postgres no está creada. No es
# global —cada instancia serverless lleva su propio contador— así que un cliente
# repartido entre instancias podría superar el límite. Aun así frena el caso
# real: alguien martilleando desde un sitio suele caer en la instancia caliente.
# Es una red, no un sustituto de supabase/rate_limits.sql.
_MEM_HITS: Dict[str, List[float]] = {}
_MEM_MAX_KEYS = 5000


def _rate_limit_memoria(clave: str, limite: int, ventana: int) -> bool:
    ahora = _time.time()
    hits = [t for t in _MEM_HITS.get(clave, []) if ahora - t < ventana]
    if len(hits) >= limite:
        _MEM_HITS[clave] = hits
        return False
    hits.append(ahora)
    _MEM_HITS[clave] = hits
    # Poda: sin esto el diccionario crece sin fin en una instancia longeva.
    if len(_MEM_HITS) > _MEM_MAX_KEYS:
        for k in [k for k, v in _MEM_HITS.items() if not v or ahora - v[-1] > 3600][:1000]:
            _MEM_HITS.pop(k, None)
    return True


def enforce_rate_limit(user_id: str, bucket: str, limit: int, window_seconds: int) -> None:
    global _RATE_LIMIT_WARNED
    clave = f"{bucket}:{user_id}"
    allowed = None

    if supabase is not None:
        try:
            res = supabase.rpc(
                "check_rate_limit",
                {"p_key": clave, "p_limit": limit, "p_window_seconds": window_seconds},
            ).execute()
            allowed = res.data
        except Exception as e:
            if not _RATE_LIMIT_WARNED:
                print(f"RATE LIMIT sin función en BD ({e}). Usando contador en memoria; "
                      f"ejecuta supabase/rate_limits.sql para uno global.")
                _RATE_LIMIT_WARNED = True

    # Antes, si la función no existía se dejaba pasar todo: en la práctica la
    # app quedaba sin ninguna limitación y nadie se enteraba.
    if allowed is None:
        allowed = _rate_limit_memoria(clave, limit, window_seconds)

    if allowed is False:
        raise HTTPException(
            429,
            "Demasiadas peticiones. Espera un momento.",
            headers={"Retry-After": str(window_seconds)},
        )


def rate_limited(bucket: str, limit: int, window_seconds: int = 60):
    """Dependencia que autentica Y limita. Devuelve el user_id."""

    def dependency(user_id: str = Depends(current_user_id)) -> str:
        enforce_rate_limit(user_id, bucket, limit, window_seconds)
        return user_id

    return dependency


# Presupuestos por tipo de endpoint.
# - external: llama a yfinance / Google News. Es lo que cuesta dinero y cuota.
# - heavy:    cálculo intensivo dentro de la función serverless.
# - write:    escrituras normales en la base de datos.
Standard = Depends(rate_limited("std", 120))
External = Depends(rate_limited("ext", 30))
Heavy = Depends(rate_limited("heavy", 10))
Seed = Depends(rate_limited("seed", 3, 3600))


def assert_owns_portfolio(user_id: str, portfolio_id: str) -> str:
    """404 si la cartera no existe o no es del usuario (no revelamos cuál)."""
    res = (
        supabase.table("portfolios")
        .select("id")
        .eq("id", portfolio_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise HTTPException(404, "Cartera no encontrada")
    return portfolio_id


def assert_owns_item(user_id: str, item_id: str) -> str:
    """Comprueba portfolio_items -> portfolios.user_id."""
    res = (
        supabase.table("portfolio_items")
        .select("id, portfolio:portfolios(user_id)")
        .eq("id", item_id)
        .limit(1)
        .execute()
    )
    row = res.data[0] if res.data else None
    if not row or (row.get("portfolio") or {}).get("user_id") != user_id:
        raise HTTPException(404, "Posición no encontrada")
    return item_id


def assert_owns_history(user_id: str, history_id: str) -> str:
    """Comprueba rebalance_history -> portfolios.user_id. Devuelve portfolio_id."""
    res = (
        supabase.table("rebalance_history")
        .select("id, portfolio_id, portfolio:portfolios(user_id)")
        .eq("id", history_id)
        .limit(1)
        .execute()
    )
    row = res.data[0] if res.data else None
    if not row or (row.get("portfolio") or {}).get("user_id") != user_id:
        raise HTTPException(404, "Operación no encontrada")
    return row["portfolio_id"]

# --- MODELS ---
# Los tipos por sí solos no validan nada útil: sin rangos ni longitudes, un
# years=10**9 o una lista de 100.000 posiciones tumban la función serverless.
# Ningún modelo acepta user_id: la identidad sale del token, no del cliente.

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]
Ticker = Annotated[str, StringConstraints(strip_whitespace=True, to_upper=True, min_length=1, max_length=15, pattern=r"^[A-Za-z0-9.\-^=]+$")]
# Formato UUID real. PostgREST ya parametriza, así que esto no evita
# inyección, pero rechaza en el borde lo que sólo puede ser basura y
# evita que llegue a la base de datos a provocar un 500.
Uuid = Annotated[str, StringConstraints(
    strip_whitespace=True, max_length=36,
    pattern=r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
)]

Period = Literal["1d", "5d", "1mo", "3mo", "6mo", "ytd", "1y", "2y", "5y", "10y", "max"]


class CreatePortfolioInput(BaseModel):
    name: Name

class RenamePortfolioInput(BaseModel):
    portfolio_id: Uuid
    name: Name

class DuplicatePortfolioInput(BaseModel):
    portfolio_id: Uuid
    new_name: Name

class AddAssetInput(BaseModel):
    portfolio_id: Uuid
    ticker: Ticker
    name: Optional[str] = Field(default="", max_length=120)

class UpdateItemInput(BaseModel):
    item_id: Uuid
    units_held: float = Field(ge=0, le=1e12)
    target_weight: float = Field(ge=0, le=100)

class RebalanceInput(BaseModel):
    portfolio_id: Uuid
    contribution: float = Field(ge=0, le=1e9)

class ApplyRebalanceInput(BaseModel):
    portfolio_id: Uuid
    contribution: float = Field(ge=0, le=1e9)
    orders: List[Dict[str, Any]] = Field(max_length=500)

class HistoryInput(BaseModel):
    portfolio_id: Uuid
    period: Period = "1mo"
    ticker: Optional[Ticker] = None
    # Inicio real de la cartera (ISO). El usuario puede haber empezado a
    # invertir antes de registrarla aquí, así que su creación no siempre es la
    # fecha correcta para "MAX".
    inception: Optional[str] = None

class SimulationInput(BaseModel):
    portfolio_ids: List[Uuid] = Field(min_length=1, max_length=20)
    years: int = Field(ge=1, le=60)
    initial_capital: float = Field(ge=0, le=1e9)
    monthly_contribution: float = Field(ge=0, le=1e7)
    contribution_mode: Literal["constant", "growing"]
    growth_rate: float = Field(default=0.0, ge=-100, le=100)
    tax_rate: bool
    sim_type: Literal["deterministic", "montecarlo", "pessimistic"]

class NewsInput(BaseModel):
    assets: List[dict] = Field(max_length=50)

class XrayInput(BaseModel):
    # [{ticker, name, type, value, sector, country, currency}]
    positions: List[dict] = Field(max_length=200)

class BenchmarkInput(BaseModel):
    holdings: List[dict] = Field(max_length=200)   # [{ticker, units}]
    benchmarks: List[Ticker] = Field(default=[], max_length=6)
    period: Period = "1y"
    # Sólo se usan para acotar "max" al inicio real de la cartera.
    portfolio_id: Optional[Uuid] = None
    inception: Optional[str] = None

# --- DATA FETCHING ---
def get_asset_metadata(ticker: str):
    clean_ticker = ticker.strip().upper()
    if clean_ticker == "BTC": clean_ticker = "BTC-EUR"
    try:
        t = yf.Ticker(clean_ticker)
        try:
            info = t.info
            name = info.get('longName') or info.get('shortName') or ticker
            qtype = info.get('quoteType', 'EQUITY')
            sector = info.get('sector') or 'General'
            country = info.get('country') or 'Global'
            currency = info.get('currency') or 'USD'
        except:
            name = ticker; qtype = 'EQUITY'; sector = 'General'; country = 'Global'; currency = 'USD'

        clean_type = 'Stock'
        if 'ETF' in str(qtype).upper(): clean_type = 'ETF'
        elif 'CRYPTO' in str(qtype).upper(): clean_type = 'Crypto'
        elif 'FUND' in str(qtype).upper(): clean_type = 'Fund'

        return { "name": name, "type": clean_type, "sector": sector, "country": country, "currency": currency, "real_ticker": clean_ticker }
    except:
        return { "name": ticker, "type": "Stock", "sector": "Unknown", "country": "Unknown", "currency": "USD", "real_ticker": clean_ticker }

# --- DIVISAS ---
# Yahoo cotiza cada activo en SU divisa: AAPL en dólares, SAP.DE en euros,
# NESN.SW en francos. La app suma todo y lo pinta con un "€" detrás, así que sin
# convertir estaba sumando dólares con euros: el valor total, los pesos reales,
# el plan de rebalanceo y las proyecciones salían mal en cuanto la cartera
# mezclaba divisas (que es el caso por defecto: las carteras semilla llevan
# AAPL, NVDA, URTH y GLD en USD junto a BTC-EUR).
_FX_CACHE = {}        # divisa -> (timestamp, EUR por unidad)
_FX_TTL = 60 * 60     # 1h
_CURRENCY_CACHE = {}  # ticker -> divisa


def _fx_to_eur(currency: str) -> float:
    """Cuántos euros vale 1 unidad de `currency`. 1.0 si no hay dato."""
    cur = (currency or "EUR").upper()
    if cur in ("EUR", ""):
        return 1.0
    now = _time.time()
    hit = _FX_CACHE.get(cur)
    if hit and now - hit[0] < _FX_TTL:
        return hit[1]
    rate = 0.0
    try:
        rate = safe_float(yf.Ticker(f"{cur}EUR=X").fast_info.last_price)
    except Exception:
        rate = 0.0
    # Sin tipo de cambio preferimos el valor nativo a un número inventado.
    rate = rate if rate > 0 else 1.0
    _FX_CACHE[cur] = (now, rate)
    return rate


def _naive_index(s):
    try:
        s.index = s.index.tz_localize(None)
    except (TypeError, AttributeError):
        try:
            s.index = s.index.tz_convert(None)
        except Exception:
            pass
    return s


def _to_eur_frame(df, period: str, interval: str):
    """Pasa a EUR cada columna de precios según la divisa de su ticker.

    Usa el histórico del par de divisas alineado por fecha (no el tipo de hoy):
    convertir una serie de 10 años con el cambio actual falsearía la evolución.
    """
    if df is None or df.empty:
        return df
    out = df.copy()
    curs = {tk: _ticker_currency(tk) for tk in df.columns}
    for cur in {c for c in curs.values() if c and c.upper() not in ("EUR", "")}:
        serie = None
        try:
            fx = yf.download(f"{cur.upper()}EUR=X", period=period, interval=interval, progress=False)["Close"]
            if isinstance(fx, pd.DataFrame):
                fx = fx.iloc[:, 0]
            fx = _naive_index(fx)
            if not fx.dropna().empty:
                serie = fx.reindex(df.index.union(fx.index)).ffill().bfill().reindex(df.index)
        except Exception as e:
            print(f"FX {cur} err: {e}")
        if serie is None or serie.dropna().empty:
            serie = _fx_to_eur(cur)  # sin histórico: tipo actual, mejor que nada
        for tk, c in curs.items():
            if c and c.upper() == cur.upper():
                out[tk] = df[tk] * serie
    return out


def _ticker_currency(ticker: str) -> str:
    """Divisa de cotización. Se deduce del símbolo cuando se puede; solo se
    pregunta a Yahoo si no hay forma de saberlo (una llamada por ticker)."""
    if not ticker:
        return "EUR"
    tk = str(ticker).strip().upper()
    if tk in _CURRENCY_CACHE:
        return _CURRENCY_CACHE[tk]

    cur = None
    if "-" in tk:                       # pares cripto: BTC-EUR, ETH-USD
        quote = tk.rsplit("-", 1)[-1]
        if len(quote) == 3 and quote.isalpha():
            cur = quote
    if cur is None and "." in tk:       # sufijo de mercado: SAP.DE, NESN.SW
        suf = tk.rsplit(".", 1)[-1]
        if suf in _SUFFIX:
            cur = _SUFFIX[suf][1]
    if cur is None:
        try:
            cur = (yf.Ticker(ticker).fast_info.get("currency") or "").upper() or None
        except Exception:
            cur = None
    cur = (cur or "USD").upper()        # sin sufijo y sin dato: Yahoo cotiza en USD
    _CURRENCY_CACHE[tk] = cur
    return cur


def fetch_live_price(ticker: str):
    """Precio actual del activo, siempre EN EUROS."""
    if not ticker: return 0.0
    try:
        t = yf.Ticker(ticker)
        fi = t.fast_info
        price = fi.last_price
        try:
            currency = (fi.get("currency") or "EUR").upper()
        except Exception:
            currency = "EUR"
        _CURRENCY_CACHE[ticker] = currency
        if price is None:
            hist = t.history(period="1d")
            if not hist.empty: price = hist["Close"].iloc[-1]
        return safe_float(safe_float(price) * _fx_to_eur(currency))
    except: return 0.0

def calculate_rsi(ticker: str):
    try:
        df = yf.download(ticker, period="1mo", interval="1d", progress=False)
        if df.empty or len(df) < 14: return 50
        if isinstance(df, pd.DataFrame) and 'Close' in df.columns: close = df['Close']
        else: close = df.iloc[:, 0]
        delta = close.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        rsi = 100 - (100 / (1 + rs))
        return round(safe_float(rsi.iloc[-1]))
    except: return 50

def get_sentiment_label(score):
    if score >= 70: return "Overbought (RSI)", "very_green"
    if score >= 60: return "Bullish (RSI)", "green"
    if score <= 30: return "Oversold (RSI)", "red"
    if score <= 40: return "Bearish (RSI)", "orange"
    return "Neutral (RSI)", "yellow"

# --- ENDPOINTS ---
# Todos exigen Depends(current_user_id). No hay endpoints públicos.
@app.post("/api/portfolios/create")
def create_portfolio(data: CreatePortfolioInput, user_id: str = Standard):
    try:
        res = supabase.table("portfolios").insert({"user_id": user_id, "name": data.name}).execute()
        return res.data[0]
    except Exception as e:
        print(f"CREATE ERROR: {e}")
        raise HTTPException(500, "No se pudo crear la cartera")

@app.get("/api/portfolios/list")
def list_portfolios(user_id: str = Standard):
    res = supabase.table("portfolios").select("*").eq("user_id", user_id).order('created_at').execute()
    return res.data

@app.put("/api/portfolios/rename")
def rename_portfolio(data: RenamePortfolioInput, user_id: str = Standard):
    assert_owns_portfolio(user_id, data.portfolio_id)
    supabase.table("portfolios").update({"name": data.name}).eq("id", data.portfolio_id).execute()
    return {"msg": "OK"}

@app.post("/api/portfolios/duplicate")
def duplicate_portfolio(data: DuplicatePortfolioInput, user_id: str = Standard):
    assert_owns_portfolio(user_id, data.portfolio_id)
    try:
        res = supabase.table("portfolios").insert({"user_id": user_id, "name": data.new_name}).execute()
        new_id = res.data[0]["id"]
        items = supabase.table("portfolio_items").select("*").eq("portfolio_id", data.portfolio_id).execute()
        if items.data:
            new_items = [{"portfolio_id": new_id, "asset_id": i["asset_id"], "units_held": i["units_held"], "target_weight": i["target_weight"]} for i in items.data]
            supabase.table("portfolio_items").insert(new_items).execute()
        return {"msg": "Duplicated"}
    except Exception as e:
        print(f"DUPLICATE ERROR: {e}")
        raise HTTPException(500, "No se pudo duplicar la cartera")

@app.delete("/api/portfolios/delete/{portfolio_id}")
def delete_portfolio(portfolio_id: str, user_id: str = Standard):
    assert_owns_portfolio(user_id, portfolio_id)
    supabase.table("portfolios").delete().eq("id", portfolio_id).execute()
    return {"msg": "OK"}

@app.put("/api/portfolios/update_contribution")
def update_contribution(
    portfolio_id: str,
    amount: float = Query(ge=0, le=1e9),
    user_id: str = Standard,
):
    assert_owns_portfolio(user_id, portfolio_id)
    supabase.table("portfolios").update({"last_contribution": amount}).eq("id", portfolio_id).execute()
    return {"msg": "Updated"}

@app.get("/api/assets/search")
def search_assets(
    q: str = Query(min_length=2, max_length=40),
    user_id: str = External,
):
    if not q or len(q) < 2: return []
    results = []
    try:
        y_res = yf.Search(q, max_results=8).quotes
        for quote in y_res:
            sym = quote.get('symbol')
            if not sym: continue
            qtype = quote.get('quoteType', 'EQUITY')
            dtype = "Stock"
            if 'ETF' in str(qtype): dtype = "ETF"
            elif 'CRYPTO' in str(qtype): dtype = "Crypto"
            elif 'FUND' in str(qtype): dtype = "Fund"
            results.append({ "ticker": sym, "name": quote.get('shortname') or quote.get('longname') or sym, "type_display": dtype, "exchange": quote.get('exchange', '') })
    except: pass
    return results

@app.post("/api/portfolio/add")
def add_asset(data: AddAssetInput, user_id: str = External):
    assert_owns_portfolio(user_id, data.portfolio_id)
    try:
        meta = get_asset_metadata(data.ticker)
        final_ticker = meta['real_ticker']
        asset_id = None
        existing = supabase.table("assets").select("id").eq("ticker", final_ticker).execute()
        if existing.data:
            asset_id = existing.data[0]["id"]
        else:
            try:
                new_asset = supabase.table("assets").insert({
                    "ticker": final_ticker, "name": meta["name"], "type": meta["type"], "sector": meta["sector"], "country": meta["country"], "currency": meta["currency"]
                }).execute()
                if new_asset.data: asset_id = new_asset.data[0]["id"]
            except:
                r = supabase.table("assets").select("id").eq("ticker", final_ticker).execute()
                if r.data: asset_id = r.data[0]["id"]
        if not asset_id: raise HTTPException(500, "Critical error: asset ID not found")
        exists_item = supabase.table("portfolio_items").select("id").eq("portfolio_id", data.portfolio_id).eq("asset_id", asset_id).execute()
        if not exists_item.data:
            supabase.table("portfolio_items").insert({"portfolio_id": data.portfolio_id, "asset_id": asset_id, "units_held": 0, "target_weight": 0}).execute()
        return {"status": "ok", "asset_name": meta["name"]}
    except HTTPException:
        raise
    except Exception as e:
        print(f"ADD ASSET ERROR: {e}")
        raise HTTPException(500, "No se pudo añadir el activo")

def get_portfolio(portfolio_id: str):
    """Uso interno: NO comprueba propiedad. Quien llame debe hacerlo antes."""
    try:
        items = supabase.table("portfolio_items").select("id, units_held, target_weight, asset:assets(id, name, ticker, type, sector)").eq("portfolio_id", portfolio_id).execute()
        data = []
        for i in items.data:
            if not i.get('asset'): continue
            ticker = i['asset']['ticker']
            price = fetch_live_price(ticker)
            val = safe_float(float(i['units_held']) * price)
            data.append({**i, "current_price": price, "value": round(val, 2)})
        total = sum(x["value"] for x in data)
        for x in data: x["real_weight"] = round(x["value"]/total*100, 2) if total > 0 else 0
        return data
    except: return []

@app.get("/api/portfolio/{portfolio_id}")
def read_portfolio(portfolio_id: str, user_id: str = External):
    assert_owns_portfolio(user_id, portfolio_id)
    return get_portfolio(portfolio_id)

@app.put("/api/portfolio/update")
def update_item(data: UpdateItemInput, user_id: str = Standard):
    assert_owns_item(user_id, data.item_id)
    supabase.table("portfolio_items").update({"units_held": data.units_held, "target_weight": data.target_weight}).eq("id", data.item_id).execute()
    return {"msg": "OK"}

@app.delete("/api/portfolio/delete/{item_id}")
def delete_item(item_id: str, user_id: str = Standard):
    assert_owns_item(user_id, item_id)
    supabase.table("portfolio_items").delete().eq("id", item_id).execute()
    return {"msg": "OK"}

# --- REBALANCE ---
@app.post("/api/portfolio/rebalance")
def calculate_rebalance(data: RebalanceInput, user_id: str = External):
    assert_owns_portfolio(user_id, data.portfolio_id)
    port = get_portfolio(data.portfolio_id)
    total = safe_float(sum(x["value"] for x in port))
    future = total + data.contribution
    orders = []
    for x in port:
        price = x["current_price"]
        if price <= 0: continue
        target_val = future * (x["target_weight"] / 100)
        diff = target_val - x["value"]
        orders.append({
            "id": x["id"],
            "asset_name": x["asset"]["name"],
            "ticker": x["asset"]["ticker"],
            "action": "BUY" if diff > 0 else "SELL",
            "units_to_trade": round(diff / price, 4),
            "diff_val": round(diff, 2),
            "price": price
        })
    return {"current_total": total, "contribution": data.contribution, "future_total": future, "orders": orders}

@app.post("/api/portfolio/apply_rebalance")
def apply_rebalance(data: ApplyRebalanceInput, user_id: str = External):
    assert_owns_portfolio(user_id, data.portfolio_id)
    # Los item_id de las órdenes los elige el cliente: solo aceptamos los que
    # pertenecen de verdad a esta cartera.
    valid_items = supabase.table("portfolio_items").select("id").eq("portfolio_id", data.portfolio_id).execute()
    allowed_item_ids = {r["id"] for r in (valid_items.data or [])}
    try:
        port_items = get_portfolio(data.portfolio_id)
        val_before = sum(i['value'] for i in port_items)
        val_after = val_before + data.contribution

        hist = supabase.table("rebalance_history").insert({
            "portfolio_id": data.portfolio_id,
            "contribution": data.contribution,
            "total_value_before": val_before,
            "total_value_after": val_after
        }).execute()
        hist_id = hist.data[0]['id']

        hist_items_data = []
        for order in data.orders:
            units_diff = safe_float(order.get('units_to_trade') or order.get('unitsToTrade'))
            diff_val = safe_float(order.get('diff_val') or order.get('diffVal'))
            price = safe_float(order.get('price'))

            if abs(units_diff) > 0.00001:
                hist_items_data.append({
                    "history_id": hist_id,
                    "asset_name": order.get('asset_name', 'Unknown'),
                    "ticker": order.get('ticker', ''),
                    "action": order.get('action'),
                    "units": abs(units_diff),
                    "amount": abs(diff_val),
                    "price": price
                })

                item_id = order.get('id')
                if item_id in allowed_item_ids:
                    curr = supabase.table("portfolio_items").select("units_held").eq("id", item_id).execute()
                    if curr.data:
                        actual = safe_float(curr.data[0]['units_held'])
                        new_h = max(0.0, actual + units_diff)
                        supabase.table("portfolio_items").update({"units_held": new_h}).eq("id", item_id).execute()

        if hist_items_data:
            supabase.table("rebalance_history_items").insert(hist_items_data).execute()

        supabase.table("portfolios").update({"last_contribution": data.contribution}).eq("id", data.portfolio_id).execute()
        return {"msg": "Applied"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"APPLY ERROR: {e}")
        raise HTTPException(500, "No se pudo aplicar el rebalanceo")

@app.post("/api/portfolio/history/undo")
def undo_rebalance_operation(data: Dict[str, str], user_id: str = Standard):
    history_id = data.get("history_id")
    if not history_id: raise HTTPException(400, "Missing history_id")
    portfolio_id = assert_owns_history(user_id, history_id)
    try:
        items = supabase.table("rebalance_history_items").select("*").eq("history_id", history_id).execute()

        for item in items.data:
            ticker = item['ticker']
            units = safe_float(item['units'])
            action = item['action']

            asset_res = supabase.table("assets").select("id").eq("ticker", ticker).execute()
            if not asset_res.data: continue
            asset_id = asset_res.data[0]['id']

            p_item = supabase.table("portfolio_items").select("id, units_held").eq("portfolio_id", portfolio_id).eq("asset_id", asset_id).execute()
            if not p_item.data: continue

            current_units = safe_float(p_item.data[0]['units_held'])
            item_id = p_item.data[0]['id']

            if action == 'BUY':
                new_units = max(0.0, current_units - units)
            else:
                new_units = current_units + units

            supabase.table("portfolio_items").update({"units_held": new_units}).eq("id", item_id).execute()

        supabase.table("rebalance_history").delete().eq("id", history_id).execute()
        return {"msg": "Undone successfully"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"UNDO ERROR: {e}")
        raise HTTPException(500, "No se pudo deshacer la operación")

@app.delete("/api/portfolio/history/delete/{history_id}")
def delete_history_entry(history_id: str, user_id: str = Standard):
    assert_owns_history(user_id, history_id)
    try:
        supabase.table("rebalance_history").delete().eq("id", history_id).execute()
        return {"msg": "Deleted"}
    except Exception as e:
        print(f"DELETE HISTORY ERROR: {e}")
        raise HTTPException(500, "No se pudo borrar la operación")

@app.get("/api/portfolio/history/{portfolio_id}")
def get_rebalance_history(portfolio_id: str, user_id: str = Standard):
    assert_owns_portfolio(user_id, portfolio_id)
    try:
        hists = supabase.table("rebalance_history").select("*").eq("portfolio_id", portfolio_id).order('created_at', desc=True).execute()
        if not hists.data: return []
        res = []
        for h in hists.data:
            items = supabase.table("rebalance_history_items").select("*").eq("history_id", h['id']).execute()
            res.append({**h, "items": items.data})
        return res
    except: return []

# --- CHART & NEWS ---
def _parse_inception(valor):
    """Fecha de inicio enviada por el cliente, sin zona horaria y validada."""
    if not valor:
        return None
    try:
        d = pd.to_datetime(valor)
        try:
            d = d.tz_localize(None)
        except (TypeError, AttributeError):
            d = d.tz_convert(None) if getattr(d, "tzinfo", None) else d
        # Una fecha absurda (futuro, o anterior a que existieran los mercados
        # electrónicos) se ignora en vez de vaciar el gráfico.
        if d > pd.Timestamp.utcnow().tz_localize(None) or d < pd.Timestamp("1970-01-01"):
            return None
        return d
    except Exception:
        return None


_INCEPTION_CACHE = {}

def _portfolio_inception(portfolio_id):
    """Fecha desde la que tiene sentido dibujar esta cartera.

    Se toma la creación de la cartera y, si hay rebalanceos registrados, el más
    antiguo de los dos: alguien puede haber creado la cartera antes de empezar a
    aportar, pero nunca al revés. Devuelve None si no se puede determinar, y en
    ese caso no se recorta nada (mejor de más que ocultar histórico real).
    """
    cached = _INCEPTION_CACHE.get(portfolio_id)
    if cached is not None:
        return cached
    dates = []
    try:
        p = supabase.table("portfolios").select("created_at").eq("id", portfolio_id).limit(1).execute()
        if p.data and p.data[0].get("created_at"):
            dates.append(pd.to_datetime(p.data[0]["created_at"]))
        h = (supabase.table("rebalance_history").select("created_at")
             .eq("portfolio_id", portfolio_id).order("created_at").limit(1).execute())
        if h.data and h.data[0].get("created_at"):
            dates.append(pd.to_datetime(h.data[0]["created_at"]))
    except Exception as e:
        print(f"INCEPTION {portfolio_id} err: {e}")
        return None
    if not dates:
        return None
    # Las series de yfinance llegan sin zona horaria; hay que igualar para poder
    # comparar sin que pandas lance TypeError.
    out = min(dates)
    try:
        out = out.tz_localize(None)
    except (TypeError, AttributeError):
        out = out.tz_convert(None) if getattr(out, "tzinfo", None) else out
    _INCEPTION_CACHE[portfolio_id] = out
    return out


@app.post("/api/portfolio/history_chart")
def get_chart_data(data: HistoryInput, user_id: str = External):
    assert_owns_portfolio(user_id, data.portfolio_id)
    try:
        query = supabase.table("portfolio_items").select("units_held, asset:assets(ticker)").eq("portfolio_id", data.portfolio_id).gt("units_held", 0)
        items = query.execute()

        if not items.data: return {"history": [], "change_pct": 0, "change_val": 0}

        tickers_map = {}
        for i in items.data:
            if i.get('asset') and i['asset'].get('ticker'):
                if data.ticker and i['asset']['ticker'] != data.ticker:
                    continue
                tickers_map[i['asset']['ticker']] = float(i['units_held'])

        if not tickers_map: return {"history": [], "change_pct": 0, "change_val": 0}

        interval = "1d"
        if data.period in ["1d", "5d"]: interval = "15m"
        elif data.period in ["1mo", "3mo"]: interval = "1h"

        df = yf.download(list(tickers_map.keys()), period=data.period, interval=interval, progress=False)["Close"]

        if isinstance(df, pd.Series):
            df = df.to_frame(name=list(tickers_map.keys())[0])
        elif len(tickers_map) == 1:
            df.columns = [list(tickers_map.keys())[0]]

        df.index = df.index.tz_localize(None)
        # A EUR antes de sumar: si no, la serie mezcla dólares con euros.
        df = _to_eur_frame(df, data.period, interval)
        df = df.ffill().bfill().fillna(0)

        total_series = pd.Series(0.0, index=df.index)
        for ticker, units in tickers_map.items():
            if ticker in df.columns:
                total_series += df[ticker] * units

        total_series = total_series[total_series > 0]

        # "MAX" es el máximo DE ESTA CARTERA, no el del activo más antiguo que
        # contiene. Sin este recorte, una cartera creada hace seis meses con
        # Apple dentro dibujaba una curva desde 1980: técnicamente es el
        # histórico de Apple, pero no es el patrimonio de nadie.
        if data.period == "max":
            inception = _parse_inception(data.inception) or _portfolio_inception(data.portfolio_id)
            if inception is not None:
                total_series = total_series[total_series.index >= inception]

        if total_series.empty: return {"history": [], "change_pct": 0, "change_val": 0}

        history = [{"date": d.isoformat(), "value": round(safe_float(v), 2)} for d, v in total_series.items()]

        start = history[0]["value"]
        end = history[-1]["value"]
        diff = end - start
        pct = (diff / start * 100) if start > 0 else 0

        return {"history": history, "change_val": round(diff, 2), "change_pct": round(pct, 2)}
    except Exception as e:
        print(f"Chart Error: {e}")
        return {"history": [], "change_pct": 0, "change_val": 0}

@app.post("/api/portfolio/news")
def get_news(data: NewsInput, user_id: str = External):
    import re
    news_map = {}
    sentiments = {}
    total_score = 0; count = 0

    def clean_asset_name(name, ticker):
        cleaned = re.sub(r'(?i)(UCITS|ETF|Acc|Dist|EUR|USD|Class|\(.*\)|Corp|Bond|Index|Fund|iShares|Vanguard|Amundi|Xtrackers|SPDR|Invesco)', '', name)
        cleaned = " ".join(cleaned.split())
        return cleaned if len(cleaned) > 3 else ticker

    for asset in data.assets:
        ticker = asset.get('ticker')
        name = asset.get('name', '')
        if not ticker: continue

        query_term = clean_asset_name(name, ticker)
        rss_url = f"https://news.google.com/rss/search?q={urllib.parse.quote(query_term + ' finance news')}&hl=en-US&gl=US&ceid=US:en"

        try:
            feed = feedparser.parse(rss_url)
            items = []
            for e in feed.entries[:4]:
                items.append({
                    "title": e.title,
                    "link": e.link,
                    "publisher": e.source.title if hasattr(e,'source') else "News",
                    "time": e.published if hasattr(e,'published') else "Recent"
                })
            news_map[ticker] = items
        except: news_map[ticker] = []

        score = calculate_rsi(ticker)
        lbl, col = get_sentiment_label(score)
        sentiments[ticker] = {"score": score, "label": lbl, "color": col}
        total_score += score; count += 1

    avg = round(total_score/count) if count > 0 else 50
    albl, acol = get_sentiment_label(avg)
    return {"news": news_map, "sentiments": sentiments, "aggregate": {"score": avg, "label": albl, "color": acol}}

@app.post("/api/simulations/run")
def run_sim(data: SimulationInput, user_id: str = Heavy):
    for pid in data.portfolio_ids:
        assert_owns_portfolio(user_id, pid)
    results = []
    base_rate = 0.07
    volatility = 0.0

    if data.sim_type == 'pessimistic': base_rate = 0.04
    elif data.sim_type == 'montecarlo': volatility = 0.15

    monthly_rate = base_rate / 12
    monthly_vol = volatility / (12 ** 0.5)

    for pid in data.portfolio_ids:
        port = get_portfolio(pid)
        current_val = sum(x['value'] for x in port)
        if current_val == 0: current_val = data.initial_capital

        points = []
        curr = current_val
        invested = current_val
        monthly_contrib = data.monthly_contribution

        # La subida por IPC se reparte mes a mes en vez de saltar de golpe una
        # vez al año: el mes 13 acumula exactamente una subida anual completa.
        # Es el mismo modelo que dibuja el calendario de aportaciones en la app
        # (buildContributionSchedule), y así los dos nunca se contradicen.
        # max(0, ...) evita que un -150% genere una raíz duodécima de negativo.
        growth_factor = 1.0
        if data.contribution_mode == 'growing':
            growth_factor = max(0.0, 1 + (data.growth_rate / 100)) ** (1 / 12)

        for m in range(data.years * 12 + 1):
            if m > 0:
                if m > 1:
                    monthly_contrib *= growth_factor
                pct_change = monthly_rate
                if data.sim_type == 'montecarlo':
                    pct_change += np.random.normal(0, monthly_vol)
                curr = curr * (1 + pct_change) + monthly_contrib
                invested += monthly_contrib

            if m % 12 == 0:
                points.append({"year": m/12, "value": round(curr)})

        gain = curr - invested
        tax_paid = 0
        if data.tax_rate and gain > 0: tax_paid = gain * 0.19
        final_net = curr - tax_paid

        results.append({
            "portfolio_id": pid, "portfolio_name": "Portfolio",
            "data": points, "final_gross": round(curr), "final_net": round(final_net),
            "total_invested": round(invested), "tax_paid": round(tax_paid), "gain": round(gain)
        })
    return results

# --- PORTFOLIO X-RAY (look-through) ---

# Exchange-suffix -> (country, currency)
_SUFFIX = {
    '': ('United States', 'USD'), 'TW': ('Taiwan', 'TWD'), 'KS': ('South Korea', 'KRW'), 'KQ': ('South Korea', 'KRW'),
    'HK': ('Hong Kong', 'HKD'), 'T': ('Japan', 'JPY'), 'L': ('United Kingdom', 'GBP'), 'AS': ('Netherlands', 'EUR'),
    'PA': ('France', 'EUR'), 'DE': ('Germany', 'EUR'), 'F': ('Germany', 'EUR'), 'MC': ('Spain', 'EUR'),
    'MI': ('Italy', 'EUR'), 'BR': ('Belgium', 'EUR'), 'LS': ('Portugal', 'EUR'), 'VI': ('Austria', 'EUR'),
    'IR': ('Ireland', 'EUR'), 'HE': ('Finland', 'EUR'),
    'SW': ('Switzerland', 'CHF'), 'TO': ('Canada', 'CAD'), 'V': ('Canada', 'CAD'), 'AX': ('Australia', 'AUD'),
    'SS': ('China', 'CNY'), 'SZ': ('China', 'CNY'), 'NS': ('India', 'INR'), 'BO': ('India', 'INR'),
    'SA': ('Brazil', 'BRL'), 'MX': ('Mexico', 'MXN'), 'ST': ('Sweden', 'SEK'), 'OL': ('Norway', 'NOK'),
    'CO': ('Denmark', 'DKK'), 'JO': ('South Africa', 'ZAR'), 'SI': ('Singapore', 'SGD'),
}

def _loc_from_symbol(symbol):
    parts = str(symbol).split('.')
    suf = parts[-1] if len(parts) > 1 else ''
    return _SUFFIX.get(suf.upper(), ('United States' if suf == '' else 'Other', 'USD'))

# Índice de referencia -> (etiqueta de región, divisa, pesos por país).
#
# Yahoo solo da las 10 primeras posiciones de cada fondo (un 20-35% del total),
# y ese top 10 son casi siempre megacaps estadounidenses. Repartir el 65-80%
# restante entre esas 10 empresas convertía cualquier ETF global en "100%
# Estados Unidos" y hacía desaparecer del mapa a Alemania, Francia o Japón.
#
# Para la geografía usamos por tanto los pesos por país del índice que replica
# el fondo, no una extrapolación de su top 10. Son cifras APROXIMADAS (cierre
# de 2025) y la app las etiqueta como estimación; se normalizan a 1.0 al
# usarlas, así que no hace falta que sumen exactamente 100.
_INDEX_PROFILES = {
    'us': ('United States', 'USD', {'United States': 100}),
    'japan': ('Japan', 'JPY', {'Japan': 100}),
    'china': ('China', 'CNY', {'China': 100}),
    'world': ('Global (diversified)', 'USD', {
        'United States': 71.0, 'Japan': 5.5, 'United Kingdom': 3.7, 'Canada': 3.2,
        'France': 2.6, 'Switzerland': 2.5, 'Germany': 2.4, 'Australia': 1.9,
        'Netherlands': 1.4, 'Sweden': 0.9, 'Denmark': 0.8, 'Italy': 0.8, 'Spain': 0.7,
        'Hong Kong': 0.5, 'Singapore': 0.4, 'Finland': 0.2, 'Belgium': 0.2,
        'Norway': 0.2, 'Ireland': 0.2, 'Israel': 0.2, 'Other': 0.7,
    }),
    'acwi': ('Global (diversified)', 'USD', {
        'United States': 64.0, 'Japan': 5.0, 'United Kingdom': 3.3, 'China': 3.2,
        'Canada': 2.9, 'Taiwan': 2.4, 'France': 2.3, 'Switzerland': 2.2, 'Germany': 2.2,
        'India': 2.2, 'Australia': 1.7, 'South Korea': 1.3, 'Netherlands': 1.2,
        'Sweden': 0.8, 'Italy': 0.7, 'Brazil': 0.6, 'Denmark': 0.6, 'Spain': 0.6,
        'Other': 2.8,
    }),
    'europe': ('Europe (diversified)', 'EUR', {
        'United Kingdom': 22.0, 'France': 16.0, 'Switzerland': 15.0, 'Germany': 14.0,
        'Netherlands': 7.0, 'Sweden': 5.0, 'Denmark': 4.5, 'Italy': 4.5, 'Spain': 4.5,
        'Finland': 1.5, 'Belgium': 1.3, 'Norway': 1.2, 'Ireland': 1.0, 'Austria': 0.7,
        'Portugal': 0.4, 'Other': 1.4,
    }),
    'eurozone': ('Europe (diversified)', 'EUR', {
        'France': 34.0, 'Germany': 29.0, 'Netherlands': 14.0, 'Spain': 9.0, 'Italy': 8.0,
        'Belgium': 2.5, 'Finland': 2.0, 'Ireland': 1.0, 'Austria': 0.5,
    }),
    'em': ('Emerging Markets', 'USD', {
        'China': 28.0, 'Taiwan': 20.0, 'India': 17.0, 'South Korea': 11.0, 'Brazil': 4.0,
        'Saudi Arabia': 3.5, 'South Africa': 3.0, 'Mexico': 2.0, 'Other': 11.5,
    }),
    'global_small': ('Global small cap (diversified)', 'USD', {
        'United States': 58.0, 'Japan': 10.0, 'United Kingdom': 5.0, 'Canada': 4.0,
        'Australia': 3.0, 'Germany': 2.5, 'Sweden': 2.5, 'Switzerland': 2.0,
        'France': 2.0, 'Italy': 1.5, 'Other': 9.5,
    }),
    'asia_pac': ('Asia-Pacific (diversified)', 'USD', {
        'Japan': 40.0, 'Australia': 18.0, 'South Korea': 13.0, 'Taiwan': 12.0,
        'Hong Kong': 9.0, 'Singapore': 6.0, 'New Zealand': 2.0,
    }),
}


def _index_key(name, ticker):
    """Clasifica un fondo por el índice que replica, a partir de su nombre."""
    n = f"{name} {ticker}".lower()
    if 'japan' in n or 'jpn' in n: return 'japan'
    if 'emerg' in n or 'emrg' in n: return 'em'
    if 'eurozone' in n or 'euro stoxx' in n or 'emu' in n: return 'eurozone'
    if 'europ' in n: return 'europe'
    if 'small cap' in n or 'smallcap' in n: return 'global_small'
    if 'acwi' in n or 'all-world' in n or 'all world' in n: return 'acwi'
    if 'world' in n or 'global' in n: return 'world'
    if 'u.s' in n or ' us ' in f" {n} " or 's&p' in n or '500' in n or 'nasdaq' in n or 'north america' in n: return 'us'
    if 'china' in n: return 'china'
    if 'pacific' in n or 'asia' in n: return 'asia_pac'
    return 'world'


def _etf_region(name, ticker):
    region, currency, _ = _INDEX_PROFILES[_index_key(name, ticker)]
    return (region, currency)


def _etf_countries(name, ticker):
    """Pesos por país del fondo, normalizados a 1.0."""
    _, _, weights = _INDEX_PROFILES[_index_key(name, ticker)]
    total = sum(weights.values()) or 1
    return {c: round(w / total, 6) for c, w in weights.items()}

_XRAY_CACHE = {}  # ticker -> (timestamp, payload)
_XRAY_TTL = 60 * 60 * 12  # 12h

def _etf_lookthrough(ticker, name):
    key = ticker.upper()
    now = _time.time()
    cached = _XRAY_CACHE.get(key)
    if cached and now - cached[0] < _XRAY_TTL:
        return cached[1]

    holdings, sectors, coverage = [], {}, 0.0
    try:
        fd = yf.Ticker(ticker).funds_data

        # Yahoo sólo publica las 10 mayores posiciones de un fondo (~20-35% del
        # patrimonio). No hay forma de sacar el resto por aquí: `equity_holdings`
        # NO es la lista de posiciones, son 6 métricas de valoración
        # (Price/Earnings, Price/Book…), así que no sirve para esto.
        # Para un look-through completo haría falta el fichero de posiciones que
        # publica la gestora o un proveedor de pago.
        th = getattr(fd, 'top_holdings', None)
        if th is not None and not th.empty:
            for sym, row in th.iterrows():
                w = safe_float(row.get('Holding Percent'))
                if w <= 0:
                    continue
                coverage += w
                country, currency = _loc_from_symbol(sym)
                holdings.append({
                    "symbol": str(sym), "name": str(row.get('Name') or sym),
                    "weight": round(w, 6), "country": country, "currency": currency
                })

        sw = getattr(fd, 'sector_weightings', None) or {}
        for s, w in sw.items():
            sectors[str(s)] = round(safe_float(w), 6)
    except Exception as e:
        print(f"XRAY etf {ticker} err: {e}")

    region, region_currency = _etf_region(name, ticker)
    payload = {
        "holdings": holdings, "sectors": sectors,
        "coverage": round(min(1.0, coverage), 6),
        "region": region, "currency": region_currency,
        # Geografía del fondo entero, independiente del top 10 (ver _INDEX_PROFILES).
        "countries": _etf_countries(name, ticker), "countries_estimated": True,
    }
    _XRAY_CACHE[key] = (now, payload)
    return payload

@app.post("/api/portfolio/xray")
def portfolio_xray(data: XrayInput, user_id: str = External):
    out = []
    for p in data.positions:
        ticker = (p.get("ticker") or "").strip()
        name = p.get("name") or ticker
        ptype = (p.get("type") or "Stock")
        value = safe_float(p.get("value"))
        is_fund = str(ptype).upper() in ("ETF", "FUND")

        if is_fund and ticker:
            lt = _etf_lookthrough(ticker, name)
            out.append({
                "ticker": ticker, "name": name, "type": ptype, "value": value,
                "coverage": lt["coverage"], "holdings": lt["holdings"],
                "sectors": lt["sectors"], "region": lt["region"], "currency": lt["currency"],
                "countries": lt["countries"], "countries_estimated": True,
            })
        else:
            # single asset (stock / crypto / other) counts fully as itself
            country = p.get("country") or _loc_from_symbol(ticker)[0]
            currency = p.get("currency") or _loc_from_symbol(ticker)[1]
            sector = p.get("sector")
            out.append({
                "ticker": ticker, "name": name, "type": ptype, "value": value,
                "coverage": 1.0,
                "holdings": [{"symbol": ticker, "name": name, "weight": 1.0, "country": country, "currency": currency}],
                "countries": {country: 1.0}, "countries_estimated": False,
                "sectors": ({sector: 1.0} if sector and str(sector).lower() not in ("general", "unknown", "") else {}),
                "region": country, "currency": currency
            })
    return {"positions": out}

# --- BENCHMARK COMPARISON ---
BENCHMARK_LABELS = {
    "^GSPC": "S&P 500", "URTH": "MSCI World", "^IXIC": "Nasdaq 100",
    "^STOXX50E": "Euro Stoxx 50", "ACWI": "MSCI ACWI", "GLD": "Gold",
    "BTC-EUR": "Bitcoin", "AGG": "US Aggregate Bond", "^N225": "Nikkei 225",
    "EEM": "Emerging Markets",
}

def _series_stats(s):
    """Absolute metrics of one value series: return, CAGR, volatility, max drawdown.

    Beta and correlation are NOT here on purpose: they only mean something
    against a reference, so they live in _relative_metrics().
    """
    s = s.dropna()
    if len(s) < 2:
        return {"return_pct": 0, "cagr": 0, "volatility": 0, "max_drawdown": 0}
    ret = (s.iloc[-1] / s.iloc[0] - 1) * 100
    years = max((s.index[-1] - s.index[0]).days / 365.25, 1e-6)
    cagr = ((s.iloc[-1] / s.iloc[0]) ** (1 / years) - 1) * 100 if s.iloc[0] > 0 else 0
    daily = s.pct_change().dropna()
    vol = safe_float(daily.std() * (252 ** 0.5) * 100)
    cummax = s.cummax()
    max_dd = safe_float(((s - cummax) / cummax).min() * 100)
    return {"return_pct": round(safe_float(ret), 2), "cagr": round(safe_float(cagr), 2),
            "volatility": round(vol, 2), "max_drawdown": round(max_dd, 2)}


# Overlapping observations needed before beta/correlation are worth showing.
# Below this the numbers are noise, so we say "not enough data" instead.
MIN_RELATIVE_POINTS = 10


def _relative_metrics(port_returns, bench_returns):
    """Beta and correlation of the portfolio against ONE benchmark.

    Returns {"status", "beta", "correlation", "points"} where status is:
      - "ok"                : at least one of the two metrics is available
      - "insufficient_data" : the two series don't overlap on enough dates
      - "not_computable"    : the maths breaks down (flat benchmark → division
                              by zero, flat portfolio → undefined correlation)

    Each metric is None when that particular one is undefined, so the client can
    show a message per cell. NaN/Infinity never leave this function.
    """
    empty = {"status": "insufficient_data", "beta": None, "correlation": None, "points": 0}
    if port_returns is None or bench_returns is None:
        return empty

    # Aligning on the date index is what handles series of different lengths:
    # only dates present (and finite) in both survive.
    aligned = pd.concat([port_returns.rename("p"), bench_returns.rename("b")], axis=1)
    aligned = aligned.replace([np.inf, -np.inf], np.nan).dropna()
    n = int(len(aligned))
    if n < MIN_RELATIVE_POINTS:
        return {**empty, "points": n}

    bench_var = safe_float(aligned["b"].var())
    port_std = safe_float(aligned["p"].std())

    beta = None
    if bench_var > 1e-12:
        raw = safe_float(aligned["p"].cov(aligned["b"])) / bench_var
        if math.isfinite(raw):
            beta = round(raw, 2)

    corr = None
    # Pearson is 0/0 when either side is flat, so both need to actually move.
    if bench_var > 1e-12 and port_std > 1e-12:
        raw = aligned["p"].corr(aligned["b"])
        raw = float(raw) if raw is not None else float("nan")
        if math.isfinite(raw):
            corr = round(max(-1.0, min(1.0, raw)), 2)

    status = "ok" if (beta is not None or corr is not None) else "not_computable"
    return {"status": status, "beta": beta, "correlation": corr, "points": n}

@app.post("/api/portfolio/benchmark")
def portfolio_benchmark(data: BenchmarkInput, user_id: str = External):
    try:
        holdings = {}
        for h in data.holdings:
            tk = (h.get("ticker") or "").strip().upper()
            if tk == "BTC":
                tk = "BTC-EUR"
            u = safe_float(h.get("units"))
            if tk and u > 0:
                holdings[tk] = holdings.get(tk, 0) + u

        benches = [b for b in (data.benchmarks or []) if b][:6]
        all_tickers = list(set(list(holdings.keys()) + benches))
        if not all_tickers:
            return {"series": [], "stats": {}, "labels": {}, "relative": {}}

        interval = "1d"
        if data.period in ["1d", "5d"]:
            interval = "60m"

        df = yf.download(all_tickers, period=data.period, interval=interval, progress=False)["Close"]
        if isinstance(df, pd.Series):
            df = df.to_frame(name=all_tickers[0])
        elif len(all_tickers) == 1:
            df.columns = [all_tickers[0]]
        df.index = df.index.tz_localize(None)
        # Todo a EUR: la cartera se suma en euros, y comparar su rentabilidad
        # con un índice en dólares mezclaría la deriva del cambio en un solo
        # lado. Para quien invierte en euros, el S&P 500 rinde lo que rinde
        # en euros.
        df = _to_eur_frame(df, data.period, interval)
        # Keep the unfilled prices around: filling turns a missing history into a
        # flat line, and a flat line quietly fakes a beta/correlation out of thin
        # air. The chart uses the filled frame, the relative metrics use `raw`.
        raw = df.copy()
        df = df.ffill().bfill()

        # Igual que en el gráfico de patrimonio: "max" es el máximo de esta
        # cartera. El recorte va ANTES de normalizar a base 100, porque si no la
        # referencia sería un precio anterior a que la cartera existiera y todos
        # los porcentajes saldrían medidos desde ahí.
        if data.period == "max" and data.portfolio_id:
            assert_owns_portfolio(user_id, data.portfolio_id)
            inception = _parse_inception(data.inception) or _portfolio_inception(data.portfolio_id)
            if inception is not None:
                df = df[df.index >= inception]
                raw = raw[raw.index >= inception]
                if df.empty:
                    return {"series": [], "stats": {}, "labels": {}, "relative": {}}

        # Portfolio value series from current holdings.
        port = pd.Series(0.0, index=df.index)
        have_port = False
        for tk, units in holdings.items():
            if tk in df.columns:
                port = port + df[tk].fillna(0) * units
                have_port = True
        port = port[port > 0]

        # Build normalized (base 100) combined series on the common date index.
        cols = {}
        if have_port and len(port) > 1:
            cols["portfolio"] = (port / port.iloc[0]) * 100
        for b in benches:
            if b in df.columns:
                s = df[b].dropna()
                if len(s) > 1:
                    cols[b] = (s / s.iloc[0]) * 100

        if not cols:
            return {"series": [], "stats": {}, "labels": {}, "relative": {}}

        combined = pd.concat(cols.values(), axis=1, keys=cols.keys()).dropna()
        series = [{"date": d.isoformat(), **{k: round(safe_float(combined.loc[d, k]), 2) for k in cols}} for d in combined.index]

        # Absolute stats, one row per line on the chart.
        stats = {}
        if "portfolio" in cols:
            stats["portfolio"] = _series_stats(port)
        for b in benches:
            if b in df.columns:
                stats[b] = _series_stats(df[b])

        # Relative stats: the portfolio's beta/correlation against EVERY selected
        # benchmark, so switching reference in the UI costs no extra round-trip.
        relative = {}
        if "portfolio" in cols:
            port_daily = port.pct_change().dropna()
            for b in benches:
                bench_daily = raw[b].dropna().pct_change().dropna() if b in raw.columns else None
                relative[b] = _relative_metrics(port_daily, bench_daily)

        labels = {b: BENCHMARK_LABELS.get(b, b) for b in benches}
        return {"series": series, "stats": stats, "labels": labels, "relative": relative,
                "start": series[0]["date"] if series else None, "end": series[-1]["date"] if series else None}
    except Exception as e:
        print(f"BENCHMARK ERROR: {e}")
        return {"series": [], "stats": {}, "labels": {}, "relative": {}}

# --- SEED DEFAULT PORTFOLIOS (for new, non-admin users) ---
# Mix of asset types so the app is exercised beyond ETFs: stocks, ETFs, a bond
# ETF (renta fija), gold and crypto. Risk profile ≈ equities+crypto weight.
SEED_PORTFOLIOS = [
    {"name": "Conservadora (20% riesgo)", "assets": [
        ("URTH", 18, 3), ("AGG", 62, 12), ("GLD", 15, 4), ("BTC-EUR", 5, 0.002),
    ]},
    {"name": "Moderada (50% riesgo)", "assets": [
        ("URTH", 28, 5), ("AAPL", 8, 2), ("NVDA", 7, 3), ("AGG", 37, 8),
        ("GLD", 10, 3), ("BTC-EUR", 10, 0.004),
    ]},
    {"name": "Agresiva (80% riesgo)", "assets": [
        ("URTH", 28, 5), ("NVDA", 14, 5), ("AAPL", 10, 3), ("MSFT", 8, 2),
        ("AGG", 8, 2), ("GLD", 8, 2), ("BTC-EUR", 16, 0.006), ("ETH-EUR", 8, 0.1),
    ]},
]

def _get_or_create_asset(ticker):
    meta = get_asset_metadata(ticker)
    final_ticker = meta['real_ticker']
    existing = supabase.table("assets").select("id").eq("ticker", final_ticker).execute()
    if existing.data:
        return existing.data[0]["id"]
    try:
        new_asset = supabase.table("assets").insert({
            "ticker": final_ticker, "name": meta["name"], "type": meta["type"],
            "sector": meta["sector"], "country": meta["country"], "currency": meta["currency"]
        }).execute()
        if new_asset.data:
            return new_asset.data[0]["id"]
    except Exception:
        r = supabase.table("assets").select("id").eq("ticker", final_ticker).execute()
        if r.data:
            return r.data[0]["id"]
    return None

@app.post("/api/portfolios/seed_defaults")
def seed_defaults(user_id: str = Seed):
    try:
        # Never seed if the user already has portfolios.
        existing = supabase.table("portfolios").select("id").eq("user_id", user_id).limit(1).execute()
        if existing.data:
            return {"status": "skipped", "reason": "already has portfolios"}

        created = []
        for pdef in SEED_PORTFOLIOS:
            pf = supabase.table("portfolios").insert({"user_id": user_id, "name": pdef["name"]}).execute()
            if not pf.data:
                continue
            pid = pf.data[0]["id"]
            created.append(pid)
            for ticker, weight, units in pdef["assets"]:
                try:
                    asset_id = _get_or_create_asset(ticker)
                    if not asset_id:
                        continue
                    supabase.table("portfolio_items").insert({
                        "portfolio_id": pid, "asset_id": asset_id,
                        "units_held": units, "target_weight": weight
                    }).execute()
                except Exception as e:
                    print(f"SEED item {ticker} err: {e}")
        return {"status": "ok", "created": len(created)}
    except Exception as e:
        print(f"SEED ERROR: {e}")
        raise HTTPException(500, "No se pudieron crear las carteras de ejemplo")

@app.get("/api/mercado/volatilidad")
def volatilidad_mercado(user_id: str = External):
    """VIX de las últimas sesiones y si procede ensanchar la banda de reajuste.

    Indexa ensancha el umbral 0,5 p.p. cuando el VIX supera 35 durante más de
    tres días hábiles. Se mira una ventana corta y se cuentan los cierres por
    encima del umbral: pedir tres *consecutivos* dejaría fuera un pico que baja
    un día y vuelve a subir, que es exactamente el mercado revuelto que la regla
    quiere cubrir.

    Si Yahoo no responde se devuelve `alto=False`: ante la duda, la banda normal.
    Ensanchar por un fallo de red significaría dejar de avisar de desviaciones
    reales.
    """
    try:
        hist = yf.Ticker("^VIX").history(period="1mo")["Close"].dropna()
        if hist.empty:
            return {"disponible": False, "alto": False, "ultimo": None, "dias_por_encima": 0}
        ultimos = [float(x) for x in hist.tail(10)]
        recientes = ultimos[-6:]
        por_encima = sum(1 for v in recientes if v > VIX_UMBRAL)
        return {
            "disponible": True,
            "alto": por_encima > 3,
            "ultimo": round(ultimos[-1], 2),
            "dias_por_encima": por_encima,
            "umbral": VIX_UMBRAL,
        }
    except Exception as e:
        print(f"VIX ERROR: {e}")
        return {"disponible": False, "alto": False, "ultimo": None, "dias_por_encima": 0}

@app.post("/api/cuenta/reset")
def reset_cuenta(data: Dict[str, Any], user_id: str = Standard):
    """Deja los datos del usuario a cero sin desmontarle la cartera.

    Se borra lo acumulado —historial de rebalanceos y unidades— y se conservan
    las carteras, los activos y los pesos objetivo: rehacer a mano un reparto de
    cinco fondos es trabajo real, y "poner los datos a cero" no significa
    empezar de nuevo desde la pantalla vacía. Las simulaciones no se tocan
    porque no se guardan: se calculan cada vez.

    Exige confirmacion=True en el cuerpo. Es irreversible y no hay papelera.
    """
    if not data.get("confirmacion"):
        raise HTTPException(400, "Falta la confirmación")

    try:
        carteras = supabase.table("portfolios").select("id").eq("user_id", user_id).execute().data or []
        ids = [c["id"] for c in carteras]
        if not ids:
            return {"status": "ok", "carteras": 0, "historial": 0, "posiciones": 0}

        # El historial se borra por cartera; los items de cada entrada caen con
        # ella si hay ON DELETE CASCADE, y si no, se limpian antes.
        borradas = 0
        for pid in ids:
            hist = supabase.table("rebalance_history").select("id").eq("portfolio_id", pid).execute().data or []
            for h in hist:
                try:
                    supabase.table("rebalance_history_items").delete().eq("history_id", h["id"]).execute()
                except Exception:
                    pass
            if hist:
                supabase.table("rebalance_history").delete().eq("portfolio_id", pid).execute()
                borradas += len(hist)

        # Unidades a cero, objetivos intactos.
        posiciones = 0
        for pid in ids:
            items = supabase.table("portfolio_items").select("id").eq("portfolio_id", pid).execute().data or []
            if items:
                supabase.table("portfolio_items").update({"units_held": 0}).eq("portfolio_id", pid).execute()
                posiciones += len(items)
            supabase.table("portfolios").update({"last_contribution": 0}).eq("id", pid).execute()

        return {"status": "ok", "carteras": len(ids), "historial": borradas, "posiciones": posiciones}
    except HTTPException:
        raise
    except Exception as e:
        print(f"RESET ERROR: {e}")
        raise HTTPException(500, "No se pudieron reiniciar los datos")

class IsinAResolver(BaseModel):
    item_id: str = Field(min_length=1, max_length=64)
    isin: str = Field(min_length=8, max_length=16)
    # Último precio al que el bróker ejecutó, en euros. Sirve para elegir entre
    # los símbolos del mismo fondo: un ISIN cotiza en varias bolsas y divisas, y
    # sólo uno se corresponde con lo que el usuario pagó.
    precio_ref: float = Field(gt=0, le=1e7)


class ResolverIsinInput(BaseModel):
    activos: List[IsinAResolver] = Field(min_length=1, max_length=25)


@app.post("/api/assets/resolver_isin")
def resolver_isin(data: ResolverIsinInput, user_id: str = External):
    """Deja cada posición apuntando a un símbolo con cotización en vivo.

    Los activos dados de alta buscando por nombre acaban a veces en otra clase
    de participación, en otra divisa o en un símbolo sin datos, y entonces la
    posición se valora mal o a cero. El ISIN identifica el fondo sin ambigüedad
    y viene en el CSV del bróker, así que es la referencia buena.

    Se resuelven todos en una sola petición: cada ISIN son varias llamadas al
    proveedor y hacerlo de uno en uno multiplicaba las idas y venidas. Hay un
    presupuesto de tiempo porque la función tiene límite; lo que no dé tiempo a
    resolver se devuelve como pendiente y se reintenta en la siguiente
    importación, en vez de agotar la petición entera.
    """
    inicio = _time.time()
    PRESUPUESTO = 40.0

    resultados = []
    for a in data.activos:
        assert_owns_item(user_id, a.item_id)

        if _time.time() - inicio > PRESUPUESTO:
            resultados.append({"item_id": a.item_id, "isin": a.isin, "resuelto": False, "motivo": "tiempo"})
            continue

        isin = a.isin.strip().upper()
        try:
            candidatos = [q.get("symbol") for q in yf.Search(isin, max_results=8).quotes if q.get("symbol")]
        except Exception as e:
            print(f"RESOLVER ISIN buscar {isin}: {e}")
            resultados.append({"item_id": a.item_id, "isin": isin, "resuelto": False, "motivo": "busqueda"})
            continue

        mejor, mejor_puntos, mejor_desvio, mejor_precio = None, None, None, 0.0
        for sym in candidatos[:5]:
            precio = fetch_live_price(sym)
            if precio <= 0:
                continue
            desvio = abs(precio / a.precio_ref - 1)
            # Un candidato a menos del 5% del precio ejecutado ya es el bueno:
            # seguir preguntando por los demás sólo gasta el presupuesto de
            # tiempo, y son cinco activos por importación.
            if desvio <= 0.05 and not sym.upper().startswith(isin):
                mejor, mejor_desvio, mejor_precio = sym, desvio, precio
                break
            # Yahoo devuelve también listados con el ISIN por símbolo (Stuttgart,
            # Berlín): cotizan el mismo fondo pero con poco volumen y datos que
            # se quedan viejos, así que ante dos candidatos parecidos gana el de
            # bolsa principal. La penalización es pequeña a propósito.
            puntos = desvio + (0.02 if sym.upper().startswith(isin) else 0.0)
            if mejor_puntos is None or puntos < mejor_puntos:
                mejor, mejor_puntos, mejor_desvio, mejor_precio = sym, puntos, desvio, precio

        # Un 35% cubre de sobra el movimiento de mercado desde la última compra;
        # más que eso ya no es el mismo instrumento.
        if not mejor or mejor_desvio > 0.35:
            resultados.append({
                "item_id": a.item_id, "isin": isin, "resuelto": False,
                "motivo": "sin_candidato", "candidatos": len(candidatos),
            })
            continue

        asset_id = _get_or_create_asset(mejor)
        if not asset_id:
            resultados.append({"item_id": a.item_id, "isin": isin, "resuelto": False, "motivo": "alta_activo"})
            continue

        supabase.table("portfolio_items").update({"asset_id": asset_id}).eq("id", a.item_id).execute()
        resultados.append({
            "item_id": a.item_id, "isin": isin, "resuelto": True,
            "ticker": mejor, "precio": round(mejor_precio, 4),
            "desvio_pct": round(mejor_desvio * 100, 2),
        })

    return {"resultados": resultados}


# --- Vercel Serverless Handler ---
