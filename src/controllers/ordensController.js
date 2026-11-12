const db = require('../database/connection');

// Whitelists para validação estrita (OWASP Input Validation)
const CATEGORIAS_VALIDAS = ['Elétrica', 'Hidráulica', 'Pintura', 'Alvenaria', 'Climatização'];
const URGENCIAS_VALIDAS = ['BAIXA', 'MEDIA', 'ALTA', 'EMERGENCIAL'];
const STATUS_VALIDOS = [
  'PENDENTE', 'PROPOSTA_RECEBIDA', 'EM_CUSTODIA', 'A_CAMINHO',
  'EM_EXECUCAO', 'AGUARDANDO_VISTORIA', 'CONCLUIDO', 'EM_DISPUTA', 'CANCELADO'
];

// Função utilitária de sanitização de texto para defesa em profundidade
function sanitizarTexto(str, maxLen = 255) {
  if (typeof str !== 'string') return '';
  return str.replace(/<[^>]*>?/gm, '').trim().substring(0, maxLen);
}

// 1. Listar ordens com filtros validados
exports.listarOrdens = (req, res) => {
  try {
    const { status, categoria, cliente_id, prestador_id } = req.query;
    let sql = `
      SELECT 
        o.*,
        c.nome as cliente_nome,
        c.telefone as cliente_telefone,
        p.nome as prestador_nome,
        (SELECT COUNT(*) FROM propostas WHERE ordem_id = o.id) as total_propostas
      FROM ordens_servico o
      JOIN usuarios c ON o.cliente_id = c.id
      LEFT JOIN usuarios p ON o.prestador_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      if (!STATUS_VALIDOS.includes(status)) {
        return res.status(400).json({ sucesso: false, mensagem: 'Status de filtro inválido.' });
      }
      sql += ` AND o.status = ?`;
      params.push(status);
    }

    if (categoria) {
      if (!CATEGORIAS_VALIDAS.includes(categoria)) {
        return res.status(400).json({ sucesso: false, mensagem: 'Categoria de filtro inválida.' });
      }
      sql += ` AND o.categoria = ?`;
      params.push(categoria);
    }

    if (cliente_id) {
      const cId = parseInt(cliente_id, 10);
      if (isNaN(cId) || cId <= 0) {
        return res.status(400).json({ sucesso: false, mensagem: 'ID de cliente inválido.' });
      }
      sql += ` AND o.cliente_id = ?`;
      params.push(cId);
    }

    if (prestador_id) {
      const pId = parseInt(prestador_id, 10);
      if (isNaN(pId) || pId <= 0) {
        return res.status(400).json({ sucesso: false, mensagem: 'ID de prestador inválido.' });
      }
      sql += ` AND (o.prestador_id = ? OR (o.status IN ('PENDENTE', 'PROPOSTA_RECEBIDA') AND o.prestador_id IS NULL))`;
      params.push(pId);
    }

    sql += ` ORDER BY o.id DESC`;

    const stmt = db.prepare(sql);
    const ordens = stmt.all(...params);
    res.json({ sucesso: true, total: ordens.length, dados: ordens });
  } catch (error) {
    console.error('[ERRO listarOrdens]:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Falha ao consultar ordens de serviço.' });
  }
};

// 2. Obter detalhes de uma ordem específica
exports.obterOrdem = (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ sucesso: false, mensagem: 'Identificador de ordem inválido.' });
    }

    const ordem = db.prepare(`
      SELECT 
        o.*,
        c.nome as cliente_nome,
        c.email as cliente_email,
        c.telefone as cliente_telefone,
        p.nome as prestador_nome,
        p.telefone as prestador_telefone,
        p.reputacao as prestador_reputacao
      FROM ordens_servico o
      JOIN usuarios c ON o.cliente_id = c.id
      LEFT JOIN usuarios p ON o.prestador_id = p.id
      WHERE o.id = ?
    `).get(id);

    if (!ordem) {
      return res.status(404).json({ sucesso: false, mensagem: 'Ordem de serviço não encontrada.' });
    }

    const propostas = db.prepare(`
      SELECT pr.*, u.nome as prestador_nome, u.reputacao as prestador_reputacao
      FROM propostas pr
      JOIN usuarios u ON pr.prestador_id = u.id
      WHERE pr.ordem_id = ?
      ORDER BY pr.id DESC
    `).all(id);

    const transacoes = db.prepare(`
      SELECT * FROM transacoes_custodia WHERE ordem_id = ? ORDER BY id DESC
    `).all(id);

    const avaliacao = db.prepare(`
      SELECT * FROM avaliacoes WHERE ordem_id = ?
    `).get(id);

    res.json({
      sucesso: true,
      dados: {
        ...ordem,
        propostas,
        transacoes,
        avaliacao
      }
    });
  } catch (error) {
    console.error('[ERRO obterOrdem]:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno ao recuperar ordem.' });
  }
};

// 3. Criar nova ordem de serviço (Solicitação do Cliente) com validação rígida
exports.criarOrdem = (req, res) => {
  try {
    const { cliente_id, categoria, titulo, descricao, cep, endereco, urgencia } = req.body;

    const cId = parseInt(cliente_id, 10);
    if (isNaN(cId) || cId <= 0) {
      return res.status(400).json({ sucesso: false, mensagem: 'cliente_id inválido.' });
    }

    if (!CATEGORIAS_VALIDAS.includes(categoria)) {
      return res.status(400).json({
        sucesso: false,
        mensagem: `Categoria inválida. Categorias aceitas: ${CATEGORIAS_VALIDAS.join(', ')}`
      });
    }

    const tituloSan = sanitizarTexto(titulo, 120);
    const descricaoSan = sanitizarTexto(descricao, 2000);
    const cepSan = sanitizarTexto(cep, 15);
    const enderecoSan = sanitizarTexto(endereco, 200);
    const urgenciaVal = URGENCIAS_VALIDAS.includes(urgencia) ? urgencia : 'MEDIA';

    if (!tituloSan || tituloSan.length < 5) {
      return res.status(400).json({ sucesso: false, mensagem: 'O título deve possuir pelo menos 5 caracteres.' });
    }

    if (!descricaoSan || descricaoSan.length < 10) {
      return res.status(400).json({ sucesso: false, mensagem: 'A descrição deve detalhar o defeito com no mínimo 10 caracteres.' });
    }

    if (!cepSan || !enderecoSan) {
      return res.status(400).json({ sucesso: false, mensagem: 'CEP e endereço completo são obrigatórios.' });
    }

    // Verifica se cliente existe
    const cliente = db.prepare('SELECT id FROM usuarios WHERE id = ?').get(cId);
    if (!cliente) {
      return res.status(404).json({ sucesso: false, mensagem: 'Usuário cliente não encontrado.' });
    }

    const stmt = db.prepare(`
      INSERT INTO ordens_servico (cliente_id, categoria, titulo, descricao, cep, endereco, urgencia, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDENTE')
    `);

    const result = stmt.run(cId, categoria, tituloSan, descricaoSan, cepSan, enderecoSan, urgenciaVal);
    const novaOrdem = db.prepare('SELECT * FROM ordens_servico WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json({
      sucesso: true,
      mensagem: 'Solicitação de reparo criada com sucesso.',
      dados: novaOrdem
    });
  } catch (error) {
    console.error('[ERRO criarOrdem]:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno ao criar solicitação.' });
  }
};

// 4. Enviar proposta de orçamento com verificação de valores
exports.enviarProposta = (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { prestador_id, valor, prazo_estimado, mensagem } = req.body;

    const pId = parseInt(prestador_id, 10);
    const valorNum = parseFloat(valor);

    if (isNaN(id) || isNaN(pId) || isNaN(valorNum)) {
      return res.status(400).json({ sucesso: false, mensagem: 'Parâmetros numéricos inválidos.' });
    }

    if (valorNum <= 0 || valorNum > 100000) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'O valor da mão de obra deve ser um número positivo entre R$ 1,00 e R$ 100.000,00.'
      });
    }

    const prazoSan = sanitizarTexto(prazo_estimado, 100);
    const msgSan = sanitizarTexto(mensagem, 1000);

    if (!prazoSan) {
      return res.status(400).json({ sucesso: false, mensagem: 'Informe a estimativa de prazo para o serviço.' });
    }

    const ordem = db.prepare('SELECT * FROM ordens_servico WHERE id = ?').get(id);
    if (!ordem) {
      return res.status(404).json({ sucesso: false, mensagem: 'Ordem de serviço não encontrada.' });
    }

    if (ordem.status !== 'PENDENTE' && ordem.status !== 'PROPOSTA_RECEBIDA') {
      return res.status(400).json({
        sucesso: false,
        mensagem: `Não é permitido enviar propostas para ordem com status '${ordem.status}'.`
      });
    }

    // Verifica se prestador existe e é do tipo PRESTADOR
    const prestador = db.prepare("SELECT id, papel FROM usuarios WHERE id = ?").get(pId);
    if (!prestador || prestador.papel !== 'PRESTADOR') {
      return res.status(400).json({ sucesso: false, mensagem: 'Apenas usuários com perfil de Prestador podem enviar propostas.' });
    }

    const stmt = db.prepare(`
      INSERT INTO propostas (ordem_id, prestador_id, valor, prazo_estimado, mensagem)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(id, pId, valorNum, prazoSan, msgSan);

    db.prepare(`UPDATE ordens_servico SET status = 'PROPOSTA_RECEBIDA' WHERE id = ? AND status = 'PENDENTE'`).run(id);

    res.status(201).json({
      sucesso: true,
      mensagem: 'Proposta de orçamento enviada com sucesso.',
      proposta_id: result.lastInsertRowid
    });
  } catch (error) {
    console.error('[ERRO enviarProposta]:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno ao enviar proposta.' });
  }
};

