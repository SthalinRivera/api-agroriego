import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { FichasController } from './fichas.controller';
import { FichasService } from './fichas.service';
import { AutomaticFichasService, AutomaticQuery } from './fichas.automatic';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { sampleSnapshot } from '../../../test/fixtures/ficha';
import { BigIntInterceptor } from '../../common/interceptors/bigint.interceptor';
import { DecimalInterceptor } from '../../common/interceptors/decimal.interceptor';

describe('Descarga HTTP de PDF', () => {
  let app: INestApplication;
  const collect = jest.fn(async (_user: string, query: AutomaticQuery) => ({
    snapshot: sampleSnapshot(),
    tables: ['1', '2', '3', '4', '5']
      .filter((id) => !query.ficha || query.ficha === id)
      .map((id) => ({
        id,
        title: `Ficha ${id}`,
        description: 'Registro adquirido',
        columns: [{ key: 'valor', label: 'Valor' }],
        rows: [{ valor: 0 }],
        notes: ['Sin calibración registrada.'],
      })),
  }));
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [FichasController],
      providers: [
        { provide: FichasService, useValue: {} },
        { provide: AutomaticFichasService, useValue: { collect } },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({
        canActivate: (context) => {
          context.switchToHttp().getRequest().user = { id: 'test-user' };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalInterceptors(
      new BigIntInterceptor(),
      new DecimalInterceptor(),
    );
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  it.each([undefined, '1', '2', '3', '4', '5'])(
    'delivers a complete PDF for ficha %s',
    async (ficha) => {
      const response = await request(app.getHttpServer())
        .get('/fichas-iot/automaticas/pdf')
        .query(ficha ? { ficha } : {})
        .buffer(true)
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
          res.on('end', () => callback(null, Buffer.concat(chunks)));
          res.on('error', callback);
        })
        .expect(200)
        .expect('Content-Type', /application\/pdf/)
        .expect('Content-Disposition', 'attachment; filename="fichas-iot.pdf"');
      expect(response.body.subarray(0, 5).toString()).toBe('%PDF-');
      expect(response.body.toString('latin1')).toMatch(/%%EOF\s*$/);
    },
  );
});
