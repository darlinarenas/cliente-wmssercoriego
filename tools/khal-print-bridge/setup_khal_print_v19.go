package main

import (
  _ "embed"
  "fmt"
  "net/http"
  "os"
  "os/exec"
  "path/filepath"
  "syscall"
  "time"
)

//go:embed KhalPrint.exe
var khalExe []byte

func esc(s string) string { out:=""; for _,r:=range s { if r=='\'' { out+="''" } else { out+=string(r) } }; return out }
func box(title,msg,icon string) {
  _=exec.Command("powershell","-NoProfile","-Command",
    "Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('"+esc(msg)+"','"+esc(title)+"','OK','"+icon+"')").Run()
}
func fail(msg string, err error) {
  if err!=nil { msg+="\n\n"+err.Error() }
  box("Khal Print - Error",msg,"Error")
  os.Exit(1)
}
func healthOK() bool {
  client:=&http.Client{Timeout:900*time.Millisecond}
  for i:=0;i<12;i++ {
    for _,port:=range []string{"17891","17892","17893"} {
      r,err:=client.Get("http://127.0.0.1:"+port+"/health")
      if err==nil {
        _=r.Body.Close()
        if r.StatusCode>=200 && r.StatusCode<300 { return true }
      }
    }
    time.Sleep(500*time.Millisecond)
  }
  return false
}
func main() {
  local:=os.Getenv("LOCALAPPDATA")
  appdata:=os.Getenv("APPDATA")
  if local==""||appdata=="" { fail("Windows no entregó las carpetas de usuario necesarias.",nil) }

  destDir:=filepath.Join(local,"KhalPrint")
  destExe:=filepath.Join(destDir,"KhalPrint.exe")
  startupDir:=filepath.Join(appdata,"Microsoft","Windows","Start Menu","Programs","Startup")
  startupCmd:=filepath.Join(startupDir,"KhalPrint.cmd")

  _=exec.Command("taskkill","/IM","KhalPrint.exe","/F").Run()
  time.Sleep(700*time.Millisecond)

  if err:=os.MkdirAll(destDir,0755);err!=nil { fail("No se pudo crear la carpeta permanente de Khal Print.",err) }
  if err:=os.WriteFile(destExe,khalExe,0755);err!=nil { fail("No se pudo instalar KhalPrint.exe.",err) }
  if err:=os.MkdirAll(startupDir,0755);err!=nil { fail("No se pudo abrir la carpeta Inicio de Windows.",err) }

  cmdText:="@echo off\r\nstart \"\" \""+destExe+"\"\r\n"
  if err:=os.WriteFile(startupCmd,[]byte(cmdText),0644);err!=nil { fail("No se pudo registrar Khal Print en Inicio de Windows.",err) }

  regData:=fmt.Sprintf("\"%s\"",destExe)
  if err:=exec.Command("reg","add",`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`,
      "/v","KhalPrint","/t","REG_SZ","/d",regData,"/f").Run();err!=nil {
    fail("No se pudo registrar Khal Print en el inicio automático de Windows.",err)
  }

  cmd:=exec.Command(destExe)
  cmd.SysProcAttr=&syscall.SysProcAttr{HideWindow:true}
  if err:=cmd.Start();err!=nil { fail("Khal Print quedó copiado, pero Windows no pudo iniciarlo.",err) }

  if !healthOK() {
    errFile:=filepath.Join(os.TempDir(),"khal-print-error.txt")
    fail("Khal Print fue copiado, pero no logró mantenerse activo.\nNo se marcará la instalación como correcta.\n\nDiagnóstico: "+errFile,nil)
  }

  box("Khal Print instalado",
    "Khal Print quedó instalado y ACTIVO.\n\nEjecutable: "+destExe+
    "\nInicio automático: ACTIVADO\nServicio local: ACTIVO\n\nYa puedes volver a Khal y pulsar Actualizar.",
    "Information")
}
