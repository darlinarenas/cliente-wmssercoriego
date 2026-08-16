# SercoRiego Lite WMS · PostgreSQL

Versión basada en la versión funcional congelada del WMS. Conserva Racks, búsqueda, productos, recepción, despacho/tránsito, movimientos, palets, historial, importación Excel, usuarios, estructura, vista móvil y la lógica matemática de inventario.

## Qué cambió

- Persistencia oficial en PostgreSQL mediante backend Node/Express.
- Inicio de sesión real con JWT y contraseñas cifradas con bcrypt.
- Módulo Usuarios administrable: el administrador crea nombre, usuario, contraseña temporal, rol y estado.
- Sin Nelson, Darlin ni operadores demo precargados. Solo existe la cuenta administrativa inicial necesaria para entrar.
- Control de concurrencia por revisión para evitar sobrescrituras silenciosas entre dos equipos.
- API autenticada y rutas CRUD para los dominios principales.
- El Service Worker no almacena respuestas `/api`, evitando inventario obsoleto.

## Arranque rápido

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm run db:init
npm start
```

Configura `DATABASE_URL`, `JWT_SECRET` y `FRONTEND_ORIGIN` en `.env`.

### Frontend

Sirve la raíz del proyecto con un servidor estático. Si frontend y backend están en dominios separados, cambia únicamente `runtime-config.js` con la URL de la API.

## Acceso administrativo inicial

- Usuario: `admin`
- Contraseña: `SercoRiego2026!`

Cambia esa contraseña al entrar por primera vez. También puedes definir `ADMIN_USERNAME` y `ADMIN_PASSWORD` antes del primer arranque de una base nueva.

Consulta `backend/README.md` y `docs/POSTGRESQL-AUTENTICACION.md` para el despliegue.
