'use client';

import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { type KeyboardEvent, useState } from 'react';

interface ChipsInputProps {
  value: string[];
  onChange(next: string[]): void;
  placeholder?: string;
  /** Default 8. */
  max?: number;
  /** Default 50. */
  maxLength?: number;
  disabled?: boolean;
  /** Para integración con form (accesibilidad). */
  name?: string;
  id: string;
  /** Aria-describedby para mensajes de error externos. */
  'aria-describedby'?: string;
}

/**
 * Input con chips removibles. Enter o coma agregan; Backspace en input
 * vacío elimina el último. No permite duplicados (case-insensitive).
 *
 * Sin librería externa — la complejidad real es chica y mantener control
 * sobre la UX (chip styling, hint cuando se llega al máximo, focus
 * management) compensa el tamaño.
 */
export function ChipsInput({
  value,
  onChange,
  placeholder,
  max = 8,
  maxLength = 50,
  disabled = false,
  name,
  id,
  'aria-describedby': ariaDescribedby,
}: ChipsInputProps) {
  const [draft, setDraft] = useState('');

  const atMax = value.length >= max;
  const inputDisabled = disabled || atMax;

  function addChip(raw: string) {
    const next = raw.trim().slice(0, maxLength);
    if (!next) return;
    if (value.some((v) => v.toLowerCase() === next.toLowerCase())) return;
    if (value.length >= max) return;
    onChange([...value, next]);
    setDraft('');
  }

  function removeAt(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addChip(draft);
      return;
    }
    if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      e.preventDefault();
      removeAt(value.length - 1);
    }
  }

  return (
    <div
      className={cn(
        'flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 text-sm transition-colors',
        'focus-within:outline-2 focus-within:outline-ring focus-within:outline-offset-2',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      {value.map((chip, index) => (
        <span
          key={chip}
          className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 font-medium text-primary text-sm"
        >
          {chip}
          <button
            type="button"
            onClick={() => removeAt(index)}
            aria-label={`Quitar ${chip}`}
            className="rounded-full p-0.5 transition-colors hover:bg-primary/20"
            disabled={disabled}
          >
            <X className="size-3" aria-hidden />
          </button>
        </span>
      ))}
      <input
        id={id}
        name={name}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (draft.trim()) addChip(draft);
        }}
        placeholder={atMax ? 'Llegaste al máximo' : placeholder}
        maxLength={maxLength}
        disabled={inputDisabled}
        aria-describedby={ariaDescribedby}
        className="min-w-[120px] flex-1 bg-transparent outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
      />
    </div>
  );
}
