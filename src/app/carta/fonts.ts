import { Caveat } from 'next/font/google';

// Letra manuscrita solo para las cartas: no se descarga en el resto de la app.
export const caveat = Caveat({
  variable: '--font-caveat',
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
});
