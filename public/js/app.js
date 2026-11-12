// FreeLA SaaS — Frontend Controller & API Client (Hardened)

let state = {
  currentRole: 'CLIENTE', // 'CLIENTE' ou 'PRESTADOR'
  currentUser: { id: 1, nome: 'Maria Santos', papel: 'CLIENTE' },
  activeTab: 'mural',
  ordens: [],
  stats: {},
  usuarios: []
};

// Função de Sanitização para Prevenção de XSS (Cross-Site Scripting)
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
  await carregarUsuarios();
  await carregarEstatisticas();
  await carregarOrdens();
  setupEventListeners();
});

// Carregar Usuários do Sistema
async function carregarUsuarios() {
  try {
    const res = await fetch('/api/usuarios');
    const json = await res.json();
    if (json.sucesso) {
      state.usuarios = json.dados;
      atualizarBadgeUsuario();
    }
  } catch (err) {
    console.error('Erro ao carregar usuários:', err);
  }
}

// Carregar KPIs do Dashboard
async function carregarEstatisticas() {
  try {
    const res = await fetch('/api/stats');
    const json = await res.json();
    if (json.sucesso) {
      state.stats = json.dados;
      document.getElementById('kpi-total').innerText = json.dados.total_ordens;
      document.getElementById('kpi-custodia').innerText = `R$ ${Number(json.dados.saldo_em_custodia).toFixed(2)}`;
      document.getElementById('kpi-repassado').innerText = `R$ ${Number(json.dados.total_repassado).toFixed(2)}`;
      document.getElementById('kpi-prestadores').innerText = json.dados.prestadores_ativos;
    }
  } catch (err) {
    console.error('Erro ao carregar estatísticas:', err);
  }
}

// Carregar Ordens de Serviço com Parâmetros Codificados
async function carregarOrdens() {
  try {
    const statusFiltro = encodeURIComponent(document.getElementById('filtro-status').value);
    const catFiltro = encodeURIComponent(document.getElementById('filtro-categoria').value);
    
    let url = '/api/ordens?';
    if (statusFiltro) url += `status=${statusFiltro}&`;
    if (catFiltro) url += `categoria=${catFiltro}&`;

    const res = await fetch(url);
    const json = await res.json();
    if (json.sucesso) {
      state.ordens = json.dados;
      renderizarOrdens();
    }
  } catch (err) {
    console.error('Erro ao carregar ordens:', err);
  }
}

