"""Khal Print Bridge

Puente local mínimo entre el WMS (navegador) y la cola de impresión de Windows.
Recibe ZPL en http://127.0.0.1:17891 y lo envía como RAW a una Zebra instalada.
No expone el servicio a la red: escucha solamente en loopback (este PC).
"""
from __future__ import annotations

import json
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

try:
    import win32print
except ImportError as exc:  # pragma: no cover - depende de Windows
    raise SystemExit("Falta pywin32. Ejecuta INSTALAR_KHAL_PRINT.bat") from exc

HOST = "127.0.0.1"
PORT = 17891
MAX_ZPL_BYTES = 12 * 1024 * 1024
ZEBRA_WORDS = ("zebra", "zdesigner", "zpl", "gc420", "gk420", "gx420", "zt410", "zt420", "zd220", "zd230", "zd420", "zd421")


def list_printers() -> list[str]:
    flags = win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS
    names = [row[2] for row in win32print.EnumPrinters(flags, None, 1)]
    return sorted(set(str(n) for n in names if n))


def printer_info(name: str) -> dict:
    result = {"name": name, "ready": False, "status": 0, "jobs": 0, "port": "", "driver": ""}
    handle = win32print.OpenPrinter(name)
    try:
        info = win32print.GetPrinter(handle, 2)
    finally:
        win32print.ClosePrinter(handle)
    status = int(info.get("Status", 0) or 0)
    offline_attr = bool(int(info.get("Attributes", 0) or 0) & 0x400)
    bad_bits = 0
    for constant in (
        "PRINTER_STATUS_PAUSED", "PRINTER_STATUS_ERROR", "PRINTER_STATUS_OFFLINE",
        "PRINTER_STATUS_PAPER_OUT", "PRINTER_STATUS_PAPER_JAM", "PRINTER_STATUS_DOOR_OPEN",
        "PRINTER_STATUS_NOT_AVAILABLE", "PRINTER_STATUS_USER_INTERVENTION",
    ):
        bad_bits |= int(getattr(win32print, constant, 0) or 0)
    result.update({
        "ready": not offline_attr and not bool(status & bad_bits),
        "status": status,
        "jobs": int(info.get("cJobs", 0) or 0),
        "port": str(info.get("pPortName", "") or ""),
        "driver": str(info.get("pDriverName", "") or ""),
    })
    return result


def looks_like_zebra(name: str) -> bool:
    low = name.lower()
    return any(word in low for word in ZEBRA_WORDS)


def choose_printer(requested: str | None = None) -> str:
    printers = list_printers()
    if requested:
        for name in printers:
            if name == requested:
                return name
        raise RuntimeError(f"La impresora '{requested}' no está instalada en Windows.")

    zebras = [name for name in printers if looks_like_zebra(name)]
    for name in zebras:
        try:
            if printer_info(name)["ready"]:
                return name
        except Exception:
            continue
    if zebras:
        return zebras[0]

    try:
        default = win32print.GetDefaultPrinter()
        if default and default in printers and looks_like_zebra(default):
            return default
    except Exception:
        pass
    raise RuntimeError("No se encontró una impresora Zebra/ZPL instalada en Windows.")


def send_raw(zpl: str, printer: str) -> int:
    data = zpl.encode("utf-8")
    if not data or b"^XA" not in data or b"^XZ" not in data:
        raise RuntimeError("El trabajo recibido no parece ZPL válido.")
    if len(data) > MAX_ZPL_BYTES:
        raise RuntimeError("El trabajo ZPL es demasiado grande; divide la cola en lotes.")

    handle = win32print.OpenPrinter(printer)
    try:
        job_id = win32print.StartDocPrinter(handle, 1, ("Khal · Etiquetas", None, "RAW"))
        win32print.StartPagePrinter(handle)
        win32print.WritePrinter(handle, data)
        win32print.EndPagePrinter(handle)
        win32print.EndDocPrinter(handle)
        return int(job_id)
    finally:
        win32print.ClosePrinter(handle)


class Handler(BaseHTTPRequestHandler):
    server_version = "KhalPrintBridge/1.0"

    def log_message(self, fmt, *args):
        return

    def _headers(self, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.end_headers()

    def _json(self, payload, status=200):
        self._headers(status)
        self.wfile.write(json.dumps(payload, ensure_ascii=False).encode("utf-8"))

    def do_OPTIONS(self):
        self._json({"ok": True})

    def do_GET(self):
        try:
            if self.path == "/health":
                chosen = None
                try:
                    chosen = choose_printer()
                except Exception:
                    pass
                self._json({"ok": True, "service": "Khal Print Bridge", "version": "1.0", "printer": chosen})
                return
            if self.path == "/printers":
                rows = []
                for name in list_printers():
                    try:
                        info = printer_info(name)
                    except Exception:
                        info = {"name": name, "ready": False}
                    info["zebra"] = looks_like_zebra(name)
                    rows.append(info)
                self._json({"ok": True, "printers": rows})
                return
            self._json({"ok": False, "error": "Ruta no encontrada."}, 404)
        except Exception as exc:
            self._json({"ok": False, "error": str(exc)}, 500)

    def do_POST(self):
        if self.path != "/print":
            self._json({"ok": False, "error": "Ruta no encontrada."}, 404)
            return
        try:
            length = int(self.headers.get("Content-Length", "0") or 0)
            if length <= 0 or length > MAX_ZPL_BYTES * 2:
                raise RuntimeError("Trabajo vacío o demasiado grande.")
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            zpl = str(payload.get("zpl", ""))
            printer = choose_printer(payload.get("printer"))
            job_id = send_raw(zpl, printer)
            self._json({"ok": True, "printer": printer, "jobId": job_id})
        except Exception as exc:
            self._json({"ok": False, "error": str(exc)}, 400)


def main():
    if not sys.platform.startswith("win"):
        raise SystemExit("Khal Print Bridge debe ejecutarse en Windows.")
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Khal Print Bridge activo en http://{HOST}:{PORT}")
    try:
        print(f"Impresora automática: {choose_printer()}")
    except Exception as exc:
        print(f"Aviso: {exc}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
