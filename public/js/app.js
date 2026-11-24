// FreeLA SaaS — Frontend Controller & Advanced Platform Manager

let state = {
  currentRole: 'CLIENTE', // 'CLIENTE' ou 'PRESTADOR'
  currentUser: { id: 1, nome: 'Maria Santos', papel: 'CLIENTE' },
  activeTab: 'mural',
  ordens: [],
  transacoes: [],
  stats: {},
  usuarios: []
};

// Estimativas regionais de mão de obra (Volta Redonda / Sul Fluminense)
const ESTIMATIVAS_PRECO = {
  'Elétrica': { min: 180, max: 380, desc: 'Instalação de disjuntores, chuveiros, tomadas e revisão de fiação.' },
  'Hidráulica': { min: 150, max: 320, desc: 'Desentupimentos, reparo de vazamentos em canos e troca de sifões.' },
  'Pintura': { min: 350, max: 950, desc: 'Pintura de cômodos, aplicação de massa corrida e impermeabilização.' },
  'Alvenaria': { min: 300, max: 1200, desc: 'Assentamento de pisos, reparo em reboco, paredes e calçadas.' },
  'Climatização': { min: 200, max: 550, desc: 'Higienização preventiva, carga de gás e instalação de splits.' }
};

const CATEGORIA_ICONS = {
  'Elétrica': '⚡',
  'Hidráulica': '💧',
  'Pintura': '🎨',
  'Alvenaria': '🧱',
  'Climatização': '❄️'
};

// Função de Sanitização para Prevenção de XSS
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Inicialização da Aplicação
document.addEventListener('DOMContentLoaded', async () => {
  await carregarUsuarios();
  await carregarEstatisticas();
  await carregarOrdens();
  await carregarTransacoes();
  await carregarNotificacoes();
  setupEventListeners();
  atualizarEstimativaPreco();

  if (window.location.hash) {
    const abaHash = window.location.hash.replace('#', '');
    if (['mural', 'nova', 'escrow', 'carteira', 'disputas', 'notificacoes'].includes(abaHash)) {
      trocarAba(abaHash);
    }
  }
});

// Carregar Usuários do Sistema
async function carregarUsuarios() {
  try {
    const res = await fetch('/api/usuarios');
    const json = await res.json();
    if (json.sucesso) {
      state.usuarios = json.dados;
      atualizarBadgeUsuario();
      atualizarCarteiraPrestador();
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

// Carregar Ordens de Serviço com Filtros
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
      document.getElementById('badge-total-ordens').innerText = json.dados.length;
      
      const totalDisputas = json.dados.filter(o => o.status === 'EM_DISPUTA').length;
      document.getElementById('badge-total-disputas').innerText = totalDisputas;

      renderizarOrdens();
      renderizarDisputas();
    }
  } catch (err) {
    console.error('Erro ao carregar ordens:', err);
  }
}

// Carregar Livro-Razão Escrow (Transações)
async function carregarTransacoes() {
  try {
    const res = await fetch('/api/transacoes');
    const json = await res.json();
    if (json.sucesso) {
      state.transacoes = json.dados;
      document.getElementById('badge-total-transacoes').innerText = json.dados.length;
      renderizarTransacoes();
    }
  } catch (err) {
    console.error('Erro ao carregar transações:', err);
  }
}

