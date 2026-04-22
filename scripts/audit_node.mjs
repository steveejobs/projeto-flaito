
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

async function audit() {
  try {
    console.log("=== Athena Runtime Audit (Node.js) ===\n");

    // Part 1
    const { data: study } = await supabase.from('client_study_context').select('client_id').limit(1);
    console.log(`[PART 1] Client Study Context: ${study && study.length > 0 ? 'ACTIVE (Data Found)' : 'INACTIVE (No rows found)'}`);

    // Part 2
    const { data: logs } = await supabase.from('assistant_action_log').select('tool_name, status').eq('action_type', 'tool_call').limit(3);
    console.log(`[PART 2] Tool Audit Logs: ${logs && logs.length > 0 ? 'OPERATIONAL (' + logs.length + ' entries found)' : 'NOT FOUND'}`);
    if (logs) logs.forEach(l => console.log(`   -> Tool: ${l.tool_name} (${l.status})`));

    // Part 3
    const { data: config } = await supabase.from('ai_agent_configs').select('slug, guardrails').eq('slug', 'voice-assistant').maybeSingle();
    console.log(`[PART 3] Voice Config: ${config ? 'CENTRALIZED (Found)' : 'NOT FOUND'}`);
    if (config) console.log(`   -> Metadata: ${JSON.stringify(config.guardrails)}`);

  } catch (e) {
    console.error("Audit failed:", e.message);
  }
}

audit();
