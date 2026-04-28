import { ChipsInput } from '@/components/salu/chips-input';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

function Harness(props: { initial?: string[]; max?: number; maxLength?: number }) {
  const [value, setValue] = useState<string[]>(props.initial ?? []);
  return (
    <ChipsInput
      id="test"
      value={value}
      onChange={setValue}
      placeholder="Agregá chips"
      max={props.max ?? 8}
      maxLength={props.maxLength ?? 50}
    />
  );
}

describe('ChipsInput', () => {
  it('renderiza chips iniciales', () => {
    render(<Harness initial={['mamá', 'papá']} />);
    expect(screen.getByText('mamá')).toBeInTheDocument();
    expect(screen.getByText('papá')).toBeInTheDocument();
  });

  it('agrega un chip al apretar Enter', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByPlaceholderText('Agregá chips');
    await user.type(input, 'osito{Enter}');
    expect(screen.getByText('osito')).toBeInTheDocument();
  });

  it('agrega un chip con coma', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByPlaceholderText('Agregá chips');
    await user.type(input, 'luna,');
    expect(screen.getByText('luna')).toBeInTheDocument();
  });

  it('Backspace en input vacío elimina el último chip', async () => {
    const user = userEvent.setup();
    render(<Harness initial={['a', 'b', 'c']} />);
    const input = screen.getByRole('textbox');
    input.focus();
    await user.keyboard('{Backspace}');
    expect(screen.queryByText('c')).not.toBeInTheDocument();
    expect(screen.getByText('b')).toBeInTheDocument();
  });

  it('no agrega duplicados (case-insensitive)', async () => {
    const user = userEvent.setup();
    render(<Harness initial={['Mamá']} />);
    const input = screen.getByRole('textbox');
    await user.type(input, 'mamá{Enter}');
    expect(screen.getAllByText(/mamá/i)).toHaveLength(1);
  });

  it('respeta el max configurado y bloquea el input', async () => {
    const user = userEvent.setup();
    render(<Harness initial={['a', 'b']} max={2} />);
    const input = screen.getByPlaceholderText('Llegaste al máximo');
    expect(input).toBeDisabled();
    await user.click(input);
    // No tira error, sigue siendo 2
    expect(screen.getAllByRole('button', { name: /quitar/i })).toHaveLength(2);
  });

  it('botón X elimina el chip correspondiente', async () => {
    const user = userEvent.setup();
    render(<Harness initial={['a', 'b']} />);
    await user.click(screen.getByRole('button', { name: 'Quitar a' }));
    expect(screen.queryByText('a')).not.toBeInTheDocument();
    expect(screen.getByText('b')).toBeInTheDocument();
  });

  it('respeta maxLength del input', () => {
    render(<Harness maxLength={10} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.maxLength).toBe(10);
  });
});
