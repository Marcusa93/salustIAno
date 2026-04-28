'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type * as React from 'react';

interface FormFieldProps extends React.ComponentProps<'input'> {
  id: string;
  label: string;
  error?: string;
}

export function FormField({ id, label, error, className, ...inputProps }: FormFieldProps) {
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        aria-describedby={errorId}
        aria-invalid={!!error}
        className={cn(className)}
        {...inputProps}
      />
      {error && (
        <p id={errorId} role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
