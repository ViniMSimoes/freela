const db = require('../database/connection');

// Listar ordens com filtros
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
      sql += ` AND o.status = ?`;
      params.push(status);
    }
    if (categoria) {
      sql += ` AND o.categoria = ?`;
      params.push(categoria);
    }
    if (cliente_id) {
      sql += ` AND o.cliente_id = ?`;
      params.push(cliente_id);
    }
    if (prestador_id) {
      sql += ` AND (o.prestador_id = ? OR (o.status IN ('PENDENTE', 'PROPOSTA_RECEBIDA') AND o.prestador_id IS NULL))`;
      params.push(prestador_id);
    }

    sql += ` ORDER BY o.id DESC`;

    const stmt = db.prepare(sql);
    const ordens = stmt.all(...params);
    res.json({ sucesso: true, total: ordens.length, dados: ordens });
  } catch (error) {
    res.status(500).json({ sucesso: false, mensagem: error.message });
  }
};

// Obter detalhes de uma ordem específica
exports.obterOrdem = (req, res) => {
  try {
    const { id } = req.params;
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
    res.status(500).json({ sucesso: false, mensagem: error.message });
  }
};

// Criar nova ordem de serviço (Solicitação do Cliente)
exports.criarOrdem = (req, res) => {
  try {
    const { cliente_id, categoria, titulo, descricao, cep, endereco, urgencia } = req.body;

    if (!cliente_id || !categoria || !titulo || !descricao || !cep || !endereco) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'Campos obrigatórios ausentes: cliente_id, categoria, titulo, descricao, cep e endereco.'
      });
    }

    const stmt = db.prepare(`
      INSERT INTO ordens_servico (cliente_id, categoria, titulo, descricao, cep, endereco, urgencia, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDENTE')
    `);

    const result = stmt.run(cliente_id, categoria, titulo, descricao, cep, endereco, urgencia || 'MEDIA');

    const novaOrdem = db.prepare('SELECT * FROM ordens_servico WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json({
      sucesso: true,
      mensagem: 'Solicitação de reparo criada com sucesso.',
      dados: novaOrdem
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, mensagem: error.message });
  }
};

