# Backend y base de datos

Primera versión funcional para Azure SQL + Node/Express. Está pensada para crecer sin guardar copias del maestro corporativo de empleados: `SembradorCorporativoId` y `UsuarioCorporativoId` son referencias lógicas a las APIs corporativas.

## Orden de instalación
1. En Azure SQL, ejecutar `database/001_schema.sql`.
2. Ejecutar `database/002_seed_items.sql`.
3. Ejecutar `database/003_report_conformity.sql`.
4. En `backend/`, copiar `.env.example` a `.env` y completar servidor, base, usuario y contraseña.
5. Ejecutar `npm install` y `npm start`.
6. Probar `GET /api/health`.

## Alcance actual
Persistencia de semana, participación semanal, resolución exacta de turno, evaluación, No realizada, incumplimientos, base para autorizaciones/auditoría y cálculo SQL de conformidad individual. No se almacenan porcentajes derivados.

## Pendiente de validar antes de producción
- Identificador y contrato exactos de las APIs corporativas de usuario/sembrador.
- Mapeo definitivo de los ítems del informe (el prototipo tiene una ambigüedad en Conteo de líneas/Manguera).
- Autenticación corporativa y autorización por rol.
- Reglas completas de cierre, retiro/restauración, corrección y autorización implementadas en endpoints/transacciones.
- CORS y despliegue definitivo del backend.

Nunca subir `.env` ni credenciales a GitHub.