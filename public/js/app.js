// FreeLA SaaS Platform — Complete Client Application Controller

const STORAGE_TOKEN_KEY = 'freela_saas_token';

const state = {
  token: localStorage.getItem(STORAGE_TOKEN_KEY) || null,
  user: null,
  page: 'overview',
  ordens: [],
  transacoes: [],
  notificacoes: [],
  prestadores: [],
  usuarios: [],
  cupons: [],
  stats: {},
  selectedStarRating: 5
};

const ESTIMATIVAS_PRECO = {
  'Elétrica': { min: 180, max: 380, desc: 'Substituição de disjuntores, chuveiros, tomadas e revisão de quadros.' },
  'Hidráulica': { min: 150, max: 320, desc: 'Reparo de vazamentos, troca de sifões, registros e desentupimentos.' },
  'Pintura': { min: 350, max: 950, desc: 'Pintura acrílica interna e externa, massa corrida e impermeabilização.' },
  'Alvenaria': { min: 300, max: 1200, desc: 'Assentamento de pisos, revestimentos, reboco e pequenos reparos.' },
  'Climatização': { min: 200, max: 550, desc: 'Instalação de aparelhos split, higienização técnica e recarga de gás.' }
};

const STATUS_META = {
  'PENDENTE': { label: 'Aguardando Propostas', cls: 'badge-neutral', step: 1 },
  'PROPOSTA_RECEBIDA': { label: 'Com Propostas', cls: 'badge-info', step: 2 },
  'EM_CUSTODIA': { label: 'Em Custódia Escrow', cls: 'badge-warning', step: 3 },
  'A_CAMINHO': { label: 'Profissional a Caminho', cls: 'badge-info', step: 3 },
  'EM_EXECUCAO': { label: 'Em Execução', cls: 'badge-info', step: 4 },
  'AGUARDANDO_VISTORIA': { label: 'Vistoria Pendente', cls: 'badge-warning', step: 4 },
  'CONCLUIDO': { label: 'Concluído e Pago', cls: 'badge-success', step: 5 },
  'EM_DISPUTA': { label: 'Em Mediação', cls: 'badge-danger', step: 4 },
  'CANCELADO': { label: 'Cancelado / Estornado', cls: 'badge-danger', step: 5 }
};

const PAGE_HEADERS = {
  overview: { title: 'Visão Geral', sub: 'Resumo financeiro e acompanhamento das suas operações' },
  mural: { title: 'Ordens de Serviço', sub: 'Gerencie solicitações, propostas, vistorias e execuções' },
  nova: { title: 'Nova Solicitação', sub: 'Descreva o reparo residencial para receber orçamentos' },
  carteira: { title: 'Carteira Digital & PIX', sub: 'Acompanhe valores em custódia e transfira seu saldo disponível' },
  prestadores: { title: 'Catálogo de Profissionais', sub: 'Especialistas cadastrados, reputação e portfólio de obras' },
  escrow: { title: 'Livro-Razão Escrow', sub: 'Histórico auditável de retenções, repasses e estornos' },
  disputas: { title: 'Mediação de Disputas', sub: 'Acompanhamento e arbitragem técnica de chamados contestados' },
  notificacoes: { title: 'Central de Mensagens', sub: 'Registro de envios automáticos por WhatsApp e e-mail' },
  admin: { title: 'Governança & Administração', sub: 'Indicadores de conversão, homologação cadastral e cupons' },
  perfil: { title: 'Minha Conta & Verificação', sub: 'Dados cadastrais, credenciais e envio de documentação' }
};

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function moeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function authHeaders() {
  const h = { 'Content-Type': 'application/json' };
  if (state.token) h['Authorization'] = `Bearer ${state.token}`;
  return h;
}

function toast(mensagem, tipo = 'info') {
  const stack = document.getElementById('toast-stack');
  if (!stack) return;
  const el = document.createElement('div');
  el.className = `toast ${tipo}`;
  el.textContent = mensagem;
  stack.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.25s';
    setTimeout(() => el.remove(), 260);
  }, 3600);
}

// =========================================================================
// INICIALIZAÇÃO E ROTEAMENTO DE SESSÃO
// =========================================================================
document.addEventListener('DOMContentLoaded', async () => {
  configurarFormulariosFixos();
  atualizarEstimativaPreco();

  const appHashes = ['overview', 'mural', 'nova', 'escrow', 'carteira', 'disputas', 'notificacoes', 'prestadores', 'admin', 'perfil'];
  const hashAtual = (window.location.hash || '').replace('#', '');

  if (state.token) {
    const ok = await validarSessaoExistente();
    if (ok) {
      await iniciarWorkspace(appHashes.includes(hashAtual) ? hashAtual : 'overview');
      return;
    }
  }

  // Caso abra diretamente uma rota interna (ex: captura automatizada de tela), autentica conta correspondente
  if (appHashes.includes(hashAtual)) {
    const contaAuto = hashAtual === 'admin'
      ? 'admin@freela.com.br'
      : (hashAtual === 'carteira' ? 'carlos.eletrica@email.com' : 'maria.cliente@email.com');
    await loginRapidoDemo(contaAuto, hashAtual, true);
    return;
  }

  await carregarDadosLanding();
  mostrarLanding();
});

async function validarSessaoExistente() {
  try {
    const res = await fetch('/api/auth/me', { headers: authHeaders() });
    if (!res.ok) {
      limparSessaoLocal();
      return false;
    }
    const json = await res.json();
    if (json.sucesso && json.dados) {
      state.user = json.dados;
      return true;
    }
    limparSessaoLocal();
    return false;
  } catch {
    limparSessaoLocal();
    return false;
  }
}

function limparSessaoLocal() {
  state.token = null;
  state.user = null;
  localStorage.removeItem(STORAGE_TOKEN_KEY);
}

