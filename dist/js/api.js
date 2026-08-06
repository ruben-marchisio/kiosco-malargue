/* =============================================
   Cliente Supabase — única instancia compartida
   ============================================= */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// SUPABASE_URL y SUPABASE_ANON vienen de /js/config.js (cargado como script global)
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
