# Auditoría de tráfico Khal v336

## Cambios implementados
- Deduplicación exclusivamente de GET idénticos simultáneos (mismo usuario, empresa y centro), sin caché persistente ni cambios a escrituras.
- Middleware de métricas desactivado por defecto. Activar `WMS_TRAFFIC_METRICS=1` en Render para emitir líneas `[WMS_TRAFFIC]` por petición API. No registra datos personales, cuerpos ni tokens. Desactivar tras obtener una muestra representativa.
- Renovación de versión PWA.

## Pendiente (no implementado)
- GET condicionales por colección: requieren versiones específicas de colección. La revisión global `meta.revision` cambia con cualquier escritura y no basta para discriminar cambios por tabla.
- Evitar `GET /state` completos de inventarios y conciliación sin romper validaciones de stock, empresas y permisos.
- Cuantificar tráfico real en Render y PostgreSQL: las métricas instrumentadas son del backend, no un reporte de uso real todavía.

## Validación recomendada antes de producción
1. Probar dos sesiones de usuario con empresas/centros diferentes; ninguna petición debe mezclarse.
2. Probar preparación y emisión, confirmación de traspasos y actualización de tareas entre dispositivos.
3. Activar temporalmente WMS_TRAFFIC_METRICS=1 y revisar los endpoints de mayor tamaño/frecuencia.
4. Desactivar las métricas después del diagnóstico.
