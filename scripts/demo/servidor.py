"""Servidor de demostración para generar las capturas del README.

Sirve el `dist` del frontend y responde a `/api/*` con una cartera sintética,
de modo que las capturas se puedan regenerar sin cuenta, sin backend y sin que
aparezca ningún dato real. Todas las cifras de aquí son inventadas.

    python scripts/demo/servidor.py [puerto]
"""
import http.server, json, math, os, random, sys
from datetime import date, datetime, timedelta
from urllib.parse import urlparse

RAIZ = os.path.join(os.path.dirname(__file__), "..", "..", "frontend_rebalanceo", "dist")
RAIZ = os.path.abspath(RAIZ)
PUERTO = int(sys.argv[1]) if len(sys.argv) > 1 else 8910

CARTERA = "11111111-1111-4111-8111-111111111111"
USUARIO = "00000000-0000-4000-8000-000000000000"

# --- Cartera sintética -------------------------------------------------------
# Pesos deliberadamente desviados del objetivo: así el plan de rebalanceo tiene
# algo que decir en la captura.
POSICIONES = [
    # ticker,    nombre,                                   uds,   precio, objetivo
    ("CSPX.L",  "iShares Core S&P 500 UCITS ETF",          31.0,  800.24, 45.0, "Equity", "Global"),
    ("IWDA.L",  "iShares Core MSCI World UCITS ETF",       98.0,  111.60, 25.0, "Equity", "Global"),
    ("EIMI.L",  "iShares Core MSCI EM IMI UCITS ETF",     108.0,   36.15, 10.0, "Equity", "Emerging"),
    ("IUSN.DE", "iShares MSCI World Small Cap UCITS ETF", 640.0,    7.24, 10.0, "Equity", "Global"),
    ("AGGH.L",  "iShares Core Global Aggregate Bond",      880.0,    4.92, 10.0, "Bond",   "Global"),
]

def _items():
    filas, total = [], 0.0
    for i, (tk, nombre, uds, precio, obj, tipo, _) in enumerate(POSICIONES, 1):
        valor = round(uds * precio, 2)
        total += valor
        filas.append({
            "id": f"{i:08d}-0000-4000-8000-000000000000",
            "units_held": uds, "target_weight": obj,
            "asset": {"id": f"a{i}", "name": nombre, "ticker": tk,
                      "type": tipo, "sector": "Diversified"},
            "current_price": precio, "value": valor,
        })
    for f in filas:
        f["real_weight"] = round(f["value"] / total * 100, 2) if total else 0
    return filas

ITEMS = _items()
TOTAL = round(sum(i["value"] for i in ITEMS), 2)

# --- Series temporales --------------------------------------------------------
def _serie(dias, inicio, deriva, vol, semilla):
    rnd = random.Random(semilla)
    v, out = inicio, []
    hoy = date.today()
    for d in range(dias, -1, -1):
        v *= (1 + deriva + rnd.gauss(0, vol))
        out.append(((hoy - timedelta(days=d)).isoformat(), round(v, 2)))
    return out

def _historial():
    serie = _serie(365, TOTAL * 0.80, 0.00062, 0.0075, 7)
    hist = [{"date": f"{f}T00:00:00", "value": v} for f, v in serie]
    ini, fin = hist[0]["value"], hist[-1]["value"]
    return {"history": hist,
            "change_val": round(fin - ini, 2),
            "change_pct": round((fin - ini) / ini * 100, 2)}

