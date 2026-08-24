# Revisión de stock y multiempresa · 2026-08-24

## Cambio aplicado

En **Productos** se agregó un selector visible de alcance:

- **Solo centro activo**: muestra únicamente productos con existencias en el centro seleccionado (por ejemplo, Vitacura) y su cantidad local.
- **Stock global de la empresa**: muestra productos con existencia en cualquier centro de la empresa activa y suma solo esos centros.
- **Todos los productos y centros**: muestra el catálogo completo y el desglose de cantidades de todos los centros de la empresa activa.

También se reforzó la selección de empresa activa: un valor antiguo o manipulado en el navegador ya no puede activar una empresa que no esté autorizada para el usuario.

## Hallazgo importante de arquitectura

La versión recibida tiene separación operativa por `companyId` y `siteId` en distintas funciones, pero PostgreSQL todavía utiliza tablas compartidas y el endpoint `/state` reconstruye un estado común. Por lo tanto, **esta versión no debe certificarse todavía como aislamiento multiempresa total a nivel de datos**.

Para cumplir literalmente que una empresa no pueda leer, modificar ni colisionar con productos, trabajadores o movimientos de otra, hace falta una migración controlada con ámbito empresarial obligatorio en el backend (o esquemas/bases separados), restricciones e índices compuestos, filtrado del lado servidor y pruebas de acceso cruzado. Esa migración no se incluyó aquí para evitar alterar a ciegas la base productiva o romper los flujos congelados.

## Validación ejecutada

- Sintaxis de los archivos modificados.
- Selector Centro / Global / Todos.
- Protección de empresa activa según autorización.
- Lógica multiempresa/multicentro existente.
- Aislamiento de edición de usuarios por ID.
- Flujo de transferencias y recepción con diferencias.
- Contrato CORS y guardado parcial.
- Seguridad de contraseñas en el modo actual del proyecto.

