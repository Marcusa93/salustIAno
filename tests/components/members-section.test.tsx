import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/app/(app)/familia/miembros/actions', () => ({
  createMemberAction: vi.fn(),
  deleteMemberAccountAction: vi.fn(),
  removeMemberAction: vi.fn(),
  resetMemberPasswordAction: vi.fn(),
  updateMemberRoleAction: vi.fn(),
}));

import { MembersSection } from '@/app/(app)/familia/_components/members-section';
import type { MemberEntry } from '@/app/(app)/familia/miembros/actions';

const member = (overrides: Partial<MemberEntry>): MemberEntry => ({
  membershipId: 'm-1',
  userId: 'u-1',
  email: 'alguien@ejemplo.com',
  displayName: 'Alguien',
  relationship: null,
  role: 'family',
  acceptedAt: '2026-05-04T00:00:00Z',
  isSelf: false,
  isSuperadmin: false,
  ...overrides,
});

const members: MemberEntry[] = [
  member({ membershipId: 'm-1', displayName: 'Marco', role: 'admin', isSelf: true }),
  member({ membershipId: 'm-2', displayName: 'Abril', role: 'admin' }),
  member({ membershipId: 'm-3', displayName: 'Abuela', role: 'family' }),
];

describe('MembersSection', () => {
  it('un admin común solo gestiona a los que no son admins', () => {
    render(<MembersSection initialMembers={members} isAdmin isSuperadmin={false} />);
    expect(screen.queryByRole('button', { name: 'Opciones para Abril' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Opciones para Abuela' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Opciones para Marco' })).not.toBeInTheDocument();
  });

  it('el superadmin gestiona a otros admins y puede borrar cuentas', async () => {
    const user = userEvent.setup();
    const asSuperadmin = members.map((m) => (m.isSelf ? { ...m, isSuperadmin: true } : m));
    render(<MembersSection initialMembers={asSuperadmin} isAdmin isSuperadmin />);

    expect(screen.getByText('Superadmin')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Opciones para Marco' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Opciones para Abril' }));
    expect(await screen.findByRole('menuitem', { name: /Borrar cuenta/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Resetear contraseña/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: 'Admin' })).toBeInTheDocument();
  });

  it('nadie ve opciones sobre el superadmin', () => {
    const others = [
      member({ membershipId: 'm-1', displayName: 'Marco', role: 'admin', isSuperadmin: true }),
      member({ membershipId: 'm-2', displayName: 'Abril', role: 'admin', isSelf: true }),
    ];
    render(<MembersSection initialMembers={others} isAdmin isSuperadmin={false} />);
    expect(screen.queryByRole('button', { name: 'Opciones para Marco' })).not.toBeInTheDocument();
  });
});
