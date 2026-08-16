# PostgreSQL + autenticación

Esta versión reemplaza la persistencia oficial en `localStorage` por PostgreSQL (`APP_CONFIG.useApi = true`). El `localStorage` solo conserva el token de sesión del navegador y elementos técnicos del PWA.

## Usuarios

La base comienza sin operadores precargados. Solo existe el usuario administrativo inicial necesario para entrar por primera vez. Desde **Usuarios** el administrador crea cada persona con nombre, usuario, contraseña temporal, rol y estado activo/inactivo.

Los movimientos, recepciones, despachos, ajustes e historial conservan `session.userId`, que ahora corresponde al usuario realmente autenticado.

## Despliegue separado frontend/backend

Si frontend y backend están en dominios distintos, define antes de cargar `src/app.js`:

```html
<script>window.SERCO_WMS_API_BASE_URL='https://TU-BACKEND.example.com/api';</script>
```

Si ambos están bajo el mismo dominio con proxy `/api`, no necesitas modificar nada.