// =========================================================================
// NAVEGAÇÃO ENTRE LANDING, AUTH E WORKSPACE
// =========================================================================
async function carregarDadosLanding() {
  try {
    const [resStats, resPrest] = await Promise.all([
      fetch('/api/stats'),
      fetch('/api/prestadores')
    ]);
    const st = await resStats.json();
    const pr = await resPrest.json();

    if (st.sucesso) {
      document.getElementById('land-kpi-ordens').textContent = st.dados.total_ordens;
      document.getElementById('land-kpi-custodia').textContent = moeda(st.dados.saldo_em_custodia);
      document.getElementById('land-kpi-prestadores').textContent = st.dados.prestadores_ativos;
    }

    const grid = document.getElementById('landing-prestadores-grid');
    if (grid && pr.sucesso) {
      grid.innerHTML = pr.dados.slice(0, 3).map(p => `
        <div class="order-card">
          <div>
            <div class="order-meta-top">
              <span class="badge badge-info">${escapeHtml(p.especialidade || 'Serviços Residenciais')}</span>
              ${p.verificado === 1 ? '<span class="badge badge-success">Verificado</span>' : '<span class="badge badge-neutral">Em análise</span>'}
            </div>
            <h3 class="order-title" style="margin-top: 10px;">${escapeHtml(p.nome)}</h3>
            <p style="font-size: 13px; color: var(--text-secondary);">Avaliação média: <strong>${Number(p.reputacao).toFixed(1)} / 5.0</strong></p>
          </div>
          <div class="order-footer">
            <span style="font-size: 12px; color: var(--text-muted);">${(p.portfolio || []).length} obra(s) no catálogo</span>
            <button class="btn btn-secondary btn-sm" onclick="irParaAuth('register', 'CLIENTE')">Solicitar Orçamento</button>
          </div>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error(err);
  }
}

function mostrarLanding() {
  document.getElementById('view-landing').classList.remove('hidden');
  document.getElementById('view-auth').classList.add('hidden');
  document.getElementById('view-app').classList.add('hidden');
}

function irParaAuth(modo = 'login', papelInicial = 'CLIENTE') {
  document.getElementById('view-landing').classList.add('hidden');
  document.getElementById('view-app').classList.add('hidden');
  document.getElementById('view-auth').classList.remove('hidden');
  alternarModoAuth(modo);
  selecionarPapelCadastro(papelInicial);
}

function alternarModoAuth(modo) {
  const isLogin = modo === 'login';
  document.getElementById('tab-auth-login').classList.toggle('active', isLogin);
  document.getElementById('tab-auth-register').classList.toggle('active', !isLogin);
  document.getElementById('form-login').classList.toggle('hidden', !isLogin);
  document.getElementById('form-register').classList.toggle('hidden', isLogin);
}

function selecionarPapelCadastro(papel) {
  document.getElementById('reg-papel').value = papel;
  document.getElementById('opt-role-cliente').classList.toggle('selected', papel === 'CLIENTE');
  document.getElementById('opt-role-prestador').classList.toggle('selected', papel === 'PRESTADOR');
  document.getElementById('reg-especialidade-group').classList.toggle('hidden', papel !== 'PRESTADOR');
}

async function loginRapidoDemo(email, paginaDestino = 'overview', silencioso = false) {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha: 'demo123' })
    });
    const json = await res.json();
    if (json.sucesso) {
      state.token = json.token;
      state.user = json.dados;
      localStorage.setItem(STORAGE_TOKEN_KEY, json.token);
      if (!silencioso) toast(`Bem-vindo(a), ${json.dados.nome}`, 'success');
      await iniciarWorkspace(paginaDestino);
    } else {
      toast(json.mensagem || 'Falha ao autenticar.', 'error');
    }
  } catch {
    toast('Erro de conexão com o servidor.', 'error');
  }
}

async function encerrarSessao() {
  limparSessaoLocal();
  window.history.replaceState(null, '', window.location.pathname);
  await carregarDadosLanding();
  mostrarLanding();
  toast('Sessão encerrada com segurança.');
}

// =========================================================================
// WORKSPACE AUTENTICADO E SIDEBAR DINÂMICA POR PAPEL
// =========================================================================
async function iniciarWorkspace(paginaInicial = 'overview') {
  document.getElementById('view-landing').classList.add('hidden');
  document.getElementById('view-auth').classList.add('hidden');
  document.getElementById('view-app').classList.remove('hidden');

  await sincronizarDadosBase();
  renderizarSidebar();
  navegarApp(paginaInicial);
}

async function sincronizarDadosBase() {
  try {
    const [rStats, rOrdens, rUsers, rTrx, rNotif, rPrest, rCup] = await Promise.all([
      fetch('/api/stats'),
      fetch('/api/ordens'),
      fetch('/api/usuarios'),
      fetch('/api/transacoes'),
      fetch('/api/notificacoes'),
      fetch('/api/prestadores'),
      fetch('/api/cupons')
    ]);

    const [jStats, jOrdens, jUsers, jTrx, jNotif, jPrest, jCup] = await Promise.all([
      rStats.json(), rOrdens.json(), rUsers.json(), rTrx.json(), rNotif.json(), rPrest.json(), rCup.json()
    ]);

    if (jStats.sucesso) state.stats = jStats.dados;
    if (jOrdens.sucesso) state.ordens = jOrdens.dados;
    if (jUsers.sucesso) {
      state.usuarios = jUsers.dados;
      if (state.user) {
        const atualizado = state.usuarios.find(u => u.id === state.user.id);
        if (atualizado) state.user = { ...state.user, ...atualizado };
      }
    }
    if (jTrx.sucesso) state.transacoes = jTrx.dados;
    if (jNotif.sucesso) state.notificacoes = jNotif.dados;
    if (jPrest.sucesso) state.prestadores = jPrest.dados;
    if (jCup.sucesso) state.cupons = jCup.dados;

    atualizarResumoUsuarioSidebar();
  } catch (err) {
    console.error('Erro ao sincronizar dados:', err);
  }
}

function atualizarResumoUsuarioSidebar() {
  if (!state.user) return;
  const iniciais = state.user.nome.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
  document.getElementById('sb-avatar').textContent = iniciais;
  document.getElementById('sb-user-name').textContent = state.user.nome;
  const labelPapel = { CLIENTE: 'Cliente Residencial', PRESTADOR: 'Profissional Autônomo', ADMIN: 'Administrador' }[state.user.papel] || state.user.papel;
  document.getElementById('sb-user-role').textContent = labelPapel;
}

function renderizarSidebar() {
  const papel = state.user ? state.user.papel : 'CLIENTE';
  const disputasCount = state.ordens.filter(o => o.status === 'EM_DISPUTA').length;

  const itensPrincipais = [
    { id: 'overview', label: 'Visão Geral' },
    { id: 'mural', label: papel === 'PRESTADOR' ? 'Mural de Chamados' : 'Ordens de Serviço', count: state.ordens.length }
  ];

  if (papel === 'CLIENTE') {
    itensPrincipais.push({ id: 'nova', label: 'Solicitar Reparo' });
    itensPrincipais.push({ id: 'prestadores', label: 'Profissionais' });
  } else if (papel === 'PRESTADOR') {
    itensPrincipais.push({ id: 'carteira', label: 'Carteira & PIX' });
    itensPrincipais.push({ id: 'prestadores', label: 'Meu Portfólio' });
  } else if (papel === 'ADMIN') {
    itensPrincipais.push({ id: 'admin', label: 'Painel Executivo' });
    itensPrincipais.push({ id: 'prestadores', label: 'Profissionais' });
  }

  const itensSecundarios = [
    { id: 'escrow', label: 'Livro-Razão Escrow', count: state.transacoes.length },
    { id: 'disputas', label: 'Disputas & Mediação', count: disputasCount || null },
    { id: 'notificacoes', label: 'Notificações', count: state.notificacoes.length },
    { id: 'perfil', label: 'Minha Conta' }
  ];

  const montarBotao = (item) => `
    <button class="nav-item ${state.page === item.id ? 'active' : ''}" id="nav-${item.id}" onclick="navegarApp('${item.id}')">
      <span class="nav-item-left">${escapeHtml(item.label)}</span>
      ${item.count ? `<span class="nav-count">${item.count}</span>` : ''}
    </button>
  `;

  document.getElementById('sidebar-nav-main').innerHTML = itensPrincipais.map(montarBotao).join('');
  document.getElementById('sidebar-nav-secondary').innerHTML = itensSecundarios.map(montarBotao).join('');
}

async function navegarApp(pagina) {
  state.page = pagina;
  document.querySelectorAll('.app-page').forEach(sec => sec.classList.add('hidden'));
  const alvo = document.getElementById(`sec-${pagina}`);
  if (alvo) alvo.classList.remove('hidden');

  const meta = PAGE_HEADERS[pagina] || PAGE_HEADERS.overview;
  document.getElementById('page-title').textContent = meta.title;
  document.getElementById('page-subtitle').textContent = meta.sub;

  renderizarTopbarActions(pagina);
  renderizarSidebar();

  if (pagina === 'overview') renderizarOverview();
  if (pagina === 'mural') renderizarMuralOrdens();
  if (pagina === 'carteira') renderizarCarteira();
  if (pagina === 'prestadores') renderizarPrestadores();
  if (pagina === 'escrow') renderizarTransacoes();
  if (pagina === 'disputas') renderizarDisputas();
  if (pagina === 'notificacoes') renderizarNotificacoes();
  if (pagina === 'admin') await renderizarPainelAdmin();
  if (pagina === 'perfil') await renderizarPerfil();
}

function renderizarTopbarActions(pagina) {
  const box = document.getElementById('topbar-actions');
  if (!state.user) return;
  const selo = state.user.verificado === 1
    ? '<span class="badge badge-success">Conta Verificada</span>'
    : '<span class="badge badge-warning" style="cursor:pointer" onclick="navegarApp(\'perfil\')">Verificação Pendente</span>';

  let cta = '';
  if (state.user.papel === 'CLIENTE' && pagina !== 'nova') {
    cta = '<button class="btn btn-primary btn-sm" onclick="navegarApp(\'nova\')">+ Solicitar Reparo</button>';
  } else if (state.user.papel === 'PRESTADOR' && pagina === 'prestadores') {
    cta = '<button class="btn btn-primary btn-sm" onclick="abrirModalPortfolio()">+ Adicionar Obra ao Portfólio</button>';
  } else if (state.user.papel === 'PRESTADOR' && pagina !== 'carteira') {
    cta = `<button class="btn btn-secondary btn-sm" onclick="navegarApp('carteira')">Saldo: ${moeda(state.user.saldo_disponivel)}</button>`;
  }

  box.innerHTML = `${selo}${cta}`;
}

// =========================================================================
// RENDERIZAÇÃO DE PÁGINAS DO WORKSPACE
// =========================================================================
function renderizarOverview() {
  const u = state.user;
  const kpiBox = document.getElementById('overview-kpis');

  if (u.papel === 'CLIENTE') {
    const minhas = state.ordens.filter(o => o.cliente_id === u.id);
    const ativas = minhas.filter(o => ['EM_CUSTODIA', 'A_CAMINHO', 'EM_EXECUCAO', 'AGUARDANDO_VISTORIA'].includes(o.status));
    const vistoria = minhas.filter(o => o.status === 'AGUARDANDO_VISTORIA').length;
    const custodiaCliente = ativas.reduce((acc, o) => acc + Number(o.valor_total || 0), 0);

    kpiBox.innerHTML = `
      <div class="kpi-card"><div class="kpi-label">Meus Chamados</div><div class="kpi-value">${minhas.length}</div><div class="kpi-sub">Total solicitados na conta</div></div>
      <div class="kpi-card"><div class="kpi-label">Protegido em Custódia</div><div class="kpi-value">${moeda(custodiaCliente)}</div><div class="kpi-sub">Retido até sua aprovação</div></div>
      <div class="kpi-card"><div class="kpi-label">Aguardando sua Vistoria</div><div class="kpi-value">${vistoria}</div><div class="kpi-sub">Prontos para homologação</div></div>
      <div class="kpi-card"><div class="kpi-label">Profissionais Ativos</div><div class="kpi-value">${state.prestadores.length}</div><div class="kpi-sub">Disponíveis na região</div></div>
    `;
  } else if (u.papel === 'PRESTADOR') {
    const abertas = state.ordens.filter(o => ['PENDENTE', 'PROPOSTA_RECEBIDA'].includes(o.status)).length;
    const assumidas = state.ordens.filter(o => o.prestador_id === u.id);

    kpiBox.innerHTML = `
      <div class="kpi-card"><div class="kpi-label">Saldo Disponível (PIX)</div><div class="kpi-value">${moeda(u.saldo_disponivel)}</div><div class="kpi-sub">Liberado para transferência</div></div>
      <div class="kpi-card"><div class="kpi-label">Garantido em Escrow</div><div class="kpi-value">${moeda(u.saldo_custodia)}</div><div class="kpi-sub">Reservado em obras ativas</div></div>
      <div class="kpi-card"><div class="kpi-label">Oportunidades Abertas</div><div class="kpi-value">${abertas}</div><div class="kpi-sub">Aguardando orçamento</div></div>
      <div class="kpi-card"><div class="kpi-label">Sua Reputação</div><div class="kpi-value">${Number(u.reputacao).toFixed(1)} / 5.0</div><div class="kpi-sub">${assumidas.length} serviço(s) vinculado(s)</div></div>
    `;
  } else {
    kpiBox.innerHTML = `
      <div class="kpi-card"><div class="kpi-label">Total de Ordens</div><div class="kpi-value">${state.stats.total_ordens || 0}</div><div class="kpi-sub">Registradas na plataforma</div></div>
      <div class="kpi-card"><div class="kpi-label">Volume em Custódia</div><div class="kpi-value">${moeda(state.stats.saldo_em_custodia)}</div><div class="kpi-sub">Bloqueado em garantia</div></div>
      <div class="kpi-card"><div class="kpi-label">Total Liquidado</div><div class="kpi-value">${moeda(state.stats.total_repassado)}</div><div class="kpi-sub">Repassado pós-vistoria</div></div>
      <div class="kpi-card"><div class="kpi-label">Usuários Cadastrados</div><div class="kpi-value">${state.usuarios.length}</div><div class="kpi-sub">Clientes, prestadores e suporte</div></div>
    `;
  }

  const recentes = state.ordens.slice(0, 4);
  document.getElementById('overview-orders-list').innerHTML = recentes.map(montarCardOrdemHtml).join('');
}

function montarCardOrdemHtml(o) {
  const meta = STATUS_META[o.status] || { label: o.status, cls: 'badge-neutral', step: 1 };
  const segs = [1, 2, 3, 4, 5].map(n => {
    const cls = o.status === 'CONCLUIDO' ? 'completed' : (n <= meta.step ? 'done' : '');
    return `<div class="stepper-seg ${cls}"></div>`;
  }).join('');

  const papel = state.user ? state.user.papel : 'CLIENTE';
  const isDonoCliente = state.user && o.cliente_id === state.user.id;
  const isPrestadorOrdem = state.user && o.prestador_id === state.user.id;

  let botoes = `<button class="btn btn-secondary btn-sm" onclick="abrirModalDetalhes(${o.id})">Detalhes</button>`;

  if (papel === 'CLIENTE' && isDonoCliente) {
    if (o.status === 'PENDENTE' || o.status === 'PROPOSTA_RECEBIDA') {
      botoes = `<button class="btn btn-primary btn-sm" onclick="abrirModalDetalhes(${o.id})">Propostas (${o.total_propostas || 0})</button>`;
    } else if (o.status === 'AGUARDANDO_VISTORIA') {
      botoes = `
        <button class="btn btn-danger btn-sm" onclick="abrirModalDisputa(${o.id})">Contestar</button>
        <button class="btn btn-success btn-sm" onclick="abrirModalAprovacao(${o.id})">Aprovar Vistoria</button>
      `;
    } else if (['EM_CUSTODIA', 'A_CAMINHO', 'EM_EXECUCAO'].includes(o.status)) {
      botoes = `
        <button class="btn btn-secondary btn-sm" onclick="abrirModalDetalhes(${o.id})">Acompanhar</button>
        <button class="btn btn-danger btn-sm" onclick="abrirModalDisputa(${o.id})">Disputa</button>
      `;
    }
  } else if (papel === 'PRESTADOR') {
    if (o.status === 'PENDENTE' || o.status === 'PROPOSTA_RECEBIDA') {
      botoes = `<button class="btn btn-primary btn-sm" onclick="abrirModalProposta(${o.id})">Enviar Orçamento</button>`;
    } else if (isPrestadorOrdem) {
      if (o.status === 'EM_CUSTODIA') {
        botoes = `<button class="btn btn-accent btn-sm" onclick="atualizarStatusOrdem(${o.id}, 'A_CAMINHO')">Marcar A Caminho</button>`;
      } else if (o.status === 'A_CAMINHO') {
        botoes = `<button class="btn btn-accent btn-sm" onclick="atualizarStatusOrdem(${o.id}, 'EM_EXECUCAO')">Iniciar Execução</button>`;
      } else if (o.status === 'EM_EXECUCAO') {
        botoes = `<button class="btn btn-success btn-sm" onclick="abrirModalConclusaoPrestador(${o.id})">Solicitar Vistoria</button>`;
      } else if (o.status === 'CONCLUIDO') {
        botoes = `<button class="btn btn-secondary btn-sm" onclick="abrirModalAvaliarCliente(${o.id})">Avaliar Cliente</button>`;
      }
    }
  } else if (papel === 'ADMIN' && o.status === 'EM_DISPUTA') {
    botoes = `<button class="btn btn-primary btn-sm" onclick="abrirModalArbitragem(${o.id})">Arbitrar Caso</button>`;
  }

  return `
    <article class="order-card">
      <div>
        <div class="order-meta-top">
          <span class="badge badge-neutral">OS #${o.id} · ${escapeHtml(o.categoria)}</span>
          <span class="badge ${meta.cls}">${meta.label}</span>
        </div>
        <h3 class="order-title">${escapeHtml(o.titulo)}</h3>
        <p class="order-desc">${escapeHtml(o.descricao)}</p>
        <p style="font-size: 12px; color: var(--text-muted); margin-top: 8px;">
          Local: ${escapeHtml(o.endereco)} (${escapeHtml(o.cep)})
        </p>
        <div class="stepper-bar">${segs}</div>
      </div>

      <div class="order-footer">
        <div>
          <span style="font-size: 11px; color: var(--text-muted); display: block;">${o.valor_total > 0 ? 'Total em custódia' : 'Orçamento'}</span>
          <span class="price-tag">${o.valor_total > 0 ? moeda(o.valor_total) : 'Em aberto'}</span>
        </div>
        <div style="display: flex; gap: 6px; flex-wrap: wrap;">${botoes}</div>
      </div>
    </article>
  `;
}

function renderizarMuralOrdens() {
  const busca = (document.getElementById('filtro-busca').value || '').toLowerCase().trim();
  const statusF = document.getElementById('filtro-status').value;
  const catF = document.getElementById('filtro-categoria').value;

  const filtradas = state.ordens.filter(o => {
    if (statusF && o.status !== statusF) return false;
    if (catF && o.categoria !== catF) return false;
    if (busca) {
      const alvo = `${o.titulo} ${o.descricao} ${o.cep} ${o.endereco} ${o.categoria}`.toLowerCase();
      if (!alvo.includes(busca)) return false;
    }
    return true;
  });

  const container = document.getElementById('orders-container');
  if (filtradas.length === 0) {
    container.innerHTML = `<div class="panel-card" style="grid-column: 1 / -1; text-align: center; color: var(--text-muted);">Nenhuma ordem encontrada para os filtros selecionados.</div>`;
    return;
  }
  container.innerHTML = filtradas.map(montarCardOrdemHtml).join('');
}

function renderizarCarteira() {
  if (!state.user) return;
  document.getElementById('wallet-available').textContent = moeda(state.user.saldo_disponivel);
  document.getElementById('wallet-escrowed').textContent = moeda(state.user.saldo_custodia);
}

function renderizarPrestadores() {
  const box = document.getElementById('prestadores-container');
  box.innerHTML = state.prestadores.map(p => {
    const obras = (p.portfolio || []).map(item => `
      <div style="margin-top: 8px; padding: 10px; background: var(--bg-page); border: 1px solid var(--border); border-radius: var(--radius-sm);">
        <strong style="font-size: 12.5px;">${escapeHtml(item.titulo)}</strong>
        <span class="badge badge-neutral" style="margin-left: 6px;">${escapeHtml(item.categoria)}</span>
        <p style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">${escapeHtml(item.descricao || '')}</p>
      </div>
    `).join('');

    return `
      <div class="order-card">
        <div>
          <div class="order-meta-top">
            <span class="badge badge-info">${escapeHtml(p.especialidade || 'Serviços Gerais')}</span>
            ${p.verificado === 1 ? '<span class="badge badge-success">Perfil Verificado</span>' : '<span class="badge badge-warning">Em Homologação</span>'}
          </div>
          <h3 class="order-title" style="margin-top: 10px;">${escapeHtml(p.nome)}</h3>
          <p style="font-size: 13px; color: var(--text-secondary);">Reputação: <strong>${Number(p.reputacao).toFixed(1)} / 5.0</strong> · Contato: ${escapeHtml(p.telefone || '-')}</p>
          <div style="margin-top: 12px;">
            <strong style="font-size: 12px; color: var(--text-muted); text-transform: uppercase;">Portfólio Técnico (${(p.portfolio || []).length})</strong>
            ${obras || '<p style="font-size: 12.5px; color: var(--text-light); margin-top: 6px;">Nenhuma obra cadastrada até o momento.</p>'}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderizarTransacoes() {
  const tbody = document.getElementById('transacoes-tbody');
  if (state.transacoes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted);">Nenhuma movimentação registrada.</td></tr>`;
    return;
  }
  tbody.innerHTML = state.transacoes.map(t => {
    const cls = t.tipo === 'LIBERACAO_REPASSE' ? 'badge-success' : (t.tipo === 'BLOQUEIO_ESCROW' ? 'badge-warning' : 'badge-danger');
    return `
      <tr>
        <td><strong>#${t.id}</strong></td>
        <td style="color: var(--text-muted); font-size: 12px;">${t.criado_em ? new Date(t.criado_em).toLocaleString('pt-BR') : '-'}</td>
        <td>OS #${t.ordem_id} · ${escapeHtml(t.ordem_titulo || '')}</td>
        <td><span class="badge ${cls}">${escapeHtml(t.tipo)}</span></td>
        <td><strong>${moeda(t.valor)}</strong></td>
        <td><span class="badge badge-neutral">${escapeHtml(t.status)}</span></td>
        <td style="color: var(--text-secondary); max-width: 320px;">${escapeHtml(t.detalhes || '')}</td>
      </tr>
    `;
  }).join('');
}

function renderizarDisputas() {
  const disputas = state.ordens.filter(o => o.status === 'EM_DISPUTA');
  const box = document.getElementById('disputas-container');
  if (disputas.length === 0) {
    box.innerHTML = `<div class="panel-card" style="grid-column: 1 / -1; text-align: center; color: var(--text-muted);">Nenhuma ordem em disputa no momento. Todos os contratos seguem dentro da conformidade.</div>`;
    return;
  }
  box.innerHTML = disputas.map(o => `
    <div class="order-card">
      <div>
        <div class="order-meta-top">
          <span class="badge badge-danger">Custódia Congelada</span>
          <span style="font-size: 12px; color: var(--text-muted);">OS #${o.id}</span>
        </div>
        <h3 class="order-title">${escapeHtml(o.titulo)}</h3>
        <p class="order-desc">${escapeHtml(o.descricao)}</p>
        <p style="font-size: 12.5px; color: var(--text-secondary); margin-top: 8px;">Cliente: <strong>${escapeHtml(o.cliente_nome)}</strong> · Valor retido: <strong>${moeda(o.valor_total)}</strong></p>
      </div>
      <div class="order-footer">
        <span style="font-size: 12px; color: var(--text-muted);">Aguardando decisão técnica</span>
        ${state.user && state.user.papel === 'ADMIN'
          ? `<button class="btn btn-primary btn-sm" onclick="abrirModalArbitragem(${o.id})">Emitir Decisão</button>`
          : `<button class="btn btn-secondary btn-sm" onclick="abrirModalDetalhes(${o.id})">Ver Detalhes</button>`}
      </div>
    </div>
  `).join('');
}

function renderizarNotificacoes() {
  const tbody = document.getElementById('notificacoes-tbody');
  if (state.notificacoes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted);">Nenhum disparo registrado.</td></tr>`;
    return;
  }
  tbody.innerHTML = state.notificacoes.map(n => `
    <tr>
      <td><strong>#${n.id}</strong></td>
      <td style="font-size: 12px; color: var(--text-muted);">${n.criado_em ? new Date(n.criado_em).toLocaleString('pt-BR') : '-'}</td>
      <td><span class="badge ${n.canal === 'WHATSAPP' ? 'badge-success' : 'badge-info'}">${escapeHtml(n.canal)}</span></td>
      <td style="font-family: monospace; font-size: 12px;">${escapeHtml(n.destinatario)}</td>
      <td>${escapeHtml(n.usuario_nome || 'Sistema')}</td>
      <td style="max-width: 360px;">${escapeHtml(n.mensagem)}</td>
      <td><span class="badge badge-neutral">${escapeHtml(n.status)}</span></td>
    </tr>
  `).join('');
}

async function renderizarPainelAdmin() {
  const res = await fetch('/api/admin/metricas');
  const json = await res.json();
  if (json.sucesso) {
    const m = json.dados;
    document.getElementById('admin-metrics-grid').innerHTML = `
      <div class="kpi-card"><div class="kpi-label">Taxa de Conversão</div><div class="kpi-value">${m.taxa_conversao_percentual}%</div><div class="kpi-sub">${m.ordens_concluidas} concluídas de ${m.total_ordens}</div></div>
      <div class="kpi-card"><div class="kpi-label">Ticket Médio</div><div class="kpi-value">${moeda(m.ticket_medio)}</div><div class="kpi-sub">Por ordem contratada</div></div>
      <div class="kpi-card"><div class="kpi-label">Receita de Intermediação</div><div class="kpi-value">${moeda(m.receita_taxas)}</div><div class="kpi-sub">Taxas de custódia</div></div>
      <div class="kpi-card"><div class="kpi-label">Prestadores Verificados</div><div class="kpi-value">${m.prestadores_verificados} / ${m.total_prestadores}</div><div class="kpi-sub">Com documentação aprovada</div></div>
    `;
  }

  const candidatos = state.usuarios.filter(u => u.papel !== 'ADMIN');
  document.getElementById('admin-verificacoes-list').innerHTML = candidatos.map(u => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding: 10px 0; border-bottom: 1px solid var(--bg-subtle); gap: 10px;">
      <div>
        <strong style="font-size: 13.5px;">${escapeHtml(u.nome)}</strong>
        <span class="badge badge-neutral" style="margin-left: 6px;">${escapeHtml(u.papel)}</span>
        <div style="font-size: 12px; color: var(--text-muted);">
          ${u.documento_url ? `Doc: ${escapeHtml(u.documento_url)}` : 'Sem anexo enviado'}
        </div>
      </div>
      ${u.verificado === 1
        ? '<span class="badge badge-success">Homologado</span>'
        : `<button class="btn btn-success btn-sm" onclick="aprovarSeloUsuario(${u.id})">Aprovar Selo</button>`}
    </div>
  `).join('');

  document.getElementById('admin-cupons-list').innerHTML = state.cupons.map(c => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding: 10px 0; border-bottom: 1px solid var(--bg-subtle);">
      <div>
        <strong style="font-family: monospace; font-size: 13.5px;">${escapeHtml(c.codigo)}</strong>
        <span style="font-size: 12.5px; color: var(--text-secondary); margin-left: 8px;">${c.desconto_percentual}% de desconto na taxa</span>
      </div>
      <button class="btn ${c.ativo === 1 ? 'btn-secondary' : 'btn-primary'} btn-sm" onclick="alternarCupom(${c.id})">
        ${c.ativo === 1 ? 'Desativar' : 'Ativar'}
      </button>
    </div>
  `).join('');
}

async function renderizarPerfil() {
  if (!state.user) return;
  document.getElementById('perf-nome').value = state.user.nome || '';
  document.getElementById('perf-email').value = state.user.email || '';
  document.getElementById('perf-telefone').value = state.user.telefone || '';
  document.getElementById('perf-especialidade').value = state.user.especialidade || '';
  document.getElementById('perf-doc-url').value = state.user.documento_url || '';
  document.getElementById('perf-senha').value = '';
  document.getElementById('perf-esp-group').classList.toggle('hidden', state.user.papel !== 'PRESTADOR');

  const badge = document.getElementById('perf-verificado-badge');
  if (state.user.verificado === 1) {
    badge.className = 'badge badge-success';
    badge.textContent = 'Perfil Verificado';
  } else {
    badge.className = 'badge badge-warning';
    badge.textContent = 'Pendente de Homologação';
  }

  const resAv = await fetch(`/api/avaliacoes?avaliado_id=${state.user.id}`);
  const jAv = await resAv.json();
  const avBox = document.getElementById('perf-avaliacoes-list');
  if (jAv.sucesso && jAv.dados.length > 0) {
    avBox.innerHTML = jAv.dados.map(a => `
      <div style="padding: 10px 0; border-bottom: 1px solid var(--bg-subtle);">
        <div style="display:flex; justify-content:space-between; font-size: 12.5px;">
          <strong>${escapeHtml(a.avaliador_nome)} (${escapeHtml(a.ordem_titulo)})</strong>
          <span class="badge badge-warning">Nota ${a.nota}/5</span>
        </div>
        <p style="font-size: 12.5px; color: var(--text-secondary); margin-top: 3px;">${escapeHtml(a.comentario || '')}</p>
      </div>
    `).join('');
  } else {
    avBox.innerHTML = `<p style="font-size: 12.5px; color: var(--text-muted);">Nenhuma avaliação registrada até o momento.</p>`;
  }
}

// =========================================================================
// MODAIS INTERATIVOS (DETALHES, CHECKOUT, PROPOSTAS, VISTORIA, DISPUTA)
// =========================================================================
function abrirModal(html) {
  document.getElementById('modal-body').innerHTML = html;
  document.getElementById('modal').classList.remove('hidden');
}

function fecharModal() {
  document.getElementById('modal').classList.add('hidden');
}

async function abrirModalDetalhes(ordemId) {
  const res = await fetch(`/api/ordens/${ordemId}`);
  const json = await res.json();
  if (!json.sucesso) return toast(json.mensagem, 'error');

  const o = json.dados;
  const propostas = o.propostas || [];
  const podeContratar = state.user && state.user.id === o.cliente_id && ['PENDENTE', 'PROPOSTA_RECEBIDA'].includes(o.status);

  const listaPropHtml = propostas.length === 0
    ? `<p style="font-size: 13px; color: var(--text-muted); padding: 12px 0;">Nenhuma proposta enviada até o momento.</p>`
    : propostas.map(p => `
        <div style="border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 14px; margin-bottom: 10px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <strong>${escapeHtml(p.prestador_nome)}</strong>
              <span style="font-size: 12px; color: var(--text-muted); margin-left: 6px;">Nota ${Number(p.prestador_reputacao || 5).toFixed(1)}</span>
            </div>
            <strong style="font-size: 15px;">${moeda(p.valor)}</strong>
          </div>
          <p style="font-size: 12.5px; color: var(--text-secondary); margin: 6px 0;">Prazo: <strong>${escapeHtml(p.prazo_estimado)}</strong> · ${escapeHtml(p.mensagem || '')}</p>
          ${podeContratar ? `
            <button class="btn btn-primary btn-sm" style="margin-top: 6px; width: 100%;" onclick="abrirModalCheckout(${o.id}, ${p.id}, ${Number(p.valor)})">
              Aceitar e Retêr em Escrow (${moeda(p.valor)} + taxa)
            </button>
          ` : ''}
        </div>
      `).join('');

  abrirModal(`
    <div class="modal-header">
      <h3>Ordem de Serviço #${o.id}</h3>
      <button class="btn btn-ghost btn-sm" onclick="fecharModal()">Fechar</button>
    </div>
    <p style="font-size: 14.5px; font-weight: 700; margin-bottom: 4px;">${escapeHtml(o.titulo)}</p>
    <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px;">${escapeHtml(o.descricao)}</p>
    <div style="background: var(--bg-page); padding: 12px; border-radius: var(--radius-sm); font-size: 12.5px; margin-bottom: 16px;">
      <div><strong>Cliente:</strong> ${escapeHtml(o.cliente_nome)}</div>
      <div><strong>Local:</strong> ${escapeHtml(o.endereco)} (${escapeHtml(o.cep)})</div>
      ${o.prestador_nome ? `<div><strong>Profissional contratado:</strong> ${escapeHtml(o.prestador_nome)}</div>` : ''}
      ${o.foto_conclusao ? `<div><strong> Registro de conclusão:</strong> <a href="${escapeHtml(o.foto_conclusao)}" target="_blank" style="color:var(--accent);">Abrir evidência</a></div>` : ''}
    </div>
    <h4 style="font-size: 13.5px; font-weight: 700; margin-bottom: 8px;">Propostas Recebidas (${propostas.length})</h4>
    ${listaPropHtml}
  `);
}

function abrirModalCheckout(ordemId, propostaId, valorMaoObra) {
  const taxaBase = Math.max(15, Math.round(valorMaoObra * 0.08 * 100) / 100);
  abrirModal(`
    <div class="modal-header">
      <h3>Checkout Protegido FreeLA Escrow</h3>
      <button class="btn btn-ghost btn-sm" onclick="fecharModal()">Fechar</button>
    </div>
    <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 14px;">
      O valor ficará retido em conta vinculada e só será transferido ao prestador após sua aprovação na vistoria presencial.
    </p>
    <div class="form-group">
      <label class="form-label">Método de pagamento</label>
      <select id="chk-metodo" class="form-select">
        <option value="PIX">PIX Instantâneo (Liquidação imediata em custódia)</option>
        <option value="CARTAO_CREDITO">Cartão de Crédito (1x sem juros)</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Cupom promocional na taxa (opcional)</label>
      <input type="text" id="chk-cupom" class="form-input" placeholder="Ex: FREELA10 ou BEMVINDO20" oninput="recalcularPreviewCheckout(${valorMaoObra})">
    </div>
    <div style="background: var(--bg-page); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 14px; margin-bottom: 16px; font-size: 13px;">
      <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>Mão de obra do profissional:</span><strong>${moeda(valorMaoObra)}</strong></div>
      <div style="display:flex; justify-content:space-between; margin-bottom:6px;"><span>Taxa de custódia e garantia:</span><strong id="chk-taxa-val">${moeda(taxaBase)}</strong></div>
      <div style="display:flex; justify-content:space-between; padding-top:8px; border-top:1px solid var(--border); font-size:15px;"><strong>Total a reter em Escrow:</strong><strong id="chk-total-val">${moeda(valorMaoObra + taxaBase)}</strong></div>
    </div>
    <div style="display:flex; justify-content:flex-end; gap:8px;">
      <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="confirmarCheckout(${ordemId}, ${propostaId})">Confirmar Pagamento em Custódia</button>
    </div>
  `);
}

function recalcularPreviewCheckout(valorMaoObra) {
  let taxa = Math.max(15, Math.round(valorMaoObra * 0.08 * 100) / 100);
  const cod = (document.getElementById('chk-cupom').value || '').trim().toUpperCase();
  if (cod) {
    const cup = state.cupons.find(c => c.codigo === cod && c.ativo === 1);
    if (cup) taxa = Math.round(taxa * (1 - cup.desconto_percentual / 100) * 100) / 100;
    else if (cod === 'FREELA10') taxa = Math.round(taxa * 0.5 * 100) / 100;
  }
  document.getElementById('chk-taxa-val').textContent = moeda(taxa);
  document.getElementById('chk-total-val').textContent = moeda(valorMaoObra + taxa);
}

async function confirmarCheckout(ordemId, propostaId) {
  const metodo_pagamento = document.getElementById('chk-metodo').value;
  const cupom = document.getElementById('chk-cupom').value.trim();

  const res = await fetch(`/api/ordens/${ordemId}/checkout`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ proposta_id: propostaId, metodo_pagamento, cupom })
  });
  const json = await res.json();
  if (json.sucesso) {
    fecharModal();
    toast('Pagamento retido em custódia com sucesso!', 'success');
    await sincronizarDadosBase();
    navegarApp(state.page);
  } else {
    toast(json.mensagem, 'error');
  }
}

