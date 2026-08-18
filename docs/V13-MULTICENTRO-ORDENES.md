# WMS Serco Riego · V13 Multicentro y Órdenes

Esta evolución se construye sobre la versión congelada sin eliminar módulos existentes.

## Cambios
- Módulo administrativo **Centros y Sucursales**. Los nombres de nuevas tiendas/centros los define el administrador.
- Cada centro puede tener racks y ubicaciones propios desde **Estructura**.
- En Recoleta, Racks 1–5, niveles 2 y 3 incorporan posiciones físicas **A/B** para pallets móviles, manteniendo ubicaciones antiguas por compatibilidad.
- Producto maestro con un código principal y múltiples códigos asociados (`product_codes`). Todos resuelven al mismo producto.
- Los códigos asociados funcionan en búsqueda, recepción, mover, pallets, despacho, vista móvil, historial y picking.
- Módulo **Órdenes / Mis tareas** con flujo: Recibida → Aceptada → Asignada → En picking → Preparada → Entregada al conductor.
- Importación de orden Excel usando solo `CODIGO`/`SKU` y `CANTIDAD`; el resto se obtiene del catálogo existente.
- Seguimiento de picking con barra de progreso y actualización periódica del panel administrativo.
- Usuarios preparados para asociarse a uno o varios centros (`site_ids`).
- Endpoint futuro Kame: `POST /api/integrations/kame/orders`, protegido por `KAME_INTEGRATION_KEY` y desactivado mientras la clave no exista.

## Despliegue recomendado
1. Actualizar primero el **backend** y dejar que `ensureDatabase()` cree de forma aditiva `product_codes`, `orders` y `users.site_ids`.
2. Verificar `/api/health`.
3. Actualizar el **frontend**.
4. Iniciar sesión como administrador y revisar Centros, Productos y Órdenes.

No se requiere borrar ni recrear la base de datos. El backend preserva colecciones nuevas si durante el despliegue un frontend viejo guarda un estado que todavía no las contiene.
