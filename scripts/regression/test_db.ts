import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function checkSchema() {
  const { data, error } = await supabase.rpc('inspect_table_columns', { table_name: 'clients' });
  
  if (error) {
    // If RPC doesn't exist, try a direct query to information_schema
    const { data: cols, error: colsError } = await supabase.from('clients').select().limit(0);
    if (colsError) {
      console.error("Error fetching columns:", colsError);
    } else {
      console.log("Columns in 'clients' table:");
      // Direct select limit 0 doesn't give column names in a useful way here, 
      // let's try a better approach using PostgREST's OpenAPI spec or similar if we can.
      // Actually, we can use a raw SQL if we have a way to run it.
    }
  } else {
    console.log(data);
  }
}

// Since I can't easily run raw SQL via the client without an RPC, 
// I'll try to insert a dummy record and see if it fails and why.
async function testInsert() {
  console.log("Testing insert into 'clients'...");
  const { data, error } = await supabase.from('clients').insert({
    full_name: "Test Client",
    office_id: "00000000-0000-0000-0000-000000000000", // Will likely fail FK if it doesn't exist
    person_type: "PF"
  }).select();

  if (error) {
    console.log("Insert failed as expected or with error:", error.message);
  } else {
    console.log("Insert succeeded:", data);
  }
}

async function run() {
  await checkSchema();
  await testInsert();
}

run();