// 5. Checkout com Escrow Protegido e Transação Atômica (Anti Double-Spending)
exports.checkoutCustodia = (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { proposta_id, metodo_pagamento, cupom } = req.body;

    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ sucesso: false, mensagem: 'ID de ordem inválido.' });
    }

    const ordem = db.prepare('SELECT * FROM ordens_servico WHERE id = ?').get(id);
    if (!ordem) {
      return res.status(404).json({ sucesso: false, mensagem: 'Ordem de serviço não encontrada.' });
    }

    // Prevenção de pagamento duplicado / Double-spending
    if (ordem.status !== 'PENDENTE' && ordem.status !== 'PROPOSTA_RECEBIDA') {
      return res.status(400).json({
        sucesso: false,
        mensagem: `Operação recusada: Esta ordem já possui pagamento processado ou status '${ordem.status}'.`
      });
    }

    let proposta;
    if (proposta_id) {
      const pId = parseInt(proposta_id, 10);
      proposta = db.prepare('SELECT * FROM propostas WHERE id = ? AND ordem_id = ?').get(pId, id);
    } else {
      proposta = db.prepare('SELECT * FROM propostas WHERE ordem_id = ? ORDER BY id DESC LIMIT 1').get(id);
    }

    if (!proposta) {
      return res.status(400).json({ sucesso: false, mensagem: 'Nenhuma proposta válida encontrada para contratação.' });
    }

    const valorMaoObra = parseFloat(proposta.valor);
    if (isNaN(valorMaoObra) || valorMaoObra <= 0) {
      return res.status(400).json({ sucesso: false, mensagem: 'Valor de mão de obra inválido.' });
    }

    let taxaPlataforma = Math.round(valorMaoObra * 0.08 * 100) / 100;
    if (taxaPlataforma < 15.0) taxaPlataforma = 15.0;

    const cupomSan = sanitizarTexto(cupom, 20).toUpperCase();
    if (cupomSan === 'FREELA10') {
      taxaPlataforma = Math.round(taxaPlataforma * 0.5 * 100) / 100; // 50% de desconto na taxa
    }

    const valorTotal = Math.round((valorMaoObra + taxaPlataforma) * 100) / 100;
    const metodoSan = (metodo_pagamento === 'CARTAO_CREDITO') ? 'CARTAO_CREDITO' : 'PIX';

    // Transação Atômica: garante que ou tudo executa ou nada é gravado
    db.exec('BEGIN TRANSACTION;');
    try {
      // 1. Atualiza propostas
      db.prepare(`UPDATE propostas SET status = 'ACEITA' WHERE id = ?`).run(proposta.id);
      db.prepare(`UPDATE propostas SET status = 'RECUSADA' WHERE ordem_id = ? AND id != ?`).run(id, proposta.id);

      // 2. Atualiza ordem para EM_CUSTODIA
      db.prepare(`
        UPDATE ordens_servico 
        SET prestador_id = ?,
            valor_mao_obra = ?,
            taxa_plataforma = ?,
            valor_total = ?,
            metodo_pagamento = ?,
            status = 'EM_CUSTODIA',
            atualizado_em = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(proposta.prestador_id, valorMaoObra, taxaPlataforma, valorTotal, metodoSan, id);

      // 3. Registra transação de retenção sob custódia
      db.prepare(`
        INSERT INTO transacoes_custodia (ordem_id, valor, tipo, status, detalhes)
        VALUES (?, ?, 'BLOQUEIO_ESCROW', 'CONFIRMADO', ?)
      `).run(id, valorTotal, `Pagamento recebido via ${metodoSan}. Saldo retido em conta escrow protegida.`);

      // 4. Bloqueia valor na custódia do prestador
      db.prepare(`
        UPDATE usuarios 
        SET saldo_custodia = saldo_custodia + ? 
        WHERE id = ?
      `).run(valorMaoObra, proposta.prestador_id);

      db.exec('COMMIT;');
    } catch (txError) {
      db.exec('ROLLBACK;');
      throw txError;
    }

    res.json({
      sucesso: true,
      mensagem: 'Pagamento processado com sucesso! Os fundos estão retidos em custódia segura.',
      dados: {
        ordem_id: id,
        status: 'EM_CUSTODIA',
        valor_mao_obra: valorMaoObra,
        taxa_plataforma: taxaPlataforma,
        valor_total: valorTotal,
        prestador_id: proposta.prestador_id
      }
    });
  } catch (error) {
    console.error('[ERRO checkoutCustodia]:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro transacional no processamento do checkout.' });
  }
};

// 6. Atualizar status de execução com controle rigoroso de transição
exports.atualizarStatus = (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { novo_status, foto_conclusao } = req.body;

    const transicoesPermitidas = ['A_CAMINHO', 'EM_EXECUCAO', 'AGUARDANDO_VISTORIA'];
    if (!transicoesPermitidas.includes(novo_status)) {
      return res.status(400).json({
        sucesso: false,
        mensagem: `Transição inválida. Permitidas: ${transicoesPermitidas.join(', ')}`
      });
    }

    const ordem = db.prepare('SELECT * FROM ordens_servico WHERE id = ?').get(id);
    if (!ordem) {
      return res.status(404).json({ sucesso: false, mensagem: 'Ordem de serviço não encontrada.' });
    }

    // A ordem precisa estar em custódia ou em andamento
    const estadosOperaveis = ['EM_CUSTODIA', 'A_CAMINHO', 'EM_EXECUCAO'];
    if (!estadosOperaveis.includes(ordem.status)) {
      return res.status(400).json({
        sucesso: false,
        mensagem: `Não é possível atualizar status de uma ordem com status '${ordem.status}'.`
      });
    }

    const fotoSan = sanitizarTexto(foto_conclusao, 500);

    db.prepare(`
      UPDATE ordens_servico 
      SET status = ?, 
          foto_conclusao = COALESCE(?, foto_conclusao),
          atualizado_em = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(novo_status, fotoSan || null, id);

    res.json({
      sucesso: true,
      mensagem: `Status da ordem atualizado para '${novo_status}'.`,
      novo_status
    });
  } catch (error) {
    console.error('[ERRO atualizarStatus]:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Falha ao atualizar status da ordem.' });
  }
};

