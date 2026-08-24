# Aislamiento multiempresa reforzado · backend

## Resultado

Cada empresa tiene ahora un ámbito obligatorio en PostgreSQL y en la API:

- `company_id` obligatorio en centros, estructura, productos, códigos, inventario, pallets, recepciones, transferencias, cargas, tareas, órdenes, movimientos y auditoría.
- Estado, configuración y número de revisión independientes mediante `wms_company_meta`.
- Claves primarias compuestas `(company_id, id)`.
- SKU único por empresa, no global: dos empresas pueden usar el mismo código sin colisionar.
- Toda lectura, actualización, eliminación y emisión de orden exige `company_id`.
- Un trabajador normal pertenece a una sola empresa; únicamente `ADMIN_GLOBAL` puede cambiar de empresa.
- El backend rechaza una empresa enviada desde el navegador si el usuario no está autorizado.
- La integración Kame exige empresa y consulta solamente productos, códigos, centros y órdenes de ese ámbito.

## Migración de datos existentes

La migración es aditiva y se ejecuta al iniciar el backend actualizado:

1. Agrega columnas y metadatos empresariales sin eliminar tablas.
2. Deduce la empresa desde `companyId`, centro, ubicación o producto cuando el dato ya existe.
3. Los registros históricos sin ninguna referencia empresarial quedan en `SERCO_RIEGO`.
4. Escribe `companyId` también dentro del JSON para mantener compatibilidad con el frontend.
5. Convierte las claves e índices al modelo empresarial.
6. Si un trabajador antiguo estaba asignado a varias empresas, conserva solamente su primera empresa y sus asignaciones compatibles. El administrador global conserva acceso general.

La misma migración está disponible para auditoría en `backend/sql/002_multiempresa_aislamiento.sql`.

## Orden de despliegue obligatorio

1. Crear un respaldo/snapshot de PostgreSQL desde el proveedor.
2. Subir primero el **backend** actualizado a Render.
3. Esperar que Render indique que el servicio inició correctamente y verificar `/api/health`.
4. Iniciar sesión como administrador y confirmar que Serco Riego, Recoleta y Vitacura aparecen correctamente.
5. Publicar después el **frontend** actualizado en Vercel.
6. Probar una empresa secundaria con un usuario propio antes de cargar datos masivos.

No publicar primero el frontend: el nuevo cliente envía `X-WMS-Company` y debe encontrar el backend preparado para validarlo.

## Pruebas incluidas

- Empresa no autorizada por encabezado.
- Escritura con `companyId` cruzado.
- Lecturas y eliminaciones por empresa + ID.
- Mismo ID y mismo SKU en empresas diferentes.
- Usuario perteneciente a una sola empresa.
- Guardado parcial sin modificar tablas ausentes.
- Emisión de órdenes e inventario limitada a la empresa activa.
- CORS para `X-WMS-Company`.
- Flujos anteriores de transferencias, usuarios y contraseñas.

