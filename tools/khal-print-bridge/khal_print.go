//go:build windows

package main

import (
    "encoding/json"
    "errors"
    "fmt"
    "io"
    "log"
    "net"
    "net/http"
    "os"
    "runtime"
    "sort"
    "strings"
    "syscall"
    "time"
    "unsafe"
)

const (
    host = "127.0.0.1"
    port = "17891"
    maxZPLBytes = 12 * 1024 * 1024
    printerEnumLocal = 0x00000002
    printerEnumConnections = 0x00000004
)

var (
    winspool = syscall.NewLazyDLL("winspool.drv")
    procEnumPrintersW = winspool.NewProc("EnumPrintersW")
    procOpenPrinterW = winspool.NewProc("OpenPrinterW")
    procClosePrinter = winspool.NewProc("ClosePrinter")
    procStartDocPrinterW = winspool.NewProc("StartDocPrinterW")
    procEndDocPrinter = winspool.NewProc("EndDocPrinter")
    procStartPagePrinter = winspool.NewProc("StartPagePrinter")
    procEndPagePrinter = winspool.NewProc("EndPagePrinter")
    procWritePrinter = winspool.NewProc("WritePrinter")
)

type printerInfo2 struct {
    ServerName uintptr
    PrinterName uintptr
    ShareName uintptr
    PortName uintptr
    DriverName uintptr
    Comment uintptr
    Location uintptr
    DevMode uintptr
    SepFile uintptr
    PrintProcessor uintptr
    Datatype uintptr
    Parameters uintptr
    SecurityDescriptor uintptr
    Attributes uint32
    Priority uint32
    DefaultPriority uint32
    StartTime uint32
    UntilTime uint32
    Status uint32
    CJobs uint32
    AveragePPM uint32
}

type docInfo1 struct {
    DocName uintptr
    OutputFile uintptr
    Datatype uintptr
}

type printerRow struct {
    Name string `json:"name"`
    Ready bool `json:"ready"`
    Status uint32 `json:"status"`
    Jobs uint32 `json:"jobs"`
    Port string `json:"port"`
    Driver string `json:"driver"`
    Zebra bool `json:"zebra"`
}

var zebraWords = []string{"zebra", "zdesigner", "zpl", "gc420", "gk420", "gx420", "zt410", "zt420", "zd220", "zd230", "zd420", "zd421"}

func ptrToString(p uintptr) string {
    if p == 0 { return "" }
    u16 := make([]uint16, 0, 256)
    for i := uintptr(0); i < 32768; i += 2 {
        v := *(*uint16)(unsafe.Pointer(p + i))
        if v == 0 { break }
        u16 = append(u16, v)
    }
    return syscall.UTF16ToString(u16)
}

func enumPrinters() ([]printerRow, error) {
    flags := uintptr(printerEnumLocal | printerEnumConnections)
    var needed, returned uint32
    r, _, err := procEnumPrintersW.Call(flags, 0, 2, 0, 0, uintptr(unsafe.Pointer(&needed)), uintptr(unsafe.Pointer(&returned)))
    if needed == 0 {
        if r == 0 && err != syscall.ERROR_INSUFFICIENT_BUFFER && err != syscall.Errno(0) { return nil, err }
        return []printerRow{}, nil
    }
    buf := make([]byte, needed)
    r, _, err = procEnumPrintersW.Call(flags, 0, 2, uintptr(unsafe.Pointer(&buf[0])), uintptr(needed), uintptr(unsafe.Pointer(&needed)), uintptr(unsafe.Pointer(&returned)))
    if r == 0 { return nil, fmt.Errorf("EnumPrintersW: %v", err) }
    size := unsafe.Sizeof(printerInfo2{})
    rows := make([]printerRow, 0, returned)
    for i := uint32(0); i < returned; i++ {
        pi := (*printerInfo2)(unsafe.Pointer(uintptr(unsafe.Pointer(&buf[0])) + uintptr(i)*size))
        name := ptrToString(pi.PrinterName)
        driver := ptrToString(pi.DriverName)
        text := strings.ToLower(name + " " + driver)
        isZebra := false
        for _, word := range zebraWords { if strings.Contains(text, word) { isZebra = true; break } }
        if !isZebra { continue }
        // Offline 0x80, Error 0x2, Paper out 0x10, Paper jam 0x8,
        // Door open 0x400000, User intervention 0x100000, Not available 0x1000, Paused 0x1.
        bad := uint32(0x80 | 0x2 | 0x10 | 0x8 | 0x400000 | 0x100000 | 0x1000 | 0x1)
        rows = append(rows, printerRow{Name:name, Ready:(pi.Status&bad)==0, Status:pi.Status, Jobs:pi.CJobs, Port:ptrToString(pi.PortName), Driver:driver, Zebra:true})
    }
    sort.Slice(rows, func(i,j int) bool { return strings.ToLower(rows[i].Name) < strings.ToLower(rows[j].Name) })
    return rows, nil
}