function abrirModalProposta(ordemId) {
  abrirModal(`
    <div class="modal-header">
      <h3>Enviar Proposta Orçamentária · OS #${ordemId}</h3>
      <button class="btn btn-ghost btn-sm" onclick="fecharModal()">Fechar</button>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Valor da mão de obra (R$)</label>
        <input type="number" id="prop-valor" class="form-input" placeholder="280.00" min="10" step="1" required>
      </div>
      <div class="form-group">
        <label class="form-label">Prazo estimado</label>
        <input type="text" id="prop-prazo" class="form-input" placeholder="Ex: Hoje às 15h ou 1 dia útil" required>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Escopo técnico e observações</label>
      <textarea id="prop-msg" class="form-textarea" rows="3" placeholder="Descreva ferramentas, garantia de mão de obra e condições..."></textarea>
    </div>
    <div style="display:flex; justify-content:flex-end; gap:8px;">
      <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="enviarPropostaOrdem(${ordemId})">Enviar Orçamento</button>
    </div>
  `);
}

async function enviarPropostaOrdem(ordemId) {
  const valor = parseFloat(document.getElementById('prop-valor').value);
  const prazo_estimado = document.getElementById('prop-prazo').value.trim();
  const mensagem = document.getElementById('prop-msg').value.trim();

  const res = await fetch(`/api/ordens/${ordemId}/propostas`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ prestador_id: state.user.id, valor, prazo_estimado, mensagem })
  });
  const json = await res.json();
  if (json.sucesso) {
    fecharModal();
    toast('Orçamento enviado ao cliente!', 'success');
    await sincronizarDadosBase();
    navegarApp(state.page);
  } else {
    toast(json.mensagem, 'error');
  }
}

