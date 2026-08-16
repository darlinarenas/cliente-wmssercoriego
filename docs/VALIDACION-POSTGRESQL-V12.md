# Validación V12 PostgreSQL

Validaciones realizadas antes de entrega:

- Sintaxis de todos los JavaScript de frontend y backend: OK.
- Inventario semilla conservado: 323 productos y 368 registros.
- Usuarios semilla: solo Administrador; sin Nelson ni operadores demo.
- Lógica 469510: mover 33 conserva el total y deja 1 en el origen cuando el origen tenía 34; despacho de 1 reduce el total en 1.
- `APP_CONFIG.useApi=true`.
- Login JWT, bcrypt, CRUD de usuarios y roles presentes.
- Esquema PostgreSQL y creación automática de tablas presentes.
- Persistencia de estado dentro de transacción PostgreSQL con control `revision`.
- Service Worker excluye `/api/` de caché para no servir inventario obsoleto.
- Plantilla Excel y módulos existentes conservados.

La conexión real contra una instancia PostgreSQL externa requiere colocar la `DATABASE_URL` del servidor destino. En este entorno no se dispuso de una instancia PostgreSQL externa ni de las credenciales del proyecto del usuario, por lo que esa conexión específica no fue ejecutada aquí.
