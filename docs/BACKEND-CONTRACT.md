# Contrato conceptual para backend

La maqueta desacopla UI y persistencia mediante Store + Repository. La futura API debe cubrir, como mínimo:

- `/sites`: sedes/almacenes (Recoleta y futura bodega tienda).
- `/racks`, `/locations`: estructura física editable.
- `/products`, `/inventory`: catálogo y stock localizado.
- `/pallets`: unidades logísticas y ubicación temporal/definitiva.
- `/receipts`: recepciones e items escaneados.
- `/movements`: movimientos internos y reubicaciones.
- `/transfers`: preparación, despacho, tránsito y recepción futura entre sedes.
- `/audit`: trazabilidad inmutable por usuario/fecha/acción.

Estados principales de transferencia previstos: PREPARANDO → EN_TRANSITO → RECIBIDO/POR_UBICAR. La recepción en TIENDA se activará cuando esa sede se modele físicamente.
