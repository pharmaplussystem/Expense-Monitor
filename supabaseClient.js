import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://rkegmwocdscysavxhbcd.supabase.co";
const SUPABASE_PUBLIC_KEY = "sb_publishable_B1InzjM_PPhxIpTiQzMr5w_pGc207Pg";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage
  }
});

export { SUPABASE_URL, SUPABASE_PUBLIC_KEY };

// Shared browser client. The app imports this module; the global reference is only for debugging/compatibility.
window.__supabaseClient = supabase;
