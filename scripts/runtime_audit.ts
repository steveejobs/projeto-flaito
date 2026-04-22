
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

async function auditPart1() {
  console.log("--- Audit Part 1: Client Study Context ---");
  const { data, error } = await supabase.from('client_study_context').select('*').limit(1);
  if (error) console.error("Error fetching client_study_context:", error);
  else console.log("Success: Table exists and is readable. Sample count:", data.length);
}

async function auditPart2() {
  console.log("\n--- Audit Part 2: Assistant Action Logs ---");
  const { data, error } = await supabase.from('assistant_action_log').select('*').eq('action_type', 'tool_call').limit(5);
  if (error) console.error("Error fetching assistant_action_log:", error);
  else {
    console.log("Success: Tool calls are being logged.");
    data.forEach(log => console.log(`- Tool: ${log.tool_name} | Status: ${log.status}`));
  }
}

async function auditPart3() {
  console.log("\n--- Audit Part 3: Agent Config (Voice) ---");
  const { data, error } = await supabase.from('ai_agent_configs').select('slug, guardrails, is_active').eq('slug', 'voice-assistant').single();
  if (error) console.error("Error fetching voice config:", error);
  else {
    console.log("Success: Voice Agent centralized config found.");
    console.log(`- Slug: ${data.slug} | Active: ${data.is_active}`);
    console.log(`- Voice Settings (Metadata):`, JSON.stringify(data.guardrails));
  }
}

await auditPart1();
await auditPart2();
await auditPart3();
