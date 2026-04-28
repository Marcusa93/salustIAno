'use client';

import { BottleIllustration } from '@/components/salu/illustrations/bottle';
import { HeartIllustration } from '@/components/salu/illustrations/heart';
import { MoonIllustration } from '@/components/salu/illustrations/moon';
import { ScaleIllustration } from '@/components/salu/illustrations/scale';
import { SaluLogo } from '@/components/salu/salu-logo';
import { ThemeToggle } from '@/components/salu/theme-toggle';
import { durations, easeWarm } from '@/lib/motion';
import { motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import type * as React from 'react';

function FadeSection({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: durations.slow, ease: easeWarm, delay }}
    >
      {children}
    </motion.div>
  );
}

const features = [
  {
    icon: <MoonIllustration />,
    text: 'Las noches que parecen eternas — cuántas veces tomó, cuánto durmió.',
  },
  {
    icon: <BottleIllustration />,
    text: 'Cada toma, cada pecho, cada fórmula. Sin papel, sin olvidar.',
  },
  {
    icon: <ScaleIllustration />,
    text: 'Los gramos que suman, los centímetros que crecen semana a semana.',
  },
  {
    icon: <HeartIllustration />,
    text: 'Los momentos que querés recordar, guardados para cuando sea grande.',
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between px-6 py-5">
        <SaluLogo size="default" />
        <ThemeToggle />
      </header>

      {/* Hero — pantalla completa */}
      <section className="flex min-h-[80svh] flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <motion.h1
          className="max-w-2xl font-display font-normal text-5xl text-foreground leading-[1.1] tracking-[-0.02em] sm:text-6xl md:text-7xl"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: durations.page, ease: easeWarm }}
        >
          Salustiano todavía no nació.
        </motion.h1>
        <motion.p
          className="mt-6 max-w-md font-sans text-lg text-muted-foreground sm:text-xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: durations.slow, ease: easeWarm, delay: 0.2 }}
        >
          Pero cuando llegue, este va a ser su lugar.
        </motion.p>
      </section>

      {/* Sección 2 — párrafo editorial */}
      <section className="flex justify-center px-6 py-20">
        <FadeSection className="max-w-prose text-center">
          <p className="font-sans text-foreground/80 text-lg leading-[1.75] sm:text-xl">
            Acá vamos a guardar todo lo que importa de los primeros meses. Las noches en vela, los
            gramos que van sumando, los momentos que querés recordar para siempre. Una sola app,
            solo para tu familia.
          </p>
        </FadeSection>
      </section>

      {/* Sección 3 — ítems con micro-ilustraciones */}
      <section className="flex justify-center px-6 py-12 pb-24">
        <div className="flex w-full max-w-sm flex-col gap-10">
          {features.map((f, i) => (
            <FadeSection key={f.text} delay={i * 0.08} className="flex items-start gap-5">
              <div className="mt-0.5 shrink-0 text-primary">{f.icon}</div>
              <p className="text-base text-foreground/75 leading-[1.65] sm:text-lg">{f.text}</p>
            </FadeSection>
          ))}
        </div>
      </section>

      {/* Sección 4 — CTA discreto */}
      <section className="flex justify-center px-6 py-20">
        <FadeSection className="text-center">
          <Link
            href="/signup"
            className="border-primary border-b-2 pb-0.5 font-display font-normal text-3xl text-foreground transition-colors duration-200 hover:text-primary sm:text-4xl"
          >
            Empezar.
          </Link>
          <p className="mt-4 text-muted-foreground text-sm">
            ¿Ya tenés cuenta?{' '}
            <Link
              href="/login"
              className="underline underline-offset-4 transition-colors hover:text-foreground"
            >
              Iniciá sesión
            </Link>
          </p>
        </FadeSection>
      </section>

      <footer className="border-border/50 border-t py-5 text-center text-muted-foreground text-xs">
        Hecho con cuidado en Tucumán
      </footer>
    </div>
  );
}
