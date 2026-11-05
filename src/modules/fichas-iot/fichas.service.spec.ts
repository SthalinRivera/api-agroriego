import { describe, it, expect, jest } from '@jest/globals';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { FichasService } from './fichas.service';
import { CreateFichaDto, FichaPageDto, MetadataDto } from './fichas.dto';
import type { PrismaService } from '../../config/prisma/prisma.service';
import { sampleSnapshot } from '../../../test/fixtures/ficha';
describe('Ficha IoT: acceso y contrato', () => {
  it('rejects unauthorized access before querying device data', async () => {
    const prisma = {
      parcelas: { findFirst: jest.fn<any>().mockResolvedValue(null) },
      dispositivos: { findMany: jest.fn() },
    };
    const service = new FichasService(prisma as unknown as PrismaService);
    await expect(service.context('parcel', 'stranger')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.dispositivos.findMany).not.toHaveBeenCalled();
  });
  it('scopes snapshot and export access to owner or shared parcel membership', async () => {
    const prisma = {
      reportes: { findFirst: jest.fn<any>().mockResolvedValue(null) },
    };
    const service = new FichasService(prisma as unknown as PrismaService);
    await expect(service.load('report', 'stranger')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(
      (
        prisma.reportes.findFirst.mock.calls[0][0] as {
          where: { parcelas: { OR: unknown } };
        }
      ).where.parcelas.OR,
    ).toEqual([
      { propietario_id: 'stranger' },
      { parcela_usuarios: { some: { usuario_id: 'stranger' } } },
    ]);
  });
  it('allows readers to paginate snapshots but rejects metadata changes', async () => {
    const snapshot = sampleSnapshot();
    const prisma = {
      reportes: {
        findFirst: jest
          .fn<any>()
          .mockResolvedValue({ parcela_id: 'parcel', metadata: snapshot }),
        update: jest.fn(),
      },
      parcelas: {
        findFirst: jest.fn<any>().mockResolvedValue({
          propietario_id: 'owner',
          parcela_usuarios: [{ nivel_acceso: 'lector' }],
        }),
      },
    };
    const service = new FichasService(prisma as unknown as PrismaService);
    const view = await service.view(snapshot.id, 'reader', {
      page: 3,
      limit: 25,
      section: 'a',
    });
    expect(view.rows).toHaveLength(25);
    expect(view.rows[0].numero).toBe(51);
    expect(view.total).toBe(80);
    expect(view.canEdit).toBe(false);
    await expect(
      service.update(snapshot.id, { anexo: '4' }, 'reader'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.reportes.update).not.toHaveBeenCalled();
  });
  it('edits metadata without recalculating or mutating original readings', async () => {
    const snapshot = sampleSnapshot();
    const prisma = {
      reportes: {
        findFirst: jest
          .fn<any>()
          .mockResolvedValue({ parcela_id: 'parcel', metadata: snapshot }),
        update: jest.fn<any>().mockResolvedValue({}),
      },
      parcelas: {
        findFirst: jest
          .fn<any>()
          .mockResolvedValue({ propietario_id: 'owner', parcela_usuarios: [] }),
      },
    };
    const result = await new FichasService(
      prisma as unknown as PrismaService,
    ).update(snapshot.id, { anexo: '4' }, 'owner');
    expect(result.general.Anexo).toBe('4');
    expect(result.c).toEqual(snapshot.c);
    expect(result.cutoff).toBe(snapshot.cutoff);
  });
  it('requires explicit offsets, UUIDs, bounded tolerances and supported moisture types', async () => {
    const errors = await validate(
      plainToInstance(CreateFichaDto, {
        parcelaId: 'bad',
        dispositivoId: 'bad',
        sensorId: 'bad',
        desde: '2026-01-01T00:00:00',
        hasta: '2026-01-02T00:00:00',
        toleranciaMinutos: -1,
        tipoHumedad: 'automatica',
      }),
    );
    expect(errors.length).toBeGreaterThanOrEqual(6);
    expect(
      await validate(
        plainToInstance(FichaPageDto, { page: '1', limit: '25', section: 'b' }),
      ),
    ).toHaveLength(0);
    expect(
      (
        await validate(
          plainToInstance(MetadataDto, { observaciones: 'a'.repeat(2001) }),
        )
      ).length,
    ).toBe(1);
  });
});
