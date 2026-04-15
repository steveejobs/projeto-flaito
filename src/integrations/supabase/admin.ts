import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = typeof import.meta.env !== 'undefined' ? import.meta.env.VITE_SUPABASE_URL : process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = typeof import.meta.env !== 'undefined' ? import.meta.env.SUPABASE_SERVICE_ROLE_KEY : process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.warn('[SupabaseAdmin] Service role key not found. RLS might block operations.');
}

// Admin client to bypass RLS (Server-side ONLY)
export const supabaseAdmin = createClient<Database>(
  SUPABASE_URL || '', 
  SERVICE_ROLE_KEY || '', 
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);