def _benchmark(benches):
    largo = 365
    curvas = {"portfolio": _serie(largo, 100, 0.00062, 0.0075, 7)}
    perfiles = {"^GSPC": (0.00058, 0.0080, 11), "URTH": (0.00051, 0.0072, 12),
                "^IXIC": (0.00072, 0.0105, 13), "^STOXX50E": (0.00035, 0.0085, 14),
                "ACWI": (0.00049, 0.0070, 15), "GLD": (0.00040, 0.0090, 16),
                "AGG": (0.00010, 0.0030, 17), "EEM": (0.00030, 0.0100, 18)}
    for b in benches:
        d, v, s = perfiles.get(b, (0.0004, 0.008, 20))
        curvas[b] = _serie(largo, 100, d, v, s)

    fechas = [f for f, _ in curvas["portfolio"]]
    series = []
    for i, f in enumerate(fechas):
        fila = {"date": f"{f}T00:00:00"}
        for k, c in curvas.items():
            fila[k] = c[i][1]
        series.append(fila)

    def stats(curva):
        vals = [v for _, v in curva]
        ret = (vals[-1] / vals[0] - 1) * 100
        difs = [vals[i] / vals[i-1] - 1 for i in range(1, len(vals))]
        media = sum(difs) / len(difs)
        desv = math.sqrt(sum((x - media) ** 2 for x in difs) / len(difs))
        pico, mdd = vals[0], 0.0
        for v in vals:
            pico = max(pico, v)
            mdd = min(mdd, (v - pico) / pico * 100)
        return {"return_pct": round(ret, 2), "cagr": round(ret, 2),
                "volatility": round(desv * math.sqrt(252) * 100, 2),
                "max_drawdown": round(mdd, 2)}

    ETIQUETAS = {"^GSPC": "S&P 500", "URTH": "MSCI World", "^IXIC": "Nasdaq 100",
                 "^STOXX50E": "Euro Stoxx 50", "ACWI": "MSCI ACWI", "GLD": "Oro",
                 "AGG": "Bonos agregados US", "EEM": "Emergentes"}
    rel = {b: {"status": "ok", "beta": round(0.88 + 0.05 * i, 2),
               "correlation": round(0.93 - 0.04 * i, 2), "points": 250}
           for i, b in enumerate(benches)}
    return {"series": series,
            "stats": {k: stats(c) for k, c in curvas.items()},
            "labels": {b: ETIQUETAS.get(b, b) for b in benches},
            "relative": rel,
            "start": series[0]["date"], "end": series[-1]["date"]}

# --- Radiografía --------------------------------------------------------------
# Las mismas compañías aparecen en varios fondos a propósito: es justo lo que la
# radiografía sirve para revelar.
_GRANDES = [
    ("NVDA", "NVIDIA", "United States", "USD", "technology"),
    ("AAPL", "Apple", "United States", "USD", "technology"),
    ("MSFT", "Microsoft", "United States", "USD", "technology"),
    ("AMZN", "Amazon", "United States", "USD", "consumer_cyclical"),
    ("META", "Meta Platforms", "United States", "USD", "communication_services"),
    ("AVGO", "Broadcom", "United States", "USD", "technology"),
    ("GOOGL", "Alphabet", "United States", "USD", "communication_services"),
    ("TSLA", "Tesla", "United States", "USD", "consumer_cyclical"),
    ("BRK.B", "Berkshire Hathaway", "United States", "USD", "financial_services"),
    ("JPM", "JPMorgan Chase", "United States", "USD", "financial_services"),
]
_MUNDO = [("TSM", "TSMC", "Taiwan", "TWD", "technology"),
          ("ASML", "ASML", "Netherlands", "EUR", "technology"),
          ("NVO", "Novo Nordisk", "Denmark", "DKK", "healthcare"),
          ("NESN.SW", "Nestlé", "Switzerland", "CHF", "consumer_defensive"),
          ("7203.T", "Toyota", "Japan", "JPY", "consumer_cyclical")]
_EMERG = [("TSM", "TSMC", "Taiwan", "TWD", "technology"),
          ("005930.KS", "Samsung Electronics", "South Korea", "KRW", "technology"),
          ("BABA", "Alibaba", "China", "CNY", "consumer_cyclical"),
          ("0700.HK", "Tencent", "China", "CNY", "communication_services"),
          ("RELIANCE.NS", "Reliance Industries", "India", "INR", "energy")]