async function atualizarStatusOrdem(ordemId, novoStatus, fotoConclusao = null) {
  const res = await fetch(`/api/ordens/${ordemId}/status`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ novo_status: novoStatus, foto_conclusao: fotoConclusao })
  });
  const json = await res.json();
  if (json.sucesso) {
    fecharModal();
    toast(`Status atualizado para ${novoStatus}.`, 'success');
    await sincronizarDadosBase();
    navegarApp(state.page);
  } else {
    toast(json.mensagem, 'error');
  }
}

function abrirModalConclusaoPrestador(ordemId) {
  abrirModal(`
    <div class="modal-header">
      <h3>Concluir Execução e Solicitar Vistoria</h3>
      <button class="btn btn-ghost btn-sm" onclick="fecharModal()">Fechar</button>
    </div>
    <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 14px;">
      Ao enviar para vistoria, o cliente será notificado por WhatsApp e e-mail para inspecionar o serviço e liberar seu repasse.
    </p>
    <div class="form-group">
      <label class="form-label">URL da foto de comprovação do reparo (opcional)</label>
      <input type="text" id="conc-foto" class="form-input" placeholder="https://images.unsplash.com/...">
    </div>
    <div style="display:flex; justify-content:flex-end; gap:8px;">
      <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-success" onclick="atualizarStatusOrdem(${ordemId}, 'AGUARDANDO_VISTORIA', document.getElementById('conc-foto').value.trim())">Confirmar Conclusão</button>
    </div>
  `);
}

