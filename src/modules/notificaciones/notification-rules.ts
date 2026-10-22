/** Only explicit forecast horizons are accepted. Irrigation duration is not a forecast horizon. */
export function forecastAlerts(output: unknown, minimum: number | null) {
  if (!output || typeof output !== 'object' || Array.isArray(output)) return [];
  const forecasts = (output as Record<string, unknown>).pronosticos;
  if (!Array.isArray(forecasts)) return [];
  return forecasts.filter((f): f is { horizonte_horas: number; humedad_predicha?: number; requiere_riego?: boolean } =>
    f && [24, 48, 72].includes(f.horizonte_horas) &&
    (f.requiere_riego === true || (minimum !== null && typeof f.humedad_predicha === 'number' && Number.isFinite(f.humedad_predicha) && f.humedad_predicha < minimum)),
  ).filter((f, i, all) => all.findIndex(other => other.horizonte_horas === f.horizonte_horas) === i);
}
