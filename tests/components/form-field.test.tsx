import { FormField } from '@/components/salu/form-field';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

describe('FormField', () => {
  it('renderiza el label asociado al input via htmlFor', () => {
    render(<FormField id="test-email" label="Email" type="email" />);

    const label = screen.getByText('Email');
    const input = screen.getByRole('textbox');

    expect(label.tagName).toBe('LABEL');
    expect(label).toHaveAttribute('for', 'test-email');
    expect(input).toHaveAttribute('id', 'test-email');
  });

  it('no muestra mensaje de error cuando no hay error', () => {
    render(<FormField id="test-input" label="Campo" type="text" />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('muestra el error con aria-describedby cuando hay mensaje de error', () => {
    render(
      <FormField id="test-input" label="Email" type="email" error="Ingresá un email válido" />,
    );

    const input = screen.getByRole('textbox');
    const errorEl = screen.getByRole('alert');

    expect(errorEl).toHaveTextContent('Ingresá un email válido');
    expect(input).toHaveAttribute('aria-describedby', 'test-input-error');
    expect(errorEl).toHaveAttribute('id', 'test-input-error');
  });

  it('marca el input como aria-invalid cuando hay error', () => {
    render(<FormField id="test-input" label="Campo" type="text" error="Hay un error" />);

    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });
});
