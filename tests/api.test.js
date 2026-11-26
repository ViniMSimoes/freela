const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// Isola banco de testes para não poluir o freela.db principal da aplicação
const TEST_DB_FILE = path.resolve(process.cwd(), './freela_test_suite.db');
if (!process.env.DB_PATH) {
  try { if (fs.existsSync(TEST_DB_FILE)) fs.unlinkSync(TEST_DB_FILE); } catch {}
  process.env.DB_PATH = TEST_DB_FILE;
}

const app = require('../src/server');
const db = require('../src/database/connection');

const PORT = 3099;

async function runTests() {
  console.log('\n======================================================');
  console.log(' SUÍTE DE TESTES RIGOROSOS — FREELA ESCROW SAAS (C1-C4)');
  console.log('======================================================\n');
  
  const server = app.listen(PORT);
  const baseUrl = `http://localhost:${PORT}/api`;

  try {
    // Teste 1: Obter Estatísticas do Dashboard
    console.log('• Teste 1: GET /api/stats (Estatísticas do Dashboard)');
    const resStats = await fetch(`${baseUrl}/stats`);
    assert.strictEqual(resStats.status, 200);
    const dataStats = await resStats.json();
    assert.strictEqual(dataStats.sucesso, true);
    console.log('  ✓ Estatísticas retornadas com sucesso.');

    // Teste 2: Cabeçalhos HTTP de Segurança (Helmet e OWASP)
    console.log('• Teste 2: Verificação de Cabeçalhos HTTP de Segurança (Helmet & OWASP)');
    assert.strictEqual(resStats.headers.get('x-content-type-options'), 'nosniff');
    assert.strictEqual(resStats.headers.get('x-frame-options'), 'SAMEORIGIN');
    assert.strictEqual(resStats.headers.get('x-powered-by'), null);
    console.log('  ✓ Cabeçalhos de segurança ativos (X-Content-Type-Options: nosniff, X-Powered-By omitido).');

    // Teste 3: Listar Usuários
    console.log('• Teste 3: GET /api/usuarios (Listagem de Usuários e Perfis)');
    const resUsers = await fetch(`${baseUrl}/usuarios`);
    assert.strictEqual(resUsers.status, 200);
    const dataUsers = await resUsers.json();
    assert.strictEqual(dataUsers.sucesso, true);
    assert.ok(dataUsers.dados.length >= 3);
    console.log(`  ✓ Total de usuários listados: ${dataUsers.dados.length}.`);

    // Teste 4: Listar Ordens de Serviço
    console.log('• Teste 4: GET /api/ordens (Listagem de Chamados com Filtros)');
    const resOrdens = await fetch(`${baseUrl}/ordens`);
    assert.strictEqual(resOrdens.status, 200);
    const dataOrdens = await resOrdens.json();
    assert.strictEqual(dataOrdens.sucesso, true);
    assert.ok(Array.isArray(dataOrdens.dados));
    console.log(`  ✓ Total de ordens listadas: ${dataOrdens.total}`);

    // Teste 5: Criação de Nova Ordem com Sanitização de Payload Malicioso (XSS)
    console.log('• Teste 5: POST /api/ordens (Criação de Chamado com Defesa XSS)');
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
    console.log(`  ✓ Ordem criada com ID #${novaOrdemId} e payload malicioso sanitizado com sucesso.`);

    // Teste 6: Rejeição de Proposta com Valor Negativo
    console.log('• Teste 6: POST /api/ordens/:id/propostas (Validação Estrita de Valor Negativo)');
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
    console.log('  ✓ Proposta com valor negativo bloqueada com sucesso (HTTP 400).');

    // Teste 7: Prestador Envia Proposta Válida
    console.log('• Teste 7: POST /api/ordens/:id/propostas (Registro de Proposta Válida)');
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

    // Teste 8: Checkout com Retenção dos Fundos em Custódia (Escrow)
    console.log('• Teste 8: POST /api/ordens/:id/checkout (Bloqueio Transacional em Escrow)');
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

    // Teste 9: Prevenção Anti Double-Spending
    console.log('• Teste 9: POST /api/ordens/:id/checkout (Proteção Anti Double-Spending)');
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

    // Teste 10: Bloqueio de Aprovação Imatura em EM_EXECUCAO
    console.log('• Teste 10: POST /api/ordens/:id/aprovar (Bloqueio de Aprovação em EM_EXECUCAO)');
    // Avança para EM_EXECUCAO primeiro
    await fetch(`${baseUrl}/ordens/${novaOrdemId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ novo_status: 'EM_EXECUCAO' })
    });
    const resAprovarImaturo = await fetch(`${baseUrl}/ordens/${novaOrdemId}/aprovar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cliente_id: 1, nota: 5, comentario: 'Tentando aprovar antes da vistoria' })
    });
    assert.strictEqual(resAprovarImaturo.status, 400);
    console.log('  ✓ Tentativa de liberação de repasse durante EM_EXECUCAO bloqueada (HTTP 400).');

    // Teste 11: Bloqueio de Aprovação por Não-Titular (Controle de Acesso 403)
    console.log('• Teste 11: POST /api/ordens/:id/aprovar (Validação de Titularidade - HTTP 403)');
    // Avança para AGUARDANDO_VISTORIA
    await fetch(`${baseUrl}/ordens/${novaOrdemId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ novo_status: 'AGUARDANDO_VISTORIA', foto_conclusao: 'https://images.unsplash.com/foto-vistoria' })
    });
    const resAprovarNaoTitular = await fetch(`${baseUrl}/ordens/${novaOrdemId}/aprovar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cliente_id: 999, nota: 5, comentario: 'Tentativa por usuário não-titular' })
    });
    assert.strictEqual(resAprovarNaoTitular.status, 403);
    console.log('  ✓ Tentativa de aprovação por usuário não-titular rejeitada com HTTP 403 Forbidden.');

    // Teste 12: Homologação Legítima da Vistoria pelo Cliente Titular
    console.log('• Teste 12: POST /api/ordens/:id/aprovar (Homologação Legítima e Repasse)');
    const resAprovar = await fetch(`${baseUrl}/ordens/${novaOrdemId}/aprovar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cliente_id: 1,
        nota: 5,
        comentario: 'Pintura impecável, local limpo e serviço entregue com excelência!'
      })
    });
    assert.strictEqual(resAprovar.status, 200);
    const dataAprovar = await resAprovar.json();
    assert.strictEqual(dataAprovar.sucesso, true);
    assert.strictEqual(dataAprovar.status, 'CONCLUIDO');
    console.log(`  ✓ Vistoria homologada! R$ ${dataAprovar.valor_liberado} liberados à carteira do prestador.`);

    // Teste 13: Listar Livro-Razão Escrow (Auditoria Contábil)
    console.log('• Teste 13: GET /api/transacoes (Livro-Razão Escrow Auditável)');
    const resTrx = await fetch(`${baseUrl}/transacoes`);
    assert.strictEqual(resTrx.status, 200);
    const dataTrx = await resTrx.json();
    assert.strictEqual(dataTrx.sucesso, true);
    assert.ok(dataTrx.dados.length >= 2);
    console.log(`  ✓ Total de movimentações auditadas no livro-razão: ${dataTrx.dados.length}`);

    // Teste 14: Resgate via PIX do Saldo Disponível
    console.log('• Teste 14: POST /api/prestador/saque (Resgate via PIX)');
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

    // Teste 15: Notificações Multicanal (WhatsApp & E-mail)
    console.log('• Teste 15: GET /api/notificacoes (Log Auditável de Mensageria)');
    const resNotif = await fetch(`${baseUrl}/notificacoes`);
    assert.strictEqual(resNotif.status, 200);
    const dataNotif = await resNotif.json();
    assert.strictEqual(dataNotif.sucesso, true);
    assert.ok(dataNotif.dados.length > 0);
    console.log(`  ✓ Log de mensageria ativo com ${dataNotif.dados.length} notificações registradas (WhatsApp/Email).`);

    // Teste 16: Verificação de Integridade Referencial (PRAGMA foreign_keys = ON)
    console.log('• Teste 16: PRAGMA foreign_keys = ON (Enforcement Estrito de Chaves Estrangeiras)');
    let fkBloqueada = false;
    try {
      db.prepare(`
        INSERT INTO avaliacoes (ordem_id, avaliador_id, avaliado_id, nota, comentario)
        VALUES (999999, 1, 2, 5, 'Teste de integridade referencial com OS inexistente')
      `).run();
    } catch (err) {
      fkBloqueada = true;
    }
    assert.strictEqual(fkBloqueada, true);
    console.log('  ✓ Inserção com chave estrangeira inexistente rejeitada pelo SQLite (Integridade ativa).');

    // Teste 17: Cadastro e Autenticação (Inicia com verificado = 0)
    console.log('• Teste 17: POST /api/auth/register & /login (Cadastro com verificado=0 e Token)');
    const uniqueSuffix = Date.now();
    const emailNovo = `joao.${uniqueSuffix}@email.com`;
    const resReg = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: 'João Pintor',
        email: emailNovo,
        senha: 'senhaSegura123',
        papel: 'PRESTADOR',
        especialidade: 'Pintura'
      })
    });
    assert.strictEqual(resReg.status, 201);
    const dataReg = await resReg.json();
    assert.strictEqual(dataReg.dados.verificado, 0);
    assert.ok(dataReg.token);
    const novoUserId = dataReg.dados.id;

    const resLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailNovo, senha: 'senhaSegura123' })
    });
    assert.strictEqual(resLogin.status, 200);
    console.log('  ✓ Usuário cadastrado com verificado=0 e autenticado com sucesso.');

    // Teste 18: Envio de Documento e Aprovação pelo ADMIN
    console.log('• Teste 18: PATCH /api/admin/usuarios/:id/aprovar (Selo Verificado via ADMIN)');
    const resDoc = await fetch(`${baseUrl}/usuarios/${novoUserId}/verificar-documento`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documento_url: 'https://docs.freela.com/cnh_joao.pdf' })
    });
    assert.strictEqual(resDoc.status, 200);

    const resAprovaNaoAdmin = await fetch(`${baseUrl}/admin/usuarios/${novoUserId}/aprovar`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_id: 1 })
    });
    assert.strictEqual(resAprovaNaoAdmin.status, 403);

    const adminUser = dataUsers.dados.find(u => u.papel === 'ADMIN') || { id: 4 };
    const resAprovaAdmin = await fetch(`${baseUrl}/admin/usuarios/${novoUserId}/aprovar`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_id: adminUser.id })
    });
    assert.strictEqual(resAprovaAdmin.status, 200);
    console.log('  ✓ Controle RBAC validado (HTTP 403 para não-ADMIN) e selo aprovado pelo ADMIN.');

    // Teste 19: Gestão Dinâmica de Cupons Promocionais
    console.log('• Teste 19: POST /api/admin/cupons & GET /api/cupons (Cupons Dinâmicos)');
    const codCupom = `PROMO${String(uniqueSuffix).slice(-4)}`;
    const resCupom = await fetch(`${baseUrl}/admin/cupons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_id: adminUser.id, codigo: codCupom, desconto_percentual: 25 })
    });
    assert.strictEqual(resCupom.status, 201);
    const resListaCupons = await fetch(`${baseUrl}/cupons`);
    const dataCupons = await resListaCupons.json();
    assert.ok(dataCupons.dados.some(c => c.codigo === codCupom));
    console.log(`  ✓ Cupom dinâmico ${codCupom} criado e listado com sucesso.`);

    // Teste 20: Catálogo de Prestadores e Portfólio
    console.log('• Teste 20: GET /api/prestadores & POST /api/prestadores/:id/portfolio');
    const resPort = await fetch(`${baseUrl}/prestadores/${novoUserId}/portfolio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: 'Pintura Acrílica Externa',
        categoria: 'Pintura',
        descricao: 'Execução completa em fachada residencial.'
      })
    });
    assert.strictEqual(resPort.status, 201);
    const resPrest = await fetch(`${baseUrl}/prestadores`);
    const dataPrest = await resPrest.json();
    assert.ok(dataPrest.dados.some(p => p.id === novoUserId && p.portfolio.length > 0));
    console.log('  ✓ Portfólio técnico adicionado e listado no catálogo de prestadores.');

    // Teste 21: Avaliação Mútua Bilateral (Prestador -> Cliente)
    console.log('• Teste 21: POST /api/ordens/:id/avaliar-cliente (Avaliação Mútua Bilateral)');
    const resAvCliente = await fetch(`${baseUrl}/ordens/${novaOrdemId}/avaliar-cliente`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prestador_id: 2, nota: 5, comentario: 'Cliente recebeu no horário combinado.' })
    });
    assert.strictEqual(resAvCliente.status, 201);
    console.log('  ✓ Avaliação mútua bilateral (Prestador -> Cliente) registrada com sucesso.');

    // Teste 22: Métricas Gerenciais do Painel Admin
    console.log('• Teste 22: GET /api/admin/metricas (Métricas de Conversão e Receita)');
    const resMetAdmin = await fetch(`${baseUrl}/admin/metricas`);
    assert.strictEqual(resMetAdmin.status, 200);
    const dataMetAdmin = await resMetAdmin.json();
    assert.strictEqual(dataMetAdmin.sucesso, true);
    assert.ok(typeof dataMetAdmin.dados.taxa_conversao_percentual === 'number');
    console.log(`  ✓ Métricas gerenciais retornadas (Conversão: ${dataMetAdmin.dados.taxa_conversao_percentual}%).`);

    // Teste 23: Sessão Autenticada via Bearer Token (GET /api/auth/me & PATCH /api/auth/perfil)
    console.log('• Teste 23: GET /api/auth/me & PATCH /api/auth/perfil (Sessão Bearer Token)');
    const resMeSemToken = await fetch(`${baseUrl}/auth/me`);
    assert.strictEqual(resMeSemToken.status, 401);

    const resMeComToken = await fetch(`${baseUrl}/auth/me`, {
      headers: { 'Authorization': `Bearer ${dataReg.token}` }
    });
    assert.strictEqual(resMeComToken.status, 200);
    const dataMe = await resMeComToken.json();
    assert.strictEqual(dataMe.dados.id, novoUserId);

    const resUpdPerfil = await fetch(`${baseUrl}/auth/perfil`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${dataReg.token}`
      },
      body: JSON.stringify({ nome: 'João Pintor Especialista', telefone: '(24) 98877-6655' })
    });
    assert.strictEqual(resUpdPerfil.status, 200);
    console.log('  ✓ Sessão Bearer validada (HTTP 401 sem token, HTTP 200 autenticado) e perfil atualizado.');

    // Teste 24: Histórico Público de Avaliações Mútuas (GET /api/avaliacoes)
    console.log('• Teste 24: GET /api/avaliacoes (Histórico de Avaliações Mútuas)');
    const resAvList = await fetch(`${baseUrl}/avaliacoes`);
    assert.strictEqual(resAvList.status, 200);
    const dataAvList = await resAvList.json();
    assert.ok(dataAvList.dados.length >= 2);
    console.log(`  ✓ Total de avaliações mútuas consultadas: ${dataAvList.dados.length}.`);

    // Teste 25: Integridade do Frontend SPA (CSP, Cache-Control e Delegação de Eventos)
    console.log('• Teste 25: Integridade do Frontend SPA (CSP, Cache-Control e Delegação de Ações)');
    const resIndex = await fetch(`http://localhost:${PORT}/`);
    assert.strictEqual(resIndex.status, 200);
    assert.strictEqual(resIndex.headers.get('cache-control'), 'no-cache');
    const cspHeader = resIndex.headers.get('content-security-policy') || '';
    assert.ok(cspHeader.includes("script-src-attr 'unsafe-inline'"));

    const htmlSrc = fs.readFileSync(path.resolve(__dirname, '../public/index.html'), 'utf8');
    const jsSrc = fs.readFileSync(path.resolve(__dirname, '../public/js/app.js'), 'utf8');
    assert.strictEqual(/\bonclick\s*=/i.test(htmlSrc), false, 'index.html deve usar data-action sem onclick inline');
    assert.strictEqual(/\bonclick\s*=/i.test(jsSrc), false, 'app.js deve usar data-action sem onclick inline');
    assert.strictEqual(/\boninput\s*=/i.test(jsSrc), false, 'app.js deve usar data-input-action sem oninput inline');

    const actionsUsadas = new Set();
    for (const src of [htmlSrc, jsSrc]) {
      for (const m of src.matchAll(/data-action="([^"]+)"/g)) {
        if (m[1] !== 'fechar-modal-backdrop') actionsUsadas.add(m[1]);
      }
    }
    for (const act of actionsUsadas) {
      assert.ok(jsSrc.includes(`case '${act}':`), `Ação data-action="${act}" mapeada no delegador`);
    }
    console.log(`  ✓ ${actionsUsadas.size} ações de interface verificadas sem conflito com CSP.`);

    console.log('\n======================================================');
    console.log(' TODOS OS 25 TESTES PASSARAM COM 100% DE SUCESSO!     ');
    console.log('======================================================\n');
  } catch (err) {
    console.error('\n❌ FALHA NOS TESTES:', err);
    process.exitCode = 1;
  } finally {
    server.close();
    try { db.close(); } catch {}
    try { if (fs.existsSync(TEST_DB_FILE)) fs.unlinkSync(TEST_DB_FILE); } catch {}
  }
}

runTests();