def _fondo(tk, nombre, valor, comp, pesos, paises, sectores):
    hold = [{"symbol": s, "name": n, "weight": w, "country": p, "currency": c}
            for (s, n, p, c, _), w in zip(comp, pesos)]
    return {"ticker": tk, "name": nombre, "type": "ETF", "value": valor,
            "coverage": round(sum(pesos), 4), "holdings": hold,
            "sectors": sectores, "countries": paises,
            "countries_estimated": True, "region": "Global", "currency": "USD"}

def _xray():
    v = {i["asset"]["ticker"]: i["value"] for i in ITEMS}
    p10 = [0.075, 0.065, 0.060, 0.041, 0.028, 0.026, 0.024, 0.021, 0.018, 0.016]
    p5 = [0.052, 0.030, 0.026, 0.022, 0.019]
    return {"positions": [
        _fondo("CSPX.L", "iShares Core S&P 500 UCITS ETF", v["CSPX.L"], _GRANDES, p10,
               {"United States": 1.0},
               {"technology": 0.34, "financial_services": 0.13, "healthcare": 0.11,
                "consumer_cyclical": 0.10, "communication_services": 0.09, "unknown": 0.23}),
        _fondo("IWDA.L", "iShares Core MSCI World UCITS ETF", v["IWDA.L"],
               _GRANDES[:5] + _MUNDO, [0.052, 0.045, 0.041, 0.028, 0.019, 0.021, 0.014, 0.013, 0.011, 0.009],
               {"United States": 0.71, "Japan": 0.06, "United Kingdom": 0.04,
                "Switzerland": 0.03, "Netherlands": 0.02, "Denmark": 0.02, "Other": 0.12},
               {"technology": 0.28, "financial_services": 0.15, "healthcare": 0.12,
                "industrials": 0.10, "consumer_cyclical": 0.09, "unknown": 0.26}),
        _fondo("EIMI.L", "iShares Core MSCI EM IMI UCITS ETF", v["EIMI.L"], _EMERG, p5,
               {"Taiwan": 0.19, "China": 0.27, "India": 0.18, "South Korea": 0.12, "Other": 0.24},
               {"technology": 0.26, "financial_services": 0.22,
                "consumer_cyclical": 0.13, "communication_services": 0.10, "unknown": 0.29}),
        _fondo("IUSN.DE", "iShares MSCI World Small Cap UCITS ETF", v["IUSN.DE"],
               [("SMC1", "Small Cap Holding I", "United States", "USD", "industrials"),
                ("SMC2", "Small Cap Holding II", "Japan", "JPY", "industrials"),
                ("SMC3", "Small Cap Holding III", "United Kingdom", "GBP", "consumer_cyclical")],
               [0.006, 0.005, 0.004],
               {"United States": 0.58, "Japan": 0.11, "United Kingdom": 0.07, "Other": 0.24},
               {"industrials": 0.20, "consumer_cyclical": 0.15, "financial_services": 0.14,
                "technology": 0.12, "unknown": 0.39}),
        _fondo("AGGH.L", "iShares Core Global Aggregate Bond", v["AGGH.L"],
               [("UST10", "US Treasury 10Y", "United States", "USD", "government"),
                ("BUND10", "German Bund 10Y", "Germany", "EUR", "government"),
                ("JGB10", "Japan Govt Bond 10Y", "Japan", "JPY", "government")],
               [0.031, 0.019, 0.015],
               {"United States": 0.41, "Japan": 0.13, "Germany": 0.08, "Other": 0.38},
               {"government": 0.55, "corporate": 0.31, "unknown": 0.14}),
    ]}