// Renderizar Cards de Ordens com Sanitização Anti-XSS
function renderizarOrdens() {
  const container = document.getElementById('orders-container');
  container.innerHTML = '';

  if (state.ordens.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: #64748B; background: #FFF; border: 1px solid #E2E8F0; border-radius: 8px;">
        Nenhuma ordem de serviço encontrada com os filtros selecionados.
      </div>
    `;
    return;
  }

  state.ordens.forEach(o => {
    const orderId = parseInt(o.id, 10);
    const card = document.createElement('div');
    card.className = 'order-card';

    let actionButtons = '';

    if (state.currentRole === 'CLIENTE') {
      if (o.status === 'PENDENTE' || o.status === 'PROPOSTA_RECEBIDA') {
        actionButtons = `<button class="btn btn-secondary btn-sm" onclick="abrirModalDetalhes(${orderId})">Ver Propostas (${parseInt(o.total_propostas, 10)})</button>`;
      } else if (o.status === 'AGUARDANDO_VISTORIA') {
        actionButtons = `
          <button class="btn btn-success btn-sm" onclick="abrirModalAprovacao(${orderId})">Aprovar & Liberar</button>
          <button class="btn btn-danger btn-sm" onclick="abrirModalDisputa(${orderId})">Disputa</button>
        `;
      } else if (o.status === 'EM_CUSTODIA' || o.status === 'A_CAMINHO' || o.status === 'EM_EXECUCAO') {
        actionButtons = `<span style="font-size: 12px; color: #0284C7; font-weight: 600;">Em andamento</span>`;
      } else if (o.status === 'CONCLUIDO') {
        actionButtons = `<span style="font-size: 12px; color: #166534; font-weight: 600;">✓ Pago & Finalizado</span>`;
      } else if (o.status === 'EM_DISPUTA') {
        actionButtons = `<span style="font-size: 12px; color: #DC2626; font-weight: 600;">Em mediação</span>`;
      }
    } else {
      // PRESTADOR
      if (o.status === 'PENDENTE' || o.status === 'PROPOSTA_RECEBIDA') {
        actionButtons = `<button class="btn btn-primary btn-sm" onclick="abrirModalProposta(${orderId})">Enviar Orçamento</button>`;
      } else if (o.prestador_id === state.currentUser.id) {
        if (o.status === 'EM_CUSTODIA') {
          actionButtons = `<button class="btn btn-secondary btn-sm" onclick="atualizarStatusOrdem(${orderId}, 'A_CAMINHO')">A Caminho</button>`;
        } else if (o.status === 'A_CAMINHO') {
          actionButtons = `<button class="btn btn-primary btn-sm" onclick="atualizarStatusOrdem(${orderId}, 'EM_EXECUCAO')">Iniciar Reparo</button>`;
        } else if (o.status === 'EM_EXECUCAO') {
          actionButtons = `<button class="btn btn-success btn-sm" onclick="atualizarStatusOrdem(${orderId}, 'AGUARDANDO_VISTORIA')">Concluir Reparo</button>`;
        } else if (o.status === 'AGUARDANDO_VISTORIA') {
          actionButtons = `<span style="font-size: 12px; color: #B45309; font-weight: 600;">Aguardando Vistoria</span>`;
        }
      }
    }

    const valorExibicao = o.valor_total > 0 
      ? `R$ ${Number(o.valor_total).toFixed(2)}` 
      : (o.total_propostas > 0 ? `${parseInt(o.total_propostas, 10)} proposta(s)` : 'Aguardando orçamento');

    card.innerHTML = `
      <div>
        <div class="order-header">
          <span class="order-category">${escapeHtml(o.categoria)}</span>
          <span class="status-badge status-${escapeHtml(o.status)}">${formatarStatus(o.status)}</span>
        </div>
        <h4 class="order-title">#${orderId} - ${escapeHtml(o.titulo)}</h4>
        <p class="order-desc">${escapeHtml(o.descricao)}</p>
        <div class="order-meta">
          <div><strong>Cliente:</strong> ${escapeHtml(o.cliente_nome)} (${escapeHtml(o.cep)})</div>
          ${o.prestador_nome ? `<div><strong>Prestador:</strong> ${escapeHtml(o.prestador_nome)}</div>` : ''}
          <div><strong>Urgência:</strong> ${escapeHtml(o.urgencia)}</div>
        </div>
      </div>
      <div class="order-footer">
        <div class="order-price">${valorExibicao}</div>
        <div style="display: flex; gap: 6px;">
          ${actionButtons}
        </div>
      </div>
    `;

    container.appendChild(card);
  });
}

function formatarStatus(status) {
  const mapa = {
    'PENDENTE': 'Pendente',
    'PROPOSTA_RECEBIDA': 'Com Propostas',
    'EM_CUSTODIA': 'Em Custódia',
    'A_CAMINHO': 'A Caminho',
    'EM_EXECUCAO': 'Em Execução',
    'AGUARDANDO_VISTORIA': 'Vistoria Pendente',
    'CONCLUIDO': 'Concluído',
    'EM_DISPUTA': 'Em Disputa'
  };
  return mapa[status] || escapeHtml(status);
}

// Configurar Event Listeners
function setupEventListeners() {
  document.getElementById('filtro-status').addEventListener('change', carregarOrdens);
  document.getElementById('filtro-categoria').addEventListener('change', carregarOrdens);

  // Alternar papel Cliente / Prestador
  document.getElementById('btn-switch-role').addEventListener('click', () => {
    if (state.currentRole === 'CLIENTE') {
      state.currentRole = 'PRESTADOR';
      state.currentUser = state.usuarios.find(u => u.papel === 'PRESTADOR') || { id: 2, nome: 'Carlos Silva', papel: 'PRESTADOR' };
    } else {
      state.currentRole = 'CLIENTE';
      state.currentUser = state.usuarios.find(u => u.papel === 'CLIENTE') || { id: 1, nome: 'Maria Santos', papel: 'CLIENTE' };
    }
    atualizarBadgeUsuario();
    renderizarOrdens();
  });

  // Formulário de Nova Solicitação
  document.getElementById('form-nova-solicitacao').addEventListener('submit', async (e) => {
    e.preventDefault();
    const titulo = document.getElementById('input-titulo').value.trim();
    const categoria = document.getElementById('select-categoria').value;
    const descricao = document.getElementById('input-descricao').value.trim();
    const cep = document.getElementById('input-cep').value.trim();
    const endereco = document.getElementById('input-endereco').value.trim();
    const urgencia = document.getElementById('select-urgencia').value;

    if (!titulo || !descricao || !cep || !endereco) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    try {
      const res = await fetch('/api/ordens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: state.currentUser.id,
          titulo,
          categoria,
          descricao,
          cep,
          endereco,
          urgencia
        })
      });
      const json = await res.json();
      if (json.sucesso) {
        alert('Solicitação criada com sucesso! Os prestadores locais já podem enviar propostas.');
        document.getElementById('form-nova-solicitacao').reset();
        trocarAba('mural');
        await carregarEstatisticas();
        await carregarOrdens();
      } else {
        alert('Erro ao criar solicitação: ' + json.mensagem);
      }
    } catch (err) {
      alert('Erro na comunicação com a API: ' + err.message);
    }
  });
}

function atualizarBadgeUsuario() {
  const badge = document.getElementById('user-badge-info');
  badge.innerText = `${state.currentUser.nome} (${state.currentRole})`;
  document.getElementById('btn-switch-role').innerText = state.currentRole === 'CLIENTE' 
    ? 'Alternar para Prestador (Carlos)' 
    : 'Alternar para Cliente (Maria)';
}

function trocarAba(aba) {
  state.activeTab = aba;
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');

  if (aba === 'mural') {
    document.getElementById('tab-btn-mural').classList.add('active');
    document.getElementById('tab-mural').style.display = 'block';
    carregarOrdens();
  } else if (aba === 'nova') {
    document.getElementById('tab-btn-nova').classList.add('active');
    document.getElementById('tab-nova').style.display = 'block';
  }
}

// Modal de Detalhes e Checkout Sanitizado
async function abrirModalDetalhes(ordemId) {
  const safeId = parseInt(ordemId, 10);
  try {
    const res = await fetch(`/api/ordens/${safeId}`);
    const json = await res.json();
    if (!json.sucesso) return alert(json.mensagem);

    const o = json.dados;
    const modal = document.getElementById('modal');
    const modalBody = document.getElementById('modal-body');

    let propostasHtml = '';
    if (o.propostas.length === 0) {
      propostasHtml = '<p style="color: #64748B;">Nenhum orçamento enviado até o momento.</p>';
    } else {
      propostasHtml = o.propostas.map(p => {
        const propId = parseInt(p.id, 10);
        const valorProp = Number(p.valor);
        return `
          <div style="border: 1px solid #E2E8F0; padding: 12px; border-radius: 6px; margin-bottom: 8px; background: #F8FAFC;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <strong>${escapeHtml(p.prestador_nome)} (★ ${Number(p.prestador_reputacao).toFixed(1)})</strong>
              <span style="font-weight: 700; color: #0F172A;">R$ ${valorProp.toFixed(2)}</span>
            </div>
            <p style="font-size: 12px; color: #475569; margin: 4px 0;">Prazo: ${escapeHtml(p.prazo_estimado)}</p>
            <p style="font-size: 12px; color: #334155;">"${escapeHtml(p.mensagem)}"</p>
            <button class="btn btn-primary btn-sm" style="margin-top: 8px;" onclick="confirmarCheckout(${safeId}, ${propId}, ${valorProp})">
              Contratar com Custódia Protegida (Escrow)
            </button>
          </div>
        `;
      }).join('');
    }

    modalBody.innerHTML = `
      <div class="modal-header">
        <h3>Ordem de Serviço #${safeId} - ${escapeHtml(o.titulo)}</h3>
        <button onclick="fecharModal()" style="border:none; background:none; font-size:18px; cursor:pointer;">&times;</button>
      </div>
      <p style="margin-bottom: 12px;"><strong>Descrição:</strong> ${escapeHtml(o.descricao)}</p>
      <p style="margin-bottom: 16px;"><strong>Endereço:</strong> ${escapeHtml(o.endereco)} (${escapeHtml(o.cep)})</p>
      <h4 style="font-size: 14px; margin-bottom: 8px;">Propostas Recebidas:</h4>
      ${propostasHtml}
    `;

    modal.style.display = 'flex';
  } catch (err) {
    alert('Erro ao carregar detalhes: ' + err.message);
  }
}

// Confirmar Checkout com Custódia (Escrow)
async function confirmarCheckout(ordemId, propostaId, valorMaoObra) {
  const safeOrderId = parseInt(ordemId, 10);
  const safePropId = parseInt(propostaId, 10);
  const cupom = prompt('Deseja aplicar um cupom de desconto na taxa? Digite FREELA10 para 50% off na intermediação ou deixe em branco:', 'FREELA10');

  try {
    const res = await fetch(`/api/ordens/${safeOrderId}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proposta_id: safePropId,
        metodo_pagamento: 'PIX',
        cupom: cupom ? cupom.trim() : null
      })
    });
    const json = await res.json();
    if (json.sucesso) {
      alert(`PAGAMENTO EM CUSTÓDIA CONFIRMADO!\n\nValor Mão de Obra: R$ ${json.dados.valor_mao_obra.toFixed(2)}\nTaxa Intermediação: R$ ${json.dados.taxa_plataforma.toFixed(2)}\nTotal Retido no Escrow: R$ ${json.dados.valor_total.toFixed(2)}\n\nO valor está bloqueado com segurança e só será repassado ao prestador após sua vistoria e aprovação final.`);
      fecharModal();
      await carregarEstatisticas();
      await carregarOrdens();
    } else {
      alert('Erro no checkout: ' + json.mensagem);
    }
  } catch (err) {
    alert('Erro: ' + err.message);
  }
}

