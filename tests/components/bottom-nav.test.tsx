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
    const labels = ['Home', 'Cuidar', 'Recordar', 'Crear', 'Familia'];
    for (const label of labels) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("el ítem activo tiene aria-current='page'", () => {
    render(<BottomNav />);
    const homeLink = screen.getByText('Home').closest('a');
    expect(homeLink).toHaveAttribute('aria-current', 'page');
  });

  it('ítems inactivos no tienen aria-current', () => {
    render(<BottomNav />);
    const cuidarLink = screen.getByText('Cuidar').closest('a');
    expect(cuidarLink).not.toHaveAttribute('aria-current');
  });

  it('tap targets incluyen min-h-[44px] y min-w-[44px]', () => {
    render(<BottomNav />);
    const homeLink = screen.getByText('Home').closest('a');
    expect(homeLink?.className).toContain('min-h-[44px]');
    expect(homeLink?.className).toContain('min-w-[44px]');
  });
});
