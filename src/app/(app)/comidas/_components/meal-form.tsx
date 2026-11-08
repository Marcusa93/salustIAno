'use client';

import { haptic } from '@/lib/haptics';
import { ALLERGEN_LABELS, FOODS, FOOD_BY_KEY, normalizeFoodName } from '@/lib/solids/catalog';
import {
  ACCEPTANCES,
  ACCEPTANCE_EMOJI,
  ACCEPTANCE_LABELS,
  AMOUNTS,
  AMOUNT_LABELS,
  EMERGENCY_SIGNS,
  FOOD_FORMATS,
  FORMAT_HINTS,
  FORMAT_LABELS,
  REACTION_SIGNS,
  REACTION_SIGN_LABELS,
} from '@/lib/solids/labels';
import { resolveFood } from '@/lib/solids/progress';
import type {
  Food,
  FoodAcceptance,
  FoodAmount,
  FoodFormat,
  FoodReaction,
  ReactionSign,
} from '@/lib/solids/types';
import { cn } from '@/lib/utils';
import { AlertTriangle, Camera, Loader2, Phone, Plus, Search, Sparkles, X } from 'lucide-react';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { attachMealPhotoAction, saveSolidMealAction } from '../actions';

export interface DraftTasting {
  uid: string;
  foodKey: string;
  foodName: string;
  format: FoodFormat | null;
  acceptance: FoodAcceptance | null;
  amount: FoodAmount | null;
  gagged: boolean;
  reaction: FoodReaction;
  reactionSigns: ReactionSign[];
}

export interface QuickFood {
  key: string;
  name: string;
  emoji: string;
}

interface MealFormProps {
  mealId?: string;
  /** "YYYY-MM-DDTHH:mm" en hora local. */
  initialLocalTime?: string;
  initialNotes?: string;
  initialTastings?: DraftTasting[];
  /** Alimento a precargar (desde "Para probar"). */
  preselectKey?: string;
  suggested: QuickFood[];
  recent: QuickFood[];
  triedKeys: string[];
}

const FORMAT_STORAGE_KEY = 'salu:comidas:formato';

let uidCounter = 0;
const nextUid = () => {
  uidCounter += 1;
  return `t${uidCounter}`;
};

