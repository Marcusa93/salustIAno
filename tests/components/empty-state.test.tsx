import { EmptyState } from '@/components/salu/empty-state';
import { render, screen } from '@testing-library/react';
import { Star } from 'lucide-react';
import { describe, expect, it } from 'vitest';

describe('EmptyState', () => {
  it('renderiza con icon LucideIcon', () => {
    render(<EmptyState icon={Star} title="Título" description="Descripción" />);
    expect(screen.getByText('Título')).toBeInTheDocument();
    // icon renders inside a div wrapper — the SVG is aria-hidden
    const svgs = document.querySelectorAll('svg[aria-hidden]');
    expect(svgs.length).toBeGreaterThan(0);
  });

  it('renderiza con illustration ReactNode', () => {
    render(
      <EmptyState
        illustration={<span data-testid="custom-illustration">Custom</span>}
        title="Título"
        description="Descripción"
      />,
    );
    expect(screen.getByTestId('custom-illustration')).toBeInTheDocument();
  });

  it('illustration tiene prioridad sobre icon si se pasan ambos', () => {
    render(
      <EmptyState
        illustration={<span data-testid="illus">Illus</span>}
        icon={Star}
        title="Título"
        description="Descripción"
      />,
    );
    // illustration must render, icon container must NOT render
    expect(screen.getByTestId('illus')).toBeInTheDocument();
    // When illustration wins, the icon's bg-primary/10 container should not exist
    const iconContainers = document.querySelectorAll('div.bg-primary\\/10');
    expect(iconContainers.length).toBe(0);
  });

  it('renderiza action CTA con href', () => {
    render(
      <EmptyState
        title="Título"
        description="Descripción"
        action={{ label: 'Acción', href: '/home' }}
      />,
    );
    const link = screen.getByRole('link', { name: 'Acción' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/home');
  });

  it('action disabled renderiza en estado deshabilitado', () => {
    render(
      <EmptyState
        title="Título"
        description="Descripción"
        action={{ label: 'Próximamente', disabled: true }}
      />,
    );
    const btn = screen.getByRole('button', { name: 'Próximamente' });
    expect(btn).toBeDisabled();
  });
});
