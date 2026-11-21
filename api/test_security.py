"""Garantías de seguridad de la API.

Estos tests existen porque el backend usa la service_role key de Supabase, que
bypassa Row Level Security: aquí no hay red debajo. Si una regresión quita un
`Depends` o vuelve a leer el user_id del body, el fallo es silencioso — la API
sigue respondiendo 200, solo que a quien no debe.

Se ejecutan sin tocar Supabase: se inyecta un doble del cliente.
"""
import sys
import types
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent))
import index  # noqa: E402


# --- Doble del cliente de Supabase -----------------------------------------
# Dos usuarios: ana (dueña de la cartera y de la posición) y mario, que
# intentará llegar a los datos de ana.

TOKENS = {"tok-ana": "ana", "tok-mario": "mario"}

# Los modelos exigen UUID real, así que las fixtures lo son.
PORTFOLIO_ID = "11111111-1111-4111-8111-111111111111"
ITEM_ID = "22222222-2222-4222-8222-222222222222"
HISTORY_ID = "33333333-3333-4333-8333-333333333333"

PORTFOLIOS = [{"id": PORTFOLIO_ID, "user_id": "ana", "name": "Cartera de Ana"}]
ITEMS = [{"id": ITEM_ID, "portfolio_id": PORTFOLIO_ID, "portfolio": {"user_id": "ana"}}]
HISTORY = [{"id": HISTORY_ID, "portfolio_id": PORTFOLIO_ID, "portfolio": {"user_id": "ana"}}]
VISTAZOS = [{"user_id": "ana", "datos": {"titular": "Nada que hacer con tu cartera"}, "actualizado": "2026-11-21T10:00:00+00:00"}]
GUARDADO = []


class _Query:
    def __init__(self, rows):
        self._rows = rows
        self._filters = {}

    def select(self, *a, **k):
        return self

    def order(self, *a, **k):
        return self

    def limit(self, *a, **k):
        return self

    def gt(self, *a, **k):
        return self

    def eq(self, column, value):
        self._filters[column] = value
        return self

    # Escrituras: no simulamos persistencia, solo que la llamada es válida.
    # Lo que estos tests comprueban es QUIÉN llega hasta aquí, no el efecto.
    def update(self, *a, **k):
        self._write = True
        return self

    def insert(self, *a, **k):
        self._write = True
        return self

    def delete(self, *a, **k):
        self._write = True
        return self

    def upsert(self, fila, *a, **k):
        self._write = True
        GUARDADO.append(fila)
        return self

    def execute(self):
        if getattr(self, "_write", False):
            return types.SimpleNamespace(data=[])
        rows = [
            r for r in self._rows
            if all(r.get(c) == v for c, v in self._filters.items())
        ]
        return types.SimpleNamespace(data=rows)


class _Auth:
    def get_user(self, jwt):
        if jwt not in TOKENS:
            raise ValueError("token inválido")
        return types.SimpleNamespace(
            user=types.SimpleNamespace(id=TOKENS[jwt])
        )


class FakeSupabase:
    """Sustituye al cliente real. Cuenta las llamadas al rate limiter."""

    def __init__(self, enforce_limits=False):
        self.auth = _Auth()
        self.enforce_limits = enforce_limits
        self.counters = {}

    def table(self, name):
        return _Query({
            "portfolios": PORTFOLIOS,
            "portfolio_items": ITEMS,
            "rebalance_history": HISTORY,
            "vistazos": VISTAZOS,
        }.get(name, []))

    def rpc(self, fn, params):
        if not self.enforce_limits:
            return types.SimpleNamespace(
                execute=lambda: types.SimpleNamespace(data=True)
            )
        key = params["p_key"]
        self.counters[key] = self.counters.get(key, 0) + 1
        allowed = self.counters[key] <= params["p_limit"]
        return types.SimpleNamespace(
            execute=lambda: types.SimpleNamespace(data=allowed)
        )


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(index, "supabase", FakeSupabase())
    return TestClient(index.app)


def auth(token):
    return {"Authorization": f"Bearer {token}"}


SIM = {
    "portfolio_ids": [PORTFOLIO_ID],
    "years": 10,
    "initial_capital": 0,
    "monthly_contribution": 100,
    "contribution_mode": "constant",
    "tax_rate": False,
    "sim_type": "deterministic",
}


# --- Todo endpoint exige autenticación --------------------------------------

def test_ningun_endpoint_queda_sin_dependencia_de_auth():
    """Barrido estático: si alguien añade una ruta sin auth, salta aquí."""
    import ast

    tree = ast.parse(Path(index.__file__).read_text())
    buckets = {"Standard", "External", "Heavy", "Seed"}
    sin_auth = []

    for node in tree.body:
        if not isinstance(node, ast.FunctionDef):
            continue
        for dec in node.decorator_list:
            if not (isinstance(dec, ast.Call) and isinstance(dec.func, ast.Attribute)):
                continue
            if dec.func.attr not in {"get", "post", "put", "delete", "patch"}:
                continue
            defaults = {ast.unparse(d) for d in node.args.defaults}
            if not (defaults & buckets) and "current_user_id" not in ast.unparse(node.args):
                sin_auth.append(dec.args[0].value)

    assert sin_auth == [], f"endpoints sin autenticación: {sin_auth}"


