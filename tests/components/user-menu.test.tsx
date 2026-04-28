import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-themes', () => ({
  useTheme: vi.fn(() => ({ theme: 'system', setTheme: vi.fn() })),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/app/(app)/_actions/sign-out', () => ({
  signOut: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { signOut } from '@/app/(app)/_actions/sign-out';
import { UserMenu } from '@/components/salu/user-menu';
import { toast } from 'sonner';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('UserMenu', () => {
  it('renderiza el trigger con aria-label correcto', () => {
    render(<UserMenu />);
    expect(screen.getByRole('button', { name: 'Menú de usuario' })).toBeInTheDocument();
  });

  it('abre el dropdown al hacer click en el trigger', async () => {
    const user = userEvent.setup();
    render(<UserMenu />);

    await user.click(screen.getByRole('button', { name: 'Menú de usuario' }));

    await waitFor(() => {
      expect(screen.getByText('Mi cuenta')).toBeInTheDocument();
    });
  });

  it('el submenu de tema tiene las 4 opciones', async () => {
    const user = userEvent.setup();
    render(<UserMenu />);

    await user.click(screen.getByRole('button', { name: 'Menú de usuario' }));

    await waitFor(() => {
      expect(screen.getByText('Tema')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Tema'));

    await waitFor(() => {
      const themeLabels = ['Sistema', 'Claro', 'Oscuro', 'Noche'];
      for (const label of themeLabels) {
        expect(screen.getByText(label)).toBeInTheDocument();
      }
    });
  });

  it('click en Cerrar sesión llama a la Server Action y muestra toast', async () => {
    const user = userEvent.setup();
    render(<UserMenu />);

    await user.click(screen.getByRole('button', { name: 'Menú de usuario' }));

    await waitFor(() => {
      expect(screen.getByText('Cerrar sesión')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Cerrar sesión'));

    await waitFor(() => {
      expect(signOut).toHaveBeenCalled();
      expect(toast.info).toHaveBeenCalledWith('Sesión cerrada (placeholder)');
    });
  });
});
