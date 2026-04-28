import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// env.ts hace safeParse de process.env al importar. Sin estos defaults,
// cualquier test que importe (directa o indirectamente) un archivo que
// dependa de @/lib/env explota al cargar el módulo.
process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??= 'test-publishable-key';
process.env.SUPABASE_SECRET_KEY ??= 'test-secret-key';
process.env.OPENROUTER_API_KEY ??= 'test-openrouter-key';
process.env.NEXT_PUBLIC_APP_URL ??= 'http://localhost:3000';

afterEach(() => {
  cleanup();
});
