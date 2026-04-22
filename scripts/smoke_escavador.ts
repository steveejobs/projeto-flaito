/**
 * scripts/smoke_escavador.ts
 * Smoke test for Escavador API integration (v2).
 * Verifies connectivity, auth, and basic endpoint reachability.
 */

import { EscavadorClient } from "../projeto-flaito/supabase/functions/_shared/escavador-client.ts";

async function runSmokeTest() {
  console.log("🚀 Starting Escavador Smoke Test...");
  
  const client = new EscavadorClient();
  const correlationId = `smoke-${Date.now()}`;

  try {
    console.log("📡 Testing /saldo endpoint...");
    const { data, status } = await client.obterSaldo(correlationId);
    
    console.log(`✅ Status: ${status}`);
    console.log(`✅ Balance: ${data.saldo_consumivel} credits`);
    
    if (status === 200) {
      console.log("\n🎉 SMOKE TEST PASSED: Escavador API is reachable and authorized.");
    } else {
      console.log("\n❌ SMOKE TEST FAILED: Unexpected status code.");
    }
  } catch (err: any) {
    console.error("\n❌ SMOKE TEST FAILED: Connection error.");
    console.error(`Error Code: ${err.code}`);
    console.error(`Message: ${err.message}`);
    Deno.exit(1);
  }
}

runSmokeTest();