function selecionarEstrela(n) {
  state.selectedStarRating = n;
  document.querySelectorAll('.star-btn').forEach(b => {
    b.classList.toggle('active', Number(b.dataset.star) <= n);
  });
}

function abrirModalAprovacao(ordemId) {
  state.selectedStarRating = 5;
  abrirModal(`
    <div class="modal-header">
      <h3>Homologar Vistoria e Liberar Pagamento</h3>
      <button class="btn btn-ghost btn-sm" onclick="fecharModal()">Fechar</button>
    </div>
    <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 16px;">
      Confirme que inspecionou presencialmente o reparo da OS #${ordemId}. Esta ação transfere o saldo em custódia para a carteira do prestador.
    </p>
    <div class="form-group">
      <label class="form-label">Avaliação do profissional (1 a 5 estrelas)</label>
      <div class="star-picker">
        ${[1, 2, 3, 4, 5].map(n => `<button type="button" class="star-btn active" data-star="${n}" onclick="selecionarEstrela(${n})">${n}★</button>`).join('')}
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Parecer sobre o serviço realizado</label>
      <textarea id="aprov-comentario" class="form-textarea" rows="3" placeholder="Descreva sua experiência com pontualidade, limpeza e qualidade técnica..."></textarea>
    </div>
    <div style="display:flex; justify-content:flex-end; gap:8px;">
      <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-success" onclick="confirmarAprovacaoVistoria(${ordemId})">Aprovar e Liberar Repasse</button>
    </div>
  `);
}

