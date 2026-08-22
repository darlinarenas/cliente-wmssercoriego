# Importación de inventario real · 2026-08-21

Fuentes analizadas:
- `inventario kame por bodega 2.xlsx`
- `PRODUCTOS.xlsx`

## Resultado del cruce
- 1.307 SKU únicos en Kame.
- 536 SKU únicos en el inventario físico.
- 517 SKU aparecen en ambos archivos.
- 19 SKU aparecen solo en el inventario físico.
- 790 SKU aparecen solo en Kame.
- 681 líneas físicas distribuidas en 28 pallet/ubicaciones.
- 1.326 SKU únicos en el maestro consolidado.

## Reglas aplicadas
- Kame conserva el stock administrativo por centro (`REC` y `VIT`).
- `PRODUCTOS.xlsx` se trata como inventario físico de Bodega Recoleta por pallet/ubicación.
- Se conservaron descripciones, familia/tipo Kame, códigos alternativos, cantidades y pallet/ubicación.
- El código alternativo `11` se excluye de los códigos escaneables porque aparece 365 veces.
- Cinco códigos alternativos ambiguos también se excluyen hasta determinar su SKU correcto.
- Las ubicaciones físicas antiguas se importan como `PAL-*` y quedan marcadas como ubicaciones legadas pendientes de mapear a rack/posición definitiva.

## Importar a PostgreSQL/Render
El importador está protegido: no hace nada sin `--apply`.

Desde la carpeta `backend`, con `DATABASE_URL` configurada:

```bash
npm run import:real
```

La importación:
1. crea/actualiza productos por código sin cambiar innecesariamente IDs existentes;
2. agrega códigos alternativos seguros;
3. crea el centro `VIT` si no existe;
4. reemplaza el inventario físico operativo por las 681 líneas del levantamiento;
5. reemplaza las ubicaciones `PAL-*` del levantamiento anterior;
6. conserva historial, movimientos, órdenes, transferencias, recepciones y auditoría;
7. guarda Kame Recoleta/Vitacura en `settings.erpStockBySite` para conciliación;
8. incrementa la revisión del estado WMS.

## Archivos añadidos
- `backend/data/real-inventory-2026-08-21.json`
- `backend/scripts/import-real-inventory.js`
- script npm `import:real` en `backend/package.json`
