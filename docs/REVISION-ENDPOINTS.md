# Revisión de endpoints de Agroriego

Inventario del código: 79 rutas de aplicación. Swagger está disponible en /api/docs. Todas salvo GET / requieren Bearer de Supabase.

## Integración con el dashboard

Se recuperó la estructura Nuxt UI del dashboard anterior. Hay resumen, listados paginados, filtros, detalles y consulta de todas las áreas del backend. Los totales vienen de meta.total; un error se muestra como error, nunca como cero. Los detalles de parcelas incluyen el dashboard de parcela; sensores incluyen estadísticas y tendencia de humedad; modelos incluyen métricas; reportes incluyen sus análisis guardados. Los detalles relacionados pueden estar limitados por el backend (por ejemplo, últimas 100 lecturas); el historial completo se consulta en su listado paginado.

La web es de consulta en esta etapa, salvo marcar una notificación como leída desde su detalle. No se ejecutan riegos, eliminaciones, creación de registros ni simulaciones al abrir el dashboard. No se añaden datos de demostración.

## Correcciones

- Los filtros por parcela, dispositivo, sensor y tipo conservan la condición de acceso del usuario.
- Los listados incluyen parcelas propias y compartidas, y la búsqueda de parcelas no sustituye el filtro de acceso.
- El heartbeat requiere acceso al dispositivo del usuario autenticado.
- El borrado de parcelas comprueba propietario, como indicaba el contrato anterior.
- Los booleanos en query se transforman explícitamente; page y limit requieren enteros.
- Campos numéricos usan IsNumber en lugar de IsDecimal (que espera strings).
- Mapeo camelCase a columnas Prisma en parcelas, cultivos, riegos y modelos.
- El cliente Prisma omite secret_hash de dispositivos por defecto.
- Las estadísticas de sensores se agregan en la base de datos.
- Calibración valida el offset. Generar análisis de reporte obtiene el ID de la ruta.
- La fecha de lectura de notificaciones respeta el valor efectivo de leida.

## Límites detectados

- POST /predicciones/predict y POST /predicciones usan una simulación basada en reglas, no inferencia de un modelo cargado. POST /reportes/:id/ia guarda contenido fijo. Las vistas lo advierten y no disparan esos endpoints.
- Las escrituras del catálogo global de modelos y tipos de sensor solo exigen autenticación. Sigue pendiente definir los roles administrativos autorizados antes de exponer esas operaciones en la web.
- La API valida pertenencia, pero no diferencia todos los permisos operativos de colaboradores en parcela_usuarios. Debe definirse la política antes de añadir controles de escritura.
- La atención de alertas acepta accion pero aún no la persiste. Activación de modelos y creación simultánea de riegos requieren transacciones o restricciones para evitar carreras.
- Faltan validaciones uniformes de UUID en parámetros de ruta y de rangos de fechas para todos los endpoints.
- GET /profile es una consulta básica de identidad; el login usa GET /auth/profile, que exige perfil activo.
- Esta revisión es estática con pruebas automatizadas. La validación funcional con datos reales requiere sesión de usuario; no se insertaron ni modificaron datos productivos.

## Inventario

| Método | Ruta |
| --- | --- |
| GET | / |
| GET | /profile |
| POST | /alertas |
| GET | /alertas |
| GET | /alertas/count |
| GET | /alertas/parcela/:parcelaId/activas |
| GET | /alertas/:id |
| PUT | /alertas/:id/atender |
| PUT | /alertas/:id/resolver |
| PUT | /alertas/:id/descartar |
| GET | /auth/profile |
| POST | /configuracion-alertas |
| GET | /configuracion-alertas/:parcelaId |
| DELETE | /configuracion-alertas/:parcelaId |
| POST | /cultivos |
| GET | /cultivos |
| GET | /cultivos/parcela/:parcelaId |
| GET | /cultivos/:id |
| PUT | /cultivos/:id |
| DELETE | /cultivos/:id |
| POST | /dispositivos |
| GET | /dispositivos |
| GET | /dispositivos/parcela/:parcelaId |
| POST | /dispositivos/heartbeat |
| GET | /dispositivos/:id |
| PUT | /dispositivos/:id |
| DELETE | /dispositivos/:id |
| POST | /lecturas |
| POST | /lecturas/batch |
| GET | /lecturas |
| GET | /lecturas/tendencia-humedad |
| GET | /lecturas/latest |
| GET | /lecturas/sensor/:sensorId/estadisticas |
| POST | /modelos-ia |
| GET | /modelos-ia |
| GET | /modelos-ia/activo |
| GET | /modelos-ia/:id |
| GET | /modelos-ia/:id/metricas |
| PUT | /modelos-ia/:id |
| PUT | /modelos-ia/:id/activar |
| DELETE | /modelos-ia/:id |
| GET | /notificaciones |
| GET | /notificaciones/no-leidas/count |
| PUT | /notificaciones/:id/leer |
| PUT | /notificaciones/leer-todas |
| POST | /parcelas |
| GET | /parcelas |
| GET | /parcelas/dashboard/:id |
| GET | /parcelas/:id |
| PUT | /parcelas/:id |
| DELETE | /parcelas/:id |
| POST | /predicciones/predict |
| POST | /predicciones |
| GET | /predicciones |
| GET | /predicciones/latest/:parcelaId |
| GET | /predicciones/:id |
| POST | /reportes |
| GET | /reportes |
| GET | /reportes/:id |
| POST | /reportes/:id/ia |
| DELETE | /reportes/:id |
| POST | /riegos |
| GET | /riegos |
| GET | /riegos/parcela/:parcelaId |
| GET | /riegos/parcela/:parcelaId/en-curso |
| GET | /riegos/:id |
| PUT | /riegos/:id |
| PUT | /riegos/:id/finalizar |
| PUT | /riegos/:id/cancelar |
| POST | /sensores/tipos |
| GET | /sensores/tipos |
| GET | /sensores/tipos/:id |
| POST | /sensores |
| GET | /sensores |
| GET | /sensores/dispositivo/:dispositivoId |
| GET | /sensores/:id |
| PUT | /sensores/:id |
| POST | /sensores/:id/calibrar |
| DELETE | /sensores/:id |
