# Ciclo operativo de orden manual · 2026-08-22

## Flujo implementado

1. El administrador o encargado selecciona **Cargar orden manualmente**.
2. Define tipo, referencia, centro preparador y destino.
3. Ingresa o escanea cualquier SKU/código asociado y la cantidad.
4. El buscador filtra progresivamente por SKU, nombre, descripción y códigos
   asociados. Muestra stock físico/disponible del centro y stock global.
5. El WMS resuelve el producto maestro y presenta sus códigos como etiquetas
   separadas.
6. El destino puede ser un centro interno o un destinatario externo. Los
   destinatarios externos se registran con tipo, nombre, identificación,
   dirección y contacto; opcionalmente se guardan para próximas órdenes.
7. Guarda la orden en estado **Recibida**.
8. El encargado acepta y asigna la orden a un operador.
9. El operador realiza picking guiado y registra cantidades preparadas.
10. El operador pulsa **Culminar orden**. Puede culminar parcialmente; el WMS
   registra los faltantes y libera su reserva.
11. La orden queda **Pendiente de emisión**. El stock físico todavía no cambia.
12. Con faltantes, el administrador puede emitir parcialmente, esperar
    reposición o cerrar sin emisión.
13. Si espera, puede recibir o traspasar mercancía, reabrir la misma orden y el
    operador continúa escaneando desde donde quedó.
14. El encargado selecciona Factura, Guía de despacho, Traspaso, Pedido u Otro,
    registra número y destinatario, y pulsa **Emitir y cerrar orden**.
15. Solo en ese momento se descuentan las cantidades realmente preparadas.
16. Si el documento es Traspaso, se crea además el tránsito hacia el centro
    destino.

## Preparación para Kame

Cada destinatario externo conserva `source` y `kameId`. Los registros manuales
usan `source: MANUAL` y `kameId: null`; una integración futura podrá asociarlos
o reemplazarlos por clientes provenientes de Kame sin cambiar las órdenes.

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
