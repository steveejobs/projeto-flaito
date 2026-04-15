/**
 * QA: Verificação do Endpoint /me da Z-API
 * Este script valida a lógica que foi implementada na Edge Function 'whatsapp-admin'.
 */

async function verifyZapiMe(instanceId, token) {
  console.log(`\n--- Testando Endpoint /me ---`);
  console.log(`Instância: ${instanceId}`);
  
  const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/me`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Sucesso! Conexão validada.');
      console.log('Dados do Dispositivo:', JSON.stringify(data, null, 2));
    } else {
      console.error('❌ Falha na validação:', data.message || data);
    }
  } catch (err) {
    console.error('❌ Erro de Rede:', err.message);
  }
}

// Para o teste do Tech Lead, usaremos as credenciais que estavam no código anterior como exemplo de sucesso
const TEST_INSTANCE = "3D9BE5C1C6615024446051515B3654B4";
const TEST_TOKEN = "B8729574FA561F6F4CFA7FB4";

verifyZapiMe(TEST_INSTANCE, TEST_TOKEN);
