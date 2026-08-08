/* =============================================
   Kiosco Digital — Supabase client + utilidades
   Importado por todos los módulos del admin
   ============================================= */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

export const CAT_EMOJI = {
  bebidas: '🥤',
  alcohol: '🍺',
  snacks: '🍫',
  comidas: '🍽️',
  panaderia: '🥐',
  almacen: '🏪',
  verduleria: '🥦',
  limpieza: '🧹',
  otros: '📦',
};

/** Formatea número como moneda argentina */
export const fmt = (n) => Number(n).toLocaleString('es-AR');
