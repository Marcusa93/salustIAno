/**
 * Workaround: @hookform/resolvers v5 was typed against Zod 4.0.x but we use 4.3+.
 * The runtime behavior is identical — only TypeScript overload resolution fails.
 * Form type safety is preserved via the explicit `useForm<Schema>` generic.
 */
import { zodResolver as _zodResolver } from '@hookform/resolvers/zod';
import type { FieldValues, Resolver } from 'react-hook-form';
import type { ZodType } from 'zod';

export function zodResolver<T extends FieldValues>(schema: ZodType<T>): Resolver<T, unknown> {
  return _zodResolver(schema as never) as Resolver<T>;
}
