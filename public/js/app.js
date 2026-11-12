// FreeLA SaaS — Frontend Controller & API Client

let state = {
  currentRole: 'CLIENTE', // 'CLIENTE' ou 'PRESTADOR'
  currentUser: { id: 1, nome: 'Maria Santos', papel: 'CLIENTE' },
  activeTab: 'mural',
  ordens: [],
  stats: {},
  usuarios: []
};

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

// Carregar Ordens de Serviço
async function carregarOrdens() {
  try {
    const statusFiltro = document.getElementById('filtro-status').value;
    const catFiltro = document.getElementById('filtro-categoria').value;
    
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

// Renderizar Cards de Ordens
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
    const card = document.createElement('div');
    card.className = 'order-card';

    // Ações contextuais de acordo com o papel e status
    let actionButtons = '';

    if (state.currentRole === 'CLIENTE') {
      if (o.status === 'PENDENTE' || o.status === 'PROPOSTA_RECEBIDA') {
        actionButtons = `<button class="btn btn-secondary btn-sm" onclick="abrirModalDetalhes(${o.id})">Ver Propostas (${o.total_propostas})</button>`;
      } else if (o.status === 'AGUARDANDO_VISTORIA') {
        actionButtons = `
          <button class="btn btn-success btn-sm" onclick="abrirModalAprovacao(${o.id})">Aprovar & Liberar</button>
          <button class="btn btn-danger btn-sm" onclick="abrirModalDisputa(${o.id})">Disputa</button>
        `;
      } else if (o.status === 'EM_CUSTODIA' || o.status === 'A_CAMINHO' || o.status === 'EM_EXECUCAO') {
        actionButtons = `<span style="font-size: 12px; color: #0284C7; font-weight: 600;">Em andamento</span>`;
      } else if (o.status === 'CONCLUIDO') {
        actionButtons = `<span style="font-size: 12px; color: #166534; font-weight: 600;">✓ Pago & Finalizado</span>`;
      }
    } else {
      // PRESTADOR
      if (o.status === 'PENDENTE' || o.status === 'PROPOSTA_RECEBIDA') {
        actionButtons = `<button class="btn btn-primary btn-sm" onclick="abrirModalProposta(${o.id})">Enviar Orçamento</button>`;
      } else if (o.prestador_id === state.currentUser.id) {
        if (o.status === 'EM_CUSTODIA') {
          actionButtons = `<button class="btn btn-secondary btn-sm" onclick="atualizarStatusOrdem(${o.id}, 'A_CAMINHO')">A Caminho</button>`;
        } else if (o.status === 'A_CAMINHO') {
          actionButtons = `<button class="btn btn-primary btn-sm" onclick="atualizarStatusOrdem(${o.id}, 'EM_EXECUCAO')">Iniciar Reparo</button>`;
        } else if (o.status === 'EM_EXECUCAO') {
          actionButtons = `<button class="btn btn-success btn-sm" onclick="atualizarStatusOrdem(${o.id}, 'AGUARDANDO_VISTORIA')">Concluir Reparo</button>`;
        } else if (o.status === 'AGUARDANDO_VISTORIA') {
          actionButtons = `<span style="font-size: 12px; color: #B45309; font-weight: 600;">Aguardando Vistoria</span>`;
        }
      }
    }

    const valorExibicao = o.valor_total > 0 
      ? `R$ ${Number(o.valor_total).toFixed(2)}` 
      : (o.total_propostas > 0 ? `${o.total_propostas} proposta(s)` : 'Aguardando orçamento');

    card.innerHTML = `
      <div>
        <div class="order-header">
          <span class="order-category">${o.categoria}</span>
          <span class="status-badge status-${o.status}">${formatarStatus(o.status)}</span>
        </div>
        <h4 class="order-title">#${o.id} - ${o.titulo}</h4>
        <p class="order-desc">${o.descricao}</p>
        <div class="order-meta">
          <div><strong>Cliente:</strong> ${o.cliente_nome} (${o.cep})</div>
          ${o.prestador_nome ? `<div><strong>Prestador:</strong> ${o.prestador_nome}</div>` : ''}
          <div><strong>Urgência:</strong> ${o.urgencia}</div>
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
  return mapa[status] || status;
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
    const titulo = document.getElementById('input-titulo').value;
    const categoria = document.getElementById('select-categoria').value;
    const descricao = document.getElementById('input-descricao').value;
    const cep = document.getElementById('input-cep').value;
    const endereco = document.getElementById('input-endereco').value;
    const urgencia = document.getElementById('select-urgencia').value;

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

// Modal de Detalhes e Checkout para o Cliente
async function abrirModalDetalhes(ordemId) {
  try {
    const res = await fetch(`/api/ordens/${ordemId}`);
    const json = await res.json();
    if (!json.sucesso) return alert(json.mensagem);

    const o = json.dados;
    const modal = document.getElementById('modal');
    const modalBody = document.getElementById('modal-body');

    let propostasHtml = '';
    if (o.propostas.length === 0) {
      propostasHtml = '<p style="color: #64748B;">Nenhum orçamento enviado até o momento.</p>';
    } else {
      propostasHtml = o.propostas.map(p => `
        <div style="border: 1px solid #E2E8F0; padding: 12px; border-radius: 6px; margin-bottom: 8px; background: #F8FAFC;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <strong>${p.prestador_nome} (★ ${p.prestador_reputacao})</strong>
            <span style="font-weight: 700; color: #0F172A;">R$ ${Number(p.valor).toFixed(2)}</span>
          </div>
          <p style="font-size: 12px; color: #475569; margin: 4px 0;">Prazo: ${p.prazo_estimado}</p>
          <p style="font-size: 12px; color: #334155;">"${p.mensagem}"</p>
          <button class="btn btn-primary btn-sm" style="margin-top: 8px;" onclick="confirmarCheckout(${o.id}, ${p.id}, ${p.valor})">
            Contratar com Custódia Protegida (Escrow)
          </button>
        </div>
      `).join('');
    }

    modalBody.innerHTML = `
      <div class="modal-header">
        <h3>Ordem de Serviço #${o.id} - ${o.titulo}</h3>
        <button onclick="fecharModal()" style="border:none; background:none; font-size:18px; cursor:pointer;">&times;</button>
      </div>
      <p style="margin-bottom: 12px;"><strong>Descrição:</strong> ${o.descricao}</p>
      <p style="margin-bottom: 16px;"><strong>Endereço:</strong> ${o.endereco} (${o.cep})</p>
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
  const cupom = prompt('Deseja aplicar um cupom de desconto na taxa? Digite FREELA10 para 50% off na intermediação ou deixe em branco:', 'FREELA10');

  try {
    const res = await fetch(`/api/ordens/${ordemId}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proposta_id: propostaId,
        metodo_pagamento: 'PIX',
        cupom: cupom || null
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
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');

  modalBody.innerHTML = `
    <div class="modal-header">
      <h3>Enviar Proposta de Orçamento (OS #${ordemId})</h3>
      <button onclick="fecharModal()" style="border:none; background:none; font-size:18px; cursor:pointer;">&times;</button>
    </div>
    <div class="form-group">
      <label class="form-label">Valor da Mão de Obra (R$):</label>
      <input type="number" id="prop-valor" class="form-input" placeholder="Ex: 220.00" step="0.50">
    </div>
    <div class="form-group">
      <label class="form-label">Estimativa de Prazo:</label>
      <input type="text" id="prop-prazo" class="form-input" placeholder="Ex: Amanhã às 14h (2 horas de trabalho)">
    </div>
    <div class="form-group">
      <label class="form-label">Mensagem técnica explicativa:</label>
      <textarea id="prop-msg" class="form-textarea" rows="3" placeholder="Explique os materiais necessários ou sua experiência na área..."></textarea>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="submeterProposta(${ordemId})">Enviar Proposta</button>
    </div>
  `;

  modal.style.display = 'flex';
}

async function submeterProposta(ordemId) {
  const valor = document.getElementById('prop-valor').value;
  const prazo_estimado = document.getElementById('prop-prazo').value;
  const mensagem = document.getElementById('prop-msg').value;

  if (!valor || !prazo_estimado) return alert('Preencha o valor e o prazo.');

  try {
    const res = await fetch(`/api/ordens/${ordemId}/propostas`, {
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
  try {
    const res = await fetch(`/api/ordens/${ordemId}/status`, {
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
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');

  modalBody.innerHTML = `
    <div class="modal-header">
      <h3>Vistoria e Liberação de Repasse (OS #${ordemId})</h3>
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
      <textarea id="aprov-comentario" class="form-textarea" rows="3" placeholder="Descreva a qualidade do reparo, pontualidade e limpeza..."></textarea>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-success" onclick="submeterAprovacao(${ordemId})">Aprovar Conclusão & Liberar Dinheiro</button>
    </div>
  `;

  modal.style.display = 'flex';
}

async function submeterAprovacao(ordemId) {
  const nota = document.getElementById('aprov-nota').value;
  const comentario = document.getElementById('aprov-comentario').value;

  try {
    const res = await fetch(`/api/ordens/${ordemId}/aprovar`, {
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
      alert(`SUCESSO!\n\n${json.mensagem}\nValor repassado: R$ ${json.valor_liberado.toFixed(2)}`);
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
  const motivo = prompt('Por favor, descreva sucintamente a inconformidade identificada no reparo para acionar a mediação:');
  if (!motivo) return;

  fetch(`/api/ordens/${ordemId}/disputa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ motivo })
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