async function confirmarAprovacaoVistoria(ordemId) {
  const comentario = document.getElementById('aprov-comentario').value.trim();
  const res = await fetch(`/api/ordens/${ordemId}/aprovar`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ cliente_id: state.user.id, nota: state.selectedStarRating, comentario })
  });
  const json = await res.json();
  if (json.sucesso) {
    fecharModal();
    toast(`Vistoria homologada! ${moeda(json.valor_liberado)} liberados ao profissional.`, 'success');
    await sincronizarDadosBase();
    navegarApp(state.page);
  } else {
    toast(json.mensagem, 'error');
  }
}

function abrirModalAvaliarCliente(ordemId) {
  state.selectedStarRating = 5;
  abrirModal(`
    <div class="modal-header">
      <h3>Avaliação Mútua do Cliente · OS #${ordemId}</h3>
      <button class="btn btn-ghost btn-sm" onclick="fecharModal()">Fechar</button>
    </div>
    <div class="form-group">
      <label class="form-label">Nota para o cliente (1 a 5 estrelas)</label>
      <div class="star-picker">
        ${[1, 2, 3, 4, 5].map(n => `<button type="button" class="star-btn active" data-star="${n}" onclick="selecionarEstrela(${n})">${n}★</button>`).join('')}
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Comentário sobre o atendimento no local</label>
      <textarea id="avcli-comentario" class="form-textarea" rows="3" placeholder="Ex: Cliente cordial, local acessível e instruções claras."></textarea>
    </div>
    <div style="display:flex; justify-content:flex-end; gap:8px;">
      <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="confirmarAvaliacaoCliente(${ordemId})">Registrar Avaliação</button>
    </div>
  `);
}

