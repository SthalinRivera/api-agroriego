# Ficha de registro IoT

## Acceso y despliegue

Página Nuxt: `/dashboard/fichas-iot`, menú **Análisis e IA > Ficha de registro IoT**.
API NestJS: `/fichas-iot`, protegida por el guard Supabase existente.

Instalar dependencias con `npm ci` y compilar la API con `npm run build`. Reiniciar la API si no está en modo watch. La web usa su `apiBase` existente.

No se requiere migración: se reutilizan `reportes.metadata` (JSONB), los identificadores UUID, relaciones e índices existentes. Cada ficha se guarda como `reportes.tipo = ficha_iot`, con esquema de instantánea versión 1. No se modifican lecturas ni predicciones al generar/exportar. Las fechas completas se conservan en el JSON; los campos de fecha sin hora de reportes no se usan en los cálculos.

El adjunto recibido contenía los requisitos, pero no un documento Word. La maquetación implementa las tres secciones descritas.

## Permisos

- Propietario y miembros de la parcela pueden listar, consultar y descargar sus fichas.
- Crear fichas y editar datos generales exige propietario o acceso compartido `admin`, `editor` o `tecnico`.
- Un `lector` puede ver/exportar fichas existentes, pero no modificar sus metadatos.
- Las comprobaciones se hacen en el backend en cada solicitud, incluidas las descargas.

## Contratos de datos y limitaciones

### Adquisición

El esquema actual no tiene columnas de programación ni un historial de intervalos. Si el dispositivo registra su programación, el módulo lee esta estructura en `dispositivos.metadata`:

```json
{
  "adquisicion": {
    "historial": [
      { "desde": "2026-01-01T05:00:00Z", "intervaloMinutos": 15 },
      { "desde": "2026-01-02T05:00:00Z", "intervaloMinutos": 30 }
    ]
  }
}
```

Cada entrada es el primer horario de una programación vigente hasta la siguiente entrada. No añadir entradas retrospectivas sin evidencia. El formulario permite declarar intervalo y fecha de anclaje solo cuando no existe historial; esa procedencia queda visible en la ficha. Una programación incompleta no produce porcentajes aparentes de disponibilidad.

`recorded_at` es el timestamp almacenado para la medición. `created_at` es el registro en el servidor, mostrado como recepción/registro (no garantiza llegada física del paquete). En la ingesta actual de ESP32, los registros históricos con `source=ESP32_Wokwi` no incluyen reloj del equipo: se conservan en A con medición desconocida y sin asociación a horarios. No se usan para evaluar predicciones o métricas temporales.

La ingesta `/device/lecturas` admite ahora los campos opcionales `measured_at` (ISO con offset) y `message_id`. Para nuevas lecturas se conserva `measurement_time_source=device` cuando el equipo envía la fecha, o `server_receipt` si no la envía. Las creaciones manuales/lotes guardan `provided` cuando reciben `recordedAt`. No se reescribe el pasado.

Duplicados: mismo sensor y `message_id`, o mismo sensor y hora de medición. Se conserva la primera recepción y luego el menor ID. Sin hora de medición ni ID de mensaje no se puede acreditar que dos paquetes sean duplicados; se conservan sin asociación. La asociación a horarios usa proximidad temporal, tolerancia de adquisición y media separación entre horarios; un horario y una lectura se usan una sola vez. Las filas adicionales permanecen visibles, pero no incrementan recibidos asociados.

Se consideran inválidas para indicadores las humedades fuera de [0,100], `metadata.valid=false` y calidad <=0. Cero es una lectura válida. Temperatura y humedad ambiental requieren un único sensor correspondiente del mismo equipo con unidades conocidas. Si hay ambigüedad, se informa y no se elige arbitrariamente un sensor.

Los campos opcionales de `sensores.metadata` son `profundidad_cm`, `tipo_humedad` (`relativa` o `volumetrica_calibrada`) y `evidencia_calibracion`. Una calibración de offset por sí sola no demuestra humedad volumétrica. Declarar humedad volumétrica exige una referencia a su evidencia.