// Renderizar Mural de Ordens com Step Bar e Micro-interações
function renderizarOrdens() {
  const container = document.getElementById('orders-container');
  container.innerHTML = '';

  const busca = (document.getElementById('filtro-busca').value || '').toLowerCase().trim();

  const filtradas = state.ordens.filter(o => {
    if (!busca) return true;
    return (
      o.titulo.toLowerCase().includes(busca) ||
      o.descricao.toLowerCase().includes(busca) ||
      o.cep.toLowerCase().includes(busca) ||
      o.endereco.toLowerCase().includes(busca) ||
      o.categoria.toLowerCase().includes(busca)
    );
  });

  if (filtradas.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 48px 20px; text-align: center; color: #64748B; background: #FFF; border: 1px dashed #CBD5E1; border-radius: 10px;">
        <div style="font-size: 32px; margin-bottom: 8px;">🔍</div>
        <strong style="font-size: 15px; color: #0F172A;">Nenhum chamado encontrado</strong>
        <p style="font-size: 13px; margin-top: 4px;">Tente alterar os filtros de especialidade ou o termo de busca.</p>
      </div>
    `;
    return;
  }

  filtradas.forEach(o => {
    const orderId = parseInt(o.id, 10);
    const card = document.createElement('div');
    card.className = 'order-card';

    // Ações contextuais de acordo com o papel e status
    let actionButtons = '';

    if (state.currentRole === 'CLIENTE') {
      if (o.status === 'PENDENTE' || o.status === 'PROPOSTA_RECEBIDA') {
        actionButtons = `<button class="btn btn-secondary btn-sm" onclick="abrirModalDetalhes(${orderId})">Ver Propostas (${parseInt(o.total_propostas, 10)})</button>`;
      } else if (o.status === 'AGUARDANDO_VISTORIA') {
        actionButtons = `
          <button class="btn btn-success btn-sm" onclick="abrirModalAprovacao(${orderId})">✓ Aprovar Vistoria</button>
          <button class="btn btn-danger btn-sm" onclick="abrirModalDisputa(${orderId})">⚠️ Abrir Disputa</button>
        `;
      } else if (o.status === 'EM_CUSTODIA' || o.status === 'A_CAMINHO' || o.status === 'EM_EXECUCAO') {
        actionButtons = `<span style="font-size: 12px; color: #0284C7; font-weight: 600;">⚡ Em andamento</span>`;
      } else if (o.status === 'CONCLUIDO') {
        actionButtons = `<span style="font-size: 12px; color: #166534; font-weight: 600;">✓ Pago & Avaliado</span>`;
      } else if (o.status === 'EM_DISPUTA') {
        actionButtons = `<button class="btn btn-danger btn-sm" onclick="trocarAba('disputas')">Ver Mediação</button>`;
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
          actionButtons = `<span style="font-size: 12px; color: #B45309; font-weight: 600;">⏳ Aguardando Vistoria</span>`;
        }
      }
    }

    // Cálculo do Step Bar (5 estágios)
    const step = obterProgressoEstagio(o.status);
    const stepBars = [1, 2, 3, 4, 5].map(s => {
      const activeClass = s <= step ? 'active' : '';
      return `<div class="step-segment ${activeClass}"></div>`;
    }).join('');

    const icon = CATEGORIA_ICONS[o.categoria] || '🔧';
    const valorExibicao = o.valor_total > 0 
      ? `R$ ${Number(o.valor_total).toFixed(2)}` 
      : (o.total_propostas > 0 ? `${parseInt(o.total_propostas, 10)} proposta(s)` : 'Aguardando propostas');

    card.innerHTML = `
      <div>
        <div class="order-top">
          <span class="category-tag">${icon} ${escapeHtml(o.categoria)}</span>
          <span class="status-badge status-${escapeHtml(o.status)}">${formatarStatus(o.status)}</span>
        </div>
        <h3 class="order-title">#${orderId} - ${escapeHtml(o.titulo)}</h3>
        <p class="order-desc">${escapeHtml(o.descricao)}</p>

        <!-- Barra de Progresso Visual do Ciclo de Vida -->
        <div class="order-step-bar" title="Progresso do chamado">${stepBars}</div>

        <div class="order-details-meta">
          <div class="meta-row">
            <span><strong>Cliente:</strong> ${escapeHtml(o.cliente_nome)}</span>
            <span><strong>Urgência:</strong> ${escapeHtml(o.urgencia)}</span>
          </div>
          <div class="meta-row">
            <span>📍 ${escapeHtml(o.endereco)} (${escapeHtml(o.cep)})</span>
          </div>
          ${o.prestador_nome ? `<div class="meta-row" style="margin-top:2px;"><span>🛠️ <strong>Prestador:</strong> ${escapeHtml(o.prestador_nome)}</span></div>` : ''}
        </div>
      </div>
      <div class="order-bottom">
        <div class="order-price-box">
          <span class="order-price-label">${o.valor_total > 0 ? 'Retido em Custódia' : 'Estimativa'}</span>
          <span class="order-price-val">${valorExibicao}</span>
        </div>
        <div style="display: flex; gap: 6px;">
          ${actionButtons}
        </div>
      </div>
    `;

    container.appendChild(card);
  });
}

function obterProgressoEstagio(status) {
  switch (status) {
    case 'PENDENTE': return 1;
    case 'PROPOSTA_RECEBIDA': return 2;
    case 'EM_CUSTODIA': return 3;
    case 'A_CAMINHO':
    case 'EM_EXECUCAO': return 4;
    case 'AGUARDANDO_VISTORIA':
    case 'CONCLUIDO': return 5;
    default: return 1;
  }
}

// Renderizar Livro-Razão Escrow (Transações)
function renderizarTransacoes() {
  const tbody = document.getElementById('transacoes-tbody');
  tbody.innerHTML = '';

  if (state.transacoes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:#64748B;">Nenhuma transação registrada no livro-razão.</td></tr>`;
    return;
  }

  state.transacoes.forEach(t => {
    const tr = document.createElement('tr');
    
    let tipoBadge = '';
    let valorCor = '#0F172A';
    if (t.tipo === 'BLOQUEIO_ESCROW') {
      tipoBadge = `<span class="status-badge" style="background:#FEF3C7; color:#92400E;">🔒 Retenção Escrow</span>`;
      valorCor = '#B45309';
    } else if (t.tipo === 'LIBERACAO_REPASSE') {
      tipoBadge = `<span class="status-badge" style="background:#DCFCE7; color:#166534;">💸 Repasse Liberado</span>`;
      valorCor = '#166534';
    } else {
      tipoBadge = `<span class="status-badge" style="background:#FEE2E2; color:#991B1B;">⚠️ Estorno / Disputa</span>`;
      valorCor = '#991B1B';
    }

    tr.innerHTML = `
      <td><strong>#TRX-${t.id}</strong></td>
      <td><span style="font-size:12px; color:#64748B;">${escapeHtml(t.criado_em)}</span></td>
      <td>OS #${t.ordem_id} - ${escapeHtml(t.ordem_titulo || 'Serviço')}</td>
      <td>${tipoBadge}</td>
      <td><strong style="color: ${valorCor}; font-size:14px;">R$ ${Number(t.valor).toFixed(2)}</strong></td>
      <td><span class="status-badge" style="background:#F1F5F9; color:#334155;">${escapeHtml(t.status)}</span></td>
      <td style="font-size: 12px; color: #475569;">${escapeHtml(t.detalhes)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Renderizar Carteira Digital do Prestador
function atualizarCarteiraPrestador() {
  const prestador = state.usuarios.find(u => u.papel === 'PRESTADOR') || { saldo_disponivel: 0, saldo_custodia: 0 };
  document.getElementById('wallet-available').innerText = `R$ ${Number(prestador.saldo_disponivel).toFixed(2)}`;
  document.getElementById('wallet-escrowed').innerText = `R$ ${Number(prestador.saldo_custodia).toFixed(2)}`;
}

// Renderizar Central de Mediação & Disputas
function renderizarDisputas() {
  const container = document.getElementById('disputas-container');
  container.innerHTML = '';

  const disputas = state.ordens.filter(o => o.status === 'EM_DISPUTA');

  if (disputas.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: #166534; background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 10px;">
        <div style="font-size: 28px; margin-bottom: 6px;">🛡️</div>
        <strong>Nenhuma disputa ativa no momento!</strong>
        <p style="font-size: 13px; color: #475569; margin-top: 4px;">Todos os serviços contratados estão transcorrendo em conformidade com as partes.</p>
      </div>
    `;
    return;
  }

  disputas.forEach(d => {
    const card = document.createElement('div');
    card.className = 'order-card';
    card.style.borderLeft = '4px solid #DC2626';

    card.innerHTML = `
      <div>
        <div class="order-top">
          <span class="category-tag">OS #${d.id}</span>
          <span class="status-badge status-EM_DISPUTA">Em Mediação</span>
        </div>
        <h3 class="order-title">${escapeHtml(d.titulo)}</h3>
        <p class="order-desc">${escapeHtml(d.descricao)}</p>
        <div class="order-details-meta">
          <div><strong>Cliente Reclamante:</strong> ${escapeHtml(d.cliente_nome)}</div>
          <div><strong>Prestador Alocado:</strong> ${escapeHtml(d.prestador_nome || 'N/A')}</div>
          <div><strong>Valor Retido sob Custódia:</strong> R$ ${Number(d.valor_total).toFixed(2)}</div>
        </div>
      </div>
      <div class="order-bottom" style="flex-direction: column; align-items: stretch; gap: 8px;">
        <span style="font-size: 12px; font-weight:700; color:#0F172A;">Painel de Conciliação / Arbitragem:</span>
        <div style="display: flex; gap: 6px;">
          <button class="btn btn-success btn-sm" style="flex:1;" onclick="arbitrarDisputa(${d.id}, 'REPASSE_PRESTADOR')">Liberar Repasse ao Prestador</button>
          <button class="btn btn-danger btn-sm" style="flex:1;" onclick="arbitrarDisputa(${d.id}, 'ESTORNO_CLIENTE')">Estornar Integral ao Cliente</button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function arbitrarDisputa(ordemId, decisao) {
  const justificativa = prompt(`Informe o parecer técnico da mediação para a decisão '${decisao}':`, 'Conformidade técnica verificada pelo suporte.');
  if (!justificativa) return;

  fetch(`/api/disputas/${ordemId}/resolver`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decisao, justificativa })
  })
  .then(res => res.json())
  .then(json => {
    if (json.sucesso) {
      alert(`MEDIAÇÃO CONCLUÍDA!\n\n${json.mensagem}`);
      carregarEstatisticas();
      carregarOrdens();
      carregarTransacoes();
      carregarUsuarios();
    } else {
      alert('Erro: ' + json.mensagem);
    }
  })
  .catch(err => alert('Erro: ' + err.message));
}

// Alternância de Abas
function trocarAba(aba) {
  state.activeTab = aba;
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');

  const btnAtivo = document.getElementById(`tab-btn-${aba}`);
  const containerAtivo = document.getElementById(`tab-${aba}`);

  if (btnAtivo) btnAtivo.classList.add('active');
  if (containerAtivo) containerAtivo.style.display = 'block';

  if (aba === 'mural') carregarOrdens();
  if (aba === 'escrow') carregarTransacoes();
  if (aba === 'carteira') { carregarUsuarios(); atualizarCarteiraPrestador(); }
  if (aba === 'disputas') carregarOrdens();
  if (aba === 'notificacoes') carregarNotificacoes();
}

// Carregar Histórico de Mensageria (WhatsApp & E-mail)
async function carregarNotificacoes() {
  try {
    const res = await fetch('/api/notificacoes');
    const json = await res.json();
    if (json.sucesso) {
      const badge = document.getElementById('badge-total-notificacoes');
      if (badge) badge.innerText = json.dados.length;
      renderizarNotificacoes(json.dados);
    }
  } catch (err) {
    console.error('Erro ao carregar notificações:', err);
  }
}

// Renderizar Tabela de Notificações
function renderizarNotificacoes(lista) {
  const tbody = document.getElementById('notificacoes-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!lista || lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #64748B; padding: 24px;">Nenhuma notificação registrada ainda. Realize ações de checkout ou aprovação para disparar avisos.</td></tr>`;
    return;
  }

  lista.forEach(n => {
    const tr = document.createElement('tr');
    const isZap = n.canal === 'WHATSAPP';
    const badgeCanal = isZap
      ? `<span class="badge" style="background: #DCFCE7; color: #166534; font-weight:700;">🟢 WhatsApp</span>`
      : `<span class="badge" style="background: #E0F2FE; color: #0369A1; font-weight:700;">✉️ E-mail</span>`;

    const dataFormatada = n.criado_em ? new Date(n.criado_em).toLocaleString('pt-BR') : '-';

    tr.innerHTML = `
      <td style="font-weight: 700;">#${escapeHtml(n.id)}</td>
      <td style="font-size: 12px; color: #64748B;">${dataFormatada}</td>
      <td>${badgeCanal}</td>
      <td style="font-family: monospace; font-size: 12px;">${escapeHtml(n.destinatario)}</td>
      <td><strong>${escapeHtml(n.usuario_nome || 'Sistema')}</strong></td>
      <td style="max-width: 320px; font-size: 13px;">${escapeHtml(n.mensagem)}</td>
      <td><span class="badge badge-concluido">✓ ${escapeHtml(n.status)}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// Atualizar Estimador de Preço
function atualizarEstimativaPreco() {
  const cat = document.getElementById('select-categoria').value;
  const info = ESTIMATIVAS_PRECO[cat] || { min: 150, max: 400, desc: 'Serviços gerais de reparo domiciliar.' };
  
  document.getElementById('estimator-title').innerText = `Estimativa Regional: ${cat}`;
  document.getElementById('estimator-text').innerHTML = `Preço médio praticado: <strong>R$ ${info.min},00 a R$ ${info.max},00</strong>. ${info.desc}`;
}

// Configurar Event Listeners
function setupEventListeners() {
  document.getElementById('filtro-status').addEventListener('change', carregarOrdens);
  document.getElementById('filtro-categoria').addEventListener('change', carregarOrdens);
  document.getElementById('filtro-busca').addEventListener('input', renderizarOrdens);

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
        alert('Chamado criado com sucesso! Notificações enviadas aos prestadores da região.');
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

  // Formulário de Saque PIX
  document.getElementById('form-saque').addEventListener('submit', async (e) => {
    e.preventDefault();
    const prestador = state.usuarios.find(u => u.papel === 'PRESTADOR');
    if (!prestador) return alert('Nenhum prestador encontrado.');

    const valor = parseFloat(document.getElementById('saque-valor').value);
    const chave_pix = document.getElementById('saque-pix').value.trim();

    try {
      const res = await fetch('/api/prestador/saque', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prestador_id: prestador.id,
          valor,
          chave_pix
        })
      });
      const json = await res.json();
      if (json.sucesso) {
        alert(`RESGATE PIX CONCLUÍDO!\n\n${json.mensagem}`);
        document.getElementById('form-saque').reset();
        await carregarUsuarios();
        atualizarCarteiraPrestador();
        await carregarEstatisticas();
      } else {
        alert('Erro no saque: ' + json.mensagem);
      }
    } catch (err) {
      alert('Erro: ' + err.message);
    }
  });
}

function atualizarBadgeUsuario() {
  const avatar = document.getElementById('user-avatar');
  const name = document.getElementById('user-name');
  const roleBadge = document.getElementById('user-role-badge');

  avatar.innerText = state.currentUser.nome.charAt(0);
  name.innerText = state.currentUser.nome;
  roleBadge.innerText = state.currentRole;
  roleBadge.className = `role-pill role-${state.currentRole}`;

  document.getElementById('btn-switch-role').innerText = state.currentRole === 'CLIENTE' 
    ? '🔄 Mudar para Prestador' 
    : '🔄 Mudar para Cliente';
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
    'EM_DISPUTA': 'Em Disputa',
    'CANCELADO': 'Cancelado'
  };
  return mapa[status] || escapeHtml(status);
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
      propostasHtml = '<div style="padding:16px; background:#F8FAFC; border:1px dashed #CBD5E1; border-radius:6px; text-align:center; color:#64748B;">Nenhum orçamento enviado até o momento.</div>';
    } else {
      propostasHtml = o.propostas.map(p => {
        const propId = parseInt(p.id, 10);
        const valorProp = Number(p.valor);
        return `
          <div style="border: 1px solid #E2E8F0; padding: 14px; border-radius: 8px; margin-bottom: 10px; background: #F8FAFC;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <strong>${escapeHtml(p.prestador_nome)} <span style="color:#F59E0B;">(★ ${Number(p.prestador_reputacao).toFixed(1)})</span></strong>
              <span style="font-weight: 800; font-size: 16px; color: #0F172A;">R$ ${valorProp.toFixed(2)}</span>
            </div>
            <p style="font-size: 12px; color: #475569; margin: 4px 0;"><strong>Estimativa de Prazo:</strong> ${escapeHtml(p.prazo_estimado)}</p>
            <p style="font-size: 12.5px; color: #334155; margin-bottom: 8px;">"${escapeHtml(p.mensagem)}"</p>
            <button class="btn btn-primary btn-sm" onclick="confirmarCheckout(${safeId}, ${propId}, ${valorProp})">
              🔒 Contratar com Custódia Protegida (Escrow)
            </button>
          </div>
        `;
      }).join('');
    }

    modalBody.innerHTML = `
      <div class="modal-header">
        <h3>OS #${safeId} — ${escapeHtml(o.titulo)}</h3>
        <button class="close-btn" onclick="fecharModal()">&times;</button>
      </div>
      <div style="margin-bottom: 16px;">
        <p style="font-size: 13px; color: #334155; margin-bottom: 8px;"><strong>Descrição:</strong> ${escapeHtml(o.descricao)}</p>
        <p style="font-size: 12.5px; color: #64748B;">📍 <strong>Local:</strong> ${escapeHtml(o.endereco)} (${escapeHtml(o.cep)})</p>
      </div>
      <h4 style="font-size: 14px; font-weight: 700; margin-bottom: 10px;">Orçamentos Recebidos:</h4>
      ${propostasHtml}
    `;

    modal.style.display = 'flex';
  } catch (err) {
    alert('Erro ao carregar detalhes: ' + err.message);
  }
}

// Confirmar Checkout com Custódia
async function confirmarCheckout(ordemId, propostaId, valorMaoObra) {
  const safeOrderId = parseInt(ordemId, 10);
  const safePropId = parseInt(propostaId, 10);
  const cupom = prompt('Deseja aplicar um cupom de desconto na taxa? Digite FREELA10 para 50% de abatimento ou confirme em branco:', 'FREELA10');

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
      alert(`PAGAMENTO RETIDO EM CUSTÓDIA COM SUCESSO!\n\nValor Mão de Obra: R$ ${json.dados.valor_mao_obra.toFixed(2)}\nTaxa Intermediação: R$ ${json.dados.taxa_plataforma.toFixed(2)}\nTotal Bloqueado no Escrow: R$ ${json.dados.valor_total.toFixed(2)}\n\nO prestador já foi notificado para iniciar o reparo. O valor só será repassado após a sua aprovação presencial.`);
      fecharModal();
      await carregarEstatisticas();
      await carregarOrdens();
      await carregarTransacoes();
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
      <button class="close-btn" onclick="fecharModal()">&times;</button>
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
      <label class="form-label">Mensagem explicativa para o cliente:</label>
      <textarea id="prop-msg" class="form-textarea" rows="3" placeholder="Explique os materiais necessários, garantia oferecida ou sua experiência..." maxlength="1000"></textarea>
    </div>
    <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px;">
      <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="submeterProposta(${safeId})">Enviar Orçamento</button>
    </div>
  `;

  modal.style.display = 'flex';
}

async function submeterProposta(ordemId) {
  const safeId = parseInt(ordemId, 10);
  const valor = parseFloat(document.getElementById('prop-valor').value);
  const prazo_estimado = document.getElementById('prop-prazo').value.trim();
  const mensagem = document.getElementById('prop-msg').value.trim();

  if (isNaN(valor) || valor <= 0) return alert('Informe um valor de mão de obra válido.');
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
      alert('Orçamento enviado ao cliente com sucesso!');
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

// Modal de Vistoria e Aprovação Final
function abrirModalAprovacao(ordemId) {
  const safeId = parseInt(ordemId, 10);
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');

  modalBody.innerHTML = `
    <div class="modal-header">
      <h3>Vistoria Presencial & Liberação de Pagamento (OS #${safeId})</h3>
      <button class="close-btn" onclick="fecharModal()">&times;</button>
    </div>
    <div class="escrow-banner" style="margin-bottom: 16px; padding: 12px 14px;">
      <div class="escrow-banner-text">
        <strong style="color:#166534;">Liquidação Irreversível de Custódia</strong>
        <p>Ao aprovar a vistoria, você atesta que o conserto residencial foi concluído com qualidade e autoriza a transferência bancária imediata ao profissional.</p>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Avaliação de Satisfação (1 a 5 estrelas):</label>
      <select id="aprov-nota" class="form-select">
        <option value="5">★★★★★ 5 Estrelas (Excelente / Impecável)</option>
        <option value="4">★★★★☆ 4 Estrelas (Muito Bom)</option>
        <option value="3">★★★☆☆ 3 Estrelas (Satisfatório)</option>
        <option value="2">★★☆☆☆ 2 Estrelas (Abaixo do Esperado)</option>
        <option value="1">★☆☆☆☆ 1 Estrela (Insatisfatório)</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Depoimento sobre a Qualidade e Pontualidade:</label>
      <textarea id="aprov-comentario" class="form-textarea" rows="3" placeholder="Comente sobre o acabamento, cordialidade e limpeza..." maxlength="500"></textarea>
    </div>
    <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px;">
      <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-success" onclick="submeterAprovacao(${safeId})">✓ Aprovar e Liberar Repasse</button>
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
      alert(`VISTORIA HOMOLOGADA!\n\n${json.mensagem}\nValor repassado: R$ ${Number(json.valor_liberado).toFixed(2)}`);
      fecharModal();
      await carregarEstatisticas();
      await carregarOrdens();
      await carregarTransacoes();
      await carregarUsuarios();
      atualizarCarteiraPrestador();
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
  const motivo = prompt('Por favor, descreva detalhadamente a inconformidade identificada no reparo para acionar a mediação cautelar:');
  if (!motivo) return;

  fetch(`/api/ordens/${safeId}/disputa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ motivo: motivo.trim() })
  })
  .then(res => res.json())
  .then(json => {
    if (json.sucesso) {
      alert(`DISPUTA INSTAURADA!\n\n${json.mensagem}\nO chamado foi direcionado para a aba "Mediação & Disputas".`);
      carregarOrdens();
      carregarTransacoes();
    } else {
      alert('Erro: ' + json.mensagem);
    }
  })
  .catch(err => alert('Erro: ' + err.message));
}

function fecharModal() {
  document.getElementById('modal').style.display = 'none';
}
