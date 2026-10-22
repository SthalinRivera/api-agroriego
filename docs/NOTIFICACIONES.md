# Notificaciones: integración y puesta en marcha

Se reutilizan `alertas`, `notificaciones`, `user_devices` y `configuracion_alertas`. No hay migraciones ni tablas nuevas. Los cambios de datos durante la implementación fueron únicamente consultas de lectura.

## Activación Firebase

Backend: configurar `FCM_ENABLED=true`, `FIREBASE_PROJECT_ID` y credenciales ADC (identidad del entorno o `GOOGLE_APPLICATION_CREDENTIALS` apuntando al JSON de cuenta de servicio fuera del repositorio). Habilitar Firebase Cloud Messaging API para el proyecto. No poner claves en Flutter ni en Nuxt. Sin FCM_ENABLED el historial y la generación funcionan, pero no se envían pushes.

Android: colocar el archivo real `google-services.json` en `app-agrotec/android/app/`, con el applicationId actual `com.example.hola_mundo`. El plugin Google Services se aplica cuando existe el archivo. Instalar dependencias con `flutter pub get`; en este Windows la herramienta solicita habilitar Developer Mode para enlaces simbólicos.

iOS: añadir `GoogleService-Info.plist` al target Runner en Xcode (bundle actual `com.example.holaMundo`), habilitar Push Notifications con el equipo y perfil de firma y cargar la clave APNs en Firebase. Se añadieron remote-notification y los entitlements de desarrollo/producción. Compilar y probar iOS requiere macOS/Xcode.

No se incluyeron credenciales ni archivos Firebase ficticios. Hasta proporcionar esta configuración no se puede validar la entrega real.

## Ejecución automática

El proceso NestJS evalúa cada minuto; `NOTIFICATIONS_WORKER_ENABLED=false` lo desactiva. Requiere un proceso persistente (un temporizador no funciona como programación fiable en un despliegue serverless que se suspende). No ejecutar varios ciclos manuales de prueba contra producción: generan registros reales y, con FCM activado, envían avisos.

- Humedad: última lectura reciente de `humedad_suelo`/`soil_moisture` inferior a `humedad_minima`. Sin umbral configurado no se inventa uno.
- ESP32: dispositivo activo sin comunicación más allá de `dispositivo_offline_minutos` (15 por defecto). Si nunca comunicó se usa created_at.
- Recuperación: las alertas activas pasan a `atendida`, estado admitido por la base real. Una lectura saludable o reconexión posterior permite detectar un nuevo episodio.
- Destinatarios: propietario y miembros de `parcela_usuarios`, sin repetir al propietario. Se vuelve a verificar acceso y configuración antes de enviar.
- Configuración: `notificaciones_activas=false` evita generación/envío de avisos automáticos.

## Pronósticos 24/48/72

La carpeta Prisma contiene únicamente schema.prisma. Las predicciones consultadas en la base contienen recomendaciones/prioridades, sin horizontes; `PrediccionesService` utiliza una simulación de duración de riego. No se alteró ese módulo ni se convirtió la duración de riego en un pronóstico.

Se preparó un adaptador para pronósticos explícitos en `predicciones.output_data`, sin cambiar su columna JSON:

```json
{
  "pronosticos": [
    { "horizonte_horas": 24, "humedad_predicha": 19, "requiere_riego": true },
    { "horizonte_horas": 48, "humedad_predicha": 17, "requiere_riego": true },
    { "horizonte_horas": 72, "humedad_predicha": 15, "requiere_riego": true }
  ]
}
```

Este contrato está preparado, pero el productor existente todavía no lo genera. Se necesita conectar la salida real del predictor para activar esos avisos. Se acepta la última predicción de menos de 24 horas; cada horizonte se notifica una vez por parcela/día UTC.

## API y cliente

- PUT `/notificaciones/dispositivos`: `{token, previousToken?, plataforma: "android" | "ios"}`. Usuario tomado del JWT; upsert por token único.
- PUT `/notificaciones/dispositivos/desactivar`: `{token}`; solo revoca tokens del usuario autenticado.
- Se mantienen GET `/notificaciones`, GET `/notificaciones/no-leidas/count`, PUT `/:id/leer` y PUT `/leer-todas` bajo `/notificaciones`.
- Flutter registra al autenticar, renueva al cambiar el token y reintenta cada minuto/al reanudar. Antes de cerrar sesión revoca el dispositivo; si falla informa mediante el error de cierre de sesión, sin dejar silenciosamente un token activo.
- Pantalla `Notificaciones` en el menú: paginación, prioridades, filtro no leídas, lectura individual reversible y leer todas. En primer plano, Flutter muestra una notificación local visible también en Android y al pulsarla abre el historial; en segundo plano/cerrada, el sistema muestra el payload notification y abre el historial al pulsarlo.
- Nuxt conserva su módulo y añade la columna prioridad.

## Duplicados y fallos

Bloqueos transaccionales PostgreSQL serializan la creación por parcela y el envío por notificación entre instancias. El progreso por dispositivo se guarda en `notificaciones.data.push`, usando hashes y sin exponer tokens. Los éxitos parciales no se vuelven a enviar en el siguiente ciclo; tokens inválidos se desactivan; errores temporales usan espera exponencial. Avisos pendientes expiran a las 24 horas o se cancelan si desaparece el acceso/condición activa.