@pytest.mark.parametrize("method,url", [
    ("GET", "/api/portfolios/list"),
    ("POST", "/api/portfolios/create"),
    ("GET", f"/api/portfolio/{PORTFOLIO_ID}"),
    ("DELETE", f"/api/portfolios/delete/{PORTFOLIO_ID}"),
    ("PUT", "/api/portfolio/update"),
    ("POST", "/api/simulations/run"),
    ("POST", "/api/portfolios/seed_defaults"),
    ("GET", "/api/assets/search?q=aapl"),
    ("GET", "/api/fandos/vistazo"),
    ("POST", "/api/fandos/vistazo"),
])
def test_sin_token_devuelve_401(client, method, url):
    assert client.request(method, url, json={}).status_code == 401


def test_token_invalido_devuelve_401(client):
    r = client.get("/api/portfolios/list", headers=auth("tok-inventado"))
    assert r.status_code == 401


def test_usuario_valido_ve_sus_carteras(client):
    r = client.get("/api/portfolios/list", headers=auth("tok-ana"))
    assert r.status_code == 200
    assert [p["id"] for p in r.json()] == [PORTFOLIO_ID]


# --- IDOR: el user_id sale del token, no del cliente ------------------------

@pytest.mark.parametrize("method,url,body", [
    ("GET", f"/api/portfolio/{PORTFOLIO_ID}", None),
    ("DELETE", f"/api/portfolios/delete/{PORTFOLIO_ID}", None),
    ("GET", f"/api/portfolio/history/{PORTFOLIO_ID}", None),
    ("PUT", "/api/portfolios/rename", {"portfolio_id": PORTFOLIO_ID, "name": "hackeada"}),
    ("POST", "/api/portfolio/rebalance", {"portfolio_id": PORTFOLIO_ID, "contribution": 10}),
    ("POST", "/api/simulations/run", SIM),
])
def test_no_se_puede_tocar_la_cartera_de_otro(client, method, url, body):
    r = client.request(method, url, headers=auth("tok-mario"), json=body)
    assert r.status_code == 404, f"{method} {url} filtró datos ajenos"


def test_no_se_puede_tocar_la_posicion_de_otro(client):
    r = client.put(
        "/api/portfolio/update",
        headers=auth("tok-mario"),
        json={"item_id": ITEM_ID, "units_held": 1, "target_weight": 10},
    )
    assert r.status_code == 404


def test_la_dueña_si_puede(client):
    r = client.put(
        "/api/portfolio/update",
        headers=auth("tok-ana"),
        json={"item_id": ITEM_ID, "units_held": 1, "target_weight": 10},
    )
    assert r.status_code == 200


# --- Validación de entradas -------------------------------------------------

@pytest.mark.parametrize("body,motivo", [
    ({**SIM, "years": 999999}, "years fuera de rango"),
    ({**SIM, "years": 0}, "years por debajo del mínimo"),
    ({**SIM, "sim_type": "'; DROP TABLE--"}, "sim_type fuera de la lista blanca"),
    ({**SIM, "contribution_mode": "otro"}, "contribution_mode inválido"),
    ({**SIM, "initial_capital": -1}, "capital negativo"),
])
def test_simulacion_rechaza_entradas_invalidas(client, body, motivo):
    r = client.post("/api/simulations/run", headers=auth("tok-ana"), json=body)
    assert r.status_code == 422, motivo


def test_nombre_demasiado_largo(client):
    r = client.post(
        "/api/portfolios/create", headers=auth("tok-ana"), json={"name": "x" * 500}
    )
    assert r.status_code == 422


def test_periodo_fuera_de_la_lista_blanca(client):
    r = client.post(
        "/api/portfolio/history_chart",
        headers=auth("tok-ana"),
        json={"portfolio_id": PORTFOLIO_ID, "period": "'; DROP TABLE--"},
    )
    assert r.status_code == 422


def test_peso_objetivo_por_encima_de_100(client):
    r = client.put(
        "/api/portfolio/update",
        headers=auth("tok-ana"),
        json={"item_id": ITEM_ID, "units_held": 1, "target_weight": 5000},
    )
    assert r.status_code == 422


def test_los_valores_que_manda_el_frontend_son_validos(client):
    """Guardarraíl: las listas blancas deben aceptar lo que la UI envía."""
    assert client.post(
        "/api/simulations/run", headers=auth("tok-ana"), json=SIM
    ).status_code == 200
    for period in ("1d", "1mo", "3mo", "1y", "max"):
        r = client.post(
            "/api/portfolio/history_chart",
            headers=auth("tok-ana"),
            json={"portfolio_id": PORTFOLIO_ID, "period": period},
        )
        assert r.status_code == 200, f"la UI usa period={period}"


# --- Rate limiting ----------------------------------------------------------