// Enviar proposta de orçamento (Prestador)
exports.enviarProposta = (req, res) => {
  try {
    const { id } = req.params; // ordem_id
    const { prestador_id, valor, prazo_estimado, mensagem } = req.body;

    if (!prestador_id || !valor || !prazo_estimado) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'Informe prestador_id, valor e prazo_estimado.'
      });
    }

    const ordem = db.prepare('SELECT * FROM ordens_servico WHERE id = ?').get(id);
    if (!ordem) {
      return res.status(404).json({ sucesso: false, mensagem: 'Ordem de serviço não encontrada.' });
    }

    if (ordem.status !== 'PENDENTE' && ordem.status !== 'PROPOSTA_RECEBIDA') {
      return res.status(400).json({
        sucesso: false,
        mensagem: `Não é possível enviar proposta para ordem com status ${ordem.status}.`
      });
    }

    const stmt = db.prepare(`
      INSERT INTO propostas (ordem_id, prestador_id, valor, prazo_estimado, mensagem)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(id, prestador_id, parseFloat(valor), prazo_estimado, mensagem || '');

    // Atualiza status da ordem para PROPOSTA_RECEBIDA
    db.prepare(`UPDATE ordens_servico SET status = 'PROPOSTA_RECEBIDA' WHERE id = ? AND status = 'PENDENTE'`).run(id);

    res.status(201).json({
      sucesso: true,
      mensagem: 'Proposta de orçamento enviada com sucesso.',
      proposta_id: result.lastInsertRowid
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, mensagem: error.message });
  }
};

// Checkout com retenção dos fundos em Custódia (Escrow)
exports.checkoutCustodia = (req, res) => {
  try {
    const { id } = req.params;
    const { proposta_id, metodo_pagamento, cupom } = req.body;

    const ordem = db.prepare('SELECT * FROM ordens_servico WHERE id = ?').get(id);
    if (!ordem) {
      return res.status(404).json({ sucesso: false, mensagem: 'Ordem de serviço não encontrada.' });
    }

    let proposta;
    if (proposta_id) {
      proposta = db.prepare('SELECT * FROM propostas WHERE id = ? AND ordem_id = ?').get(proposta_id, id);
    } else {
      proposta = db.prepare('SELECT * FROM propostas WHERE ordem_id = ? ORDER BY id DESC LIMIT 1').get(id);
    }

    if (!proposta) {
      return res.status(400).json({ sucesso: false, mensagem: 'Nenhuma proposta selecionada para esta ordem.' });
    }

    const valorMaoObra = parseFloat(proposta.valor);
    let taxaPlataforma = Math.round(valorMaoObra * 0.08 * 100) / 100; // 8% de intermediação
    if (taxaPlataforma < 15.0) taxaPlataforma = 15.0; // taxa mínima

    if (cupom && cupom.toUpperCase() === 'FREELA10') {
      taxaPlataforma = Math.round(taxaPlataforma * 0.5 * 100) / 100; // 50% de desconto na taxa
    }

    const valorTotal = valorMaoObra + taxaPlataforma;

    // Atualiza proposta para ACEITA
    db.prepare(`UPDATE propostas SET status = 'ACEITA' WHERE id = ?`).run(proposta.id);
    db.prepare(`UPDATE propostas SET status = 'RECUSADA' WHERE ordem_id = ? AND id != ?`).run(id, proposta.id);

    // Atualiza ordem para EM_CUSTODIA
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
    `).run(proposta.prestador_id, valorMaoObra, taxaPlataforma, valorTotal, metodo_pagamento || 'PIX', id);

    // Registra transação de retenção sob custódia
    db.prepare(`
      INSERT INTO transacoes_custodia (ordem_id, valor, tipo, status, detalhes)
      VALUES (?, ?, 'BLOQUEIO_ESCROW', 'CONFIRMADO', ?)
    `).run(id, valorTotal, `Pagamento recebido via ${metodo_pagamento || 'PIX'}. Saldo retido em conta escrow protegida.`);

    // Atualiza saldo em custódia do prestador
    db.prepare(`
      UPDATE usuarios 
      SET saldo_custodia = saldo_custodia + ? 
      WHERE id = ?
    `).run(valorMaoObra, proposta.prestador_id);

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
    res.status(500).json({ sucesso: false, mensagem: error.message });
  }
};