func choosePrinter(requested string) (string, error) {
    rows, err := enumPrinters(); if err != nil { return "", err }
    wanted := strings.TrimSpace(strings.ToLower(requested))
    if wanted != "" {
        for _, row := range rows { if strings.ToLower(strings.TrimSpace(row.Name)) == wanted { return row.Name, nil } }
        return "", fmt.Errorf("La impresora '%s' no está instalada como Zebra/ZPL en este Windows.", requested)
    }
    for _, row := range rows { if row.Ready { return row.Name, nil } }
    if len(rows) > 0 { return rows[0].Name, nil }
    return "", errors.New("No se encontró una impresora Zebra/ZPL instalada en Windows.")
}

func sendRaw(zpl, printer string) (uint32, error) {
    data := []byte(zpl)
    if len(data) == 0 || !strings.Contains(zpl, "^XA") || !strings.Contains(zpl, "^XZ") { return 0, errors.New("El trabajo recibido no parece ZPL válido.") }
    if len(data) > maxZPLBytes { return 0, errors.New("El trabajo ZPL es demasiado grande; divide la cola en lotes.") }
    pName, _ := syscall.UTF16PtrFromString(printer)
    var h uintptr
    r, _, err := procOpenPrinterW.Call(uintptr(unsafe.Pointer(pName)), uintptr(unsafe.Pointer(&h)), 0)
    if r == 0 { return 0, fmt.Errorf("No se pudo abrir la impresora %s: %v", printer, err) }
    defer procClosePrinter.Call(h)
    docName, _ := syscall.UTF16PtrFromString("Khal - Etiquetas")
    datatype, _ := syscall.UTF16PtrFromString("RAW")
    di := docInfo1{DocName:uintptr(unsafe.Pointer(docName)), Datatype:uintptr(unsafe.Pointer(datatype))}
    job, _, err := procStartDocPrinterW.Call(h, 1, uintptr(unsafe.Pointer(&di)))
    if job == 0 { return 0, fmt.Errorf("StartDocPrinterW: %v", err) }
    okDoc := false
    defer func(){ if !okDoc { procEndDocPrinter.Call(h) } }()
    r, _, err = procStartPagePrinter.Call(h); if r == 0 { return 0, fmt.Errorf("StartPagePrinter: %v", err) }
    pageEnded := false
    defer func(){ if !pageEnded { procEndPagePrinter.Call(h) } }()
    var written uint32
    r, _, err = procWritePrinter.Call(h, uintptr(unsafe.Pointer(&data[0])), uintptr(len(data)), uintptr(unsafe.Pointer(&written)))
    if r == 0 { return 0, fmt.Errorf("WritePrinter: %v", err) }
    if int(written) != len(data) { return 0, fmt.Errorf("Windows recibió %d de %d bytes del trabajo.", written, len(data)) }
    procEndPagePrinter.Call(h); pageEnded = true
    procEndDocPrinter.Call(h); okDoc = true
    return uint32(job), nil
}