# --- Rutas --------------------------------------------------------------------
def responder(ruta, cuerpo):
    if ruta == "/api/portfolios/list":
        return [{"id": CARTERA, "user_id": USUARIO, "name": "Cartera Principal",
                 "created_at": "2024-01-15T10:00:00Z", "last_contribution": 500.0}]
    # Las rutas concretas van antes que /api/portfolio/{id}, que si no las
    # captura: "/api/portfolio/xray" también tiene tres barras.
    if ruta == "/api/portfolio/history_chart":
        return _historial()
    if ruta == "/api/portfolio/xray":
        return _xray()
    if ruta == "/api/portfolio/benchmark":
        return _benchmark((cuerpo or {}).get("benchmarks") or ["^GSPC", "URTH"])
    if ruta.startswith("/api/portfolio/history/"):
        return []
    if ruta.startswith("/api/portfolio/") and ruta.count("/") == 3:
        return ITEMS
    if ruta == "/api/mercado/volatilidad":
        return {"disponible": True, "alto": False, "ultimo": 16.4,
                "dias_por_encima": 0, "umbral": 35}
    if ruta == "/api/simulations/run":
        c = cuerpo or {}
        años = int(c.get("years") or 15)
        aporte = float(c.get("monthly_contribution") or 500)
        tasa = 0.07 if c.get("sim_type") != "pessimistic" else 0.04
        salida = []
        for pid in (c.get("portfolio_ids") or [CARTERA]):
            capital, invertido, puntos = TOTAL, TOTAL, []
            for mes in range(años * 12 + 1):
                if mes:
                    capital = capital * (1 + tasa / 12) + aporte
                    invertido += aporte
                if mes % 12 == 0:
                    puntos.append({"year": mes // 12, "value": round(capital)})
            ganancia = capital - invertido
            impuesto = ganancia * 0.19 if c.get("tax_rate") and ganancia > 0 else 0
            salida.append({"portfolio_id": pid, "portfolio_name": "Cartera Principal",
                           "data": puntos, "final_gross": round(capital),
                           "final_net": round(capital - impuesto),
                           "total_invested": round(invertido),
                           "tax_paid": round(impuesto), "gain": round(ganancia)})
        return salida
    if ruta == "/api/portfolio/news":
        return {"news": {}, "sentiments": {}, "aggregate": {"score": 58, "label": "Neutral (RSI)", "color": "yellow"}}
    if ruta == "/api/assets/search":
        return []
    if ruta.startswith("/auth/v1/user"):
        return {"id": USUARIO, "aud": "authenticated", "role": "authenticated",
                "email": "demo@fandance.app", "user_metadata": {}, "app_metadata": {}}
    if ruta.startswith("/auth/v1/"):
        return {"access_token": "demo", "token_type": "bearer", "expires_in": 3600,
                "refresh_token": "demo", "user": {"id": USUARIO, "email": "demo@fandance.app"}}
    return {}

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=RAIZ, **k)

    def _json(self, dato):
        b = json.dumps(dato).encode()
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(b)))
        self.send_header("access-control-allow-origin", "*")
        self.end_headers()
        self.wfile.write(b)

    def _api(self):
        ruta = urlparse(self.path).path
        n = int(self.headers.get("content-length", 0) or 0)
        cuerpo = None
        if n:
            try: cuerpo = json.loads(self.rfile.read(n))
            except Exception: cuerpo = None
        self._json(responder(ruta, cuerpo))

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("access-control-allow-origin", "*")
        self.send_header("access-control-allow-headers", "*")
        self.send_header("access-control-allow-methods", "GET,POST,PUT,DELETE,OPTIONS")
        self.end_headers()

    def do_POST(self): self._api()
    def do_PUT(self): self._api()
    def do_DELETE(self): self._api()

    def do_GET(self):
        ruta = urlparse(self.path).path
        if ruta.startswith("/api/") or ruta.startswith("/auth/"):
            return self._api()
        destino = os.path.join(RAIZ, ruta.lstrip("/"))
        if not os.path.isfile(destino):
            self.path = "/index.html"          # SPA: todo lo demás al index
        return super().do_GET()

    def log_message(self, *a): pass

if __name__ == "__main__":
    print(f"demo en http://127.0.0.1:{PUERTO}  (raíz: {RAIZ})")
    http.server.HTTPServer(("127.0.0.1", PUERTO), Handler).serve_forever()
