import type { Prisma } from '@prisma/client';

export function parcelaAccess(userId: string): Prisma.parcelasWhereInput {
  return { OR: [
    { propietario_id: userId },
    { parcela_usuarios: { some: { usuario_id: userId } } },
  ] };
}