func cors(w http.ResponseWriter, r *http.Request) {
    origin := r.Header.Get("Origin")
    if origin == "" { origin = "*" }
    w.Header().Set("Access-Control-Allow-Origin", origin)
    w.Header().Set("Vary", "Origin")
    w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
    w.Header().Set("Access-Control-Allow-Private-Network", "true")
    w.Header().Set("Cache-Control", "no-store")
    w.Header().Set("Content-Type", "application/json; charset=utf-8")
}

func reply(w http.ResponseWriter, r *http.Request, status int, payload any) {
    cors(w,r); w.WriteHeader(status); _ = json.NewEncoder(w).Encode(payload)
}

func main() {
    if runtime.GOOS != "windows" { log.Fatal("Khal Print debe ejecutarse en Windows") }
    mux := http.NewServeMux()
    mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request){
        if r.Method == http.MethodOptions { reply(w,r,200,map[string]any{"ok":true,"version":"1.3"}); return }
        if r.Method != http.MethodGet { reply(w,r,405,map[string]any{"ok":false,"error":"Método no permitido."}); return }
        rows, err := enumPrinters(); if err != nil { reply(w,r,500,map[string]any{"ok":false,"error":err.Error()}); return }
        chosen := ""; if len(rows)>0 { chosen,_ = choosePrinter("") }
        reply(w,r,200,map[string]any{"ok":true,"service":"Khal Print","version":"1.3","printer":chosen,"printers":len(rows)})
    })
    mux.HandleFunc("/printers", func(w http.ResponseWriter, r *http.Request){
        if r.Method == http.MethodOptions { reply(w,r,200,map[string]any{"ok":true,"version":"1.3"}); return }
        if r.Method != http.MethodGet { reply(w,r,405,map[string]any{"ok":false,"error":"Método no permitido."}); return }
        rows, err := enumPrinters(); if err != nil { reply(w,r,500,map[string]any{"ok":false,"error":err.Error()}); return }
        reply(w,r,200,map[string]any{"ok":true,"printers":rows})
    })
    mux.HandleFunc("/print", func(w http.ResponseWriter, r *http.Request){
        if r.Method == http.MethodOptions { reply(w,r,200,map[string]any{"ok":true,"version":"1.3"}); return }
        if r.Method != http.MethodPost { reply(w,r,405,map[string]any{"ok":false,"error":"Método no permitido."}); return }
        r.Body = http.MaxBytesReader(w,r.Body,maxZPLBytes*2)
        body, err := io.ReadAll(r.Body); if err != nil { reply(w,r,400,map[string]any{"ok":false,"error":"Trabajo vacío o demasiado grande."}); return }
        var p struct{ ZPL string `json:"zpl"`; Printer *string `json:"printer"` }
        if err=json.Unmarshal(body,&p); err != nil { reply(w,r,400,map[string]any{"ok":false,"error":"Solicitud de impresión no válida."}); return }
        requested := ""; if p.Printer != nil { requested=*p.Printer }
        printer, err := choosePrinter(requested); if err != nil { reply(w,r,400,map[string]any{"ok":false,"error":err.Error()}); return }
        job, err := sendRaw(p.ZPL, printer); if err != nil { reply(w,r,400,map[string]any{"ok":false,"error":err.Error()}); return }
        reply(w,r,200,map[string]any{"ok":true,"printer":printer,"jobId":job})
    })
    server := &http.Server{Addr: net.JoinHostPort(host,port), Handler:mux, ReadHeaderTimeout:5*time.Second, ReadTimeout:20*time.Second, WriteTimeout:20*time.Second, IdleTimeout:60*time.Second}
    if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
        msg := fmt.Sprintf("Khal Print no pudo iniciar en %s:%s: %v",host,port,err)
        _ = os.WriteFile(os.TempDir()+"\\khal-print-error.txt",[]byte(msg),0644)
    }
}
