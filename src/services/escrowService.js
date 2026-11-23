// Motor Transacional de Custódia Financeira (Escrow Engine) — FreeLA
// Camada de Negócio Desacoplada e Atômica (ACID)
const db = require('../database/connection');
const notificationService = require('./notificationService');

class EscrowService {
  /**
   * Bloqueia fundos do cliente em conta vinculada de garantia (Escrow)
   */
  bloquearCustodia({ ordemId, propostaId, metodoPagamento, cupom }) {
    const ordem = db.prepare('SELECT * FROM ordens_servico WHERE id = ?').get(ordemId);
    if (!ordem) {
      const err = new Error('Ordem de serviço não encontrada.');
      err.status = 404;
      throw err;
    }

    if (ordem.status !== 'PENDENTE' && ordem.status !== 'PROPOSTA_RECEBIDA') {
      const err = new Error(`Operação recusada: Esta ordem já possui pagamento ou status '${ordem.status}'.`);
      err.status = 400;
      throw err;
    }

    let proposta;
    if (propostaId) {
      proposta = db.prepare('SELECT * FROM propostas WHERE id = ? AND ordem_id = ?').get(propostaId, ordemId);
    } else {
      proposta = db.prepare('SELECT * FROM propostas WHERE ordem_id = ? ORDER BY id DESC LIMIT 1').get(ordemId);
    }

    if (!proposta) {
      const err = new Error('Nenhuma proposta válida encontrada para contratação.');
      err.status = 400;
      throw err;
    }

    const valorMaoObra = parseFloat(proposta.valor);
    if (isNaN(valorMaoObra) || valorMaoObra <= 0) {
      const err = new Error('Valor de mão de obra inválido.');
      err.status = 400;
      throw err;
    }

    let taxaPlataforma = Math.round(valorMaoObra * 0.08 * 100) / 100;
    if (taxaPlataforma < 15.0) taxaPlataforma = 15.0;

    const cupomSan = (cupom || '').trim().toUpperCase();
    if (cupomSan === 'FREELA10') {
      taxaPlataforma = Math.round(taxaPlataforma * 0.5 * 100) / 100; // 50% de desconto na taxa
    }

    const valorTotal = Math.round((valorMaoObra + taxaPlataforma) * 100) / 100;
    const metodoSan = (metodoPagamento === 'CARTAO_CREDITO') ? 'CARTAO_CREDITO' : 'PIX';

    // Transação Atômica ACID
    db.exec('BEGIN TRANSACTION;');
    try {
      db.prepare(`UPDATE propostas SET status = 'ACEITA' WHERE id = ?`).run(proposta.id);
      db.prepare(`UPDATE propostas SET status = 'RECUSADA' WHERE ordem_id = ? AND id != ?`).run(ordemId, proposta.id);

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
      `).run(proposta.prestador_id, valorMaoObra, taxaPlataforma, valorTotal, metodoSan, ordemId);

      db.prepare(`
        INSERT INTO transacoes_custodia (ordem_id, valor, tipo, status, detalhes)
        VALUES (?, ?, 'BLOQUEIO_ESCROW', 'CONFIRMADO', ?)
      `).run(ordemId, valorTotal, `Fundos retidos via ${metodoSan}. Bloqueado em conta escrow protegida.`);

      db.prepare(`
        UPDATE usuarios 
        SET saldo_custodia = saldo_custodia + ? 
        WHERE id = ?
      `).run(valorMaoObra, proposta.prestador_id);

      db.exec('COMMIT;');
    } catch (txErr) {
      db.exec('ROLLBACK;');
      throw txErr;
    }

    // Disparo de notificação multicanal
    const prestador = db.prepare('SELECT nome FROM usuarios WHERE id = ?').get(proposta.prestador_id);
    notificationService.notificarBloqueioEscrow(ordem, valorTotal, prestador ? prestador.nome : 'Profissional');

    return {
      ordem_id: ordemId,
      status: 'EM_CUSTODIA',
      valor_mao_obra: valorMaoObra,
      taxa_plataforma: taxaPlataforma,
      valor_total: valorTotal,
      prestador_id: proposta.prestador_id
    };
  }

  /**
   * Homologa a vistoria presencial e liquida o repasse de forma irreversível
   */
  liberarRepasse({ ordemId, clienteId, nota, comentario }) {
    const ordem = db.prepare('SELECT * FROM ordens_servico WHERE id = ?').get(ordemId);
    if (!ordem) {
      const err = new Error('Ordem de serviço não encontrada.');
      err.status = 404;
      throw err;
    }

    // Validação estrita de Autorização: apenas o titular pode liberar o pagamento
    const solicitanteId = parseInt(clienteId, 10);
    if (!solicitanteId || solicitanteId !== ordem.cliente_id) {
      const err = new Error('Acesso negado: Apenas o cliente titular desta ordem pode homologar a vistoria e autorizar o repasse financeiro.');
      err.status = 403;
      throw err;
    }

    // Validação estrita de Ciclo de Vida: proibido aprovar antes de vistoria pendente
    if (ordem.status !== 'AGUARDANDO_VISTORIA') {
      const err = new Error(`Operação inválida: O repasse só pode ser liberado após o prestador concluir o reparo e o status avançar para 'AGUARDANDO_VISTORIA'. Status atual: '${ordem.status}'.`);
      err.status = 400;
      throw err;
    }

    const valorRepasse = parseFloat(ordem.valor_mao_obra);
    const notaNum = Math.max(1, Math.min(5, parseInt(nota, 10) || 5));
    const comentarioSan = (comentario || 'Vistoria aprovada presencialmente. Repasse autorizado.').trim();

    db.exec('BEGIN TRANSACTION;');
    try {
      db.prepare(`
        UPDATE ordens_servico 
        SET status = 'CONCLUIDO', atualizado_em = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(ordemId);

      db.prepare(`
        UPDATE usuarios 
        SET saldo_custodia = MAX(0, saldo_custodia - ?),
            saldo_disponivel = saldo_disponivel + ?
        WHERE id = ?
      `).run(valorRepasse, valorRepasse, ordem.prestador_id);

      db.prepare(`
        INSERT INTO transacoes_custodia (ordem_id, valor, tipo, status, detalhes)
        VALUES (?, ?, 'LIBERACAO_REPASSE', 'CONFIRMADO', 'Vistoria presencial homologada pelo cliente titular. Repasse liquidado.')
      `).run(ordemId, valorRepasse);

      // Avaliação formal com integridade referencial mútua
      db.prepare(`
        INSERT INTO avaliacoes (ordem_id, avaliador_id, avaliado_id, nota, comentario)
        VALUES (?, ?, ?, ?, ?)
      `).run(ordemId, solicitanteId, ordem.prestador_id, notaNum, comentarioSan);

      // Recalcular média ponderada de reputação
      const avg = db.prepare('SELECT AVG(nota) as media FROM avaliacoes WHERE avaliado_id = ?').get(ordem.prestador_id);
      if (avg && avg.media) {
        db.prepare('UPDATE usuarios SET reputacao = ROUND(?, 1) WHERE id = ?').run(avg.media, ordem.prestador_id);
      }

      db.exec('COMMIT;');
    } catch (txErr) {
      db.exec('ROLLBACK;');
      throw txErr;
    }

    notificationService.notificarMudancaStatus(ordem, 'CONCLUIDO');

    return {
      valor_liberado: valorRepasse,
      status: 'CONCLUIDO'
    };
  }