// 7. Aprovação da Vistoria e Liquidação Atômica do Escrow
exports.aprovarVistoria = (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { nota, comentario, cliente_id } = req.body;

    const ordem = db.prepare('SELECT * FROM ordens_servico WHERE id = ?').get(id);
    if (!ordem) {
      return res.status(404).json({ sucesso: false, mensagem: 'Ordem de serviço não encontrada.' });
    }

    if (ordem.status !== 'AGUARDANDO_VISTORIA' && ordem.status !== 'EM_EXECUCAO') {
      return res.status(400).json({
        sucesso: false,
        mensagem: `A ordem deve estar aguardando vistoria para aprovação. Status atual: '${ordem.status}'.`
      });
    }

    const valorRepasse = parseFloat(ordem.valor_mao_obra);
    const notaNum = Math.max(1, Math.min(5, parseInt(nota, 10) || 5));
    const comentarioSan = sanitizarTexto(comentario, 500) || 'Serviço aprovado na vistoria presencial.';

    db.exec('BEGIN TRANSACTION;');
    try {
      // 1. Marca ordem como CONCLUIDO
      db.prepare(`
        UPDATE ordens_servico 
        SET status = 'CONCLUIDO', atualizado_em = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(id);

      // 2. Transfere saldo da custódia para saldo disponível do prestador
      db.prepare(`
        UPDATE usuarios 
        SET saldo_custodia = MAX(0, saldo_custodia - ?),
            saldo_disponivel = saldo_disponivel + ?
        WHERE id = ?
      `).run(valorRepasse, valorRepasse, ordem.prestador_id);

      // 3. Registra transação de liquidação
      db.prepare(`
        INSERT INTO transacoes_custodia (ordem_id, valor, tipo, status, detalhes)
        VALUES (?, ?, 'LIBERACAO_REPASSE', 'CONFIRMADO', 'Vistoria aprovada. Valor transferido à carteira do prestador.')
      `).run(id, valorRepasse);

      // 4. Registra avaliação
      const avaliadorId = parseInt(cliente_id, 10) || ordem.cliente_id;
      db.prepare(`
        INSERT INTO avaliacoes (ordem_id, avaliador_id, avaliado_id, nota, comentario)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, avaliadorId, ordem.prestador_id, notaNum, comentarioSan);

      // 5. Recalcula reputação com média ponderada
      const avg = db.prepare(`SELECT AVG(nota) as media FROM avaliacoes WHERE avaliado_id = ?`).get(ordem.prestador_id);
      if (avg && avg.media) {
        db.prepare(`UPDATE usuarios SET reputacao = ROUND(?, 1) WHERE id = ?`).run(avg.media, ordem.prestador_id);
      }

      db.exec('COMMIT;');
    } catch (txError) {
      db.exec('ROLLBACK;');
      throw txError;
    }

    res.json({
      sucesso: true,
      mensagem: 'Vistoria aprovada! Pagamento liberado com sucesso para a conta do prestador.',
      valor_liberado: valorRepasse,
      status: 'CONCLUIDO'
    });
  } catch (error) {
    console.error('[ERRO aprovarVistoria]:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro transacional na liberação de vistoria.' });
  }
};

