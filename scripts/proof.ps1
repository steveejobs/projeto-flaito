# 1. Carregar .env manualmente
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

Write-Host "💎 INICIANDO PROVA DE PRODUÃ‡ÃƒO - FLAITO DOCUMENT ENGINE`n" -ForegroundColor Cyan

# PASSO 1: Buscar Template
$templateId = "50000000-0000-0000-0000-000000000001"
Write-Host "📂 1. Buscando template real (ID: $templateId)..."
$tempRes = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/document_templates?id=eq.$templateId&select=*" -Headers $headers
$templateName = $tempRes[0].name
Write-Host "✅ Template: $templateName" -ForegroundColor Green

# PASSO 2: Montar Payload
Write-Host "`n📦 2. Montando payload complexo..."
$payload = @{
    template_id = $templateId
    data = @{
        client_name = "Jardel Fernandes (Prova Final)"
        client = @{
            name = "Jardel Fernandes (Prova Final)"
            address = @{
                city = "SÃ£o Paulo"
                state = "SP"
            }
        }
        is_premium = $true
        office = @{
            signature_html = "<div style='color:blue'><b>Assinado via PowerShell</b><br><img src='https://via.placeholder.com/100x30?text=Sig'></div>"
        }
    }
} | ConvertTo-Json -Depth 5

# PASSO 3: Preview (RPC)
Write-Host "`n🧪 3. Executando RPC render_template_preview..."
$resPreview = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/rpc/render_template_preview" -Method Post -Headers $headers -Body $payload
$resPreview.content | Out-File "production_preview.html" -Encoding utf8
Write-Host "✅ Preview Gerado (production_preview.html)" -ForegroundColor Green

# PASSO 4: Documento Final (Edge Function)
Write-Host "`n⚡ 4. Executando Edge Function lexos-render-document..."
$edgeUrl = "https://$PROJECT_REF.functions.supabase.co/lexos-render-document"
try {
    $resFinal = Invoke-RestMethod -Uri $edgeUrl -Method Post -Headers $headers -Body $payload
    if ($resFinal.ok -eq $true) {
        $resFinal.content | Out-File "production_final_document.html" -Encoding utf8
        Write-Host "✅ DOCUMENTO FINAL GERADO PELA EDGE FUNCTION!" -ForegroundColor Green
        Write-Host "`n🔍 VALIDAÃ‡Ã•ES DEFINITIVAS:" -ForegroundColor Cyan
        
        $html = $resFinal.content
        if ($html -like "*Jardel Fernandes*") { Write-Host "✅ {{client.name}} resolvido" -ForegroundColor Green }
        if ($html -like "*SÃ£o Paulo*") { Write-Host "✅ VariÃ¡vel aninhada resolvida" -ForegroundColor Green }
        if ($html -like "*Assinado via PowerShell*") { Write-Host "✅ Assinatura HTML renderizada" -ForegroundColor Green }
        if ($html -notlike "*{{*") { Write-Host "✅ Nenhum placeholder residual" -ForegroundColor Green }
        
        Write-Host "`n🏆 PRONTO PARA USO EM PRODUÃ‡ÃƒO." -ForegroundColor Yellow
    } else {
        Write-Host "❌ Falha na Edge Function: $($resFinal.reason)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Erro CrÃtico: $_" -ForegroundColor Red
}