  /**
   * Resgate via PIX do saldo disponível
   */
  processarSaque({ prestadorId, valor, chavePix }) {
    const pId = parseInt(prestadorId, 10);
    const valorNum = parseFloat(valor);

    if (isNaN(pId) || isNaN(valorNum) || valorNum <= 0) {
      const err = new Error('Valor de saque ou identificador inválido.');
      err.status = 400;
      throw err;
    }

    const prestador = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(pId);
    if (!prestador || prestador.papel !== 'PRESTADOR') {
      const err = new Error('Prestador não encontrado no sistema.');
      err.status = 404;
      throw err;
    }

    if (prestador.saldo_disponivel < valorNum) {
      const err = new Error(`Saldo insuficiente para saque. Disponível: R$ ${Number(prestador.saldo_disponivel).toFixed(2)}`);
      err.status = 400;
      throw err;
    }

    db.exec('BEGIN TRANSACTION;');
    let novoSaldo = 0;
    try {
      db.prepare('UPDATE usuarios SET saldo_disponivel = saldo_disponivel - ? WHERE id = ?').run(valorNum, pId);
      novoSaldo = prestador.saldo_disponivel - valorNum;
      db.exec('COMMIT;');
    } catch (txErr) {
      db.exec('ROLLBACK;');
      throw txErr;
    }

    const chaveSan = (chavePix || 'Chave PIX padrão cadastrada').trim();
    notificationService.enviarWhatsApp(prestador.telefone, `Saque PIX de R$ ${valorNum.toFixed(2)} confirmado para a chave [${chaveSan}].`, pId);
    notificationService.enviarEmail(prestador.email, 'Comprovante de Saque PIX', `Transferência de R$ ${valorNum.toFixed(2)} processada com sucesso.`, pId);

    return {
      valor_sacado: valorNum,
      novo_saldo: novoSaldo,
      chave_pix: chaveSan
    };
  }

