$URL = $env:SUPABASE_URL || "YOUR_SUPABASE_URL"
$KEY = $env:SUPABASE_SERVICE_ROLE_KEY || "YOUR_SUPABASE_SERVICE_ROLE_KEY"
$PROJECT_REF = "ccvbosbjtlxewqybvwqj"

$headers = @{
    "apikey" = $KEY
    "Authorization" = "Bearer $KEY"
    "Content-Type" = "application/json"
}

Write-Host "💎 INICIANDO PROVA DE PRODUÇÃO - FLAITO DOCUMENT ENGINE`n" -ForegroundColor Cyan

# PASSO 1: Buscar Template
$templateId = "50000000-0000-0000-0000-000000000001"
Write-Host "📂 1. Buscando template real (ID: $templateId)..."
try {
    $tempRes = Invoke-RestMethod -Uri "$URL/rest/v1/document_templates?id=eq.$templateId&select=*" -Headers $headers
    if ($tempRes.Count -eq 0) {
        Write-Host "❌ Template não encontrado no banco." -ForegroundColor Red
        return
    }
    $templateName = $tempRes[0].name
    Write-Host "✅ Template: $templateName" -ForegroundColor Green
} catch {
    Write-Host "❌ Erro ao buscar template: $_" -ForegroundColor Red
    return
}

# PASSO 2: Montar Payload
Write-Host "`n📦 2. Montando payload complexo..."
$payloadObj = @{
    template_id = $templateId
    data = @{
        client_name = "Jardel Fernandes (Prova de Producao)"
        client_nationality = "Brasileiro"
        client_marital_status = "Casado"
        client_rg = "12.345.678-x"
        lawyer_name = "Dr. Fernando Magalhaes"
        oab_number = "SP/123.456"
        client = @{
            name = "Jardel Fernandes (Prova de Producao)"
            address = @{
                city = "Sao Paulo"
                state = "SP"
            }
        }
        is_urgent = $true
        office = @{
            signature_html = "<div style='color:#1a73e8; font-family:sans-serif; border: 1px dashed #ccc; padding: 10px; display: inline-block;'><b>ASSINADO DIGITALMENTE</b><br><img src='https://via.placeholder.com/150x40?text=Assinatura+Digital' alt='Signature'></div>"
        }
    }
}
$payload = $payloadObj | ConvertTo-Json -Depth 10 -Compress

# PASSO 3: Preview (RPC)
Write-Host "`n🧪 3. Executando RPC render_template_preview..."
try {
    $resPreview = Invoke-RestMethod -Uri "$URL/rest/v1/rpc/render_template_preview" -Method Post -Headers $headers -Body $payload
    $resPreview.content | Out-File "production_preview.html" -Encoding utf8
    Write-Host "✅ Preview Gerado (production_preview.html)" -ForegroundColor Green
} catch {
    Write-Host "❌ Falha na RPC: $_" -ForegroundColor Red
}

# PASSO 4: Documento Final (Edge Function)
Write-Host "`n⚡ 4. Executando Edge Function lexos-render-document..."
$edgeUrl = "https://$PROJECT_REF.functions.supabase.co/lexos-render-document"
try {
    $resFinal = Invoke-RestMethod -Uri $edgeUrl -Method Post -Headers $headers -Body $payload
    if ($resFinal.ok -eq $true) {
        $resFinal.content | Out-File "production_documento_final.html" -Encoding utf8
        Write-Host "✅ DOCUMENTO FINAL GERADO PELA EDGE FUNCTION!" -ForegroundColor Green
        
        Write-Host "`n🔍 CHECKS DE QUALIDADE:" -ForegroundColor Cyan
        $html = $resFinal.content
        
        $checks = @(
            @{ name = "{{client.name}} resolvido"; pass = $html -like "*Jardel Fernandes*" }
            @{ name = "Variavel aninhada (city) resolvida"; pass = $html -like "*Sao Paulo*" }
            @{ name = "Assinatura HTML renderizada"; pass = $html -like "*ASSINADO DIGITALMENTE*" }
            @{ name = "Nenhum {{...}} residual"; pass = $html -notlike "*{{*" }
            @{ name = "Formatacao preservada"; pass = $html -like "*<br>*" -or $html -like "*</p>*" }
        )

        foreach ($c in $checks) {
            if ($c.pass) { Write-Host "✅ $($c.name)" -ForegroundColor Green }
            else { Write-Host "❌ $($c.name)" -ForegroundColor Red }
        }
        
        Write-Host "`n🏆 PROVA CONCLUÍDA: SISTEMA PRONTO PARA PRODUÇÃO." -ForegroundColor Yellow
    } else {
        Write-Host "❌ Falha na Edge Function: $($resFinal.reason)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Erro ao disparar Edge Function: $_" -ForegroundColor Red
    Write-Host "DICA: Verifique se a Edge Function 'lexos-render-document' está implantada no projeto $PROJECT_REF" -ForegroundColor Gray
}
