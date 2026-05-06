'use client';

import { SaluLogo } from '@/components/salu/salu-logo';
import { ThemeToggle } from '@/components/salu/theme-toggle';
import { durations, easeWarm } from '@/lib/motion';
import { motion } from 'motion/react';
import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="flex h-svh flex-col overflow-hidden bg-background">
      <header className="flex items-center justify-between px-6 py-5">
        <SaluLogo size="default" />
        <ThemeToggle />
      </header>

      <main className="-mt-8 flex flex-1 flex-col items-center justify-center px-6 text-center">
        <motion.h1
          className="max-w-2xl font-display font-normal text-4xl text-foreground leading-[1.1] tracking-[-0.02em] sm:text-5xl md:text-6xl"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: durations.page, ease: easeWarm }}
        >
          Salustiano ya nació.
        </motion.h1>

        <motion.p
          className="mt-5 max-w-md font-sans text-base text-muted-foreground leading-relaxed sm:text-lg"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: durations.slow, ease: easeWarm, delay: 0.2 }}
        >
          Esta es la Salu app — un lugar con IA para cuidarlo y compartir sus mejores momentos.
        </motion.p>

        <motion.div
          className="mt-10 flex flex-col items-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: durations.slow, ease: easeWarm, delay: 0.4 }}
        >
          <Link
            href="/signup"
            className="border-primary border-b-2 pb-0.5 font-display font-normal text-2xl text-foreground transition-colors duration-200 hover:text-primary sm:text-3xl"
          >
            Empezar.
          </Link>
          <p className="text-muted-foreground text-sm">
            ¿Ya tenés cuenta?{' '}
            <Link
              href="/login"
              className="underline underline-offset-4 transition-colors hover:text-foreground"
            >
              Iniciá sesión
            </Link>
          </p>
        </motion.div>
      </main>

      <footer className="py-4 text-center text-muted-foreground text-xs">
        Hecho con cuidado en Tucumán
      </footer>
    </div>
  );
}