### Predicciones

Solo se consumen pronósticos originales persistidos en el formato `output_data.pronosticos` ya utilizado por el módulo de notificaciones:

```json
{
  "modelo_version": "version-original",
  "pronosticos": [
    { "horizonte_horas": 24, "humedad_predicha": 31.25 },
    { "horizonte_horas": 48, "humedad_predicha": 29.80 }
  ]
}
```

Esto es un contrato ilustrativo, no una predicción real. El módulo nunca genera esos valores. El servicio predictivo actual contiene un simulador de reglas sin horizonte: esas predicciones no se convierten artificialmente en pronósticos a 24/48 h. Los nuevos resultados del simulador llevan además `simulado=true` y quedan excluidos. Versiones originales faltantes se muestran como Sin dato; no se reemplazan con la versión actual del catálogo, que podría haber cambiado.

Se filtran las emisiones en el periodo cerrado [inicio, fin] y se buscan observaciones hasta 48 h + tolerancia después del cierre, sin superar el corte. Objetivo = emisión + horizonte. Empate: lectura anterior y luego menor ID. EPA es nulo con observación cero. No se recalculan pronósticos históricos ni se interpolan observaciones.

No hay identificación de un conjunto temporal de prueba en las entidades actuales. Las métricas son **operativas del periodo**; no se afirma desempeño en un conjunto de prueba. R² no se calcula con menos de dos pares o con observaciones constantes.

### Consistencia y capacidad

La creación usa una transacción `RepeatableRead` y fija el corte. Las consultas masivas tienen criterios temporales y por sensor/parcela; no hay una consulta por fila. Los cálculos se guardan sin redondear y los tres formatos usan la misma instantánea. Editar metadatos no recalcula los resultados; para actualizar observaciones pendientes se genera otra ficha.

Límites explícitos por ficha: 366 días, 50 000 lecturas consultadas, 10 000 predicciones/riegos, 20 000 horarios esperados. Al superarlos la API rechaza la operación con un mensaje para dividir el periodo, sin truncar registros. Las exportaciones usan escritura por flujo; Excel no acumula el libro completo en memoria. La web avisa y requiere confirmar descargas que superan 500 filas.

Fechas consultadas/guardadas en UTC con offset obligatorio, mostradas en `America/Lima`. Excel almacena fechas reales representando la hora de Lima; su formato no soporta zona horaria, por eso se identifica expresamente en Datos generales.

PDF: páginas A4 para datos generales y diccionario; A3 horizontal para tablas anchas, encabezados repetidos, filas completas, numeración y fondo blanco. Excel: cinco hojas, números reales, fechas reales, filtros, encabezado inmovilizado y textos como celdas string (sin objetos fórmula).

## Endpoints

- `GET /fichas-iot/opciones`: parcelas accesibles y modelos.
- `GET /fichas-iot/contexto/:parcelaId`: dispositivos, sensores de humedad y permiso de edición.
- `GET /fichas-iot?page=1&limit=10`: historial paginado.
- `POST /fichas-iot`: calcula y guarda una instantánea con los filtros y metadatos validados.
- `GET /fichas-iot/:id?section=a&page=1&limit=25`: resumen, indicadores y página de A/B.
- `PATCH /fichas-iot/:id`: modifica solo datos generales.
- `GET /fichas-iot/:id/pdf` y `/excel`: exportan la instantánea completa.

## Verificación

- Backend: `npm test -- --runInBand fichas` y `npm run build`.
- Web: `npm run typecheck`, ESLint de archivos modificados y `npx playwright test tests/e2e/fichas-iot.spec.ts`.
- Las pruebas incluyen vacíos, duplicados, intervalos cambiantes, predicciones pendientes, observación cero, R² constante, horizontes independientes, permisos, paginación, fechas de Lima, precisión numérica y texto de Excel seguro.
- Las muestras visuales son sintéticas; no se guardan como reportes de producción ni son datos de tesis.