  /**
   * Arbitragem e resolução formal de disputa
   */
  resolverArbitragem({ ordemId, decisao, justificativa }) {
    const ordem = db.prepare('SELECT * FROM ordens_servico WHERE id = ?').get(ordemId);
    if (!ordem || ordem.status !== 'EM_DISPUTA') {
      const err = new Error('Esta ordem não se encontra em mediação de disputa.');
      err.status = 400;
      throw err;
    }

    const decisaoSan = (decisao === 'REPASSE_PRESTADOR') ? 'REPASSE_PRESTADOR' : 'ESTORNO_CLIENTE';
    const justSan = (justificativa || 'Parecer de mediação emitido pelo suporte técnico.').trim();

    db.exec('BEGIN TRANSACTION;');
    try {
      if (decisaoSan === 'REPASSE_PRESTADOR') {
        db.prepare("UPDATE ordens_servico SET status = 'CONCLUIDO', atualizado_em = CURRENT_TIMESTAMP WHERE id = ?").run(ordemId);
        db.prepare(`
          UPDATE usuarios 
          SET saldo_custodia = MAX(0, saldo_custodia - ?), 
              saldo_disponivel = saldo_disponivel + ? 
          WHERE id = ?
        `).run(ordem.valor_mao_obra, ordem.valor_mao_obra, ordem.prestador_id);
        
        db.prepare(`
          INSERT INTO transacoes_custodia (ordem_id, valor, tipo, status, detalhes)
          VALUES (?, ?, 'LIBERACAO_REPASSE', 'CONFIRMADO', ?)
        `).run(ordemId, ordem.valor_mao_obra, `Arbitragem concluída a favor do prestador. Parecer: ${justSan}`);
      } else {
        db.prepare("UPDATE ordens_servico SET status = 'CANCELADO', atualizado_em = CURRENT_TIMESTAMP WHERE id = ?").run(ordemId);
        db.prepare(`
          UPDATE usuarios 
          SET saldo_custodia = MAX(0, saldo_custodia - ?) 
          WHERE id = ?
        `).run(ordem.valor_mao_obra, ordem.prestador_id);

        db.prepare(`
          INSERT INTO transacoes_custodia (ordem_id, valor, tipo, status, detalhes)
          VALUES (?, ?, 'ESTORNO_DISPUTA', 'CONFIRMADO', ?)
        `).run(ordemId, ordem.valor_total, `Arbitragem concluída com estorno integral ao cliente. Parecer: ${justSan}`);
      }
      db.exec('COMMIT;');
    } catch (txErr) {
      db.exec('ROLLBACK;');
      throw txErr;
    }

    notificationService.notificarMudancaStatus(ordem, decisaoSan === 'REPASSE_PRESTADOR' ? 'CONCLUIDO' : 'CANCELADO');

    return {
      ordem_id: ordemId,
      decisao: decisaoSan,
      status_final: (decisaoSan === 'REPASSE_PRESTADOR' ? 'CONCLUIDO' : 'CANCELADO')
    };
  }
}

module.exports = new EscrowService();
