# Validación V10 · lógica matemática de inventario

## Regla funcional
- Mover: descuenta exactamente del origen seleccionado y suma exactamente al destino.
- Despachar: al confirmar EN TRÁNSITO descuenta del inventario físico y registra de qué ubicación/palet salió.
- Búsqueda: muestra stock actual en bodega y unidades que quedaron EN TRÁNSITO con documento, destino y conductor.
- Preparación de despacho: antes de agregar muestra código, producto, descripción, total disponible y ubicaciones.

## Caso verificado 469510
Datos iniciales del seed:
- Palet N: 34 unidades.
- Otro palet: 38 unidades.
- Total: 72 unidades.

Prueba de movimiento:
- Se movieron 33 unidades desde Palet N a REC-R6-M2-N3.
- Resultado: Palet N = 1; Rack = 33; total = 72.

Prueba de despacho:
- Se despacharon 6 unidades con origen automático (prioridad rack).
- Resultado: Rack = 27; total físico = 66; 6 unidades asignadas a salida.

## Comprobaciones técnicas
- `node --check` ejecutado sobre todos los JavaScript del proyecto.
- Prueba programática ejecutada contra `createSeed()` y `inventory-ops.js`.
- Service Worker actualizado para invalidar caché anterior e incluir el nuevo servicio de inventario.
