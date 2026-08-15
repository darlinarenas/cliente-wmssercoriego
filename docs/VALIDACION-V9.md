# Validación v0.9 — Edición controlada e inventario

## Cambios comprobados

- Se agregó **Editar / Inventario** en búsqueda de escritorio, catálogo de Productos y búsqueda móvil.
- Solo roles `ADMINISTRADOR` y `ENCARGADO` pueden guardar correcciones.
- La ficha permite corregir código, nombre, descripción, tipo/familia y rotación.
- El inventario físico se ajusta por ubicación mostrando cantidad del sistema, conteo físico y diferencia.
- Cada diferencia genera un movimiento `AJUSTE_INVENTARIO` con cantidad anterior, cantidad nueva, diferencia, usuario, fecha, ubicación y motivo.
- La corrección de código se propaga a inventario, recepciones, transferencias y movimientos; el código anterior queda guardado en `previousCodes` y en auditoría.
- La búsqueda acepta descripción y códigos anteriores.
- La migración conserva LocalStorage existente y agrega los nuevos campos sin restablecer datos.

## Validación técnica

Ejecutar `node --check` sobre todos los JavaScript, servir por HTTP y comprobar integridad del ZIP antes de entrega.