def test_el_limite_corta_y_devuelve_retry_after(monkeypatch):
    monkeypatch.setattr(index, "supabase", FakeSupabase(enforce_limits=True))
    c = TestClient(index.app)

    codes = [
        c.post("/api/simulations/run", headers=auth("tok-ana"), json=SIM).status_code
        for _ in range(12)
    ]
    assert codes[:10] == [200] * 10, "el presupuesto Heavy es 10/min"
    assert codes[10:] == [429, 429]

    r = c.post("/api/simulations/run", headers=auth("tok-ana"), json=SIM)
    assert r.headers.get("Retry-After") == "60"


def test_el_presupuesto_es_por_usuario(monkeypatch):
    monkeypatch.setattr(index, "supabase", FakeSupabase(enforce_limits=True))
    c = TestClient(index.app)

    for _ in range(11):
        c.post("/api/simulations/run", headers=auth("tok-ana"), json=SIM)

    # Ana está limitada; mario no debe heredar su contador (404 = pasó el
    # limitador y falló después, al no ser suya la cartera).
    assert c.post(
        "/api/simulations/run", headers=auth("tok-mario"), json=SIM
    ).status_code == 404


def test_los_buckets_no_se_pisan(monkeypatch):
    monkeypatch.setattr(index, "supabase", FakeSupabase(enforce_limits=True))
    c = TestClient(index.app)

    for _ in range(11):
        c.post("/api/simulations/run", headers=auth("tok-ana"), json=SIM)

    assert c.get("/api/portfolios/list", headers=auth("tok-ana")).status_code == 200


def test_sin_la_funcion_sql_la_app_sigue_funcionando(monkeypatch):
    """Fail-open deliberado: una migración sin aplicar no debe tumbar la API."""
    fake = FakeSupabase()

    def explota(fn, params):
        raise Exception("function check_rate_limit does not exist")

    fake.rpc = explota
    monkeypatch.setattr(index, "supabase", fake)
    monkeypatch.setattr(index, "_RATE_LIMIT_WARNED", False)

    c = TestClient(index.app)
    assert c.get("/api/portfolios/list", headers=auth("tok-ana")).status_code == 200


# --- CORS -------------------------------------------------------------------

def test_cors_no_es_comodin():
    """"*" junto a allow_credentials permite a cualquier web actuar por ti."""
    assert "*" not in index.ALLOWED_ORIGINS


# --- Contrato FANDOS: el vistazo de la cartera --------------------------------

VISTAZO = {
    "v": 1, "app": "fandance", "generado": "2026-11-21T10:00:00Z", "tono": "ok",
    "titular": "Nada que hacer con tu cartera", "href": "/fandance/",
    "cifras": [{"etiqueta": "Cartera", "valor": "3.604 €", "privada": True}],
    "avisos": [{"id": "fandance:csv:2026-11", "texto": "Sube el CSV", "href": "/fandance/", "nivel": "aviso"}],
    "cartera": {"nombre": "Cartera Principal", "valor": 3604.0, "coste": 3327.6, "plusvalia": 276.4,
                "mensual": 300, "posiciones": [{"ticker": "VUAA.L", "nombre": "S&P 500", "valor": 1600,
                                                "peso": 44.4, "objetivo": 45, "coste": 1480}]},
}


def test_el_vistazo_se_guarda_a_nombre_de_quien_llama(client):
    GUARDADO.clear()
    r = client.post("/api/fandos/vistazo", json={**VISTAZO, "user_id": "mario"}, headers=auth("tok-ana"))
    assert r.status_code == 200
    assert GUARDADO and GUARDADO[-1]["user_id"] == "ana"
    assert "user_id" not in GUARDADO[-1]["datos"]


def test_cada_uno_lee_solo_su_vistazo(client):
    assert client.get("/api/fandos/vistazo", headers=auth("tok-ana")).json()["titular"] == "Nada que hacer con tu cartera"
    assert client.get("/api/fandos/vistazo", headers=auth("tok-mario")).status_code == 404


@pytest.mark.parametrize("href", [
    "https://malo.example/fandance",
    "javascript:alert(1)",
    "//malo.example/x",
    "/fanwork/agenda",
    "/fandance/../fanwork",
])
def test_el_vistazo_no_acepta_enlaces_fuera_de_fandance(client, href):
    malo = {**VISTAZO, "href": href}
    # Los enlaces de los avisos pasan por la misma regla.
    r1 = client.post("/api/fandos/vistazo", json=malo, headers=auth("tok-ana"))
    r2 = client.post("/api/fandos/vistazo", json={**VISTAZO, "avisos": [{**VISTAZO["avisos"][0], "href": href}]},
                     headers=auth("tok-ana"))
    assert r1.status_code == 422 and r2.status_code == 422


def test_el_vistazo_tiene_tamaño_acotado(client):
    largo = {**VISTAZO, "titular": "x" * 500}
    muchas = {**VISTAZO, "cartera": {**VISTAZO["cartera"], "posiciones": VISTAZO["cartera"]["posiciones"] * 40}}
    assert client.post("/api/fandos/vistazo", json=largo, headers=auth("tok-ana")).status_code == 422
    assert client.post("/api/fandos/vistazo", json=muchas, headers=auth("tok-ana")).status_code == 422