// Modal para Prestador Enviar Orçamento
function abrirModalProposta(ordemId) {
  const safeId = parseInt(ordemId, 10);
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');

  modalBody.innerHTML = `
    <div class="modal-header">
      <h3>Enviar Proposta de Orçamento (OS #${safeId})</h3>
      <button onclick="fecharModal()" style="border:none; background:none; font-size:18px; cursor:pointer;">&times;</button>
    </div>
    <div class="form-group">
      <label class="form-label">Valor da Mão de Obra (R$):</label>
      <input type="number" id="prop-valor" class="form-input" placeholder="Ex: 220.00" min="1" max="100000" step="0.50">
    </div>
    <div class="form-group">
      <label class="form-label">Estimativa de Prazo:</label>
      <input type="text" id="prop-prazo" class="form-input" placeholder="Ex: Amanhã às 14h (2 horas de trabalho)" maxlength="100">
    </div>
    <div class="form-group">
      <label class="form-label">Mensagem técnica explicativa:</label>
      <textarea id="prop-msg" class="form-textarea" rows="3" placeholder="Explique os materiais necessários ou sua experiência na área..." maxlength="1000"></textarea>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="submeterProposta(${safeId})">Enviar Proposta</button>
    </div>
  `;

  modal.style.display = 'flex';
}

