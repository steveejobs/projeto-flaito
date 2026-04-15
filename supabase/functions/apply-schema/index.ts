import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import postgres from 'https://deno.land/x/postgresjs@v3.3.4/mod.js'

serve(async (req) => {
    const { sql: sqlContent } = await req.json()

    const databaseUrl = Deno.env.get("SUPABASE_DB_URL") || "postgresql://postgres:2*XN$+4qt_W@uyG@db.ccvbosbjtlxewqybvwqj.supabase.co:5432/postgres"

    try {
        const sql = postgres(databaseUrl, { ssl: 'require' })

        console.log("Executing SQL...")
        // Split SQL by statements if necessary, but postgres() handles large strings
        // We'll execute the whole thing
        await sql.unsafe(sqlContent)

        return new Response(JSON.stringify({ success: true, message: "Schema applied successfully" }), {
            headers: { "Content-Type": "application/json" },
        })
    } catch (error) {
        console.error(error)
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        })
    }
})
