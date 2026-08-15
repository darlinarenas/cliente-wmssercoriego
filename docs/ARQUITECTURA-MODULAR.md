# Arquitectura modular

## Principio
La reorganización no cambia la experiencia aprobada. Solo separa responsabilidades.

## Frontend
- UI y navegación en módulos de dominio.
- Acceso a datos a través de `services/repository.js`.
- `LocalStorageRepository` continúa activo en la maqueta.
- `ApiRepository` queda como punto de sustitución para backend.

## Backend
- API separada del frontend.
- Credenciales y conexión de base de datos vivirán únicamente en backend.
- Cada dominio tendrá sus propias rutas, validaciones, servicio y repositorio al implementarse.

## Migración futura
1. Congelar modelo de datos.
2. Crear esquema de base de datos.
3. Implementar endpoints siguiendo `BACKEND-CONTRACT.md`.
4. Activar `ApiRepository` en frontend.
5. Migrar datos semilla/LocalStorage necesarios.
6. Pruebas end-to-end antes de producción.
