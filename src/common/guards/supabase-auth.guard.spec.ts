import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { SupabaseAuthGuard } from './supabase-auth.guard';

jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));

describe('SupabaseAuthGuard', () => {
  const getUser = jest.fn();
  const savedUrl = process.env.SUPABASE_URL;
  const savedKey = process.env.SUPABASE_ANON_KEY;
  let guard: SupabaseAuthGuard;
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-public-key';
    (createClient as jest.Mock).mockReturnValue({ auth: { getUser } });
    guard = new SupabaseAuthGuard();
  });
  afterAll(() => {
    if (savedUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = savedUrl;
    if (savedKey === undefined) delete process.env.SUPABASE_ANON_KEY;
    else process.env.SUPABASE_ANON_KEY = savedKey;
  });
  function context(authorization?: unknown) {
    const request = { headers: { authorization }, user: undefined };
    return {
      request,
      ctx: {
        switchToHttp: () => ({ getRequest: () => request }),
      } as ExecutionContext,
    };
  }
  it.each([undefined, '', 'Bearer ', 'Basic abc', ['Bearer abc']])(
    'rejects malformed authorization %p',
    async (header) => {
      await expect(
        guard.canActivate(context(header).ctx),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(getUser).not.toHaveBeenCalled();
    },
  );
  it('rejects an invalid or expired token without exposing provider details', async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'provider details' },
    });
    await expect(
      guard.canActivate(context('Bearer invalid').ctx),
    ).rejects.toThrow('Sesión inválida o vencida');
  });
  it('rejects a response without a user', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(
      guard.canActivate(context('Bearer token').ctx),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it('attaches the verified user to the request', async () => {
    const user = { id: 'verified-user' };
    getUser.mockResolvedValue({ data: { user }, error: null });
    const { ctx, request } = context('bearer valid-token');
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(request.user).toEqual(user);
    expect(getUser).toHaveBeenCalledWith('valid-token');
  });
});
