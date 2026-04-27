/**
 * Tipos de la base de datos Supabase.
 *
 * Placeholder mientras no haya migraciones. Cuando aparezcan tablas reales,
 * regenerar este archivo con `supabase gen types typescript` (lo cableamos
 * como `pnpm db:types` cuando arranque el paso de migraciones).
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
