$envFile = Get-Content .env
$env = @{}
foreach ($line in $envFile) {
    if ($line -match "^([^=]+)=(.*)$") {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        $env[$key] = $value
    }
}

$SUPABASE_URL = $env["VITE_SUPABASE_URL"]
if (!$SUPABASE_URL) { $SUPABASE_URL = $env["SUPABASE_URL"] }
$SUPABASE_KEY = $env["SUPABASE_SERVICE_ROLE_KEY"]
$PROJECT_REF = $SUPABASE_URL.Split('//')[1].Split('.')[0]

$headers = @{
    "apikey" = $SUPABASE_KEY
    "Authorization" = "Bearer $SUPABASE_KEY"
    "Content-Type" = "application/json"
}

Write-Host "🚀 INICIANDO VALIDAÇÃO FINAL VIA POWERSHELL`n" -ForegroundColor Cyan

# 1. Teste Procuração Raw
Write-Host "🧪 Testando motor de renderização (Procuração)..."
$bodyProc = @{
    p_content = "<h1>PROCURAÇÃO</h1><p>OUTORGANTE: {{client.name}}</p><p>CIDADE: {{client.address.city}}</p>{{#if urgent}}<p>URGENTE</p>{{/if}}<br>{{{office.signature_html}}}"
    p_data = @{
        "client.name" = "Jardel Fernandes"
        "client.address.city" = "São Paulo"
        "urgent" = $true
        "office.signature_html" = "<img src='sig.png'>"
    }
} | ConvertTo-Json

$resProc = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/rpc/render_template_preview_raw" -Method Post -Headers $headers -Body $bodyProc
$resProc | Out-File "resultado_procuracao.html"

if ($resProc -like "*Jardel Fernandes*" -and $resProc -like "*São Paulo*" -and $resProc -like "*URGENTE*" -and $resProc -like "*<img src='sig.png'>*") {
    Write-Host "✅ Teste Procuração: PASSOU" -ForegroundColor Green
} else {
    Write-Host "❌ Teste Procuração: FALHOU" -ForegroundColor Red
}

# 2. Teste Contrato Raw (Condicional False)
Write-Host "`n🧪 Testando motor de renderização (Contrato - Else)..."
$bodyCont = @{
    p_content = "<h2>CONTRATO</h2>{{#if has_discount}}<p>Desconto</p>{{else}}<p>VALOR INTEGRAL</p>{{/if}}"
    p_data = @{
        "has_discount" = $false
    }
} | ConvertTo-Json

$resCont = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/rpc/render_template_preview_raw" -Method Post -Headers $headers -Body $bodyCont
$resCont | Out-File "resultado_contrato.html"

if ($resCont -like "*VALOR INTEGRAL*" -and $resCont -notlike "*Desconto*") {
    Write-Host "✅ Teste Contrato: PASSOU" -ForegroundColor Green
} else {
    Write-Host "❌ Teste Contrato: FALHOU" -ForegroundColor Red
}

# 3. Integração Edge Function
Write-Host "`n⚡ Testando integração Edge Function..."
$bodyE2E = @{
    template_id = "50000000-0000-0000-0000-000000000001"
    data = @{
        "client_name" = "Validacao E2E PowerShell"
    }
} | ConvertTo-Json

try {
    $resE2E = Invoke-RestMethod -Uri "https://$PROJECT_REF.functions.supabase.co/lexos-render-document" -Method Post -Headers $headers -Body $bodyE2E
    if ($resE2E.ok -eq $true) {
        Write-Host "✅ Integração Edge Function: PASSOU" -ForegroundColor Green
        $resE2E.content | Out-File "e2e_integration_output.html"
    } else {
        Write-Host "⚠️ Integração Edge Function: FALHOU (Reason: $($resE2E.reason))" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Erro ao chamar Edge Function: $_" -ForegroundColor Red
}

Write-Host "`n🏁 VALIDAÇÃO CONCLUÍDA." -ForegroundColor Cyan
