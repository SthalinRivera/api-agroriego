import { describe, it, expect, jest } from '@jest/globals';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LecturasService } from './lecturas.service';
import { MoistureTrendQueryDto } from './lecturas.dto';

function fixture(owner = 'u1', code = 'humedad_suelo') {
  const prisma = {
    sensores: { findUnique: jest.fn<any>().mockResolvedValue({
      tipos_sensor: { codigo: code },
      dispositivos: { parcela_id: 'p1', parcelas: { propietario_id: owner } },
    }) },
    parcela_usuarios: { findUnique: jest.fn<any>().mockResolvedValue(null) },
    $queryRaw: jest.fn<any>().mockResolvedValue([
      { recorded_at: new Date('2026-10-09T12:00:00Z'), valor: '31.25' },
    ]),
  };
  return { prisma, service: new LecturasService(prisma as any) };
}

describe('moisture trend', () => {
  it.each([7, 30, 365])('queries %i days and aggregates in the database', async days => {
    const { service, prisma } = fixture();
    const result = await service.moistureTrend({ sensorId: 'soil', days }, 'u1');
    expect(result.aggregation).toBe(days === 7 ? 'hour' : 'day');
    expect(new Date(result.hasta).getTime() - new Date(result.desde).getTime()).toBe(days * 86400000);
    expect(result.data[0].valor).toBe(31.25);
    const args = prisma.$queryRaw.mock.calls[0];
    expect(args[0].join('?')).toContain('AVG(valor)');
    expect(args[0].join('?')).toContain('America/Lima');
    expect(args.slice(1)).toEqual(['soil', new Date(result.desde), new Date(result.hasta), result.aggregation]);
  });
  it('rejects a sensor belonging to another user before reading data', async () => {
    const { service, prisma } = fixture('other');
    await expect(service.moistureTrend({ sensorId: 'soil', days: 7 }, 'u1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
  it('allows a parcel member and returns empty data without zero filling', async () => {
    const { service, prisma } = fixture('other');
    prisma.parcela_usuarios.findUnique.mockResolvedValue({ usuario_id: 'u1' });
    prisma.$queryRaw.mockResolvedValue([]);
    expect((await service.moistureTrend({ sensorId: 'soil', days: 30 }, 'u1')).data).toEqual([]);
  });
  it('rejects missing sensors, wrong types and invalid ranges', async () => {
    const { service, prisma } = fixture('u1', 'temperatura');
    await expect(service.moistureTrend({ sensorId: 'soil', days: 7 }, 'u1')).rejects.toBeInstanceOf(BadRequestException);
    prisma.sensores.findUnique.mockResolvedValue(null);
    await expect(service.moistureTrend({ sensorId: 'missing', days: 7 }, 'u1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.moistureTrend({ sensorId: 'soil', days: 8 }, 'u1')).rejects.toBeInstanceOf(BadRequestException);
  });
  it('validates and converts HTTP query parameters', async () => {
    const valid = plainToInstance(MoistureTrendQueryDto, {
      sensorId: '123e4567-e89b-42d3-a456-426614174000', days: '365',
    });
    expect(await validate(valid)).toHaveLength(0);
    expect(valid.days).toBe(365);
    expect((await validate(plainToInstance(MoistureTrendQueryDto, {
      sensorId: 'bad', days: '1000',
    }))).length).toBeGreaterThan(0);
  });
});