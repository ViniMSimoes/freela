const assert = require('node:assert');
const app = require('../src/server');

const PORT = 3099;

async function runTests() {
  console.log('\n--- INICIANDO TESTES AUTOMATIZADOS DO FREELA MVP ---');
  
  const server = app.listen(PORT);
  const baseUrl = `http://localhost:${PORT}/api`;

  try {
    // Teste 1: Obter Estatísticas
    console.log('• Teste 1: GET /api/stats');
    const resStats = await fetch(`${baseUrl}/stats`);
    assert.strictEqual(resStats.status, 200);
    const dataStats = await resStats.json();
    assert.strictEqual(dataStats.sucesso, true);
    assert.ok(dataStats.dados.total_ordens >= 0);
    console.log('  ✓ Estatísticas retornadas com sucesso.');

    // Teste 2: Listar Ordens
    console.log('• Teste 2: GET /api/ordens');
    const resOrdens = await fetch(`${baseUrl}/ordens`);
    assert.strictEqual(resOrdens.status, 200);
    const dataOrdens = await resOrdens.json();
    assert.strictEqual(dataOrdens.sucesso, true);
    assert.ok(Array.isArray(dataOrdens.dados));
    console.log(`  ✓ Total de ordens listadas: ${dataOrdens.total}`);

    // Teste 3: Criar Nova Ordem de Serviço
    console.log('• Teste 3: POST /api/ordens (Solicitação de Cliente)');
    const resNova = await fetch(`${baseUrl}/ordens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cliente_id: 1,
        categoria: 'Pintura',
        titulo: 'Pintura de Fachada Residencial',
        descricao: 'Aplicação de tinta acrílica lavável na parede externa com impermeabilizante.',
        cep: '27255-000',
        endereco: 'Rua 21, nº 45 - Volta Redonda/RJ',
        urgencia: 'MEDIA'
      })
    });
    assert.strictEqual(resNova.status, 201);
    const dataNova = await resNova.json();
    assert.strictEqual(dataNova.sucesso, true);
    const novaOrdemId = dataNova.dados.id;
    assert.ok(novaOrdemId > 0);
    console.log(`  ✓ Ordem criada com ID: ${novaOrdemId} (Status: ${dataNova.dados.status})`);

    // Teste 4: Prestador Envia Proposta
    console.log('• Teste 4: POST /api/ordens/:id/propostas (Envio de Proposta)');
    const resProp = await fetch(`${baseUrl}/ordens/${novaOrdemId}/propostas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prestador_id: 2,
        valor: 450.0,
        prazo_estimado: '2 dias úteis',
        mensagem: 'Tenho andaime e equipamento airless para pintura rápida.'
      })
    });
    assert.strictEqual(resProp.status, 201);
    const dataProp = await resProp.json();
    assert.strictEqual(dataProp.sucesso, true);
    const propostaId = dataProp.proposta_id;
    console.log(`  ✓ Proposta #${propostaId} registrada com sucesso.`);

    // Teste 5: Checkout com Retenção dos Fundos em Custódia (Escrow)
    console.log('• Teste 5: POST /api/ordens/:id/checkout (Retenção em Escrow)');
    const resCheckout = await fetch(`${baseUrl}/ordens/${novaOrdemId}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proposta_id: propostaId,
        metodo_pagamento: 'PIX',
        cupom: 'FREELA10'
      })
    });
    assert.strictEqual(resCheckout.status, 200);
    const dataCheckout = await resCheckout.json();
    assert.strictEqual(dataCheckout.sucesso, true);
    assert.strictEqual(dataCheckout.dados.status, 'EM_CUSTODIA');
    assert.strictEqual(dataCheckout.dados.valor_mao_obra, 450.0);
    console.log(`  ✓ Valor total R$ ${dataCheckout.dados.valor_total} retido com sucesso na custódia segura.`);

    // Teste 6: Prestador Atualiza Status de Execução
    console.log('• Teste 6: PATCH /api/ordens/:id/status (Avanço da Execução)');
    const resStatus1 = await fetch(`${baseUrl}/ordens/${novaOrdemId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ novo_status: 'EM_EXECUCAO' })
    });
    assert.strictEqual(resStatus1.status, 200);

    const resStatus2 = await fetch(`${baseUrl}/ordens/${novaOrdemId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        novo_status: 'AGUARDANDO_VISTORIA',
        foto_conclusao: 'https://images.unsplash.com/photo-584622650111-993a426fbf0a'
      })
    });
    assert.strictEqual(resStatus2.status, 200);
    console.log('  ✓ Ordem avançada para AGUARDANDO_VISTORIA com fotos comprobatórias.');

    // Teste 7: Cliente Realiza Vistoria e Aprova Conclusão (Liquidação do Escrow)
    console.log('• Teste 7: POST /api/ordens/:id/aprovar (Aprovação e Repasse)');
    const resAprovar = await fetch(`${baseUrl}/ordens/${novaOrdemId}/aprovar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cliente_id: 1,
        nota: 5,
        comentario: 'Pintura impecável, local limpo e serviço entregue antes do prazo!'
      })
    });
    assert.strictEqual(resAprovar.status, 200);
    const dataAprovar = await resAprovar.json();
    assert.strictEqual(dataAprovar.sucesso, true);
    assert.strictEqual(dataAprovar.status, 'CONCLUIDO');
    assert.strictEqual(dataAprovar.valor_liberado, 450.0);
    console.log(`  ✓ Vistoria aprovada! R$ ${dataAprovar.valor_liberado} liberados à carteira do prestador.`);

    console.log('\n======================================================');
    console.log(' TODOS OS 7 TESTES AUTOMATIZADOS PASSARAM COM SUCESSO! ');
    console.log('======================================================\n');
  } catch (err) {
    console.error('\n❌ FALHA NOS TESTES:', err);
    process.exitCode = 1;
  } finally {
    server.close();
  }
}

runTests();
