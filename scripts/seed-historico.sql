-- ============================================================
-- Carga histórica de Salustiano: 2026-05-01 → 2026-07-08
--
-- Qué inserta:
--   • feeding_events : 68 días de tomas (pecho+fórmula 30 ml las
--       primeras 4 semanas; mamadera sola con volumen progresivo
--       30→100 ml desde sem 5)
--   • diaper_events  : 7 pañales por día (wet/both/dirty rotando)
--   • sleep_sessions : 6 sesiones/día ≈ 15 h totales
--   • child_measurements : los 3 controles pediátricos reales
--   • medical_milestones : 3 controles + vacunas de hoy
--   • notes          : nota del día de las vacunas (Thermofren)
--
-- Ejecutar en Supabase SQL Editor (corre como postgres → bypasea RLS).
-- El script es IDEMPOTENTE en el sentido de que aborta si ya existen
-- más de 10 tomas históricas para el niño (evita duplicar).
-- ============================================================

DO $$
DECLARE
  v_child_id   uuid;
  v_family_id  uuid;
  v_user_id    uuid;

  d            date;
  day_num      integer;   -- días desde nacimiento (0-based)
  i            integer;

  v_occurred_at timestamptz;
  v_amount_ml   integer;

  -- Offsets en minutos desde medianoche UTC para cada toma
  -- Argentina = UTC-3 → hay que sumar 3 h a cada hora AR
  --
  -- Período 1 (9 tomas/día): AR 01:00, 03:30, 06:00, 08:30, 11:00,
  --                               13:30, 16:00, 18:30, 21:00
  --                           UTC 04:00, 06:30, 09:00, 11:30, 14:00,
  --                               16:30, 19:00, 21:30, 00:00+1d
  feed_p1 integer[] := ARRAY[240, 390, 540, 690, 840, 990, 1140, 1290, 1440];

  -- Período 2 (8 tomas/día): AR 01:00, 04:00, 07:00, 10:00, 13:00,
  --                               16:00, 19:00, 22:00
  --                           UTC 04:00, 07:00, 10:00, 13:00, 16:00,
  --                               19:00, 22:00, 01:00+1d
  feed_p2 integer[] := ARRAY[240, 420, 600, 780, 960, 1140, 1320, 1500];

  -- 7 pañales/día
  -- AR  02:00  05:00  08:30  11:30  14:30  17:30  20:30
  -- UTC 05:00  08:00  11:30  14:30  17:30  20:30  23:30
  diaper_offsets integer[] := ARRAY[300, 480, 690, 870, 1050, 1230, 1410];
  diaper_types_r  text[]   := ARRAY['wet','wet','both','wet','both','wet','dirty'];

  v_existing integer;

