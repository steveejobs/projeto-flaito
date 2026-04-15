import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') || process.env.SUPABASE_URL || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function check() {
  const { data } = await supabaseAdmin.from('automation_rules').select('*');
  console.log(JSON.stringify(data, null, 2));
}

check();
