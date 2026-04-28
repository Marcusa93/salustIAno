import type { Metadata } from 'next';
import type * as React from 'react';

export const metadata: Metadata = {
  title: 'Empezar',
};

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
