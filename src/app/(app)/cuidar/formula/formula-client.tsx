'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { AlertTriangle, ChevronDown, ChevronUp, Minus, Plus, Settings } from 'lucide-react';
import { type FormEvent, useCallback, useState, useTransition } from 'react';
import { toast } from 'sonner';
import type { FormulaSettingsInput, FormulaStockRow } from './actions';
import { adjustFormulaStockAction, saveFormulaSettingsAction } from './actions';

interface Props {
  initialStock: FormulaStockRow | null;
}

export function FormulaClient({ initialStock }: Props) {
  const [stock, setStock] = useState(initialStock);
  const [showSettings, setShowSettings] = useState(initialStock === null);
  const [isPending, startTransition] = useTransition();

  const isLow = stock !== null && stock.current_boxes <= stock.alert_threshold;

  // ─── contador ───────────────────────────────────────────────────────────────

  function handleAdjust(delta: number) {
    if (stock === null) {
      toast.error('Configurá el stock primero.');
      return;
    }
    startTransition(async () => {
      const result = await adjustFormulaStockAction(delta);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setStock((prev) => (prev ? { ...prev, current_boxes: result.current_boxes } : prev));
      if (delta > 0)
        toast.success(
          `+${delta} caja${delta === 1 ? '' : 's'} registrada${delta === 1 ? '' : 's'}.`,
        );
    });
  }

  // ─── settings form ──────────────────────────────────────────────────────────

  const [form, setForm] = useState<FormulaSettingsInput>({
    alert_threshold: stock?.alert_threshold ?? 10,
    ml_per_box: stock?.ml_per_box ?? 200,
    brand: stock?.brand ?? '',
    current_boxes: stock?.current_boxes,
  });
  const [saving, setSaving] = useState(false);

  const handleFormChange = useCallback(
    (field: keyof FormulaSettingsInput, value: string | number) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  async function handleSaveSettings(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await saveFormulaSettingsAction({
        alert_threshold: Number(form.alert_threshold),
        ml_per_box: Number(form.ml_per_box),
        brand: form.brand?.trim() || undefined,
        current_boxes: stock === null ? Number(form.current_boxes ?? 0) : undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Configuración guardada.');
      setStock((prev) => ({
        id: prev?.id ?? '',
        current_boxes:
          stock === null ? Number(form.current_boxes ?? 0) : (prev?.current_boxes ?? 0),
        alert_threshold: Number(form.alert_threshold),
        ml_per_box: Number(form.ml_per_box),
        brand: form.brand?.trim() || null,
        updated_at: new Date().toISOString(),
      }));
      setShowSettings(false);
    } finally {
      setSaving(false);
    }
  }

  // ─── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      {/* Alerta de stock bajo */}
      {isLow && (
        <div
          className={cn(
            'flex items-start gap-3 rounded-xl border px-4 py-3',
            'border-accent/60 bg-accent/20 text-accent-foreground',
          )}
          role="alert"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p className="text-sm leading-snug">
            <strong>Stock bajo.</strong> Quedan {stock.current_boxes} caja
            {stock.current_boxes === 1 ? '' : 's'}. {stock.brand ? `(${stock.brand}) ` : ''}
            ¡Es momento de comprar!
          </p>
        </div>
      )}

      {/* Contador principal */}
      <Card className="flex flex-col items-center gap-6 px-6 py-10">
        {stock === null ? (
          <p className="text-center text-muted-foreground text-sm">
            Configurá el stock inicial desde los ajustes de abajo.
          </p>
        ) : (
          <>
            {stock.brand && (
              <p className="text-center text-muted-foreground text-xs uppercase tracking-wide">
                {stock.brand}
              </p>
            )}
            <div className="flex items-center gap-6">
              <Button
                variant="outline"
                size="icon"
                className="size-14 rounded-full text-xl"
                onClick={() => handleAdjust(-1)}
                disabled={isPending || stock.current_boxes === 0}
                aria-label="Restar una caja"
              >
                <Minus className="size-5" aria-hidden />
              </Button>

              <div className="flex min-w-[7rem] flex-col items-center gap-1">
                <span
                  className={cn(
                    'font-display font-semibold text-7xl tabular-nums leading-none',
                    isLow ? 'text-accent-foreground' : 'text-foreground',
                  )}
                >
                  {stock.current_boxes}
                </span>
                <span className="text-muted-foreground text-sm">
                  caja{stock.current_boxes === 1 ? '' : 's'}
                </span>
              </div>

              <Button
                variant="outline"
                size="icon"
                className="size-14 rounded-full text-xl"
                onClick={() => handleAdjust(+1)}
                disabled={isPending}
                aria-label="Agregar una caja"
              >
                <Plus className="size-5" aria-hidden />
              </Button>
            </div>

            <div className="flex gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleAdjust(+6)}
                disabled={isPending}
                className="gap-1.5"
              >
                <Plus className="size-3.5" aria-hidden />
                Compré 6
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleAdjust(+12)}
                disabled={isPending}
                className="gap-1.5"
              >
                <Plus className="size-3.5" aria-hidden />
                Compré 12
              </Button>
            </div>

            <p className="text-muted-foreground text-xs">
              {stock.ml_per_box} ml/caja · alerta con ≤{stock.alert_threshold} caja
              {stock.alert_threshold === 1 ? '' : 's'}
            </p>
          </>
        )}
      </Card>

      {/* Panel de ajustes */}
      <div className="flex flex-col gap-0">
        <button
          type="button"
          onClick={() => setShowSettings((s) => !s)}
          className="flex items-center gap-2 self-start rounded-md py-1 text-muted-foreground text-sm hover:text-foreground focus-visible:outline-ring"
          aria-expanded={showSettings}
        >
          <Settings className="size-4" aria-hidden />
          Ajustes de stock
          {showSettings ? (
            <ChevronUp className="size-4" aria-hidden />
          ) : (
            <ChevronDown className="size-4" aria-hidden />
          )}
        </button>

        {showSettings && (
          <Card className="mt-3 px-4 py-5">
            <form onSubmit={handleSaveSettings} className="flex flex-col gap-4">
              {stock === null && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="current_boxes">Cajas actuales</Label>
                  <Input
                    id="current_boxes"
                    type="number"
                    min={0}
                    max={9999}
                    value={form.current_boxes ?? 0}
                    onChange={(e) => handleFormChange('current_boxes', e.target.value)}
                    required
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ml_per_box">ml por caja</Label>
                  <Input
                    id="ml_per_box"
                    type="number"
                    min={1}
                    max={9999}
                    value={form.ml_per_box}
                    onChange={(e) => handleFormChange('ml_per_box', e.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="alert_threshold">Alerta al llegar a</Label>
                  <div className="relative">
                    <Input
                      id="alert_threshold"
                      type="number"
                      min={0}
                      max={999}
                      value={form.alert_threshold}
                      onChange={(e) => handleFormChange('alert_threshold', e.target.value)}
                      required
                      className="pr-14"
                    />
                    <span className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-3 text-muted-foreground text-xs">
                      cajas
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="brand">Marca (opcional)</Label>
                <Input
                  id="brand"
                  type="text"
                  maxLength={100}
                  placeholder="Ej: Nan Comfort"
                  value={form.brand ?? ''}
                  onChange={(e) => handleFormChange('brand', e.target.value)}
                />
              </div>

              <Button type="submit" disabled={saving} className="w-full sm:w-auto sm:self-end">
                {saving ? 'Guardando…' : 'Guardar ajustes'}
              </Button>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}
