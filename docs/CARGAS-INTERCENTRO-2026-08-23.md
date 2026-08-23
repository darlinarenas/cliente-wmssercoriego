# Cargas intercentro

## Flujo operativo

1. El centro de origen prepara el traspaso y pulsa **Sellar y crear carga**.
2. El WMS descuenta el stock del origen, crea un manifiesto y genera una etiqueta Code 128.
3. En **Cargas / Custodia**, un encargado asigna al transportista.
4. El transportista revisa el manifiesto, escanea el código y pulsa **Aceptar custodia**. La carga queda **En tránsito**.
5. Al llegar, se registra la llegada y el centro destino abre **Recibir traspasos**.
6. El receptor compara cada cantidad. Si existe una diferencia, debe describirla antes de confirmar.
7. El WMS incorpora únicamente lo recibido en un pallet temporal **Por ubicar** y crea una tarea.
8. En **Tareas por ubicar**, un encargado asigna la tarea o un operario toma una tarea libre. El pallet se abre en el módulo existente para posicionarlo.
9. La tarea y la carga solo se cierran cuando el pallet ya no tiene unidades pendientes de ubicación.

## Estados de una carga

- **Lista para retiro:** sellada, inventario descontado del origen y aún sin custodia aceptada.
- **En tránsito:** el transportista confirmó que revisó y recibió la carga.
- **Llegó al destino:** se informó la llegada, pendiente de conteo y recepción.
- **Recibida:** cantidades esperadas y recibidas coinciden.
- **Recibida con diferencias:** la recepción quedó registrada con su observación y detalle.
- **Cerrada:** todo lo recibido ya fue ubicado.

## Controles importantes

- Una carga no puede recibirse dos veces.
- Un centro distinto del destino no puede recibirla.
- Las diferencias requieren una observación.
- Cada cambio queda en la trazabilidad con usuario y fecha.
- La etiqueta funciona sin servicios externos y contiene un Code 128 escaneable y el manifiesto legible.
- Los traspasos antiguos que estén listos o en tránsito se conectan automáticamente al nuevo control de cargas.

## Orden de despliegue

Desplegar primero `backend/` y después la aplicación web. No eliminar las tablas existentes: `shipments` y `tasks` son tablas nuevas y aditivas.