BEGIN
  -- ── Buscar child y familia ──────────────────────────────────
  SELECT id, family_group_id
  INTO   v_child_id, v_family_id
  FROM   child_profiles
  WHERE  deleted_at IS NULL
  LIMIT  1;

  IF v_child_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró ningún child_profile. Verificar que Salustiano está creado.';
  END IF;

  SELECT user_id INTO v_user_id
  FROM   family_memberships
  WHERE  family_group_id = v_family_id
  ORDER  BY created_at
  LIMIT  1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró ningún miembro en la familia.';
  END IF;

  RAISE NOTICE 'child_id=%, family_id=%, user_id=%', v_child_id, v_family_id, v_user_id;

  -- ── Guard: evitar duplicados ────────────────────────────────
  SELECT COUNT(*) INTO v_existing
  FROM   feeding_events
  WHERE  child_id   = v_child_id
    AND  deleted_at IS NULL
    AND  occurred_at >= '2026-05-01'
    AND  occurred_at <  '2026-07-08';

  IF v_existing > 10 THEN
    RAISE EXCEPTION
      'Ya existen % tomas históricas. Borrarlas antes de volver a correr este script.',
      v_existing;
  END IF;

  -- ============================================================
  -- 1. TOMAS (feeding_events)
  -- ============================================================
  FOR d IN
    SELECT gs::date
    FROM   generate_series('2026-05-01'::date,
                           '2026-07-07'::date,
                           '1 day'::interval) gs
  LOOP
    day_num := d - '2026-05-01'::date;   -- 0 = día de nacimiento

    -- ── Período 1: semanas 1-4 (01/05 → 28/05) ──────────────
    IF d <= '2026-05-28' THEN
      FOR i IN 1..9 LOOP
        v_occurred_at := d::timestamptz + feed_p1[i] * interval '1 minute';

        IF i % 2 = 1 THEN
          -- Tomas impares → pecho (ambos lados, ~20 min)
          INSERT INTO feeding_events
            (child_id, occurred_at, type, side, duration_minutes, reaction, created_by)
          VALUES
            (v_child_id, v_occurred_at, 'breastfeeding', 'both', 20, 'none', v_user_id);
        ELSE
          -- Tomas pares → mamadera 30 ml
          INSERT INTO feeding_events
            (child_id, occurred_at, type, amount_ml, reaction, created_by)
          VALUES
            (v_child_id, v_occurred_at, 'bottle', 30, 'none', v_user_id);
        END IF;
      END LOOP;

    -- ── Período 2: sem 5+ (29/05 → 07/07) ───────────────────
    ELSE
      -- Volumen progresivo: 30 ml el día 28 → 100 ml el día 68
      -- incremento ≈ 1,75 ml/día
      v_amount_ml := LEAST(
        30 + ROUND((day_num - 27) * 1.75)::integer,
        100
      );

      FOR i IN 1..8 LOOP
        v_occurred_at := d::timestamptz + feed_p2[i] * interval '1 minute';
        INSERT INTO feeding_events
          (child_id, occurred_at, type, amount_ml, reaction, created_by)
        VALUES
          (v_child_id, v_occurred_at, 'bottle', v_amount_ml, 'none', v_user_id);
      END LOOP;
    END IF;
  END LOOP;

  RAISE NOTICE '✓ Tomas cargadas.';

  -- ============================================================
  -- 2. PAÑALES (diaper_events)  — 7 por día
  -- ============================================================
  FOR d IN
    SELECT gs::date
    FROM   generate_series('2026-05-01'::date,
                           '2026-07-07'::date,
                           '1 day'::interval) gs
  LOOP
    FOR i IN 1..7 LOOP
      INSERT INTO diaper_events (child_id, occurred_at, type, created_by)
      VALUES (
        v_child_id,
        d::timestamptz + diaper_offsets[i] * interval '1 minute',
        diaper_types_r[i]::diaper_type,
        v_user_id
      );
    END LOOP;
  END LOOP;

  RAISE NOTICE '✓ Pañales cargados.';

  -- ============================================================
  -- 3. SUEÑO (sleep_sessions)  — 6 sesiones/día ≈ 15 h
  --
  --  Sesión  AR (hora local)      UTC                dur   tipo
  --  ──────  ─────────────────    ─────────────────  ────  ─────
  --   1      00:00 – 04:00        03:00 – 07:00       4 h  noche
  --   2      04:30 – 07:00        07:30 – 10:00       2.5h noche
  --   3      08:00 – 10:30        11:00 – 13:30       2.5h siesta
  --   4      12:00 – 14:00        15:00 – 17:00       2 h  siesta
  --   5      15:30 – 17:30        18:30 – 20:30       2 h  siesta
  --   6      19:00 – 21:00        22:00 – 00:00+1d    2 h  tarde
  -- ============================================================
  FOR d IN
    SELECT gs::date
    FROM   generate_series('2026-05-01'::date,
                           '2026-07-07'::date,
                           '1 day'::interval) gs
  LOOP
    INSERT INTO sleep_sessions
      (child_id, started_at, ended_at, quality, is_nap, created_by)
    VALUES
      -- sesión 1 — noche (4 h)
      (v_child_id,
       d::timestamptz + interval  '3 hours',
       d::timestamptz + interval  '7 hours',
       'good', false, v_user_id),
      -- sesión 2 — noche (2.5 h)
      (v_child_id,
       d::timestamptz + interval  '7 hours 30 minutes',
       d::timestamptz + interval '10 hours',
       'good', false, v_user_id),
      -- sesión 3 — siesta (2.5 h)
      (v_child_id,
       d::timestamptz + interval '11 hours',
       d::timestamptz + interval '13 hours 30 minutes',
       'good', true, v_user_id),
      -- sesión 4 — siesta (2 h)
      (v_child_id,
       d::timestamptz + interval '15 hours',
       d::timestamptz + interval '17 hours',
       'good', true, v_user_id),
      -- sesión 5 — siesta (2 h)
      (v_child_id,
       d::timestamptz + interval '18 hours 30 minutes',
       d::timestamptz + interval '20 hours 30 minutes',
       'good', true, v_user_id),
      -- sesión 6 — tarde/noche (2 h)  ended_at = medianoche UTC del día sig.
      (v_child_id,
       d::timestamptz + interval '22 hours',
       d::timestamptz + interval '24 hours',
       'unknown', false, v_user_id);
  END LOOP;

  RAISE NOTICE '✓ Sueños cargados.';

  -- ============================================================
  -- 4. MEDICIONES (child_measurements)
  -- ============================================================
  -- Control 1 — 13/05: 3.050 g, cabeza 35 cm
  INSERT INTO child_measurements
    (child_id, measured_at, weight_grams, head_circumference_cm, created_by)
  VALUES
    (v_child_id, '2026-05-13 12:00:00-03', 3050, 35.0, v_user_id);

  -- Control 2 — 27/05: ≈ 3.450 g (+400 g)
  INSERT INTO child_measurements
    (child_id, measured_at, weight_grams, created_by)
  VALUES
    (v_child_id, '2026-05-27 12:00:00-03', 3450, v_user_id);

  -- Control 3 — 17/06: 4.050 g
  INSERT INTO child_measurements
    (child_id, measured_at, weight_grams, created_by)
  VALUES
    (v_child_id, '2026-06-17 12:00:00-03', 4050, v_user_id);

  RAISE NOTICE '✓ Mediciones cargadas.';

  -- ============================================================
  -- 5. HITOS MÉDICOS (medical_milestones)
  -- ============================================================
  -- created_at se pasa explícito (= fecha del hito) para satisfacer
  -- el check completed_at >= created_at en registros históricos.
  INSERT INTO medical_milestones
    (family_group_id, category, title, description,
     due_at, completed_at, created_at, created_by)
  VALUES
    (v_family_id,
     'control_pediatrico',
     'Primer control pediátrico',
     'Pesó 3.050 g. Perímetro cefálico: 35 cm. '
     'No perdió más del 6 % del peso de nacimiento. '
     'La pediatra indicó que todo estaba muy bien.',
     '2026-05-13 12:00:00-03',
     '2026-05-13 12:00:00-03',
     '2026-05-13 12:00:00-03',
     v_user_id),

    (v_family_id,
     'control_pediatrico',
     'Segundo control pediátrico',
     'Ganó aproximadamente 400 g desde el control anterior '
     '(≈ 3.450 g). Todo excelente.',
     '2026-05-27 12:00:00-03',
     '2026-05-27 12:00:00-03',
     '2026-05-27 12:00:00-03',
     v_user_id),

    (v_family_id,
     'control_pediatrico',
     'Tercer control pediátrico',
     'Pesó 4.050 g. Curva de peso excelente.',
     '2026-06-17 12:00:00-03',
     '2026-06-17 12:00:00-03',
     '2026-06-17 12:00:00-03',
     v_user_id),

    (v_family_id,
     'vacuna',
     'Primeras vacunas',
     'Primeras vacunas de Salustiano. '
     'Pediatra indicó Thermofren (paracetamol en gotas) '
     'cada 6-8 horas para controlar posible fiebre o malestar.',
     '2026-07-08 10:00:00-03',
     '2026-07-08 10:00:00-03',
     '2026-07-08 10:00:00-03',
     v_user_id);

  RAISE NOTICE '✓ Hitos médicos cargados.';

  -- ============================================================
  -- 6. NOTA DEL DÍA — vacunas + Thermofren
  -- ============================================================
  INSERT INTO notes
    (child_id, occurred_at, category, content, created_by)
  VALUES (
    v_child_id,
    '2026-07-08 10:00:00-03',
    'milestone',
    'Primeras vacunas de Salustiano (8 de julio de 2026). '
    'Pediatra indicó Thermofren (paracetamol en gotas) '
    'cada 6-8 horas mientras dure el malestar o la fiebre.',
    v_user_id
  );

  RAISE NOTICE '✓ Nota de vacunas cargada.';
  RAISE NOTICE '🟢 Carga histórica completada exitosamente.';
END $$;
