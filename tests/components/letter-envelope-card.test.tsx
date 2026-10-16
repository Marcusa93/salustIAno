import { LetterEnvelopeCard } from '@/app/(app)/home/_components/letter-envelope-card';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

describe('LetterEnvelopeCard', () => {
  it('lleva a la carta programada', () => {
    render(<LetterEnvelopeCard slug="mama-2026" />);
    const link = screen.getByRole('link', { name: /Salu te dejó una carta/ });
    expect(link).toHaveAttribute('href', '/carta/mama-2026');
  });
});
