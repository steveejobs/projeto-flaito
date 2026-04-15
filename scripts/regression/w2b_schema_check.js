import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SUPABASE_SERVICE_ROLE_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
  const tables = [
    'agent_profiles', 'automation_flows', 'flow_versions', 
    'automation_flow_nodes', 'automation_flow_edges', 
    'flow_runs', 'flow_run_steps', 'whatsapp_conversations', 
    'conversation_events', 'crm_leads', 'crm_activities'
  ];

  for(const table of tables) {
     const { error } = await supabase.from(table).select('id').limit(1);
     if(error) {
       console.log(`[ ] ${table} -> ERROR: ${error.message} (Code: ${error.code})`);
     } else {
       console.log(`[x] ${table} -> EXISTS`);
     }
  }
}
checkTables();
