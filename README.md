# SercoRiego Lite WMS · PostgreSQL

Versión basada en la versión funcional congelada del WMS. Conserva Racks, búsqueda, productos, recepción, despacho/tránsito, movimientos, palets, historial, importación Excel, usuarios, estructura, vista móvil y la lógica matemática de inventario.

## Qué cambió

- Persistencia oficial en PostgreSQL mediante backend Node/Express.
- Inicio de sesión real con JWT y usuarios almacenados en PostgreSQL.
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

Configura `DATABASE_URL`, `JWT_SECRET` y `FRONTEND_ORIGIN` en un `.env` local o,
preferiblemente, como variables de entorno de Render. El archivo `.env` nunca
debe incluirse en Git ni en un ZIP de entrega.

### Frontend

Sirve la raíz del proyecto con un servidor estático. Si frontend y backend están en dominios separados, cambia únicamente `runtime-config.js` con la URL de la API.

## Acceso administrativo inicial

- Usuario: `admin`
- Contraseña: `SercoRiego2026!`

Cambia esa contraseña al entrar por primera vez. También puedes definir `ADMIN_USERNAME` y `ADMIN_PASSWORD` antes del primer arranque de una base nueva.

> Etapa de desarrollo: por decisión del proyecto, las contraseñas se almacenan
> temporalmente sin transformación. Antes de una entrega comercial debe
> ejecutarse la migración controlada a hash seguro.

Consulta `backend/README.md` y `docs/POSTGRESQL-AUTENTICACION.md` para el despliegue.
