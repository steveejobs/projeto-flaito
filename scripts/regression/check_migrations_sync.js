import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SUPABASE_SERVICE_ROLE_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMigrations() {
   const { data, error } = await supabase.from('supabase_migrations.schema_migrations').select('*');
   if(error) {
     const { data: d2, error: e2 } = await supabase.from('schema_migrations').select('*');
     console.log('schema_migrations error:', e2 ? e2.message : `Found ${d2?.length} migrations in public`);
   } else {
     console.log('supabase_migrations.schema_migrations error:', error ? error.message : `Found ${data?.length} migrations in supabase_migrations`);
   }
}
checkMigrations();