async function submeterProposta(ordemId) {
  const safeId = parseInt(ordemId, 10);
  const valor = parseFloat(document.getElementById('prop-valor').value);
  const prazo_estimado = document.getElementById('prop-prazo').value.trim();
  const mensagem = document.getElementById('prop-msg').value.trim();

  if (isNaN(valor) || valor <= 0) return alert('Informe um valor de mão de obra válido superior a zero.');
  if (!prazo_estimado) return alert('Informe a estimativa de prazo.');

  try {
    const res = await fetch(`/api/ordens/${safeId}/propostas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prestador_id: state.currentUser.id,
        valor,
        prazo_estimado,
        mensagem
      })
    });
    const json = await res.json();
    if (json.sucesso) {
      alert('Proposta enviada ao cliente com sucesso!');
      fecharModal();
      await carregarOrdens();
    } else {
      alert('Erro: ' + json.mensagem);
    }
  } catch (err) {
    alert('Erro: ' + err.message);
  }
}

// Atualizar Status da Ordem pelo Prestador
async function atualizarStatusOrdem(ordemId, novoStatus) {
  const safeId = parseInt(ordemId, 10);
  try {
    const res = await fetch(`/api/ordens/${safeId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ novo_status: novoStatus })
    });
    const json = await res.json();
    if (json.sucesso) {
      alert(json.mensagem);
      await carregarOrdens();
    } else {
      alert('Erro: ' + json.mensagem);
    }
  } catch (err) {
    alert('Erro: ' + err.message);
  }
}