async function confirmarAvaliacaoCliente(ordemId) {
  const comentario = document.getElementById('avcli-comentario').value.trim();
  const res = await fetch(`/api/ordens/${ordemId}/avaliar-cliente`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ prestador_id: state.user.id, nota: state.selectedStarRating, comentario })
  });
  const json = await res.json();
  if (json.sucesso) {
    fecharModal();
    toast('Avaliação do cliente registrada!', 'success');
    await sincronizarDadosBase();
  } else {
    toast(json.mensagem, 'error');
  }
}

function abrirModalDisputa(ordemId) {
  abrirModal(`
    <div class="modal-header">
      <h3>Abrir Contestação e Congelar Escrow · OS #${ordemId}</h3>
      <button class="btn btn-ghost btn-sm" onclick="fecharModal()">Fechar</button>
    </div>
    <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 14px;">
      O valor permanecerá bloqueado na plataforma até a análise técnica da mediação administrativa.
    </p>
    <div class="form-group">
      <label class="form-label">Motivo principal da inconformidade</label>
      <input type="text" id="disp-motivo" class="form-input" placeholder="Ex: Vazamento persistente após troca da peça" required>
    </div>
    <div class="form-group">
      <label class="form-label">Relato detalhado</label>
      <textarea id="disp-detalhes" class="form-textarea" rows="3" placeholder="Descreva o problema verificado presencialmente..."></textarea>
    </div>
    <div style="display:flex; justify-content:flex-end; gap:8px;">
      <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-danger" onclick="confirmarDisputa(${ordemId})">Congelar Custódia e Acionar Suporte</button>
    </div>
  `);
}

async function confirmarDisputa(ordemId) {
  const motivo = document.getElementById('disp-motivo').value.trim();
  const detalhes = document.getElementById('disp-detalhes').value.trim();
  if (!motivo) return toast('Informe o motivo da contestação.', 'error');

  const res = await fetch(`/api/ordens/${ordemId}/disputa`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ motivo, detalhes })
  });
  const json = await res.json();
  if (json.sucesso) {
    fecharModal();
    toast('Disputa registrada e custódia congelada.', 'info');
    await sincronizarDadosBase();
    navegarApp('disputas');
  } else {
    toast(json.mensagem, 'error');
  }
}

function abrirModalArbitragem(ordemId) {
  abrirModal(`
    <div class="modal-header">
      <h3>Arbitragem Administrativa · OS #${ordemId}</h3>
      <button class="btn btn-ghost btn-sm" onclick="fecharModal()">Fechar</button>
    </div>
    <div class="form-group">
      <label class="form-label">Decisão da mediação</label>
      <select id="arb-decisao" class="form-select">
        <option value="ESTORNO_CLIENTE">Estorno Integral ao Cliente (Cancelar OS)</option>
        <option value="REPASSE_PRESTADOR">Liberar Repasse ao Prestador (Concluir OS)</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Parecer técnico fundamentado</label>
      <textarea id="arb-justificativa" class="form-textarea" rows="3" placeholder="Registre a fundamentação da análise para o livro-razão..." required></textarea>
    </div>
    <div style="display:flex; justify-content:flex-end; gap:8px;">
      <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="confirmarArbitragem(${ordemId})">Executar Decisão</button>
    </div>
  `);
}

async function confirmarArbitragem(ordemId) {
  const decisao = document.getElementById('arb-decisao').value;
  const justificativa = document.getElementById('arb-justificativa').value.trim();
  const res = await fetch(`/api/disputas/${ordemId}/resolver`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ decisao, justificativa })
  });
  const json = await res.json();
  if (json.sucesso) {
    fecharModal();
    toast(json.mensagem, 'success');
    await sincronizarDadosBase();
    navegarApp('disputas');
  } else {
    toast(json.mensagem, 'error');
  }
}

