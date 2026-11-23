// Serviço Integrado de Mensageria & Notificações (WhatsApp & E-mail) — FreeLA
const db = require('../database/connection');

class NotificationService {
  /**
   * Disparo simulado e persistência de mensagens WhatsApp
   */
  async enviarWhatsApp(destinatarioTelefone, mensagem, usuarioId = null) {
    if (!destinatarioTelefone) return false;
    
    const telefoneLimpo = destinatarioTelefone.replace(/\D/g, '');
    const dataHora = new Date().toLocaleTimeString('pt-BR');
    
    console.log(`\x1b[32m[WHATSAPP DISPATCH ${dataHora}]\x1b[0m Para +55 ${telefoneLimpo}: "${mensagem}"`);
    
    try {
      db.prepare(`
        INSERT INTO notificacoes_log (usuario_id, canal, destinatario, mensagem, status)
        VALUES (?, 'WHATSAPP', ?, ?, 'ENVIADO')
      `).run(usuarioId, destinatarioTelefone, mensagem);
      return true;
    } catch (err) {
      console.error('[ERRO LOG WHATSAPP]:', err.message);
      return false;
    }
  }

  /**
   * Disparo simulado e persistência de E-mail transacional
   */
  async enviarEmail(destinatarioEmail, assunto, corpoHtml, usuarioId = null) {
    if (!destinatarioEmail) return false;
    
    const dataHora = new Date().toLocaleTimeString('pt-BR');
    console.log(`\x1b[36m[EMAIL DISPATCH ${dataHora}]\x1b[0m Para: <${destinatarioEmail}> | Assunto: [FreeLA] ${assunto}`);
    
    try {
      db.prepare(`
        INSERT INTO notificacoes_log (usuario_id, canal, destinatario, assunto, mensagem, status)
        VALUES (?, 'EMAIL', ?, ?, ?, 'ENVIADO')
      `).run(usuarioId, destinatarioEmail, assunto, corpoHtml);
      return true;
    } catch (err) {
      console.error('[ERRO LOG EMAIL]:', err.message);
      return false;
    }
  }

  /**
   * Notificação multicanal de alteração de status
   */
  async notificarMudancaStatus(ordem, novoStatus) {
    const cliente = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(ordem.cliente_id);
    const prestador = ordem.prestador_id 
      ? db.prepare('SELECT * FROM usuarios WHERE id = ?').get(ordem.prestador_id) 
      : null;

    const statusFormatado = {
      'A_CAMINHO': 'O prestador está a caminho da sua residência.',
      'EM_EXECUCAO': 'O serviço foi iniciado presencialmente.',
      'AGUARDANDO_VISTORIA': 'O reparo foi concluído! Realize a vistoria presencial para liberar o pagamento.',
      'CONCLUIDO': 'Vistoria aprovada! Pagamento repassado ao prestador com sucesso.',
      'EM_DISPUTA': 'Uma contestação foi aberta na ordem de serviço. O saldo em custódia foi congelado.'
    }[novoStatus] || `Status atualizado para ${novoStatus}`;

    if (cliente) {
      const msgWhats = `Olá ${cliente.nome}! Atualização no chamado OS #${ordem.id} (${ordem.categoria}): ${statusFormatado}`;
      await this.enviarWhatsApp(cliente.telefone, msgWhats, cliente.id);
      await this.enviarEmail(cliente.email, `Atualização do Chamado #${ordem.id}`, msgWhats, cliente.id);
    }

    if (prestador && novoStatus === 'AGUARDANDO_VISTORIA') {
      const msgPrestador = `Olá ${prestador.nome}! A OS #${ordem.id} aguarda vistoria do cliente. Seu repasse de R$ ${Number(ordem.valor_mao_obra).toFixed(2)} será liberado pós-aprovação.`;
      await this.enviarWhatsApp(prestador.telefone, msgPrestador, prestador.id);
    }
  }

  /**
   * Notificação de bloqueio em custódia (Checkout)
   */
  async notificarBloqueioEscrow(ordem, valorTotal, prestadorNome) {
    const cliente = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(ordem.cliente_id);
    if (cliente) {
      const msg = `Pagamento confirmado para OS #${ordem.id}! O valor de R$ ${Number(valorTotal).toFixed(2)} está retido com segurança no FreeLA Escrow™. O prestador ${prestadorNome} já foi acionado.`;
      await this.enviarWhatsApp(cliente.telefone, msg, cliente.id);
      await this.enviarEmail(cliente.email, `Comprovante de Custódia — OS #${ordem.id}`, msg, cliente.id);
    }
  }

  /**
   * Listar histórico recente de notificações para o frontend
   */
  listarNotificacoesRecentes() {
    return db.prepare(`
      SELECT n.*, u.nome as usuario_nome
      FROM notificacoes_log n
      LEFT JOIN usuarios u ON n.usuario_id = u.id
      ORDER BY n.id DESC
      LIMIT 20
    `).all();
  }
}

module.exports = new NotificationService();
