import { BottomNav } from '@/components/salu/bottom-nav';
import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}));

import { usePathname } from 'next/navigation';

beforeAll(() => {
  (usePathname as ReturnType<typeof vi.fn>).mockReturnValue('/home');
});

describe('BottomNav', () => {
  it('renderiza 5 ítems de navegación', () => {
    render(<BottomNav />);
    const labels = ['Inicio', 'Cuidar', 'Registro', 'Álbum', 'Diversión'];
    for (const label of labels) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("el ítem activo tiene aria-current='page'", () => {
    render(<BottomNav />);
    const homeLink = screen.getByText('Inicio').closest('a');
    expect(homeLink).toHaveAttribute('aria-current', 'page');
  });

  it('ítems inactivos no tienen aria-current', () => {
    render(<BottomNav />);
    const cuidarLink = screen.getByText('Cuidar').closest('a');
    expect(cuidarLink).not.toHaveAttribute('aria-current');
  });

  it('tap targets respetan el mínimo de accesibilidad (>=44px)', () => {
    render(<BottomNav />);
    const homeLink = screen.getByText('Inicio').closest('a');
    // El tap target sube a 52px para tener más respiro visual + flecha
    // de active. Lo importante es que sea >= 44px.
    expect(homeLink?.className).toContain('min-h-[52px]');
    expect(homeLink?.className).toContain('min-w-[44px]');
  });
});
