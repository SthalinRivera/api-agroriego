import 'dotenv/config';
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    constructor() {
        const pool = new Pool({ connectionString: process.env.DATABASE_URL });
        const adapter = new PrismaPg(pool);
        super({
            adapter,
            omit: { dispositivos: { secret_hash: true } },
            log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
        });
    }

    async onModuleInit() {
        await this.$connect();
    }

    async onModuleDestroy() {
        await this.$disconnect();
    }

    // Helper para limpiar en tests
    async cleanDatabase() {
        if (process.env.NODE_ENV === 'test') {
            const models = Reflect.ownKeys(this).filter(
                (key) => typeof key === 'string' && !key.startsWith('_') && !key.startsWith('$')
            );
            for (const model of models) {
                if (typeof this[model as string]?.deleteMany === 'function') {
                    await this[model as string].deleteMany();
                }
            }
        }
    }
}