// Modal de Vistoria e Aprovação Final (Liberação do Escrow)
function abrirModalAprovacao(ordemId) {
  const safeId = parseInt(ordemId, 10);
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');

  modalBody.innerHTML = `
    <div class="modal-header">
      <h3>Vistoria e Liberação de Repasse (OS #${safeId})</h3>
      <button onclick="fecharModal()" style="border:none; background:none; font-size:18px; cursor:pointer;">&times;</button>
    </div>
    <div class="escrow-banner" style="margin-bottom: 16px;">
      <div class="escrow-banner-text">
        <strong>Liberação Financeira Irreversível</strong>
        <p>Ao aprovar a conclusão do reparo, o valor bloqueado na conta de custódia será imediatamente transferido para a carteira do prestador.</p>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Avaliação do Prestador (1 a 5 estrelas):</label>
      <select id="aprov-nota" class="form-select">
        <option value="5">★★★★★ 5 Estrelas (Excelente)</option>
        <option value="4">★★★★☆ 4 Estrelas (Muito Bom)</option>
        <option value="3">★★★☆☆ 3 Estrelas (Satisfatório)</option>
        <option value="2">★★☆☆☆ 2 Estrelas (Abaixo do esperado)</option>
        <option value="1">★☆☆☆☆ 1 Estrela (Ruim)</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Comentário sobre a execução do reparo:</label>
      <textarea id="aprov-comentario" class="form-textarea" rows="3" placeholder="Descreva a qualidade do reparo, pontualidade e limpeza..." maxlength="500"></textarea>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-success" onclick="submeterAprovacao(${safeId})">Aprovar Conclusão & Liberar Dinheiro</button>
    </div>
  `;

  modal.style.display = 'flex';
}

async function submeterAprovacao(ordemId) {
  const safeId = parseInt(ordemId, 10);
  const nota = parseInt(document.getElementById('aprov-nota').value, 10);
  const comentario = document.getElementById('aprov-comentario').value.trim();

  try {
    const res = await fetch(`/api/ordens/${safeId}/aprovar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cliente_id: state.currentUser.id,
        nota,
        comentario
      })
    });
    const json = await res.json();
    if (json.sucesso) {
      alert(`SUCESSO!\n\n${json.mensagem}\nValor repassado: R$ ${Number(json.valor_liberado).toFixed(2)}`);
      fecharModal();
      await carregarEstatisticas();
      await carregarOrdens();
    } else {
      alert('Erro: ' + json.mensagem);
    }
  } catch (err) {
    alert('Erro: ' + err.message);
  }
}

// Modal de Abertura de Disputa
function abrirModalDisputa(ordemId) {
  const safeId = parseInt(ordemId, 10);
  const motivo = prompt('Por favor, descreva sucintamente a inconformidade identificada no reparo para acionar a mediação:');
  if (!motivo) return;

  fetch(`/api/ordens/${safeId}/disputa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ motivo: motivo.trim() })
  })
  .then(res => res.json())
  .then(json => {
    if (json.sucesso) {
      alert(json.mensagem);
      carregarOrdens();
    } else {
      alert('Erro: ' + json.mensagem);
    }
  })
  .catch(err => alert('Erro: ' + err.message));
}

function fecharModal() {
  document.getElementById('modal').style.display = 'none';
}
