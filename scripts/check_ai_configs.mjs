import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), 'projeto-flaito', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConfigs() {
  const { data, error } = await supabase
    .from('ai_agent_configs')
    .select('*');

  if (error) {
    console.error('Error fetching ai_agent_configs:', error);
    return;
  }

  console.log('--- ai_agent_configs ---');
  data.forEach(config => {
    console.log(`Slug: ${config.slug}, Name: ${config.friendly_name}, Office: ${config.office_id}, Metadata: ${JSON.stringify(config.metadata)}`);
  });
}

checkConfigs();