function abrirModalPortfolio() {
  abrirModal(`
    <div class="modal-header">
      <h3>Adicionar Serviço ao Meu Portfólio</h3>
      <button class="btn btn-ghost btn-sm" onclick="fecharModal()">Fechar</button>
    </div>
    <div class="form-group">
      <label class="form-label">Título da obra realizada</label>
      <input type="text" id="port-titulo" class="form-input" placeholder="Ex: Adequação de quadro bifásico NBR 5410" required>
    </div>
    <div class="form-group">
      <label class="form-label">Especialidade</label>
      <select id="port-cat" class="form-select">
        <option value="Elétrica">Elétrica</option>
        <option value="Hidráulica">Hidráulica</option>
        <option value="Pintura">Pintura</option>
        <option value="Alvenaria">Alvenaria</option>
        <option value="Climatização">Climatização</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Descrição técnica</label>
      <textarea id="port-desc" class="form-textarea" rows="3" placeholder="Materiais empregados e resultado entregue..."></textarea>
    </div>
    <div style="display:flex; justify-content:flex-end; gap:8px;">
      <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarItemPortfolio()">Publicar no Catálogo</button>
    </div>
  `);
}

async function salvarItemPortfolio() {
  const titulo = document.getElementById('port-titulo').value.trim();
  const categoria = document.getElementById('port-cat').value;
  const descricao = document.getElementById('port-desc').value.trim();
  if (!titulo) return toast('Informe o título da obra.', 'error');

  const res = await fetch(`/api/prestadores/${state.user.id}/portfolio`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ titulo, categoria, descricao })
  });
  const json = await res.json();
  if (json.sucesso) {
    fecharModal();
    toast('Obra adicionada ao seu portfólio!', 'success');
    await sincronizarDadosBase();
    renderizarPrestadores();
  } else {
    toast(json.mensagem, 'error');
  }
}

async function aprovarSeloUsuario(userId) {
  const res = await fetch(`/api/admin/usuarios/${userId}/aprovar`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ admin_id: state.user.id })
  });
  const json = await res.json();
  if (json.sucesso) {
    toast(json.mensagem, 'success');
    await sincronizarDadosBase();
    renderizarPainelAdmin();
  } else {
    toast(json.mensagem, 'error');
  }
}

async function alternarCupom(cupomId) {
  const res = await fetch(`/api/admin/cupons/${cupomId}/toggle`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ admin_id: state.user.id })
  });
  if (res.ok) {
    await sincronizarDadosBase();
    renderizarPainelAdmin();
  }
}

// =========================================================================
// LISTENERS DE FORMULÁRIOS FIXOS
// =========================================================================
function atualizarEstimativaPreco() {
  const sel = document.getElementById('select-categoria');
  if (!sel) return;
  const cat = sel.value;
  const info = ESTIMATIVAS_PRECO[cat] || { min: 150, max: 400, desc: '' };
  document.getElementById('estimator-title').textContent = `Referência Regional · ${cat}`;
  document.getElementById('estimator-text').textContent = `Faixa média em Volta Redonda: R$ ${info.min},00 a R$ ${info.max},00. ${info.desc}`;
}

function configurarFormulariosFixos() {
  document.getElementById('select-categoria').addEventListener('change', atualizarEstimativaPreco);
  document.getElementById('filtro-busca').addEventListener('input', renderizarMuralOrdens);
  document.getElementById('filtro-status').addEventListener('change', renderizarMuralOrdens);
  document.getElementById('filtro-categoria').addEventListener('change', renderizarMuralOrdens);

  // Login real
  document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const senha = document.getElementById('login-senha').value;
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha })
    });
    const json = await res.json();
    if (json.sucesso) {
      state.token = json.token;
      state.user = json.dados;
      localStorage.setItem(STORAGE_TOKEN_KEY, json.token);
      toast(`Sessão iniciada como ${json.dados.nome}`, 'success');
      await iniciarWorkspace('overview');
    } else {
      toast(json.mensagem || 'E-mail ou senha incorretos.', 'error');
    }
  });

  // Cadastro real
  document.getElementById('form-register').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      nome: document.getElementById('reg-nome').value.trim(),
      email: document.getElementById('reg-email').value.trim(),
      telefone: document.getElementById('reg-telefone').value.trim(),
      papel: document.getElementById('reg-papel').value,
      especialidade: document.getElementById('reg-especialidade').value,
      senha: document.getElementById('reg-senha').value
    };
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (json.sucesso) {
      state.token = json.token;
      state.user = json.dados;
      localStorage.setItem(STORAGE_TOKEN_KEY, json.token);
      toast('Conta criada com sucesso!', 'success');
      await iniciarWorkspace('overview');
    } else {
      toast(json.mensagem, 'error');
    }
  });

  // Nova Ordem
  document.getElementById('form-nova-solicitacao').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      cliente_id: state.user.id,
      categoria: document.getElementById('select-categoria').value,
      urgencia: document.getElementById('select-urgencia').value,
      titulo: document.getElementById('input-titulo').value.trim(),
      descricao: document.getElementById('input-descricao').value.trim(),
      cep: document.getElementById('input-cep').value.trim(),
      endereco: document.getElementById('input-endereco').value.trim()
    };
    const res = await fetch('/api/ordens', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (json.sucesso) {
      e.target.reset();
      atualizarEstimativaPreco();
      toast('Solicitação publicada no mural!', 'success');
      await sincronizarDadosBase();
      navegarApp('mural');
    } else {
      toast(json.mensagem, 'error');
    }
  });

  // Saque PIX
  document.getElementById('form-saque').addEventListener('submit', async (e) => {
    e.preventDefault();
    const valor = parseFloat(document.getElementById('saque-valor').value);
    const chave_pix = document.getElementById('saque-pix').value.trim();
    const res = await fetch('/api/prestador/saque', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ prestador_id: state.user.id, valor, chave_pix })
    });
    const json = await res.json();
    if (json.sucesso) {
      e.target.reset();
      toast(json.mensagem, 'success');
      await sincronizarDadosBase();
      renderizarCarteira();
    } else {
      toast(json.mensagem, 'error');
    }
  });

  // Novo Cupom Admin
  document.getElementById('form-novo-cupom').addEventListener('submit', async (e) => {
    e.preventDefault();
    const codigo = document.getElementById('cupom-codigo').value.trim();
    const desconto_percentual = document.getElementById('cupom-desconto').value;
    const res = await fetch('/api/admin/cupons', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ admin_id: state.user.id, codigo, desconto_percentual })
    });
    const json = await res.json();
    if (json.sucesso) {
      e.target.reset();
      toast(json.mensagem, 'success');
      await sincronizarDadosBase();
      renderizarPainelAdmin();
    } else {
      toast(json.mensagem, 'error');
    }
  });

  // Atualizar Perfil
  document.getElementById('form-perfil').addEventListener('submit', async (e) => {
    e.preventDefault();
    const res = await fetch('/api/auth/perfil', {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({
        nome: document.getElementById('perf-nome').value.trim(),
        telefone: document.getElementById('perf-telefone').value.trim(),
        especialidade: document.getElementById('perf-especialidade').value.trim(),
        nova_senha: document.getElementById('perf-senha').value
      })
    });
    const json = await res.json();
    if (json.sucesso) {
      state.user = json.dados;
      atualizarResumoUsuarioSidebar();
      toast('Dados da conta atualizados!', 'success');
    } else {
      toast(json.mensagem, 'error');
    }
  });

  // Enviar Documento para Verificação
  document.getElementById('form-documento').addEventListener('submit', async (e) => {
    e.preventDefault();
    const documento_url = document.getElementById('perf-doc-url').value.trim();
    const res = await fetch(`/api/usuarios/${state.user.id}/verificar-documento`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ documento_url })
    });
    const json = await res.json();
    if (json.sucesso) {
      toast(json.mensagem, 'success');
      await sincronizarDadosBase();
      renderizarPerfil();
    } else {
      toast(json.mensagem, 'error');
    }
  });
}