// 8. Abertura de Disputa / Contestação
exports.abrirDisputa = (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { motivo, detalhes } = req.body;

    const ordem = db.prepare('SELECT * FROM ordens_servico WHERE id = ?').get(id);
    if (!ordem) {
      return res.status(404).json({ sucesso: false, mensagem: 'Ordem de serviço não encontrada.' });
    }

    // Apenas ordens ativas com fundos em custódia podem ser contestadas
    const estadosDisputaveis = ['EM_CUSTODIA', 'A_CAMINHO', 'EM_EXECUCAO', 'AGUARDANDO_VISTORIA'];
    if (!estadosDisputaveis.includes(ordem.status)) {
      return res.status(400).json({
        sucesso: false,
        mensagem: `Não é possível abrir disputa em uma ordem com status '${ordem.status}'.`
      });
    }

    const motivoSan = sanitizarTexto(motivo, 255) || 'Serviço com inconformidade presencial.';
    const detalhesSan = sanitizarTexto(detalhes, 1000);

    db.prepare(`
      UPDATE ordens_servico 
      SET status = 'EM_DISPUTA', atualizado_em = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);

    db.prepare(`
      INSERT INTO transacoes_custodia (ordem_id, valor, tipo, status, detalhes)
      VALUES (?, ?, 'ESTORNO_DISPUTA', 'EM_ANALISE', ?)
    `).run(id, ordem.valor_total, `Disputa aberta. Motivo: ${motivoSan}. Saldo retido preventivamente.`);

    res.json({
      sucesso: true,
      mensagem: 'Disputa registrada com sucesso. A liberação do pagamento foi congelada e a mediação foi acionada.',
      status: 'EM_DISPUTA'
    });
  } catch (error) {
    console.error('[ERRO abrirDisputa]:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Falha ao registrar disputa.' });
  }
};

// 9. Estatísticas do Sistema
exports.obterEstatisticas = (req, res) => {
  try {
    const totalOrdens = db.prepare('SELECT COUNT(*) as total FROM ordens_servico').get().total;
    const ordensConcluidas = db.prepare("SELECT COUNT(*) as total FROM ordens_servico WHERE status = 'CONCLUIDO'").get().total;
    const emCustodia = db.prepare("SELECT COALESCE(SUM(valor_total), 0) as total FROM ordens_servico WHERE status IN ('EM_CUSTODIA', 'A_CAMINHO', 'EM_EXECUCAO', 'AGUARDANDO_VISTORIA')").get().total;
    const totalRepassado = db.prepare("SELECT COALESCE(SUM(valor_mao_obra), 0) as total FROM ordens_servico WHERE status = 'CONCLUIDO'").get().total;
    const prestadoresAtivos = db.prepare("SELECT COUNT(*) as total FROM usuarios WHERE papel = 'PRESTADOR'").get().total;

    res.json({
      sucesso: true,
      dados: {
        total_ordens: totalOrdens,
        ordens_concluidas: ordensConcluidas,
        saldo_em_custodia: emCustodia,
        total_repassado: totalRepassado,
        prestadores_ativos: prestadoresAtivos
      }
    });
  } catch (error) {
    console.error('[ERRO obterEstatisticas]:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao calcular estatísticas.' });
  }
};

// 10. Listar Usuários
exports.listarUsuarios = (req, res) => {
  try {
    const usuarios = db.prepare('SELECT id, nome, email, papel, telefone, especialidade, reputacao, saldo_disponivel, saldo_custodia, verificado FROM usuarios ORDER BY id ASC').all();
    res.json({ sucesso: true, dados: usuarios });
  } catch (error) {
    console.error('[ERRO listarUsuarios]:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao listar usuários.' });
  }
};

// 11. Listar Livro-Razão de Custódia (Transações Escrow)
exports.listarTransacoes = (req, res) => {
  try {
    const sql = `
      SELECT t.*, o.titulo as ordem_titulo, o.categoria, c.nome as cliente_nome, p.nome as prestador_nome
      FROM transacoes_custodia t
      JOIN ordens_servico o ON t.ordem_id = o.id
      JOIN usuarios c ON o.cliente_id = c.id
      LEFT JOIN usuarios p ON o.prestador_id = p.id
      ORDER BY t.id DESC
    `;
    const transacoes = db.prepare(sql).all();
    res.json({ sucesso: true, dados: transacoes });
  } catch (error) {
    console.error('[ERRO listarTransacoes]:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao listar transações de custódia.' });
  }
};

// 12. Solicitar Saque PIX do Saldo Disponível (Prestador)
exports.solicitarSaque = (req, res) => {
  try {
    const { prestador_id, valor, chave_pix } = req.body;
    const pId = parseInt(prestador_id, 10);
    const valorNum = parseFloat(valor);

    if (isNaN(pId) || isNaN(valorNum) || valorNum <= 0) {
      return res.status(400).json({ sucesso: false, mensagem: 'Valor de saque ou ID inválido.' });
    }

    const prestador = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(pId);
    if (!prestador || prestador.papel !== 'PRESTADOR') {
      return res.status(404).json({ sucesso: false, mensagem: 'Prestador não encontrado.' });
    }

    if (prestador.saldo_disponivel < valorNum) {
      return res.status(400).json({
        sucesso: false,
        mensagem: `Saldo insuficiente. Disponível para saque imediato: R$ ${prestador.saldo_disponivel.toFixed(2)}`
      });
    }

    db.prepare('UPDATE usuarios SET saldo_disponivel = saldo_disponivel - ? WHERE id = ?').run(valorNum, pId);

    res.json({
      sucesso: true,
      mensagem: `Saque PIX de R$ ${valorNum.toFixed(2)} processado com sucesso para a chave: ${sanitizarTexto(chave_pix, 100) || 'CPF/E-mail padrão'}!`,
      novo_saldo: prestador.saldo_disponivel - valorNum
    });
  } catch (error) {
    console.error('[ERRO solicitarSaque]:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao processar saque.' });
  }
};

// 13. Resolução e Mediação de Disputas (Arbitragem)
exports.resolverDisputa = (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { decisao, justificativa } = req.body;

    const ordem = db.prepare('SELECT * FROM ordens_servico WHERE id = ?').get(id);
    if (!ordem || ordem.status !== 'EM_DISPUTA') {
      return res.status(400).json({ sucesso: false, mensagem: 'Esta ordem não se encontra em mediação de disputa.' });
    }

    const decisaoSan = (decisao === 'REPASSE_PRESTADOR') ? 'REPASSE_PRESTADOR' : 'ESTORNO_CLIENTE';
    const justSan = sanitizarTexto(justificativa, 255) || 'Mediação concluída pelo suporte técnico.';

    db.exec('BEGIN TRANSACTION;');
    try {
      if (decisaoSan === 'REPASSE_PRESTADOR') {
        db.prepare("UPDATE ordens_servico SET status = 'CONCLUIDO', atualizado_em = CURRENT_TIMESTAMP WHERE id = ?").run(id);
        db.prepare("UPDATE usuarios SET saldo_custodia = MAX(0, saldo_custodia - ?), saldo_disponivel = saldo_disponivel + ? WHERE id = ?").run(ordem.valor_mao_obra, ordem.valor_mao_obra, ordem.prestador_id);
        db.prepare("INSERT INTO transacoes_custodia (ordem_id, valor, tipo, status, detalhes) VALUES (?, ?, 'LIBERACAO_REPASSE', 'CONFIRMADO', ?)").run(id, ordem.valor_mao_obra, `Disputa resolvida a favor do prestador. Parecer: ${justSan}`);
      } else {
        db.prepare("UPDATE ordens_servico SET status = 'CANCELADO', atualizado_em = CURRENT_TIMESTAMP WHERE id = ?").run(id);
        db.prepare("UPDATE usuarios SET saldo_custodia = MAX(0, saldo_custodia - ?) WHERE id = ?").run(ordem.valor_mao_obra, ordem.prestador_id);
        db.prepare("INSERT INTO transacoes_custodia (ordem_id, valor, tipo, status, detalhes) VALUES (?, ?, 'ESTORNO_DISPUTA', 'CONFIRMADO', ?)").run(id, ordem.valor_total, `Disputa resolvida com estorno integral ao cliente. Parecer: ${justSan}`);
      }
      db.exec('COMMIT;');
    } catch (e) {
      db.exec('ROLLBACK;');
      throw e;
    }

    res.json({
      sucesso: true,
      mensagem: `Disputa na OS #${id} resolvida com decisão '${decisaoSan}'.`,
      status_final: (decisaoSan === 'REPASSE_PRESTADOR' ? 'CONCLUIDO' : 'CANCELADO')
    });
  } catch (error) {
    console.error('[ERRO resolverDisputa]:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao arbitrar disputa.' });
  }
};
