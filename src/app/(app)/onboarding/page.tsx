'use client';

import { FormField } from '@/components/salu/form-field';
import { Stepper } from '@/components/salu/stepper';
import { Button } from '@/components/ui/button';
import { durations, easings } from '@/lib/motion';
import { zodResolver } from '@/lib/zod-compat';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

const step1Schema = z.object({
  familyName: z.string().min(1, 'El nombre de familia es obligatorio').max(100),
});

const step2Schema = z.object({
  babyName: z.string().min(1, 'El nombre del bebé es obligatorio').max(100),
});

const step3Schema = z.object({
  birthDate: z.string().optional(),
  gestationalWeeks: z
    .string()
    .optional()
    .refine(
      (v) => !v || (Number(v) >= 20 && Number(v) <= 45),
      'Las semanas gestacionales deben estar entre 20 y 45',
    ),
});

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;
type Step3Data = z.infer<typeof step3Schema>;

const TOTAL_STEPS = 4;

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
};

const transition = {
  duration: durations.slow,
  ease: easings.easeWarm,
};

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [step1Data, setStep1Data] = useState<Step1Data | null>(null);
  const [step2Data, setStep2Data] = useState<Step2Data | null>(null);
  const [step3Data, setStep3Data] = useState<Step3Data | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const step1Form = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    mode: 'onBlur',
  });

  const step2Form = useForm<Step2Data>({
    resolver: zodResolver(step2Schema),
    mode: 'onBlur',
  });

  const step3Form = useForm<Step3Data>({
    resolver: zodResolver(step3Schema),
    mode: 'onBlur',
  });

  function goTo(next: number) {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  }

  function handleStep1(data: Step1Data) {
    setStep1Data(data);
    goTo(2);
  }

  function handleStep2(data: Step2Data) {
    setStep2Data(data);
    goTo(3);
  }

  function handleStep3(data: Step3Data) {
    setStep3Data(data);
    goTo(4);
  }

  async function handleConfirm() {
    setIsSubmitting(true);
    await new Promise((r) => setTimeout(r, 600));
    setIsSubmitting(false);
    toast.success('¡Perfil creado (placeholder)!');
  }

  const stepTitles = [
    'Empecemos por la familia. ¿Cómo se llama?',
    'Y ahora, contame de Salu.',
    '¿Cuándo nació o va a nacer?',
    '¡Todo listo para empezar!',
  ];

  return (
    <div className="mx-auto flex max-w-md flex-col gap-8">
      <div className="flex flex-col gap-2">
        {step > 1 && (
          <button
            type="button"
            onClick={() => goTo(step - 1)}
            aria-label="Volver al paso anterior"
            className="-ml-1 mb-1 flex items-center gap-1 self-start text-muted-foreground text-sm transition-colors hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
            Atrás
          </button>
        )}
        <Stepper steps={TOTAL_STEPS} current={step} />
        <h1 className="mt-2 font-semibold text-2xl tracking-tight">{stepTitles[step - 1]}</h1>
      </div>

      <div className="overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          {step === 1 && (
            <motion.div
              key="step-1"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={transition}
            >
              <form
                onSubmit={step1Form.handleSubmit(handleStep1)}
                noValidate
                className="flex flex-col gap-6"
              >
                <div className="flex flex-col gap-1">
                  <FormField
                    id="family-name"
                    label="Nombre de familia"
                    type="text"
                    placeholder="Los Rossi"
                    error={step1Form.formState.errors.familyName?.message}
                    {...step1Form.register('familyName')}
                  />
                  <p className="px-0.5 text-muted-foreground text-xs">
                    Por ejemplo: Familia Pérez, Los abuelos, Casa Rossi…
                  </p>
                </div>
                <div className="flex justify-end">
                  <motion.div
                    animate={
                      step1Form.formState.isValid ? { scale: [0.95, 1.02, 1] } : { scale: 1 }
                    }
                    transition={{ duration: durations.fast }}
                  >
                    <Button
                      type="submit"
                      disabled={step1Form.formState.isSubmitted && !step1Form.formState.isValid}
                    >
                      Siguiente
                    </Button>
                  </motion.div>
                </div>
              </form>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step-2"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={transition}
            >
              <form
                onSubmit={step2Form.handleSubmit(handleStep2)}
                noValidate
                className="flex flex-col gap-6"
              >
                <div className="flex flex-col gap-1">
                  <FormField
                    id="baby-name"
                    label="Nombre del bebé"
                    type="text"
                    placeholder="Salustiano"
                    error={step2Form.formState.errors.babyName?.message}
                    {...step2Form.register('babyName')}
                  />
                  <p className="px-0.5 text-muted-foreground text-xs">
                    El nombre del bebé. Lo podés editar después.
                  </p>
                </div>
                <div className="flex justify-end">
                  <motion.div
                    animate={
                      step2Form.formState.isValid ? { scale: [0.95, 1.02, 1] } : { scale: 1 }
                    }
                    transition={{ duration: durations.fast }}
                  >
                    <Button
                      type="submit"
                      disabled={step2Form.formState.isSubmitted && !step2Form.formState.isValid}
                    >
                      Siguiente
                    </Button>
                  </motion.div>
                </div>
              </form>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step-3"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={transition}
            >
              <form
                onSubmit={step3Form.handleSubmit(handleStep3)}
                noValidate
                className="flex flex-col gap-6"
              >
                <FormField
                  id="birth-date"
                  label="Fecha de nacimiento (opcional)"
                  type="date"
                  error={step3Form.formState.errors.birthDate?.message}
                  {...step3Form.register('birthDate')}
                />
                <FormField
                  id="gestational-weeks"
                  label="Semanas gestacionales al nacer (opcional)"
                  type="number"
                  placeholder="40"
                  error={step3Form.formState.errors.gestationalWeeks?.message}
                  {...step3Form.register('gestationalWeeks')}
                />
                <div className="flex justify-end">
                  <Button type="submit">Siguiente</Button>
                </div>
              </form>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="step-4"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={transition}
            >
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-3">
                  <div className="rounded-xl border border-border bg-muted/30 p-4">
                    <p className="mb-1 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                      Familia
                    </p>
                    <p className="font-medium">{step1Data?.familyName}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/30 p-4">
                    <p className="mb-1 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                      Bebé
                    </p>
                    <p className="font-medium">{step2Data?.babyName}</p>
                    {step3Data?.birthDate && (
                      <p className="mt-0.5 text-muted-foreground text-sm">
                        Nacimiento: {step3Data.birthDate}
                      </p>
                    )}
                    {step3Data?.gestationalWeeks && (
                      <p className="mt-0.5 text-muted-foreground text-sm">
                        {step3Data.gestationalWeeks} semanas gestacionales
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleConfirm} disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Guardando…
                      </>
                    ) : (
                      'Empezar.'
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
