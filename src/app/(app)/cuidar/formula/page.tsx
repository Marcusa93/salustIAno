import { PageHeader } from '@/components/salu/page-header';
import type { Metadata } from 'next';
import { getFormulaStockAction } from './actions';
import { FormulaClient } from './formula-client';

export const metadata: Metadata = {
  title: 'Stock de fórmula',
};

export default async function FormulaPage() {
  const result = await getFormulaStockAction();
  const stock = result.ok ? result.stock : null;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-10 px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader
        eyebrow="Cuidar · Salud"
        title="Stock de fórmula."
        description="Llevá la cuenta de cuántas cajas quedan y recibí una alerta cuando el stock baje del umbral."
      />
      <FormulaClient initialStock={stock} />
    </div>
  );
}
