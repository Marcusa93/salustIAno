import { completeOnboardingAction } from '@/app/(auth)/bienvenida/actions';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  updateUser: vi.fn(),
  refreshSession: vi.fn(async () => ({ data: {}, error: null })),
  getUser: vi.fn(async () => ({
    data: { user: { id: 'abril', user_metadata: { must_change_password: true } } },
    error: null,
  })),
  adminUpdateUserById: vi.fn(
    async (): Promise<{ data: object; error: { message: string } | null }> => ({
      data: {},
      error: null,
    }),
  ),
  adminGetUserById: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: mocks.getUser,
      updateUser: mocks.updateUser,
      refreshSession: mocks.refreshSession,
    },
  }),
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    auth: {
      admin: { updateUserById: mocks.adminUpdateUserById, getUserById: mocks.adminGetUserById },
    },
  }),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const INPUT = { password: 'Salustiano2026', passwordConfirm: 'Salustiano2026' };
const authError = (code: string, message: string) => ({ code, message, name: 'AuthApiError' });

describe('completeOnboardingAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('cambia la clave y apaga el flag de forma explícita (user_metadata se combina)', async () => {
    mocks.updateUser.mockResolvedValue({ data: {}, error: null });
    const result = await completeOnboardingAction(INPUT);
    expect(result).toEqual({ ok: true });
    expect(mocks.adminUpdateUserById).toHaveBeenCalledWith('abril', {
      user_metadata: { must_change_password: false },
    });
    expect(mocks.refreshSession).toHaveBeenCalled();
  });

  it('si la clave ya había cambiado y el flag está limpio, la deja pasar', async () => {
    mocks.updateUser.mockResolvedValue({
      data: {},
      error: authError('same_password', 'New password should be different from the old password.'),
    });
    mocks.adminGetUserById.mockResolvedValue({
      data: { user: { id: 'abril', user_metadata: { must_change_password: false } } },
    });
    expect(await completeOnboardingAction(INPUT)).toEqual({ ok: true });
    expect(mocks.refreshSession).toHaveBeenCalled();
  });

  it('si repite la clave temporal, se lo dice claro', async () => {
    mocks.updateUser.mockResolvedValue({
      data: {},
      error: authError('same_password', 'New password should be different from the old password.'),
    });
    mocks.adminGetUserById.mockResolvedValue({
      data: { user: { id: 'abril', user_metadata: { must_change_password: true } } },
    });
    expect(await completeOnboardingAction(INPUT)).toEqual({
      ok: false,
      error: 'Esa es la contraseña temporal que te dieron. Elegí una nueva.',
      field: 'password',
    });
    expect(mocks.adminUpdateUserById).not.toHaveBeenCalled();
  });

  it('explica cuando la clave es débil', async () => {
    mocks.updateUser.mockResolvedValue({
      data: {},
      error: authError('weak_password', 'Password is known to be weak and easy to guess.'),
    });
    const result = await completeOnboardingAction(INPUT);
    expect(result).toMatchObject({ ok: false, field: 'password' });
  });

  it('si no pudo apagar el flag, no dice que salió todo bien', async () => {
    mocks.updateUser.mockResolvedValue({ data: {}, error: null });
    mocks.adminUpdateUserById.mockResolvedValueOnce({ data: {}, error: { message: 'boom' } });
    const result = await completeOnboardingAction(INPUT);
    expect(result.ok).toBe(false);
  });
});
