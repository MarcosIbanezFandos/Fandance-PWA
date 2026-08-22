"""Genera las capturas del README contra el servidor de demostración.

Levanta un Chrome headless con perfil temporal, lo lleva por cada pantalla y
guarda un PNG. No hay sesión real: se inyecta una de mentira en localStorage,
y todos los datos vienen de scripts/demo/servidor.py.

    python scripts/demo/servidor.py &
    python scripts/demo/capturar.py
"""
import base64, json, os, shutil, subprocess, sys, tempfile, time, urllib.request

import websocket  # websocket-client

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
BASE = "http://localhost:8910"
SALIDA = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "docs", "screenshots"))
ANCHO, ALTO, ESCALA = 1440, 900, 2

USUARIO = "00000000-0000-4000-8000-000000000000"
CARTERA = "11111111-1111-4111-8111-111111111111"
SESION = {
    "access_token": "demo-access-token", "token_type": "bearer",
    "expires_in": 3600, "expires_at": int(time.time()) + 60 * 60 * 24 * 365,
    "refresh_token": "demo-refresh-token",
    "user": {"id": USUARIO, "aud": "authenticated", "role": "authenticated",
             "email": "demo@fandance.app", "app_metadata": {}, "user_metadata": {},
             "created_at": "2024-01-01T00:00:00Z"},
}

# ruta · fichero · texto que confirma que cargó · scroll · alto · botón a pulsar
PANTALLAS = [
    ("/",           "01-inicio.png",      "Patrimonio",  0,   900, None),
    ("/posiciones", "02-rebalanceo.png",  "A invertir",  442, 980, None),
    ("/xray",       "03-radiografia.png", "Radiografía", 0,   880, None),
    # La simulación no se lanza sola: hay que pulsar el botón y esperar.
    ("/simulacion", "04-simulacion.png",  "Modelo",      0,   900, "Calcular Proyección"),
]


class CDP:
    def __init__(self, ws_url):
        self.ws = websocket.create_connection(ws_url, timeout=30)
        self.n = 0

    def cmd(self, metodo, **params):
        self.n += 1
        self.ws.send(json.dumps({"id": self.n, "method": metodo, "params": params}))
        while True:
            msg = json.loads(self.ws.recv())
            if msg.get("id") == self.n:
                if "error" in msg:
                    raise RuntimeError(f"{metodo}: {msg['error']}")
                return msg.get("result", {})

    def eval(self, expr):
        r = self.cmd("Runtime.evaluate", expression=expr,
                     returnByValue=True, awaitPromise=True)
        return r.get("result", {}).get("value")

    def esperar(self, texto, limite=30):
        fin = time.time() + limite
        while time.time() < fin:
            if self.eval(f"document.body && document.body.innerText.includes({json.dumps(texto)})"):
                return True
            time.sleep(0.4)
        return False


def arrancar_chrome(perfil):
    p = subprocess.Popen([
        CHROME, "--headless=new", "--remote-debugging-port=9333",
        # Acotado al origen exacto (y el puerto sólo escucha en loopback).
        "--remote-allow-origins=http://127.0.0.1:9333",
        f"--user-data-dir={perfil}", "--no-first-run", "--no-default-browser-check",
        "--hide-scrollbars", "--force-color-profile=srgb",
        "--disable-features=Translate,MediaRouter",
        f"--window-size={ANCHO},{ALTO}", "about:blank",
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(60):
        try:
            with urllib.request.urlopen("http://127.0.0.1:9333/json/version", timeout=1) as r:
                json.load(r)
                return p
        except Exception:
            time.sleep(0.5)
    raise RuntimeError("Chrome no levantó el puerto de depuración")


def main():
    os.makedirs(SALIDA, exist_ok=True)
    perfil = tempfile.mkdtemp(prefix="fandance-demo-")
    chrome = arrancar_chrome(perfil)
    try:
        with urllib.request.urlopen("http://127.0.0.1:9333/json/list") as r:
            objetivos = json.load(r)
        pagina = next(t for t in objetivos if t["type"] == "page")
        c = CDP(pagina["webSocketDebuggerUrl"])

        c.cmd("Page.enable"); c.cmd("Runtime.enable")
        c.cmd("Emulation.setDeviceMetricsOverride",
              width=ANCHO, height=ALTO, deviceScaleFactor=ESCALA, mobile=False)
        # captureBeyondViewport queda descartado a propósito: redimensiona el
        # viewport para la captura, recharts vuelve a medir su contenedor y el
        # gráfico desaparece justo en el fotograma que se guarda. En su lugar se
        # ajusta la altura del viewport a cada pantalla y se captura tal cual.

        # Estado inicial antes de que cargue la app: sesión falsa (para saltar
        # el login), tema oscuro y el aviso del CSV ya descartado, que si no
        # aparece un modal encima de la captura.
        semilla = {
            "sb-localhost-auth-token": json.dumps(SESION),
            "theme": "dark",
            "lastActiveId": CARTERA,
            f"tr_aviso_{CARTERA}": "2099-12",
        }
        c.cmd("Page.addScriptToEvaluateOnNewDocument", source=(
            "try{const s=" + json.dumps(semilla) +
            ";for(const k in s)localStorage.setItem(k,s[k]);}catch(e){}"
        ))

        for ruta, fichero, espera, scroll, alto, boton in PANTALLAS:
            c.cmd("Emulation.setDeviceMetricsOverride",
                  width=ANCHO, height=alto, deviceScaleFactor=ESCALA, mobile=False)
            c.cmd("Page.navigate", url=BASE + ruta)
            time.sleep(1.0)
            if not c.esperar(espera):
                print(f"  ! {ruta}: no apareció «{espera}»")
            if boton:
                # El botón vive por debajo del pliegue: hay que traerlo a la
                # vista antes de pulsarlo.
                pulsado = c.eval(
                    "(()=>{const b=[...document.querySelectorAll('button')]"
                    f".find(x=>x.textContent.trim().includes({json.dumps(boton)}));"
                    "if(!b)return false;b.scrollIntoView({block:'center'});"
                    "b.click();return true;})()"
                )
                if not pulsado:
                    print(f"  ! {ruta}: no encontré el botón «{boton}»")
                time.sleep(4.0)
                # Devuelve el panel al principio para encuadrar el resultado.
                c.eval("(()=>{const p=document.querySelector('.app-scroll')||"
                       "document.scrollingElement;p.scrollTop=0;})()")
                time.sleep(1.0)

            # Recharts mide su contenedor al montar; si el layout todavía no
            # había asentado, dibuja a cero. Un resize le obliga a re-medir.
            c.eval("window.dispatchEvent(new Event('resize'))")
            time.sleep(2.5)
            if scroll:
                # El scroll no lo lleva la ventana sino el panel de contenido
                # (.app-scroll en MainLayout); window.scrollTo no haría nada.
                c.eval(
                    "(()=>{const p=document.querySelector('.app-scroll')||"
                    "document.scrollingElement;"
                    f"p.scrollTop={scroll};return p.scrollTop;}})()"
                )
                time.sleep(1.5)

            r = c.cmd("Page.captureScreenshot", format="png")
            destino = os.path.join(SALIDA, fichero)
            with open(destino, "wb") as f:
                f.write(base64.b64decode(r["data"]))
            print(f"  ✓ {fichero}  ({os.path.getsize(destino)//1024} KB)")
    finally:
        chrome.terminate()
        try: chrome.wait(timeout=10)
        except Exception: chrome.kill()
        shutil.rmtree(perfil, ignore_errors=True)


if __name__ == "__main__":
    main()