FCM y PostgreSQL no comparten transacción: una caída después de que FCM acepte un envío y antes de persistir el resultado puede repetirlo al reintentar. Se utiliza tag/collapse-id estable para reducir avisos repetidos, pero no se promete entrega exactamente una vez ante fallos de red/proceso.

## Verificación real pendiente

En dispositivo físico: iniciar sesión y comprobar user_devices; provocar un aviso en entorno de pruebas; verificar primer plano, segundo plano y app terminada; pulsar push; leer/no leer; renovar token; cerrar/cambiar sesión; verificar aislamiento entre usuarios. Repetir ciclo no debe crear otra alerta/notificación del mismo episodio. La detención forzada desde Ajustes y las restricciones del sistema operativo no equivalen a una app cerrada normalmente.

Referencias oficiales: https://firebase.google.com/docs/cloud-messaging/flutter/receive-messages y https://firebase.google.com/docs/cloud-messaging/send/admin-sdk

## Resultado de validación de esta implementación

- `npm run build` (NestJS): correcto.
- Jest `notification-rules dashboard-validation`: 23 pruebas correctas, incluidas deduplicación, destinatarios, desactivación, recuperación, datos antiguos, horizontes explícitos, tokens inválidos y reintentos parciales.
- Flutter `notifications_screen_test.dart`: 3 pruebas correctas.
- Análisis Dart de servicio push, pantalla y pruebas nuevas: sin incidencias. El análisis global muestra avisos en archivos existentes ajenos al módulo.
- Nuxt `npm run typecheck`: correcto.
- Consultas Prisma de sensores/predicciones/cola y bloqueo PostgreSQL verificadas contra la base real, sin escrituras ni envíos.
- No se construyó ni probó un APK/IPA con Firebase configurado; la prueba real de entrega sigue pendiente.

## Botón de prueba sin ESP32

Disponible en Flutter (Menú → Notificaciones) y Nuxt (módulo Notificaciones): **Enviar notificación de prueba**.

El botón llama a `POST /notificaciones/prueba` con la sesión existente. El servidor registra un aviso `prueba_push` del usuario autenticado y espera el envío FCM dentro de la petición HTTP; esta prueba no depende del temporizador del worker y puede ejecutarse en Vercel. Solo se permiten pruebas cada 30 segundos por usuario. No crea alertas ni lecturas de sensores. Si no existen dispositivos activos, informa cómo registrar la app; si Firebase falla, no muestra un éxito falso. Los tokens inválidos se desactivan.

Para usar los cambios hay que desplegar nuevamente backend y frontend web; para el botón móvil, instalar la nueva compilación Flutter. Abrir primero la app e iniciar sesión para registrar el token. Para comprobar segundo plano, dejar el teléfono en segundo plano y pulsar el botón web con la misma cuenta. Un mensaje de aceptación de Firebase confirma aceptación del envío, no recepción garantizada por el teléfono.

Este endpoint de prueba no sustituye la programación de alertas automáticas en un entorno serverless. El worker periódico sigue requiriendo un proceso persistente o una integración separada con un programador de tareas.

Validación del botón: compilación NestJS correcta, 20 pruebas backend y 5 pruebas Flutter aprobadas; typecheck Nuxt correcto.

## Permisos y diagnóstico del envío (actualización)

Flutter ahora solicita permiso la primera vez incluso si Android informa `denied` antes de haber preguntado. Guarda que ya preguntó para no repetir el diálogo automáticamente cada minuto. En Notificaciones, **Activar notificaciones** vuelve a solicitar el permiso y registra el token. **Enviar notificación de prueba** realiza ese mismo paso antes del POST; si no se pudo activar este teléfono, muestra la causa y no envía la prueba. Si el sistema ya bloqueó el diálogo, habilitar manualmente en Ajustes del teléfono → Aplicaciones → AgroRiego IoT → Notificaciones. Instalar la nueva compilación para ver este comportamiento.

Para Vercel, el backend admite estas alternativas de credenciales (solo en el proyecto backend, nunca en Nuxt ni Flutter):

1. `FIREBASE_SERVICE_ACCOUNT_JSON` o `FIREBASE_SERVICE_ACCOUNT`: contenido JSON de la cuenta de servicio. La segunda variable se admite para instalaciones existentes.
2. O las tres variables `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`. La clave debe conservar encabezado/pie PEM; se admiten saltos reales y `\n` escapados.
3. ADC / `GOOGLE_APPLICATION_CREDENTIALS` sigue disponible cuando el archivo realmente existe en el entorno del servidor. Una ruta local de Windows no es un archivo accesible desde Vercel.

En todos los casos: `FCM_ENABLED=true`, mismo proyecto Firebase para app y backend, entorno Production/Preview correcto y nuevo despliegue tras cambiar variables. Las credenciales de cuenta de servicio se obtienen de Configuración del proyecto Firebase → Cuentas de servicio, no de google-services.json.

El endpoint devuelve instrucciones según el código Firebase (credenciales, proyecto diferente, token vencido, APNs, límites o indisponibilidad). Solo registra códigos permitidos en los logs y en `notificaciones.data.push.errorCodes`, sin claves, tokens ni mensajes originales de credenciales. El historial por sí solo no confirma entrega push. Para un error desconocido, revisar los logs del backend después del nuevo despliegue; no compartir claves privadas.

Referencias: https://firebase.google.com/docs/cloud-messaging/flutter/receive-messages , https://firebase.google.com/docs/admin/setup , https://vercel.com/docs/environment-variables/managing-environment-variables
