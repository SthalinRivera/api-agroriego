import { UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService profile access', () => {
  const findUnique = jest.fn();
  const service = new AuthService({
    profiles: { findUnique },
  } as unknown as PrismaService);
  beforeEach(() => jest.clearAllMocks());
  it('rejects missing identity without querying profiles', async () => {
    await expect(service.getProfile({})).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(findUnique).not.toHaveBeenCalled();
  });
  it.each([null, { activo: false }])(
    'rejects missing or inactive profiles',
    async (profile) => {
      findUnique.mockResolvedValue(profile);
      await expect(
        service.getProfile({ user: { id: 'user-id' } }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    },
  );
  it('returns the active profile and assigned role', async () => {
    findUnique.mockResolvedValue({
      id: 'user-id',
      activo: true,
      full_name: 'Ana Perez',
      users: { email: 'ana@example.com' },
      roles: { id: 1n, nombre: 'Agricultor', descripcion: null },
    });
    await expect(
      service.getProfile({ user: { id: 'user-id' } }),
    ).resolves.toMatchObject({
      id: 'user-id',
      email: 'ana@example.com',
      nombres: 'Ana',
      apellidos: 'Perez',
      estado: true,
      roles: [{ id: 1, nombre: 'Agricultor' }],
    });
  });
});
