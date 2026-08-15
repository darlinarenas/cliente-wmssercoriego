# Validación SercoRiego Lite WMS v0.6

Fecha: 15-08-2026

## Cambios verificados

- Se mantiene la base v0.5 y la misma clave de LocalStorage.
- R1–R5: 6 módulos × 3 niveles.
- R6–R9: 6 módulos × 6 niveles = 144 posiciones rápidas.
- Total inicial: 9 racks y 242 ubicaciones, incluyendo REC-PU-01…08.
- Cada posición dispone de un código escaneable separado de su ID interno.
- Formato recomendado inicial: `{SEDE}-{RACK}-M{MODULO}-N{NIVEL}` → `REC-R6-M3-N4`.
- El formato escaneable es editable desde Estructura sin cambiar el ID histórico de la posición.
- Organización de palet admite tres destinos: escaneo de ubicación, escritura manual del código o selección manual.
- Modo ubicación rápida implementado: producto → ubicación → cantidad → confirmar.
- La cantidad rápida inicia en 1 unidad.
- El destino escaneado se valida contra ubicaciones activas y bloquea posiciones rápidas ocupadas por otro SKU.
- Cada movimiento queda registrado en historial con origen, destino, cantidad, usuario y método.

## Pruebas realizadas

- `node --check` sobre todos los módulos JavaScript: OK.
- Seed: 9 racks: OK.
- Seed: 242 ubicaciones: OK.
- Seed: 144 ubicaciones R6–R9: OK.
- Resolución de `REC-R6-M3-N4`: OK.
- Cambio de formato a `{SEDE}-{RACK}-{MODULO}-{NIVEL}` y resolución de `REC-R6-3-4`: OK.
- Servidor HTTP local y carga de `index.html` + módulo `pallets.js`: OK.

## Cámara

La lectura por cámara usa la capacidad del navegador disponible. Para uso real en teléfono debe abrirse bajo HTTPS (o localhost) y conceder permiso de cámara. El ingreso manual y la selección manual permanecen disponibles como respaldo.