// Atualizar status da ordem de serviço (Prestador)
exports.atualizarStatus = (req, res) => {
  try {
    const { id } = req.params;
    const { novo_status, foto_conclusao } = req.body;

    const statusValidos = ['A_CAMINHO', 'EM_EXECUCAO', 'AGUARDANDO_VISTORIA'];
    if (!statusValidos.includes(novo_status)) {
      return res.status(400).json({
        sucesso: false,
        mensagem: `Status inválido. Escolha um dos seguintes: ${statusValidos.join(', ')}`
      });
    }

    const ordem = db.prepare('SELECT * FROM ordens_servico WHERE id = ?').get(id);
    if (!ordem) {
      return res.status(404).json({ sucesso: false, mensagem: 'Ordem de serviço não encontrada.' });
    }

    db.prepare(`
      UPDATE ordens_servico 
      SET status = ?, 
          foto_conclusao = COALESCE(?, foto_conclusao),
          atualizado_em = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(novo_status, foto_conclusao || null, id);

    res.json({
      sucesso: true,
      mensagem: `Status da ordem atualizado para '${novo_status}'.`,
      novo_status
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, mensagem: error.message });
  }
};

// Aprovação da Vistoria pelo Cliente e Liberação da Custódia
exports.aprovarVistoria = (req, res) => {
  try {
    const { id } = req.params;
    const { nota, comentario, cliente_id } = req.body;

    const ordem = db.prepare('SELECT * FROM ordens_servico WHERE id = ?').get(id);
    if (!ordem) {
      return res.status(404).json({ sucesso: false, mensagem: 'Ordem de serviço não encontrada.' });
    }

    if (ordem.status !== 'AGUARDANDO_VISTORIA' && ordem.status !== 'EM_EXECUCAO') {
      return res.status(400).json({
        sucesso: false,
        mensagem: `A ordem deve estar aguardando vistoria para aprovação. Status atual: ${ordem.status}`
      });
    }

    // 1. Marca ordem como CONCLUIDO
    db.prepare(`
      UPDATE ordens_servico 
      SET status = 'CONCLUIDO', atualizado_em = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);

    // 2. Escrow Engine: Libera o saldo em custódia para saldo disponível do prestador
    const valorRepasse = ordem.valor_mao_obra;
    db.prepare(`
      UPDATE usuarios 
      SET saldo_custodia = MAX(0, saldo_custodia - ?),
          saldo_disponivel = saldo_disponivel + ?
      WHERE id = ?
    `).run(valorRepasse, valorRepasse, ordem.prestador_id);

    // 3. Registra transação de liquidação do repasse
    db.prepare(`
      INSERT INTO transacoes_custodia (ordem_id, valor, tipo, status, detalhes)
      VALUES (?, ?, 'LIBERACAO_REPASSE', 'CONFIRMADO', 'Vistoria aprovada pelo cliente. Valor repassado à carteira do prestador.')
    `).run(id, valorRepasse);

    // 4. Registra avaliação caso informada
    if (nota) {
      const notaInt = Math.max(1, Math.min(5, parseInt(nota, 10)));
      db.prepare(`
        INSERT INTO avaliacoes (ordem_id, avaliador_id, avaliado_id, nota, comentario)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, cliente_id || ordem.cliente_id, ordem.prestador_id, notaInt, comentario || 'Serviço aprovado');

      // Recalcula média de reputação do prestador
      const avg = db.prepare(`SELECT AVG(nota) as media FROM avaliacoes WHERE avaliado_id = ?`).get(ordem.prestador_id);
      if (avg && avg.media) {
        db.prepare(`UPDATE usuarios SET reputacao = ROUND(?, 1) WHERE id = ?`).run(avg.media, ordem.prestador_id);
      }
    }

    res.json({
      sucesso: true,
      mensagem: 'Vistoria aprovada! Pagamento liberado com sucesso para a conta do prestador.',
      valor_liberado: valorRepasse,
      status: 'CONCLUIDO'
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, mensagem: error.message });
  }
};

// Abertura de Disputa / Contestação pelo Cliente
exports.abrirDisputa = (req, res) => {
  try {
    const { id } = req.params;
    const { motivo, detalhes } = req.body;

    const ordem = db.prepare('SELECT * FROM ordens_servico WHERE id = ?').get(id);
    if (!ordem) {
      return res.status(404).json({ sucesso: false, mensagem: 'Ordem de serviço não encontrada.' });
    }

    db.prepare(`
      UPDATE ordens_servico 
      SET status = 'EM_DISPUTA', atualizado_em = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);

    db.prepare(`
      INSERT INTO transacoes_custodia (ordem_id, valor, tipo, status, detalhes)
      VALUES (?, ?, 'ESTORNO_DISPUTA', 'EM_ANALISE', ?)
    `).run(id, ordem.valor_total, `Disputa aberta pelo cliente. Motivo: ${motivo || 'Serviço inconforme'}. Saldo congelado.`);

    res.json({
      sucesso: true,
      mensagem: 'Disputa registrada com sucesso. A liberação do pagamento foi congelada e a mediação foi acionada.',
      status: 'EM_DISPUTA'
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, mensagem: error.message });
  }
};

// Obter Estatísticas Gerais do Sistema (KPIs do Dashboard)
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
    res.status(500).json({ sucesso: false, mensagem: error.message });
  }
};

// Listar Usuários cadastrados (para troca de perfil na demonstração)
exports.listarUsuarios = (req, res) => {
  try {
    const usuarios = db.prepare('SELECT * FROM usuarios ORDER BY id ASC').all();
    res.json({ sucesso: true, dados: usuarios });
  } catch (error) {
    res.status(500).json({ sucesso: false, mensagem: error.message });
  }
};