function nowLocal(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function readStoredFormat(): FoodFormat | null {
  try {
    const v = window.localStorage.getItem(FORMAT_STORAGE_KEY);
    return v && (FOOD_FORMATS as readonly string[]).includes(v) ? (v as FoodFormat) : null;
  } catch {
    return null;
  }
}

function storeFormat(format: FoodFormat): void {
  try {
    window.localStorage.setItem(FORMAT_STORAGE_KEY, format);
  } catch {
    /* sin storage: no pasa nada */
  }
}

function searchFoods(query: string): Food[] {
  const q = normalizeFoodName(query);
  if (!q) return [];
  const scored: { food: Food; score: number }[] = [];
  for (const food of FOODS) {
    const names = [food.name, ...(food.aliases ?? [])].map(normalizeFoodName);
    let score = -1;
    for (const n of names) {
      if (n === q) score = Math.max(score, 3);
      else if (n.startsWith(q)) score = Math.max(score, 2);
      else if (n.includes(q)) score = Math.max(score, 1);
    }
    if (score >= 0) scored.push({ food, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.food.name.localeCompare(b.food.name))
    .slice(0, 8)
    .map((s) => s.food);
}

export function MealForm({
  mealId,
  initialLocalTime,
  initialNotes,
  initialTastings,
  preselectKey,
  suggested,
  recent,
  triedKeys,
}: MealFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [time, setTime] = useState(initialLocalTime ?? '');
  const [notes, setNotes] = useState(initialNotes ?? '');
  const [items, setItems] = useState<DraftTasting[]>(initialTastings ?? []);
  const [query, setQuery] = useState('');
  const [defaultFormat, setDefaultFormat] = useState<FoodFormat | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const preselected = useRef(false);
  const tried = useMemo(() => new Set(triedKeys), [triedKeys]);

  // La hora y el formato recordado se resuelven en el cliente para no
  // desfasar el render del server (zona horaria / localStorage).
  useEffect(() => {
    if (!initialLocalTime) setTime(nowLocal());
    setDefaultFormat(readStoredFormat());
  }, [initialLocalTime]);

  const addFood = (key: string, name: string) => {
    haptic('tap');
    setItems((prev) =>
      prev.some((t) => t.foodKey === key)
        ? prev
        : [
            ...prev,
            {
              uid: nextUid(),
              foodKey: key,
              foodName: name,
              format: defaultFormat ?? readStoredFormat(),
              acceptance: null,
              amount: null,
              gagged: false,
              reaction: 'none',
              reactionSigns: [],
            },
          ],
    );
    setQuery('');
  };

  useEffect(() => {
    if (preselected.current || !preselectKey) return;
    preselected.current = true;
    const food = FOOD_BY_KEY.get(preselectKey);
    if (food) addFood(food.key, food.name);
    // biome-ignore lint/correctness/useExhaustiveDependencies: solo al montar, con el alimento que vino en la URL.
  }, [preselectKey]);

  // La vista previa es un object URL: se libera al cambiarla o al salir.
  useEffect(() => {
    if (!photo) {
      setPhotoPreview(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const update = (uid: string, patch: Partial<DraftTasting>) =>
    setItems((prev) => prev.map((t) => (t.uid === uid ? { ...t, ...patch } : t)));

  const results = useMemo(() => searchFoods(query), [query]);
  const custom = query.trim().length >= 2 ? resolveFood(query) : null;
  const usedKeys = new Set(items.map((t) => t.foodKey));

  const submit = () => {
    if (items.length === 0) {
      toast.error('Sumá al menos un alimento.');
      return;
    }
    const occurred = time ? new Date(time) : new Date();
    if (Number.isNaN(occurred.getTime())) {
      toast.error('Revisá la hora.');
      return;
    }
    startTransition(async () => {
      const res = await saveSolidMealAction(
        {
          occurred_at: occurred.toISOString(),
          notes,
          tastings: items.map((t) => ({
            food_key: t.foodKey,
            food_name: t.foodName,
            format: t.format,
            acceptance: t.acceptance,
            amount: t.amount,
            gagged: t.gagged,
            reaction: t.reaction,
            reaction_signs: t.reaction === 'none' ? [] : t.reactionSigns,
          })),
        },
        mealId,
      );
      if (!res.ok) {
        haptic('warning');
        toast.error(res.error);
        return;
      }
      if (photo) {
        const fd = new FormData();
        fd.append('photo', photo);
        const up = await attachMealPhotoAction(res.id, fd).catch(() => null);
        if (!up?.ok) {
          toast.warning(`La comida se guardó, pero la foto no: ${up?.error ?? 'probá de nuevo.'}`);
        }
      }
      haptic('success');
      if (!res.detailSaved) {
        toast.warning('Se anotó la comida, pero falta activar el detalle por alimento en la base.');
      } else if (res.firstTimes.length > 0) {
        toast.success(`¡Primera vez con ${listJoin(res.firstTimes.map((n) => n.toLowerCase()))}!`);
      } else {
        toast.success(mealId ? 'Cambios guardados.' : 'Comida anotada.');
      }
      router.push('/comidas' as Route);
    });
  };

  return (
    <div className="flex flex-col gap-6 pb-28">
      <label className="flex flex-col gap-1.5">
        <span className="px-1 font-medium text-[10.5px] text-muted-foreground/80 uppercase tracking-[0.22em]">
          Cuándo
        </span>
        <input
          type="datetime-local"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="h-12 rounded-2xl bg-card px-4 text-foreground ring-1 ring-foreground/[0.08] focus:outline-none focus:ring-2 focus:ring-solid"
        />
      </label>

      {/* Buscar y sumar alimentos */}
      <section className="flex flex-col gap-3" aria-label="Alimentos">
        <span className="px-1 font-medium text-[10.5px] text-muted-foreground/80 uppercase tracking-[0.22em]">
          Qué comió
        </span>
        <div className="relative">
          <Search
            className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-4 size-4 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                const first = results[0];
                if (first) addFood(first.key, first.name);
                else if (custom) addFood(custom.key, custom.name);
              }
            }}
            placeholder="Buscá: zapallo, banana, carne…"
            aria-label="Buscar un alimento"
            className="h-12 w-full rounded-2xl bg-card pr-4 pl-11 text-foreground ring-1 ring-foreground/[0.08] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-solid"
          />
        </div>

        {query.trim() ? (
          <ul className="flex flex-col overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/[0.08]">
            {results.map((food) => (
              <li key={food.key}>
                <button
                  type="button"
                  disabled={usedKeys.has(food.key)}
                  onClick={() => addFood(food.key, food.name)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60 disabled:opacity-50"
                >
                  <span className="text-xl" aria-hidden>
                    {food.emoji}
                  </span>
                  <span className="flex-1 text-foreground">{food.name}</span>
                  {food.fromMonths > 6 && (
                    <span className="text-muted-foreground text-xs">
                      desde los {food.fromMonths} m
                    </span>
                  )}
                  {!tried.has(food.key) && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-[11px] text-primary">
                      Nuevo
                    </span>
                  )}
                </button>
              </li>
            ))}
            {custom && !custom.food && (
              <li>
                <button
                  type="button"
                  onClick={() => addFood(custom.key, custom.name)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60"
                >
                  <Plus className="size-5 text-muted-foreground" aria-hidden />
                  <span className="flex-1 text-foreground">Sumar “{custom.name}”</span>
                </button>
              </li>
            )}
          </ul>
        ) : (
          <div className="flex flex-col gap-3">
            {suggested.length > 0 && (
              <QuickRow
                title="Para probar"
                Icon={Sparkles}
                foods={suggested.filter((f) => !usedKeys.has(f.key))}
                onPick={addFood}
              />
            )}
            {recent.length > 0 && (
              <QuickRow
                title="Ya probó"
                foods={recent.filter((f) => !usedKeys.has(f.key))}
                onPick={addFood}
              />
            )}
          </div>
        )}
      </section>

      {/* Cada alimento */}
      {items.length > 0 && (
        <ul className="flex flex-col gap-4">
          {items.map((item) => (
            <TastingEditor
              key={item.uid}
              item={item}
              isNew={!tried.has(item.foodKey)}
              onChange={(patch) => {
                if (patch.format) {
                  storeFormat(patch.format);
                  setDefaultFormat(patch.format);
                }
                update(item.uid, patch);
              }}
              onRemove={() => setItems((prev) => prev.filter((t) => t.uid !== item.uid))}
            />
          ))}
        </ul>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="px-1 font-medium text-[10.5px] text-muted-foreground/80 uppercase tracking-[0.22em]">
          Notas
        </span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          maxLength={2000}
          placeholder="Ej.: se rió con la cuchara, comió con papá…"
          className="rounded-2xl bg-card px-4 py-3 text-foreground ring-1 ring-foreground/[0.08] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-solid"
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="px-1 font-medium text-[10.5px] text-muted-foreground/80 uppercase tracking-[0.22em]">
          Foto
        </span>
        {photoPreview ? (
          <div className="relative self-start">
            <img
              src={photoPreview}
              alt="Foto de la comida"
              className="h-44 w-auto max-w-full rounded-2xl object-cover ring-1 ring-foreground/[0.08]"
            />
            <button
              type="button"
              onClick={() => setPhoto(null)}
              aria-label="Sacar la foto"
              className="absolute top-2 right-2 grid size-8 place-items-center rounded-full bg-background/90 text-foreground shadow"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        ) : (
          <label className="flex h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-foreground/15 border-dashed bg-card text-muted-foreground text-sm transition-colors hover:text-foreground">
            <Camera className="size-5" aria-hidden />
            Sumar una foto (opcional)
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                if (file && file.size > 20 * 1024 * 1024) {
                  toast.error('La foto pesa más de 20 MB.');
                  return;
                }
                setPhoto(file);
              }}
            />
          </label>
        )}
        <span className="px-1 text-muted-foreground text-xs">
          Queda en la comida y en el álbum del mes.
        </span>
      </div>

      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.25rem)] z-30 px-4 md:bottom-6 md:pl-64">
        <button
          type="button"
          onClick={submit}
          disabled={pending || items.length === 0}
          className="mx-auto flex h-14 w-full max-w-xl items-center justify-center gap-2 rounded-2xl bg-solid font-medium text-base text-white shadow-[0_20px_40px_-20px_var(--elevation)] transition-transform active:scale-[0.98] disabled:opacity-50 dark:text-background"
        >
          {pending && <Loader2 className="size-5 animate-spin" aria-hidden />}
          {mealId
            ? 'Guardar cambios'
            : items.length === 0
              ? 'Sumá un alimento'
              : `Anotar ${items.length === 1 ? 'la comida' : `${items.length} alimentos`}`}
        </button>
      </div>
    </div>
  );
}

function QuickRow({
  title,
  Icon,
  foods,
  onPick,
}: {
  title: string;
  Icon?: typeof Sparkles;
  foods: QuickFood[];
  onPick: (key: string, name: string) => void;
}) {
  if (foods.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <span className="flex items-center gap-1.5 px-1 text-muted-foreground text-xs">
        {Icon && <Icon className="size-3.5 text-primary" aria-hidden />}
        {title}
      </span>
      <div className="flex flex-wrap gap-2">
        {foods.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => onPick(f.key, f.name)}
            className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-2 text-foreground text-sm ring-1 ring-foreground/[0.08] transition-transform active:scale-95"
          >
            <span aria-hidden>{f.emoji}</span>
            {f.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function TastingEditor({
  item,
  isNew,
  onChange,
  onRemove,
}: {
  item: DraftTasting;
  isNew: boolean;
  onChange: (patch: Partial<DraftTasting>) => void;
  onRemove: () => void;
}) {
  const food = FOOD_BY_KEY.get(item.foodKey) ?? null;
  const allergens = food?.allergens ?? [];
  const emergency =
    item.reaction === 'strong' || item.reactionSigns.some((s) => EMERGENCY_SIGNS.has(s));

  return (
    <li className="flex flex-col gap-4 rounded-3xl bg-card p-4 shadow-[0_16px_32px_-24px_var(--elevation)] ring-1 ring-solid/20">
      <div className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-solid-soft text-2xl">
          {food?.emoji ?? '🍽️'}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="font-medium text-foreground text-lg leading-tight">{item.foodName}</span>
          <div className="flex flex-wrap gap-1.5">
            {isNew && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-[11px] text-primary">
                Primera vez
              </span>
            )}
            {allergens.map((a) => (
              <span
                key={a}
                className="rounded-full bg-feed-soft px-2 py-0.5 font-medium text-[11px] text-feed-foreground"
              >
                Alérgeno: {ALLERGEN_LABELS[a].toLowerCase()}
              </span>
            ))}
            {food?.iron && (
              <span className="rounded-full bg-health-soft px-2 py-0.5 font-medium text-[11px] text-health-foreground">
                Hierro
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Sacar ${item.foodName}`}
          className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      {isNew && allergens.length > 0 && (
        <p className="rounded-2xl bg-feed-soft/70 px-3 py-2 text-feed-foreground text-sm">
          Primera vez con un alérgeno: que sea en poca cantidad y miralo las 2 horas siguientes.
        </p>
      )}

      <Field label="Cómo se lo dieron">
        <div className="grid grid-cols-2 gap-2">
          {FOOD_FORMATS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={item.format === f}
              onClick={() => onChange({ format: item.format === f ? null : f })}
              className={cn(
                'flex flex-col items-start rounded-2xl px-3 py-2 text-left ring-1 transition-colors',
                item.format === f
                  ? 'bg-solid-soft text-solid-foreground ring-solid/40'
                  : 'bg-muted/50 text-foreground ring-transparent',
              )}
            >
              <span className="font-medium text-sm">{FORMAT_LABELS[f]}</span>
              <span className="text-[11.5px] opacity-75">{FORMAT_HINTS[f]}</span>
            </button>
          ))}
        </div>
        {food && (item.format === 'finger' || item.format === 'preloaded') && (
          <p className="text-muted-foreground text-xs">{food.blw}</p>
        )}
      </Field>

      <Field label="¿Le gustó?">
        <div className="grid grid-cols-5 gap-1.5">
          {ACCEPTANCES.map((a) => (
            <button
              key={a}
              type="button"
              aria-pressed={item.acceptance === a}
              aria-label={ACCEPTANCE_LABELS[a]}
              onClick={() => {
                haptic('tap');
                onChange({ acceptance: item.acceptance === a ? null : a });
              }}
              className={cn(
                'flex flex-col items-center gap-1 rounded-2xl py-2 ring-1 transition-all',
                item.acceptance === a
                  ? 'scale-105 bg-solid-soft ring-solid/40'
                  : 'bg-muted/40 ring-transparent grayscale-[40%]',
              )}
            >
              <span className="text-2xl leading-none" aria-hidden>
                {ACCEPTANCE_EMOJI[a]}
              </span>
              <span className="text-[10.5px] text-muted-foreground leading-tight">
                {ACCEPTANCE_LABELS[a]}
              </span>
            </button>
          ))}
        </div>
      </Field>

      <Field label="¿Cuánto comió?">
        <div className="flex flex-wrap gap-1.5">
          {AMOUNTS.map((a) => (
            <Pill
              key={a}
              active={item.amount === a}
              onClick={() => onChange({ amount: item.amount === a ? null : a })}
            >
              {AMOUNT_LABELS[a]}
            </Pill>
          ))}
        </div>
      </Field>

      <div className="flex flex-wrap gap-2">
        <Pill active={item.gagged} onClick={() => onChange({ gagged: !item.gagged })}>
          Tuvo arcadas
        </Pill>
        <Pill
          active={item.reaction !== 'none'}
          tone="health"
          onClick={() =>
            onChange(
              item.reaction === 'none'
                ? { reaction: 'mild' }
                : { reaction: 'none', reactionSigns: [] },
            )
          }
        >
          Tuvo una reacción
        </Pill>
      </div>
      {item.gagged && (
        <p className="text-muted-foreground text-xs">
          Las arcadas son normales y lo protegen: si tose y hace ruido, está resolviendo solo.
        </p>
      )}

      {item.reaction !== 'none' && (
        <div className="flex flex-col gap-3 rounded-2xl bg-health-soft/60 p-3">
          <div className="flex gap-1.5">
            <Pill
              active={item.reaction === 'mild'}
              tone="health"
              onClick={() => onChange({ reaction: 'mild' })}
            >
              Leve
            </Pill>
            <Pill
              active={item.reaction === 'strong'}
              tone="health"
              onClick={() => onChange({ reaction: 'strong' })}
            >
              Fuerte
            </Pill>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {REACTION_SIGNS.map((s) => {
              const active = item.reactionSigns.includes(s);
              return (
                <Pill
                  key={s}
                  active={active}
                  tone="health"
                  onClick={() =>
                    onChange({
                      reactionSigns: active
                        ? item.reactionSigns.filter((x) => x !== s)
                        : [...item.reactionSigns, s],
                    })
                  }
                >
                  {REACTION_SIGN_LABELS[s]}
                </Pill>
              );
            })}
          </div>
          {emergency ? (
            <a
              href="tel:107"
              className="flex items-center gap-2 rounded-2xl bg-health px-3 py-3 font-medium text-sm text-white"
            >
              <Phone className="size-4 shrink-0" aria-hidden />
              Si le cuesta respirar, se le hincha la cara o está decaído: llamá ya al 107 o al 911.
            </a>
          ) : (
            <p className="flex gap-2 text-health-foreground text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              Anotalo y consultá con la pediatra antes de volver a darle este alimento.
            </p>
          )}
        </div>
      )}

      {food?.caution && <p className="text-muted-foreground text-xs">⚠️ {food.caution}</p>}
    </li>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-muted-foreground text-xs">{label}</span>
      {children}
    </div>
  );
}

function Pill({
  active,
  tone = 'solid',
  onClick,
  children,
}: {
  active: boolean;
  tone?: 'solid' | 'health';
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'rounded-full px-3 py-1.5 text-sm ring-1 transition-colors',
        active
          ? tone === 'health'
            ? 'bg-health-soft text-health-foreground ring-health/40'
            : 'bg-solid-soft text-solid-foreground ring-solid/40'
          : 'bg-muted/50 text-foreground ring-transparent',
      )}
    >
      {children}
    </button>
  );
}

function listJoin(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} y ${items.at(-1)}`;
}
