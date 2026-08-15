# Validación v0.5 — Organización de palets

Validaciones realizadas antes de entregar:

1. Sintaxis JavaScript de todos los módulos con `node --check`.
2. Importación de `renderPallets` actualizada a su módulo propio `views/pallets.js`.
3. Estructura inicial verificada: R1–R5 6×3; R6–R9 6×6; zonas temporales REC-PU.
4. Palet demostración `PAL-0101` en `REC-PU-01`, con dos productos para probar inmediatamente la pantalla.
5. Regla de recomendación verificada por código: ubicaciones existentes primero; posiciones rápidas libres R6–R9 después.
6. Movimiento desde palet conserva trazabilidad mediante `movements`, usuario, fecha, origen, destino, cantidad y motivo.
7. La prueba de cámara requiere HTTPS/localhost, permiso físico y navegador compatible con BarcodeDetector.
