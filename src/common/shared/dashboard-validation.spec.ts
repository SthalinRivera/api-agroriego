import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ParcelaQueryDto, CreateParcelaDto } from '../../modules/parcelas/parcelas.dto';
import { CultivoQueryDto } from '../../modules/cultivos/cultivos.dto';
import { DispositivoQueryDto } from '../../modules/dispositivos/dispositivos.dto';
import { SensorQueryDto, CalibrarSensorDto } from '../../modules/sensores/sensores.dto';
import { NotificacionQueryDto } from '../../modules/notificaciones/notificaciones.dto';
import { CreateLecturaDto } from '../../modules/lecturas/lecturas.dto';

describe('Dashboard HTTP DTO validation', () => {
  it.each([
    [ParcelaQueryDto, 'activa'], [CultivoQueryDto, 'activo'],
    [DispositivoQueryDto, 'activo'], [SensorQueryDto, 'activo'], [NotificacionQueryDto, 'leida'],
  ] as const)('%s parses false without converting it to true', async (Dto, key) => {
    const instance = plainToInstance(Dto as new () => object, { [key]: 'false', page: '2', limit: '20' });
    expect(Reflect.get(instance, key)).toBe(false);
    expect(await validate(instance)).toHaveLength(0);
    expect((await validate(plainToInstance(Dto as new () => object, { [key]: 'invalid' }))).length).toBeGreaterThan(0);
  });
  it('rejects fractional pagination', async () => {
    expect((await validate(plainToInstance(ParcelaQueryDto, { page: '1.5' }))).length).toBeGreaterThan(0);
  });
  it('accepts numeric coordinates and area', async () => {
    expect(await validate(plainToInstance(CreateParcelaDto, { nombre: 'Parcela', latitud: -12.5, longitud: -77.2, areaHectareas: 1.5 }))).toHaveLength(0);
  });
  it('accepts numeric sensor readings and rejects invalid numeric input', async () => {
    const valid = { sensorId: '550e8400-e29b-41d4-a716-446655440000', valor: 42.5, calidad: 95 };
    expect(await validate(plainToInstance(CreateLecturaDto, valid))).toHaveLength(0);
    expect((await validate(plainToInstance(CreateLecturaDto, { ...valid, valor: 'invalid' }))).length).toBeGreaterThan(0);
  });
  it('requires a finite calibration offset', async () => {
    expect(await validate(plainToInstance(CalibrarSensorDto, { offset: 0.5 }))).toHaveLength(0);
    expect((await validate(plainToInstance(CalibrarSensorDto, { offset: 'invalid' }))).length).toBeGreaterThan(0);
  });
});
