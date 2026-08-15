# Validación v0.8

## Cambios verificados
- Los productos Orbit se muestran como `Orbit CODIGO` sin guiones.
- Migración de LocalStorage: `Orbit 49-85-10` -> `Orbit 498510` sin resetear datos.
- Los códigos de ubicación conservan guiones, por ejemplo `REC-R6-M3-N4`.
- Nuevo módulo Usuarios / Operadores.
- Alta, edición, activación/desactivación y roles.
- Cambio de operador actual desde usuarios registrados.
- El operador actual sigue siendo el responsable automático de nuevas recepciones, despachos y movimientos.
- Los selectores de supervisor/revisor usan usuarios activos registrados.

## Pruebas ejecutadas
- `node --check` sobre todos los módulos JavaScript: OK.
- Seed: 9 racks, 242 ubicaciones, productos Orbit sin guiones: OK.
- Migración simulada de v0.7 a v0.8: OK.
- Servidor HTTP: index, módulo Usuarios y migración accesibles: OK.
- Búsqueda estática de patrones `Orbit xx-xx-xx`: sin coincidencias.

## Limitación del entorno
La prueba visual automática con Chromium headless volvió a bloquearse por DBus del contenedor y terminó por timeout. No se marca como validación visual aprobada.
