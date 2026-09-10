//go:build windows

package main

import (
    "bytes"
    "encoding/json"
    "errors"
    "fmt"
    "io"
    "log"
    "net"
    "net/http"
    "net/url"
    "os"
    "path/filepath"
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
    agentVersion = "1.4"
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

type printerInfo2 struct { ServerName,PrinterName,ShareName,PortName,DriverName,Comment,Location,DevMode,SepFile,PrintProcessor,Datatype,Parameters,SecurityDescriptor uintptr; Attributes,Priority,DefaultPriority,StartTime,UntilTime,Status,CJobs,AveragePPM uint32 }
type docInfo1 struct { DocName,OutputFile,Datatype uintptr }
type printerRow struct { Name string `json:"name"`; Ready bool `json:"ready"`; Status uint32 `json:"status"`; Jobs uint32 `json:"jobs"`; Port string `json:"port"`; Driver string `json:"driver"`; Zebra bool `json:"zebra"` }
type remoteConfig struct { Enabled bool `json:"enabled"`; APIBaseURL string `json:"apiBaseUrl"`; StationToken string `json:"stationToken"`; PreferredPrinter string `json:"preferredPrinter"`; StationName string `json:"stationName"`; SiteID string `json:"siteId"`; CompanyID string `json:"companyId"` }
type remoteJob struct { ID string `json:"id"`; ZPL string `json:"zpl"`; Copies int `json:"copies"`; LabelType string `json:"labelType"` }

var zebraWords = []string{"zebra", "zdesigner", "zpl", "gc420", "gk420", "gx420", "zt410", "zt420", "zd220", "zd230", "zd420", "zd421"}

func ptrToString(p uintptr) string { if p==0{return ""};u16:=make([]uint16,0,256);for i:=uintptr(0);i<32768;i+=2{v:=*(*uint16)(unsafe.Pointer(p+i));if v==0{break};u16=append(u16,v)};return syscall.UTF16ToString(u16) }
func enumPrinters() ([]printerRow,error){
    flags:=uintptr(printerEnumLocal|printerEnumConnections);var needed,returned uint32
    r,_,err:=procEnumPrintersW.Call(flags,0,2,0,0,uintptr(unsafe.Pointer(&needed)),uintptr(unsafe.Pointer(&returned)))
    if needed==0 { if r==0&&err!=syscall.ERROR_INSUFFICIENT_BUFFER&&err!=syscall.Errno(0){return nil,err};return []printerRow{},nil }
    buf:=make([]byte,needed);r,_,err=procEnumPrintersW.Call(flags,0,2,uintptr(unsafe.Pointer(&buf[0])),uintptr(needed),uintptr(unsafe.Pointer(&needed)),uintptr(unsafe.Pointer(&returned)));if r==0{return nil,fmt.Errorf("EnumPrintersW: %v",err)}
    size:=unsafe.Sizeof(printerInfo2{});rows:=make([]printerRow,0,returned)
    for i:=uint32(0);i<returned;i++{pi:=(*printerInfo2)(unsafe.Pointer(uintptr(unsafe.Pointer(&buf[0]))+uintptr(i)*size));name:=ptrToString(pi.PrinterName);driver:=ptrToString(pi.DriverName);text:=strings.ToLower(name+" "+driver);isZebra:=false;for _,word:=range zebraWords{if strings.Contains(text,word){isZebra=true;break}};if !isZebra{continue};bad:=uint32(0x80|0x2|0x10|0x8|0x400000|0x100000|0x1000|0x1);rows=append(rows,printerRow{Name:name,Ready:(pi.Status&bad)==0,Status:pi.Status,Jobs:pi.CJobs,Port:ptrToString(pi.PortName),Driver:driver,Zebra:true})}
    sort.Slice(rows,func(i,j int)bool{return strings.ToLower(rows[i].Name)<strings.ToLower(rows[j].Name)});return rows,nil
}
func choosePrinter(requested string)(string,error){rows,err:=enumPrinters();if err!=nil{return "",err};wanted:=strings.TrimSpace(strings.ToLower(requested));if wanted!=""{for _,row:=range rows{if strings.ToLower(strings.TrimSpace(row.Name))==wanted{return row.Name,nil}};return "",fmt.Errorf("La impresora '%s' no está instalada como Zebra/ZPL en este Windows.",requested)};for _,row:=range rows{if row.Ready{return row.Name,nil}};if len(rows)>0{return rows[0].Name,nil};return "",errors.New("No se encontró una impresora Zebra/ZPL instalada en Windows.")}
func sendRaw(zpl,printer string)(uint32,error){data:=[]byte(zpl);if len(data)==0||!strings.Contains(zpl,"^XA")||!strings.Contains(zpl,"^XZ"){return 0,errors.New("El trabajo recibido no parece ZPL válido.")};if len(data)>maxZPLBytes{return 0,errors.New("El trabajo ZPL es demasiado grande; divide la cola en lotes.")};pName,_:=syscall.UTF16PtrFromString(printer);var h uintptr;r,_,err:=procOpenPrinterW.Call(uintptr(unsafe.Pointer(pName)),uintptr(unsafe.Pointer(&h)),0);if r==0{return 0,fmt.Errorf("No se pudo abrir la impresora %s: %v",printer,err)};defer procClosePrinter.Call(h);docName,_:=syscall.UTF16PtrFromString("Khal - Etiquetas");datatype,_:=syscall.UTF16PtrFromString("RAW");di:=docInfo1{DocName:uintptr(unsafe.Pointer(docName)),Datatype:uintptr(unsafe.Pointer(datatype))};job,_,err:=procStartDocPrinterW.Call(h,1,uintptr(unsafe.Pointer(&di)));if job==0{return 0,fmt.Errorf("StartDocPrinterW: %v",err)};okDoc:=false;defer func(){if !okDoc{procEndDocPrinter.Call(h)}}();r,_,err=procStartPagePrinter.Call(h);if r==0{return 0,fmt.Errorf("StartPagePrinter: %v",err)};pageEnded:=false;defer func(){if !pageEnded{procEndPagePrinter.Call(h)}}();var written uint32;r,_,err=procWritePrinter.Call(h,uintptr(unsafe.Pointer(&data[0])),uintptr(len(data)),uintptr(unsafe.Pointer(&written)));if r==0{return 0,fmt.Errorf("WritePrinter: %v",err)};if int(written)!=len(data){return 0,fmt.Errorf("Windows recibió %d de %d bytes del trabajo.",written,len(data))};procEndPagePrinter.Call(h);pageEnded=true;procEndDocPrinter.Call(h);okDoc=true;return uint32(job),nil}

func allowedOrigin(origin string) bool { if origin==""{return true};u,err:=url.Parse(origin);if err!=nil{return false};h:=strings.ToLower(u.Hostname());if (u.Scheme=="http"||u.Scheme=="https")&&(h=="localhost"||h=="127.0.0.1"){return true};if u.Scheme!="https"{return false};return h=="cliente-wmssercoriego.vercel.app"||(strings.HasPrefix(h,"cliente-wmssercoriego-")&&strings.HasSuffix(h,".vercel.app")) }
func cors(w http.ResponseWriter,r *http.Request) bool {origin:=r.Header.Get("Origin");if !allowedOrigin(origin){http.Error(w,"Origen no autorizado",http.StatusForbidden);return false};if origin!=""{w.Header().Set("Access-Control-Allow-Origin",origin);w.Header().Set("Vary","Origin")};w.Header().Set("Access-Control-Allow-Methods","GET, POST, OPTIONS");w.Header().Set("Access-Control-Allow-Headers","Content-Type");w.Header().Set("Access-Control-Allow-Private-Network","true");w.Header().Set("Cache-Control","no-store");w.Header().Set("Content-Type","application/json; charset=utf-8");return true}
func reply(w http.ResponseWriter,r *http.Request,status int,payload any){if !cors(w,r){return};w.WriteHeader(status);_ = json.NewEncoder(w).Encode(payload)}

func configPath() string { exe,err:=os.Executable();if err==nil{return filepath.Join(filepath.Dir(exe),"config.json")};return filepath.Join(os.TempDir(),"khal-print-config.json") }
func loadConfig() remoteConfig {var c remoteConfig;b,err:=os.ReadFile(configPath());if err==nil{_ = json.Unmarshal(b,&c)};c.APIBaseURL=strings.TrimRight(strings.TrimSpace(c.APIBaseURL),"/");return c}
func saveConfig(c remoteConfig) error {c.APIBaseURL=strings.TrimRight(strings.TrimSpace(c.APIBaseURL),"/");if c.APIBaseURL==""||!strings.HasPrefix(c.APIBaseURL,"https://"){return errors.New("La URL del backend debe usar HTTPS.")};if len(strings.TrimSpace(c.StationToken))<20{return errors.New("El token de estación no es válido.")};b,_:=json.MarshalIndent(c,"","  ");return os.WriteFile(configPath(),b,0600)}
func apiRequest(method,path string,body any,c remoteConfig)(map[string]any,error){var data []byte;if body!=nil{data,_=json.Marshal(body)};req,err:=http.NewRequest(method,c.APIBaseURL+path,bytes.NewReader(data));if err!=nil{return nil,err};req.Header.Set("Authorization","Bearer "+c.StationToken);if body!=nil{req.Header.Set("Content-Type","application/json")};client:=&http.Client{Timeout:12*time.Second};resp,err:=client.Do(req);if err!=nil{return nil,err};defer resp.Body.Close();raw,_:=io.ReadAll(io.LimitReader(resp.Body,2*1024*1024));if resp.StatusCode<200||resp.StatusCode>=300{var e map[string]any;_ = json.Unmarshal(raw,&e);if msg,ok:=e["error"].(string);ok&&msg!=""{return nil,errors.New(msg)};return nil,fmt.Errorf("Backend respondió %d",resp.StatusCode)};if len(raw)==0{return map[string]any{},nil};var out map[string]any;if err=json.Unmarshal(raw,&out);err!=nil{return nil,err};return out,nil}
func remoteLoop(){for{c:=loadConfig();if !c.Enabled||c.APIBaseURL==""||c.StationToken==""{time.Sleep(3*time.Second);continue};printer,err:=choosePrinter(c.PreferredPrinter);if err!=nil{_,_=apiRequest("POST","/print-agent/heartbeat",map[string]any{"printerName":"","ready":false},c);time.Sleep(4*time.Second);continue};_,_=apiRequest("POST","/print-agent/heartbeat",map[string]any{"printerName":printer,"ready":true},c);out,err:=apiRequest("GET","/print-agent/jobs/next",nil,c);if err!=nil{time.Sleep(4*time.Second);continue};rawJob,ok:=out["job"];if !ok||rawJob==nil{time.Sleep(2*time.Second);continue};b,_:=json.Marshal(rawJob);var job remoteJob;if json.Unmarshal(b,&job)!=nil||job.ID==""{time.Sleep(2*time.Second);continue};_,printErr:=sendRaw(job.ZPL,printer);payload:=map[string]any{"ok":printErr==nil,"printerName":printer};if printErr!=nil{payload["error"]=printErr.Error()};_,_=apiRequest("POST","/print-agent/jobs/"+url.PathEscape(job.ID)+"/result",payload,c);time.Sleep(400*time.Millisecond)}}

func main(){
    if runtime.GOOS!="windows"{log.Fatal("Khal Print debe ejecutarse en Windows")}
    go remoteLoop()
    mux:=http.NewServeMux()
    mux.HandleFunc("/health",func(w http.ResponseWriter,r *http.Request){if r.Method==http.MethodOptions{reply(w,r,200,map[string]any{"ok":true,"version":agentVersion});return};if r.Method!=http.MethodGet{reply(w,r,405,map[string]any{"ok":false,"error":"Método no permitido."});return};rows,err:=enumPrinters();if err!=nil{reply(w,r,500,map[string]any{"ok":false,"error":err.Error()});return};chosen:="";if len(rows)>0{chosen,_=choosePrinter("")};c:=loadConfig();reply(w,r,200,map[string]any{"ok":true,"service":"Khal Print","version":agentVersion,"printer":chosen,"printers":len(rows),"remoteEnabled":c.Enabled,"remoteSiteId":c.SiteID,"remoteStationName":c.StationName})})
    mux.HandleFunc("/printers",func(w http.ResponseWriter,r *http.Request){if r.Method==http.MethodOptions{reply(w,r,200,map[string]any{"ok":true});return};if r.Method!=http.MethodGet{reply(w,r,405,map[string]any{"ok":false,"error":"Método no permitido."});return};rows,err:=enumPrinters();if err!=nil{reply(w,r,500,map[string]any{"ok":false,"error":err.Error()});return};reply(w,r,200,map[string]any{"ok":true,"printers":rows})})
    mux.HandleFunc("/print",func(w http.ResponseWriter,r *http.Request){if r.Method==http.MethodOptions{reply(w,r,200,map[string]any{"ok":true});return};if r.Method!=http.MethodPost{reply(w,r,405,map[string]any{"ok":false,"error":"Método no permitido."});return};r.Body=http.MaxBytesReader(w,r.Body,maxZPLBytes*2);body,err:=io.ReadAll(r.Body);if err!=nil{reply(w,r,400,map[string]any{"ok":false,"error":"Trabajo vacío o demasiado grande."});return};var p struct{ZPL string `json:"zpl"`;Printer *string `json:"printer"`};if err=json.Unmarshal(body,&p);err!=nil{reply(w,r,400,map[string]any{"ok":false,"error":"Solicitud de impresión no válida."});return};requested:="";if p.Printer!=nil{requested=*p.Printer};printer,err:=choosePrinter(requested);if err!=nil{reply(w,r,400,map[string]any{"ok":false,"error":err.Error()});return};job,err:=sendRaw(p.ZPL,printer);if err!=nil{reply(w,r,400,map[string]any{"ok":false,"error":err.Error()});return};reply(w,r,200,map[string]any{"ok":true,"printer":printer,"jobId":job})})
    mux.HandleFunc("/remote/config",func(w http.ResponseWriter,r *http.Request){if r.Method==http.MethodOptions{reply(w,r,200,map[string]any{"ok":true});return};if r.Method!=http.MethodPost{reply(w,r,405,map[string]any{"ok":false,"error":"Método no permitido."});return};r.Body=http.MaxBytesReader(w,r.Body,64*1024);var c remoteConfig;if err:=json.NewDecoder(r.Body).Decode(&c);err!=nil{reply(w,r,400,map[string]any{"ok":false,"error":"Configuración no válida."});return};if err:=saveConfig(c);err!=nil{reply(w,r,400,map[string]any{"ok":false,"error":err.Error()});return};reply(w,r,200,map[string]any{"ok":true,"remoteEnabled":c.Enabled,"stationName":c.StationName,"siteId":c.SiteID})})
    mux.HandleFunc("/remote/status",func(w http.ResponseWriter,r *http.Request){if r.Method==http.MethodOptions{reply(w,r,200,map[string]any{"ok":true});return};c:=loadConfig();reply(w,r,200,map[string]any{"ok":true,"enabled":c.Enabled,"stationName":c.StationName,"siteId":c.SiteID,"companyId":c.CompanyID,"apiBaseUrl":c.APIBaseURL})})
    server:=&http.Server{Addr:net.JoinHostPort(host,port),Handler:mux,ReadHeaderTimeout:5*time.Second,ReadTimeout:20*time.Second,WriteTimeout:20*time.Second,IdleTimeout:60*time.Second}
    if err:=server.ListenAndServe();err!=nil&&err!=http.ErrServerClosed{msg:=fmt.Sprintf("Khal Print no pudo iniciar en %s:%s: %v",host,port,err);_ = os.WriteFile(filepath.Join(os.TempDir(),"khal-print-error.txt"),[]byte(msg),0644)}
}
