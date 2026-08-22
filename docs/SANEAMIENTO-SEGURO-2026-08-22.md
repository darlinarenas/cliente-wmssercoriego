# Saneamiento seguro · 2026-08-22

## Alcance

Este saneamiento se realizó sobre la versión entregada el 22 de agosto de
2026. No cambia inventario, movimientos, racks, recepciones, órdenes, centros,
login existente, mapa, base de datos ni reglas de negocio aprobadas.

## Cambios realizados

- Se normalizó el estado dejado por la reversión del mapa. Las diferencias de
  `mapa3d.js`, `app.css` y `sw.js` eran únicamente de formato/permisos y no de
  lógica.
- Se eliminaron copias inactivas no importadas por la aplicación:
  - `src/modules/layout/layout.js`
  - `src/services/scanner.js`
  - `src/modules/usuarios/centros/centros.js`
  - `backend/src/modules/db/database.js`
  - `backend/src/modules/db/initial-state.js`
- Se añadió `.gitattributes` para evitar falsos cambios por finales de línea.
- Se añadió `backend/.env.example` sin credenciales reales.
- El `.env` real fue excluido del paquete de entrega.
- Se corrigió la creación del administrador inicial para que use el mismo modo
  de contraseña que el login actual de desarrollo.
- Se actualizaron los README para reflejar correctamente el estado temporal de
  las contraseñas.

## Verificaciones

- Sintaxis de todos los JavaScript del frontend: OK.
- Sintaxis de los archivos críticos del backend: OK.
- Prueba de estructura V15, aislamiento por centro, migración y stock reservado: OK.
- Prueba del modo actual de contraseñas de desarrollo: OK.
- Búsqueda de referencias a los archivos eliminados: sin referencias activas.

## Acción externa pendiente

Como el ZIP original contenía un `.env`, se recomienda rotar en Supabase/Render
las credenciales que hayan estado dentro de ese archivo. El saneamiento elimina
el archivo de la nueva entrega, pero no puede rotar credenciales externas.
