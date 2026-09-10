"""Khal Print Bridge 1.1

Puente local entre Khal Web y las impresoras instaladas en Windows.
Escucha solo en loopback; no depende de IP de impresora ni de red.
"""
from __future__ import annotations
import json,sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
try:
    import win32print
except ImportError as exc:
    raise SystemExit("Falta pywin32. Ejecuta INSTALAR_KHAL_PRINT.bat") from exc

HOST="127.0.0.1"; PORT=17891; MAX_ZPL_BYTES=12*1024*1024
ZEBRA_WORDS=("zebra","zdesigner","zpl","gc420","gk420","gx420","zt410","zt420","zd220","zd230","zd420","zd421")

def list_printers():
    flags=win32print.PRINTER_ENUM_LOCAL|win32print.PRINTER_ENUM_CONNECTIONS
    return sorted(set(str(row[2]) for row in win32print.EnumPrinters(flags,None,1) if row[2]))

def printer_info(name):
    result={"name":name,"ready":False,"status":0,"jobs":0,"port":"","driver":""}
    h=win32print.OpenPrinter(name)
    try: info=win32print.GetPrinter(h,2)
    finally: win32print.ClosePrinter(h)
    status=int(info.get("Status",0) or 0); attrs=int(info.get("Attributes",0) or 0)
    bad=0
    for c in ("PRINTER_STATUS_PAUSED","PRINTER_STATUS_ERROR","PRINTER_STATUS_OFFLINE","PRINTER_STATUS_PAPER_OUT","PRINTER_STATUS_PAPER_JAM","PRINTER_STATUS_DOOR_OPEN","PRINTER_STATUS_NOT_AVAILABLE","PRINTER_STATUS_USER_INTERVENTION"):
        bad|=int(getattr(win32print,c,0) or 0)
    result.update({"ready":not bool(attrs&0x400) and not bool(status&bad),"status":status,"jobs":int(info.get("cJobs",0) or 0),"port":str(info.get("pPortName","") or ""),"driver":str(info.get("pDriverName","") or "")})
    return result

def looks_like_zebra(name,info=None):
    text=f"{name} {(info or {}).get('driver','')}".lower()
    return any(w in text for w in ZEBRA_WORDS)

def zebra_rows():
    rows=[]
    for name in list_printers():
        try: info=printer_info(name)
        except Exception: info={"name":name,"ready":False,"status":0,"jobs":0,"port":"","driver":""}
        info["zebra"]=looks_like_zebra(name,info)
        if info["zebra"]: rows.append(info)
    return rows

def choose_printer(requested=None):
    rows=zebra_rows()
    if requested:
        wanted=str(requested).strip().lower()
        for row in rows:
            if row["name"].strip().lower()==wanted: return row["name"]
        raise RuntimeError(f"La impresora '{requested}' no está instalada como Zebra/ZPL en este Windows.")
    ready=[r for r in rows if r.get("ready")]
    if ready:return ready[0]["name"]
    if rows:return rows[0]["name"]
    raise RuntimeError("No se encontró una impresora Zebra/ZPL instalada en Windows.")

def send_raw(zpl,printer):
    data=zpl.encode("utf-8")
    if not data or b"^XA" not in data or b"^XZ" not in data: raise RuntimeError("El trabajo recibido no parece ZPL válido.")
    if len(data)>MAX_ZPL_BYTES: raise RuntimeError("El trabajo ZPL es demasiado grande; divide la cola en lotes.")
    h=win32print.OpenPrinter(printer)
    try:
        job=win32print.StartDocPrinter(h,1,("Khal · Etiquetas",None,"RAW")); win32print.StartPagePrinter(h); win32print.WritePrinter(h,data); win32print.EndPagePrinter(h); win32print.EndDocPrinter(h); return int(job)
    finally: win32print.ClosePrinter(h)

class Handler(BaseHTTPRequestHandler):
    server_version="KhalPrintBridge/1.1"
    def log_message(self,fmt,*args): return
    def _headers(self,status=200):
        self.send_response(status); self.send_header("Content-Type","application/json; charset=utf-8"); self.send_header("Cache-Control","no-store")
        origin=self.headers.get("Origin")
        if origin:self.send_header("Access-Control-Allow-Origin",origin); self.send_header("Vary","Origin")
        else:self.send_header("Access-Control-Allow-Origin","*")
        self.send_header("Access-Control-Allow-Methods","GET, POST, OPTIONS"); self.send_header("Access-Control-Allow-Headers","Content-Type"); self.send_header("Access-Control-Allow-Private-Network","true"); self.end_headers()
    def _json(self,payload,status=200): self._headers(status); self.wfile.write(json.dumps(payload,ensure_ascii=False).encode("utf-8"))
    def do_OPTIONS(self): self._json({"ok":True,"version":"1.1"})
    def do_GET(self):
        try:
            if self.path=="/health":
                rows=zebra_rows(); chosen=choose_printer() if rows else None; self._json({"ok":True,"service":"Khal Print Bridge","version":"1.1","printer":chosen,"printers":len(rows)}); return
            if self.path=="/printers": self._json({"ok":True,"printers":zebra_rows()}); return
            self._json({"ok":False,"error":"Ruta no encontrada."},404)
        except Exception as exc:self._json({"ok":False,"error":str(exc)},500)
    def do_POST(self):
        if self.path!="/print": self._json({"ok":False,"error":"Ruta no encontrada."},404); return
        try:
            length=int(self.headers.get("Content-Length","0") or 0)
            if length<=0 or length>MAX_ZPL_BYTES*2: raise RuntimeError("Trabajo vacío o demasiado grande.")
            payload=json.loads(self.rfile.read(length).decode("utf-8")); printer=choose_printer(payload.get("printer")); job=send_raw(str(payload.get("zpl","")),printer); self._json({"ok":True,"printer":printer,"jobId":job})
        except Exception as exc:self._json({"ok":False,"error":str(exc)},400)

def main():
    if not sys.platform.startswith("win"):raise SystemExit("Khal Print Bridge debe ejecutarse en Windows.")
    server=ThreadingHTTPServer((HOST,PORT),Handler); print(f"Khal Print Bridge 1.1 activo en http://{HOST}:{PORT}")
    try: print(f"Impresora automática: {choose_printer()}")
    except Exception as exc: print(f"Aviso: {exc}")
    try:server.serve_forever()
    except KeyboardInterrupt:pass
    finally:server.server_close()
if __name__=="__main__":main()
