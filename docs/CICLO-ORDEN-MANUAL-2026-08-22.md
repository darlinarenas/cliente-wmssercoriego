# Ciclo operativo de orden manual · 2026-08-22

## Flujo implementado

1. El administrador o encargado selecciona **Cargar orden manualmente**.
2. Define tipo, referencia, centro preparador y destino.
3. Ingresa o escanea cualquier SKU/código asociado y la cantidad.
4. El WMS resuelve el producto maestro, descripción y códigos asociados.
5. Guarda la orden en estado **Recibida**.
6. El encargado acepta y asigna la orden a un operador.
7. El operador realiza picking guiado y registra cantidades preparadas.
8. El operador pulsa **Culminar orden**. Puede culminar parcialmente; el WMS
   registra los faltantes y libera su reserva.
9. La orden queda **Pendiente de emisión**. El stock físico todavía no cambia.
10. El encargado selecciona Factura, Guía de despacho, Traspaso, Pedido u Otro,
    registra número y destinatario, y pulsa **Emitir y cerrar orden**.
11. Solo en ese momento se descuentan las cantidades realmente preparadas.
12. Si el documento es Traspaso, se crea además el tránsito hacia el centro
    destino.

## Archivos modificados

- `src/modules/ordenes/ordenes.js`
- `src/services/stock.js`
- `styles/app.css`

No se modifica el esquema de PostgreSQL: los nuevos campos son aditivos dentro
del documento JSON de cada orden.

## Verificaciones

- Sintaxis de todo el frontend: OK.
- Pruebas anteriores de estructura V15 y autenticación: OK.
- Reserva parcial: solicitado 10, preparado 6, reservado después de culminar 6.
- Emisión: descuenta 6 y libera completamente la reserva.
- El refresco automático no reconstruye formularios ni diálogos abiertos.
