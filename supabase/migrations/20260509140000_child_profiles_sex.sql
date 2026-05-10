-- ============================================================================
-- Migration 026 — Sumar columna `sex` a child_profiles.
--
-- Necesaria para usar las curvas de crecimiento de la OMS (WHO Child
-- Growth Standards) — boys y girls tienen tablas LMS distintas. Sin el
-- sexo del bebé no podemos calcular el percentil real, solo aproximado.
--
-- 'male' / 'female' / 'other' como ENUM-like vía CHECK constraint
-- (más liviano que un type custom para 3 valores). 'other' está para
-- casos raros (intersex, sin asignar) — en esos casos la app va a
-- mostrar el peso bruto sin percentil, no se inventa una curva.
--
-- IMPORTANTE: tras correr esta migración, hay que UPDATE manual el
-- valor para los bebés ya cargados, ej.:
--   update child_profiles set sex = 'male' where name = 'Salustiano';
-- (no podemos defaulting a 'male' porque ofendería a las familias con
-- nenas; mejor null hasta que un humano lo confirme).
-- ============================================================================

alter table public.child_profiles
  add column if not exists sex text;

alter table public.child_profiles
  drop constraint if exists child_profiles_sex_valid;

alter table public.child_profiles
  add constraint child_profiles_sex_valid
  check (sex is null or sex in ('male', 'female', 'other'));
