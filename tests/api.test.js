const assert = require('node:assert');
const app = require('../src/server');

const PORT = 3099;

async function runTests() {
  console.log('\n--- INICIANDO SUÍTE COMPLETA DE TESTES, SEGURANÇA & NOVAS FUNÇÕES ---');
  
  const server = app.listen(PORT);
  const baseUrl = `http://localhost:${PORT}/api`;

  try {
    // Teste 1: Obter Estatísticas
    console.log('• Teste 1: GET /api/stats (Estatísticas do Dashboard)');
    const resStats = await fetch(`${baseUrl}/stats`);
    assert.strictEqual(resStats.status, 200);
    const dataStats = await resStats.json();
    assert.strictEqual(dataStats.sucesso, true);
    console.log('  ✓ Estatísticas retornadas com sucesso.');

    // Teste 2: Verificação de Cabeçalhos de Segurança (OWASP / Helmet)
    console.log('• Teste 2: Verificação de Cabeçalhos HTTP de Segurança (Helmet)');
    assert.strictEqual(resStats.headers.get('x-content-type-options'), 'nosniff');
    assert.strictEqual(resStats.headers.get('x-frame-options'), 'SAMEORIGIN');
    assert.strictEqual(resStats.headers.get('x-powered-by'), null);
    console.log('  ✓ Cabeçalhos de segurança ativos (X-Content-Type-Options: nosniff, X-Powered-By omitido).');

    // Teste 3: Listar Ordens
    console.log('• Teste 3: GET /api/ordens (Listagem de Chamados)');
    const resOrdens = await fetch(`${baseUrl}/ordens`);
    assert.strictEqual(resOrdens.status, 200);
    const dataOrdens = await resOrdens.json();
    assert.strictEqual(dataOrdens.sucesso, true);
    assert.ok(Array.isArray(dataOrdens.dados));
    console.log(`  ✓ Total de ordens listadas: ${dataOrdens.total}`);

    // Teste 4: Criar Nova Ordem com Sanitização de XSS
    console.log('• Teste 4: POST /api/ordens (Criação de Chamado com Sanitização)');
    const resNova = await fetch(`${baseUrl}/ordens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cliente_id: 1,
        categoria: 'Pintura',
        titulo: 'Pintura de Fachada <script>alert("xss")</script>',
        descricao: 'Aplicação de tinta acrílica lavável na parede externa com impermeabilizante.',
        cep: '27255-000',
        endereco: 'Rua 21, nº 45 - Volta Redonda/RJ',
        urgencia: 'MEDIA'
      })
    });
    assert.strictEqual(resNova.status, 201);
    const dataNova = await resNova.json();
    assert.strictEqual(dataNova.sucesso, true);
    assert.strictEqual(dataNova.dados.titulo.includes('<script>'), false);
    const novaOrdemId = dataNova.dados.id;
    console.log(`  ✓ Ordem criada com ID ${novaOrdemId} e payload malicioso sanitizado com sucesso.`);

    // Teste 5: Segurança - Rejeição de Proposta com Valor Negativo
    console.log('• Teste 5: POST /api/ordens/:id/propostas (Validação de Valor Negativo)');
    const resPropNegativa = await fetch(`${baseUrl}/ordens/${novaOrdemId}/propostas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prestador_id: 2,
        valor: -150.0,
        prazo_estimado: '1 dia'
      })
    });
    assert.strictEqual(resPropNegativa.status, 400);
    console.log('  ✓ Proposta inválida com valor negativo bloqueada com sucesso (HTTP 400).');

    // Teste 6: Prestador Envia Proposta Válida
    console.log('• Teste 6: POST /api/ordens/:id/propostas (Envio de Proposta Válida)');
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
    const propostaId = dataProp.proposta_id;
    console.log(`  ✓ Proposta #${propostaId} registrada com sucesso.`);

    // Teste 7: Checkout com Retenção dos Fundos em Custódia (Escrow)
    console.log('• Teste 7: POST /api/ordens/:id/checkout (Retenção em Escrow)');
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
    console.log(`  ✓ Valor total R$ ${dataCheckout.dados.valor_total} retido com sucesso na custódia segura.`);

    // Teste 8: Segurança - Proteção Anti Double-Spending
    console.log('• Teste 8: POST /api/ordens/:id/checkout (Proteção Anti Double-Spending)');
    const resCheckoutDuplicado = await fetch(`${baseUrl}/ordens/${novaOrdemId}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proposta_id: propostaId,
        metodo_pagamento: 'PIX'
      })
    });
    assert.strictEqual(resCheckoutDuplicado.status, 400);
    console.log('  ✓ Tentativa de pagamento duplo bloqueada com sucesso (HTTP 400).');

    // Teste 9: Prestador Atualiza Status de Execução
    console.log('• Teste 9: PATCH /api/ordens/:id/status (Avanço da Execução)');
    const resStatus = await fetch(`${baseUrl}/ordens/${novaOrdemId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        novo_status: 'AGUARDANDO_VISTORIA',
        foto_conclusao: 'https://images.unsplash.com/photo-exemplo'
      })
    });
    assert.strictEqual(resStatus.status, 200);
    console.log('  ✓ Ordem avançada para AGUARDANDO_VISTORIA.');

    // Teste 10: Cliente Realiza Vistoria e Aprova Conclusão
    console.log('• Teste 10: POST /api/ordens/:id/aprovar (Aprovação e Repasse)');
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
    console.log(`  ✓ Vistoria aprovada! R$ ${dataAprovar.valor_liberado} liberados à carteira do prestador.`);

    // Teste 11: Nova Funcionalidade - Listar Livro-Razão Escrow (Auditoria Transacional)
    console.log('• Teste 11: GET /api/transacoes (Livro-Razão Escrow)');
    const resTrx = await fetch(`${baseUrl}/transacoes`);
    assert.strictEqual(resTrx.status, 200);
    const dataTrx = await resTrx.json();
    assert.strictEqual(dataTrx.sucesso, true);
    assert.ok(dataTrx.dados.length > 0);
    console.log(`  ✓ Total de movimentações auditadas no livro-razão: ${dataTrx.dados.length}`);

    // Teste 12: Nova Funcionalidade - Solicitação de Saque PIX da Carteira
    console.log('• Teste 12: POST /api/prestador/saque (Resgate PIX da Carteira)');
    const resSaque = await fetch(`${baseUrl}/prestador/saque`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prestador_id: 2,
        valor: 100.0,
        chave_pix: 'carlos.eletrica@email.com'
      })
    });
    assert.strictEqual(resSaque.status, 200);
    const dataSaque = await resSaque.json();
    assert.strictEqual(dataSaque.sucesso, true);
    console.log(`  ✓ Saque PIX processado com sucesso. Novo saldo disponível: R$ ${dataSaque.novo_saldo}`);

    console.log('\n======================================================');
    console.log(' TODOS OS 12 TESTES PASSARAM COM 100% DE SUCESSO!     ');
    console.log('======================================================\n');
  } catch (err) {
    console.error('\n❌ FALHA NOS TESTES:', err);
    process.exitCode = 1;
  } finally {
    server.close();
  }
}

runTests();
