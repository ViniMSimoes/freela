// FreeLA — Unslopped Client Controller (CSP-safe Event Delegation)
// unslop methodology by Damir Sokolovsky (@heydamir), CC BY 4.0

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
  selectedStarRating: 5,
  pendingIntent: null
};

const ICONS = {
  overview: '<svg class="ico" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  mural: '<svg class="ico" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6"/><path d="M9 16h4"/></svg>',
  nova: '<svg class="ico" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>',
  carteira: '<svg class="ico" viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M2 10h20"/><circle cx="16.5" cy="14.5" r="1"/></svg>',
  prestadores: '<svg class="ico" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  admin: '<svg class="ico" viewBox="0 0 24 24"><path d="M12 3v18"/><path d="M18 9v12"/><path d="M6 15v6"/></svg>',
  escrow: '<svg class="ico" viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  disputas: '<svg class="ico" viewBox="0 0 24 24"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg>',
  notificacoes: '<svg class="ico" viewBox="0 0 24 24"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
  perfil: '<svg class="ico" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c1.8-3.5 5-5 8-5s6.2 1.5 8 5"/></svg>'
};

const ESTIMATIVAS_PRECO = {
  'Elétrica': { min: '180,00', max: '380,00', desc: 'Substituição de disjuntores, chuveiros, tomadas e revisão de quadros.' },
  'Hidráulica': { min: '150,00', max: '320,00', desc: 'Reparo de vazamentos, troca de sifões, registros e desentupimentos.' },
  'Pintura': { min: '350,00', max: '950,00', desc: 'Pintura acrílica interna e externa, massa corrida e impermeabilização.' },
  'Alvenaria': { min: '300,00', max: '1.200,00', desc: 'Assentamento de pisos, revestimentos, reboco e pequenos reparos.' },
  'Climatização': { min: '200,00', max: '550,00', desc: 'Instalação de aparelhos split, higienização técnica e recarga de gás.' }
};

const STATUS_META = {
  'PENDENTE': { label: 'Aguardando propostas', dot: '', step: 1 },
  'PROPOSTA_RECEBIDA': { label: 'Proposta recebida', dot: 'dot-accent', step: 2 },
  'EM_CUSTODIA': { label: 'Retido em custódia', dot: 'dot-accent', step: 3 },
  'A_CAMINHO': { label: 'Prestador a caminho', dot: 'dot-accent', step: 3 },
  'EM_EXECUCAO': { label: 'Em execução', dot: 'dot-accent', step: 4 },
  'AGUARDANDO_VISTORIA': { label: 'Vistoria pendente', dot: 'dot-accent', step: 4 },
  'CONCLUIDO': { label: 'Liquidado', dot: 'dot-pos', step: 5 },
  'EM_DISPUTA': { label: 'Em mediação', dot: 'dot-neg', step: 4 },
  'CANCELADO': { label: 'Estornado', dot: 'dot-neg', step: 5 }
};

const PAGE_TITLES = {
  overview: { crumb: 'Visão geral', title: 'Novembro', sub: '2026' },
  mural: { crumb: 'Ordens de serviço', title: 'Ordens de serviço', sub: '' },
  nova: { crumb: 'Solicitar reparo', title: 'Solicitar reparo', sub: '' },
  carteira: { crumb: 'Carteira PIX', title: 'Carteira PIX', sub: '' },
  prestadores: { crumb: 'Profissionais', title: 'Profissionais', sub: '' },
  escrow: { crumb: 'Livro-razão escrow', title: 'Livro-razão', sub: 'Escrow' },
  disputas: { crumb: 'Disputas', title: 'Mediação de disputas', sub: '' },
  notificacoes: { crumb: 'Notificações', title: 'Registro de avisos', sub: '' },
  admin: { crumb: 'Administração', title: 'Governança', sub: 'Plataforma' },
  perfil: { crumb: 'Minha conta', title: 'Minha conta', sub: '' }
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

function limparPontuacaoExclamativa(msg) {
  return String(msg || '').replace(/!/g, '.').replace(/\.\.+/g, '.').trim();
}

function normalizarCategoriaOrdem(texto) {
  if (!texto) return null;
  const s = String(texto).toLowerCase();
  if (s.includes('elétric') || s.includes('eletric')) return 'Elétrica';
  if (s.includes('hidráulic') || s.includes('hidraulic')) return 'Hidráulica';
  if (s.includes('pintur')) return 'Pintura';
  if (s.includes('alvenar') || s.includes('reform')) return 'Alvenaria';
  if (s.includes('climatiz') || s.includes('split')) return 'Climatização';
  return ESTIMATIVAS_PRECO[texto] ? texto : null;
}

function moeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function codigoOrdem(id) {
  return `OS·${String(id).padStart(4, '0')}`;
}

function authHeaders() {
  const h = { 'Content-Type': 'application/json' };
  if (state.token) h['Authorization'] = `Bearer ${state.token}`;
  return h;
}

function toast(mensagem, tipo = 'info') {
  const region = document.getElementById('toast-region');
  if (!region) return;
  const el = document.createElement('div');
  el.className = 'toast-item';
  const dotCls = tipo === 'success' ? 'dot-pos' : (tipo === 'error' ? 'dot-neg' : 'dot-accent');
  el.innerHTML = `<span class="dot ${dotCls}"></span><span>${escapeHtml(limparPontuacaoExclamativa(mensagem))}</span>`;
  region.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 180ms cubic-bezier(0.22, 1, 0.36, 1)';
    setTimeout(() => el.remove(), 200);
  }, 3600);
}

function mostrarFeedbackForm(elementId, mensagem, tipo = 'error') {
  const box = document.getElementById(elementId);
  if (!box) return;
  if (!mensagem) {
    box.textContent = '';
    box.className = 'form-feedback hidden';
    return;
  }
  box.textContent = limparPontuacaoExclamativa(mensagem);
  box.className = `form-feedback ${tipo === 'success' ? 'is-success' : 'is-error'}`;
}

// =========================================================================
// INICIALIZAÇÃO E DELEGAÇÃO CENTRAL DE EVENTOS (100% CSP-COMPATIBLE)
// =========================================================================
document.addEventListener('DOMContentLoaded', async () => {
  configurarDelegacaoEventos();
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

function configurarDelegacaoEventos() {
  document.addEventListener('click', (e) => {
    const backdrop = e.target.closest('[data-action="fechar-modal-backdrop"]');
    if (backdrop && e.target === backdrop) {
      fecharModal();
      return;
    }

    const alvo = e.target.closest('[data-action]');
    if (!alvo) return;
    const acao = alvo.dataset.action;
    if (acao === 'fechar-modal-backdrop') return;

    if (alvo.tagName === 'A') {
      e.preventDefault();
    }

    executarAcaoInterface(acao, alvo);
  });

  document.addEventListener('input', (e) => {
    const alvo = e.target.closest('[data-input-action]');
    if (!alvo) return;
    if (alvo.dataset.inputAction === 'recalcular-checkout') {
      recalcularPreviewCheckout(Number(alvo.dataset.valor || 0));
    }
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      const appView = document.getElementById('view-app');
      if (appView && !appView.classList.contains('hidden')) {
        e.preventDefault();
        navegarApp('mural');
        setTimeout(() => document.getElementById('filtro-busca')?.focus(), 40);
      }
      return;
    }

    if (e.key === 'Escape') {
      fecharModal();
      return;
    }

    if (e.key === 'Enter' || e.key === ' ') {
      const interativo = e.target.closest('[role="button"][data-action]');
      if (interativo) {
        e.preventDefault();
        executarAcaoInterface(interativo.dataset.action, interativo);
      }
    }
  });
}

function executarAcaoInterface(acao, el) {
  switch (acao) {
    case 'ir-topo':
      window.scrollTo({ top: 0, behavior: 'smooth' });
      break;
    case 'abrir-auth':
      state.pendingIntent = null;
      irParaAuth(el.dataset.mode || 'login', el.dataset.role || 'CLIENTE');
      break;
    case 'solicitar-orcamento':
      solicitarOrcamentoLanding(el.dataset.cat || null, el.dataset.prestador || null);
      break;
    case 'pedir-orcamento-interno':
      abrirFormularioOrcamentoInterno(el.dataset.cat || null, el.dataset.prestador || null);
      break;
    case 'mostrar-landing':
      mostrarLanding();
      break;
    case 'alternar-modo-auth':
      alternarModoAuth(el.dataset.mode || 'login');
      break;
    case 'selecionar-papel':
      selecionarPapelCadastro(el.dataset.role || 'CLIENTE');
      break;
    case 'login-demo':
      loginRapidoDemo(el.dataset.email);
      break;
    case 'navegar-app':
      navegarApp(el.dataset.page || 'overview');
      break;
    case 'buscar-global':
      navegarApp('mural');
      setTimeout(() => document.getElementById('filtro-busca')?.focus(), 60);
      break;
    case 'encerrar-sessao':
      encerrarSessao();
      break;
    case 'fechar-modal':
      fecharModal();
      break;
    case 'abrir-detalhes':
      abrirModalDetalhes(Number(el.dataset.id));
      break;
    case 'abrir-checkout':
      abrirModalCheckout(Number(el.dataset.ordemId), Number(el.dataset.propostaId), Number(el.dataset.valor));
      break;
    case 'confirmar-checkout':
      confirmarCheckout(Number(el.dataset.ordemId), Number(el.dataset.propostaId), el);
      break;
    case 'abrir-proposta':
      abrirModalProposta(Number(el.dataset.id));
      break;
    case 'enviar-proposta':
      enviarPropostaOrdem(Number(el.dataset.id), el);
      break;
    case 'atualizar-status':
      atualizarStatusOrdem(Number(el.dataset.id), el.dataset.status);
      break;
    case 'abrir-conclusao':
      abrirModalConclusaoPrestador(Number(el.dataset.id));
      break;
    case 'confirmar-conclusao': {
      const fotoInput = document.getElementById('conc-foto');
      atualizarStatusOrdem(Number(el.dataset.id), 'AGUARDANDO_VISTORIA', fotoInput ? fotoInput.value.trim() : '');
      break;
    }
    case 'selecionar-nota':
      selecionarNota(Number(el.dataset.val));
      break;
    case 'abrir-aprovacao':
      abrirModalAprovacao(Number(el.dataset.id));
      break;
    case 'confirmar-aprovacao':
      confirmarAprovacaoVistoria(Number(el.dataset.id), el);
      break;
    case 'abrir-avaliar-cliente':
      abrirModalAvaliarCliente(Number(el.dataset.id));
      break;
    case 'confirmar-avaliar-cliente':
      confirmarAvaliacaoCliente(Number(el.dataset.id), el);
      break;
    case 'abrir-disputa':
      abrirModalDisputa(Number(el.dataset.id));
      break;
    case 'confirmar-disputa':
      confirmarDisputa(Number(el.dataset.id), el);
      break;
    case 'abrir-arbitragem':
      abrirModalArbitragem(Number(el.dataset.id));
      break;
    case 'confirmar-arbitragem':
      confirmarArbitragem(Number(el.dataset.id), el);
      break;
    case 'abrir-portfolio':
      abrirModalPortfolio();
      break;
    case 'salvar-portfolio':
      salvarItemPortfolio(el);
      break;
    case 'aprovar-usuario':
      aprovarSeloUsuario(Number(el.dataset.id));
      break;
    case 'alternar-cupom':
      alternarCupom(Number(el.dataset.id));
      break;
    default:
      break;
  }
}

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
// LANDING & FLUXO DIRETO DE SOLICITAÇÃO DE ORÇAMENTO
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
      document.getElementById('land-live-summary').textContent = `${moeda(st.dados.total_repassado)} liquidados`;
    }

    const grid = document.getElementById('landing-prestadores-grid');
    if (grid && pr.sucesso) {
      grid.innerHTML = pr.dados.slice(0, 3).map(p => {
        const catNorm = normalizarCategoriaOrdem(p.especialidade) || 'Elétrica';
        return `
          <div class="warm-panel" style="gap: 16px;">
            <div>
              <div class="order-top">
                <span class="mono" style="font-size: 12px; color: var(--warm-text-3);">${escapeHtml(p.especialidade || 'Serviços residenciais')}</span>
                <span class="status-inline">
                  <span class="dot ${p.verificado === 1 ? 'dot-pos' : 'dot-accent'}"></span>
                  ${p.verificado === 1 ? 'Verificado' : 'Em análise'}
                </span>
              </div>
              <h3 style="margin-top: 8px; margin-bottom: 4px;">${escapeHtml(p.nome)}</h3>
              <p style="font-size: 13px;">Nota média <span class="mono">${Number(p.reputacao).toFixed(1)}</span> em avaliações verificadas</p>
            </div>
            <div style="padding-top: 12px; border-top: 1px solid var(--warm-hairline); display: flex; justify-content: space-between; align-items: center;">
              <span class="mono" style="font-size: 12px; color: var(--warm-text-3);">${(p.portfolio || []).length} obra(s) publicada(s)</span>
              <button
                type="button"
                class="link-quiet"
                style="padding: 0; font-weight: 500; color: var(--warm-text-1);"
                data-action="solicitar-orcamento"
                data-cat="${escapeHtml(catNorm)}"
                data-prestador="${escapeHtml(p.nome)}"
              >Pedir orçamento</button>
            </div>
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    console.error(err);
  }
}

function atualizarHeaderLanding() {
  const box = document.getElementById('landing-header-actions');
  if (!box) return;
  if (state.token && state.user) {
    box.innerHTML = `
      <button type="button" class="link-quiet" data-action="navegar-app" data-page="overview">Painel (${escapeHtml(state.user.nome.split(' ')[0])})</button>
      <button type="button" class="btn btn-primary" data-action="solicitar-orcamento">Solicitar reparo</button>
    `;
  } else {
    box.innerHTML = `
      <button type="button" class="link-quiet" data-action="abrir-auth" data-mode="login" data-role="CLIENTE">Entrar</button>
      <button type="button" class="btn btn-primary" data-action="abrir-auth" data-mode="register" data-role="CLIENTE">Criar conta</button>
    `;
  }
}

function mostrarLanding() {
  atualizarHeaderLanding();
  document.getElementById('view-landing').classList.remove('hidden');
  document.getElementById('view-auth').classList.add('hidden');
  document.getElementById('view-app').classList.add('hidden');
}

async function solicitarOrcamentoLanding(categoria = null, prestadorNome = null) {
  const catNorm = normalizarCategoriaOrdem(categoria);
  state.pendingIntent = {
    page: 'nova',
    categoria: catNorm,
    prestadorNome: prestadorNome || null
  };

  if (state.token && state.user) {
    if (state.user.papel === 'CLIENTE') {
      await iniciarWorkspace('nova');
      aplicarIntencaoFormularioNovaOrdem();
      return;
    }
    await iniciarWorkspace('mural');
    toast('Use uma conta de cliente para publicar novos pedidos de orçamento');
    return;
  }

  irParaAuth('register', 'CLIENTE');
}

function abrirFormularioOrcamentoInterno(categoria = null, prestadorNome = null) {
  state.pendingIntent = {
    page: 'nova',
    categoria: normalizarCategoriaOrdem(categoria),
    prestadorNome: prestadorNome || null
  };
  navegarApp('nova');
  aplicarIntencaoFormularioNovaOrdem();
}

function aplicarIntencaoFormularioNovaOrdem() {
  if (!state.pendingIntent) return;
  const { categoria, prestadorNome } = state.pendingIntent;
  const sel = document.getElementById('select-categoria');
  if (sel && categoria && ESTIMATIVAS_PRECO[categoria]) {
    sel.value = categoria;
    atualizarEstimativaPreco();
  }
  const inputTitulo = document.getElementById('input-titulo');
  if (inputTitulo) {
    if (prestadorNome && !inputTitulo.value) {
      inputTitulo.placeholder = `Ex: Serviço de ${(categoria || 'reparo').toLowerCase()} (preferência: ${prestadorNome})`;
    }
    setTimeout(() => inputTitulo.focus(), 50);
  }
  state.pendingIntent = null;
}

function renderizarBannerIntencaoAuth() {
  const banner = document.getElementById('auth-intent-banner');
  if (!banner) return;
  if (!state.pendingIntent || state.pendingIntent.page !== 'nova') {
    banner.textContent = '';
    banner.classList.add('hidden');
    return;
  }
  const detalhe = state.pendingIntent.prestadorNome
    ? ` com referência a ${state.pendingIntent.prestadorNome}`
    : (state.pendingIntent.categoria ? ` na área de ${state.pendingIntent.categoria}` : '');
  banner.textContent = `Crie sua conta gratuita ou acesse abaixo para abrir seu pedido de orçamento${detalhe}.`;
  banner.classList.remove('hidden');
}

function resolverDestinoPosAuth(usuario) {
  if (state.pendingIntent && state.pendingIntent.page === 'nova' && usuario && usuario.papel === 'CLIENTE') {
    return 'nova';
  }
  return 'overview';
}

function irParaAuth(modo = 'login', papelInicial = 'CLIENTE') {
  mostrarFeedbackForm('auth-feedback', '');
  renderizarBannerIntencaoAuth();
  document.getElementById('view-landing').classList.add('hidden');
  document.getElementById('view-app').classList.add('hidden');
  document.getElementById('view-auth').classList.remove('hidden');
  alternarModoAuth(modo);
  selecionarPapelCadastro(papelInicial);
  window.scrollTo({ top: 0, behavior: 'instant' });

  setTimeout(() => {
    if (modo === 'register') {
      document.getElementById('reg-nome')?.focus();
    } else {
      document.getElementById('login-email')?.focus();
    }
  }, 40);
}

function alternarModoAuth(modo) {
  mostrarFeedbackForm('auth-feedback', '');
  const isLogin = modo === 'login';
  document.getElementById('tab-auth-login').classList.toggle('active', isLogin);
  document.getElementById('tab-auth-register').classList.toggle('active', !isLogin);
  document.getElementById('form-login').classList.toggle('hidden', !isLogin);
  document.getElementById('form-register').classList.toggle('hidden', isLogin);
}

function selecionarPapelCadastro(papel) {
  document.getElementById('reg-papel').value = papel;
  document.getElementById('opt-role-cliente').classList.toggle('active', papel === 'CLIENTE');
  document.getElementById('opt-role-prestador').classList.toggle('active', papel === 'PRESTADOR');
  document.getElementById('reg-especialidade-group').classList.toggle('hidden', papel !== 'PRESTADOR');
}

async function loginRapidoDemo(email, paginaForcada = null, silencioso = false) {
  mostrarFeedbackForm('auth-feedback', '');
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
      if (!silencioso) toast(`Sessão iniciada como ${json.dados.nome}`, 'success');
      const destino = paginaForcada || resolverDestinoPosAuth(json.dados);
      await iniciarWorkspace(destino);
      if (destino === 'nova') aplicarIntencaoFormularioNovaOrdem();
    } else {
      mostrarFeedbackForm('auth-feedback', json.mensagem || 'Credenciais recusadas');
      toast(json.mensagem || 'Credenciais recusadas', 'error');
    }
  } catch {
    mostrarFeedbackForm('auth-feedback', 'Falha de comunicação com o servidor local');
    toast('Falha de comunicação com o servidor', 'error');
  }
}

async function encerrarSessao() {
  limparSessaoLocal();
  state.pendingIntent = null;
  window.history.replaceState(null, '', window.location.pathname);
  await carregarDadosLanding();
  mostrarLanding();
  toast('Sessão encerrada');
}

// =========================================================================
// WORKSPACE E SIDEBAR ALINHADA
// =========================================================================
async function iniciarWorkspace(paginaInicial = 'overview') {
  document.getElementById('view-landing').classList.add('hidden');
  document.getElementById('view-auth').classList.add('hidden');
  document.getElementById('view-app').classList.remove('hidden');

  await sincronizarDadosBase();
  renderizarSidebar();
  await navegarApp(paginaInicial);
}

async function sincronizarDadosBase() {
  try {
    const hdr = { headers: authHeaders() };
    const [rStats, rOrdens, rUsers, rTrx, rNotif, rPrest, rCup] = await Promise.all([
      fetch('/api/stats', hdr),
      fetch('/api/ordens', hdr),
      fetch('/api/usuarios', hdr),
      fetch('/api/transacoes', hdr),
      fetch('/api/notificacoes', hdr),
      fetch('/api/prestadores', hdr),
      fetch('/api/cupons', hdr)
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
    console.error(err);
  }
}

function atualizarResumoUsuarioSidebar() {
  if (!state.user) return;
  const iniciais = state.user.nome.split(' ').filter(Boolean).map(p => p[0]).slice(0, 2).join('').toUpperCase();
  document.getElementById('sb-avatar').textContent = iniciais || 'FL';
  document.getElementById('sb-user-name').textContent = state.user.nome;
  const mapPapel = { CLIENTE: 'Cliente residencial', PRESTADOR: 'Profissional autônomo', ADMIN: 'Administração' };
  document.getElementById('sb-user-role').textContent = mapPapel[state.user.papel] || state.user.papel;
}

function obterOrdensDoUsuarioAtual() {
  if (!state.user) return [];
  if (state.user.papel === 'CLIENTE') {
    return state.ordens.filter(o => o.cliente_id === state.user.id);
  }
  if (state.user.papel === 'PRESTADOR') {
    return state.ordens.filter(o => o.prestador_id === state.user.id);
  }
  return state.ordens;
}

function renderizarSidebar() {
  const papel = state.user ? state.user.papel : 'CLIENTE';
  const ordensProprias = obterOrdensDoUsuarioAtual();
  const contagemMural = papel === 'CLIENTE' ? ordensProprias.length : state.ordens.length;
  const disputasCount = ordensProprias.filter(o => o.status === 'EM_DISPUTA').length;

  const itensPrincipais = [
    { id: 'overview', label: 'Visão geral', icon: ICONS.overview },
    {
      id: 'mural',
      label: papel === 'PRESTADOR' ? 'Mural de chamados' : 'Ordens de serviço',
      icon: ICONS.mural,
      count: contagemMural || null
    }
  ];

  if (papel === 'CLIENTE') {
    itensPrincipais.push({ id: 'nova', label: 'Solicitar reparo', icon: ICONS.nova });
    itensPrincipais.push({ id: 'prestadores', label: 'Profissionais', icon: ICONS.prestadores });
  } else if (papel === 'PRESTADOR') {
    itensPrincipais.push({ id: 'carteira', label: 'Carteira PIX', icon: ICONS.carteira });
    itensPrincipais.push({ id: 'prestadores', label: 'Meu portfólio', icon: ICONS.prestadores });
  } else if (papel === 'ADMIN') {
    itensPrincipais.push({ id: 'admin', label: 'Governança', icon: ICONS.admin });
    itensPrincipais.push({ id: 'prestadores', label: 'Profissionais', icon: ICONS.prestadores });
  }

  const itensSecundarios = [
    { id: 'escrow', label: 'Livro-razão escrow', icon: ICONS.escrow, count: state.transacoes.length || null },
    { id: 'disputas', label: 'Disputas', icon: ICONS.disputas, count: disputasCount || null },
    { id: 'notificacoes', label: 'Notificações', icon: ICONS.notificacoes, count: state.notificacoes.length || null },
    { id: 'perfil', label: 'Minha conta', icon: ICONS.perfil }
  ];

  const renderRow = (it) => `
    <button type="button" class="nav-row ${state.page === it.id ? 'active' : ''}" data-action="navegar-app" data-page="${it.id}">
      ${it.icon}
      <span class="nav-row-label">${escapeHtml(it.label)}</span>
      ${it.count ? `<span class="nav-row-count">${it.count}</span>` : ''}
    </button>
  `;

  document.getElementById('sidebar-nav-main').innerHTML = itensPrincipais.map(renderRow).join('');
  document.getElementById('sidebar-nav-secondary').innerHTML = itensSecundarios.map(renderRow).join('');
}

async function navegarApp(pagina) {
  state.page = pagina;
  mostrarFeedbackForm('nova-ordem-feedback', '');
  document.querySelectorAll('.app-page').forEach(sec => sec.classList.add('hidden'));
  const alvo = document.getElementById(`sec-${pagina}`);
  if (alvo) alvo.classList.remove('hidden');

  let meta = PAGE_TITLES[pagina] || PAGE_TITLES.overview;
  if (pagina === 'prestadores' && state.user && state.user.papel === 'PRESTADOR') {
    meta = { crumb: 'Meu portfólio', title: 'Meu portfólio', sub: '' };
  }
  document.getElementById('page-breadcrumb').textContent = meta.crumb;
  document.getElementById('page-title').textContent = meta.title;
  document.getElementById('page-subtitle').textContent = meta.sub;

  renderizarTopbarActions(pagina);
  renderizarSidebar();

  if (pagina === 'overview') renderizarOverview();
  if (pagina === 'mural') renderizarMuralOrdens();
  if (pagina === 'nova') atualizarEstimativaPreco();
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
  const verifHtml = state.user.verificado === 1
    ? '<span class="status-inline"><span class="dot dot-pos"></span>Conta verificada</span>'
    : '<span class="status-inline" role="button" tabindex="0" style="cursor:pointer" data-action="navegar-app" data-page="perfil"><span class="dot dot-accent"></span>Verificação pendente</span>';

  let cta = '';
  if (state.user.papel === 'CLIENTE' && pagina !== 'nova') {
    cta = '<button type="button" class="btn btn-primary btn-sm" data-action="navegar-app" data-page="nova">Solicitar reparo</button>';
  } else if (state.user.papel === 'PRESTADOR' && pagina === 'prestadores') {
    cta = '<button type="button" class="btn btn-primary btn-sm" data-action="abrir-portfolio">Adicionar obra</button>';
  } else if (state.user.papel === 'PRESTADOR' && pagina !== 'carteira') {
    cta = `<button type="button" class="btn btn-secondary btn-sm mono" data-action="navegar-app" data-page="carteira">${moeda(state.user.saldo_disponivel)}</button>`;
  }

  box.innerHTML = `${verifHtml}${cta}`;
}

// =========================================================================
// VISÃO GERAL: ESTRITAMENTE ISOLADA POR CONTA (EMPTY STATE NO PRIMEIRO ACESSO)
// =========================================================================
function criarObjetoEscrowHtml(ordemRef) {
  if (!ordemRef || !(Number(ordemRef.valor_total) > 0)) return '';
  return `
    <div class="escrow-slip-object" aria-hidden="true">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div class="slip-chip"></div>
        <span class="slip-code">ESCROW</span>
      </div>
      <div>
        <div class="tabular" style="font-size: 12px; font-weight: 500;">${moeda(ordemRef.valor_total)}</div>
        <div class="slip-code">${codigoOrdem(ordemRef.id)} · PIX</div>
      </div>
    </div>
  `;
}

function renderizarOverview() {
  const u = state.user;
  const kpiBox = document.getElementById('overview-kpis');
  let ordensEscopo = [];
  let retidoEscopo = 0;
  let liquidadoEscopo = 0;

  if (u.papel === 'CLIENTE') {
    const minhas = state.ordens.filter(o => o.cliente_id === u.id);
    const ativas = minhas.filter(o => ['EM_CUSTODIA', 'A_CAMINHO', 'EM_EXECUCAO', 'AGUARDANDO_VISTORIA'].includes(o.status));
    const vistoria = minhas.filter(o => o.status === 'AGUARDANDO_VISTORIA').length;
    const concluidasLista = minhas.filter(o => o.status === 'CONCLUIDO');
    const custodiaCliente = ativas.reduce((acc, o) => acc + Number(o.valor_total || 0), 0);
    const liquidadoCliente = concluidasLista.reduce((acc, o) => acc + Number(o.valor_mao_obra || o.valor_total || 0), 0);
    const slipHtml = criarObjetoEscrowHtml(ativas[0]);

    ordensEscopo = minhas;
    retidoEscopo = custodiaCliente;
    liquidadoEscopo = liquidadoCliente;

    kpiBox.innerHTML = `
      <div class="stat-card ${slipHtml ? 'has-object' : ''}">
        <div class="stat-label">Protegido em custódia</div>
        <div class="stat-figure">${moeda(custodiaCliente)}</div>
        <div class="stat-delta">
          ${ativas.length > 0 || concluidasLista.length > 0
            ? `<span class="acc">${ativas.length} ativa(s)</span> · ${concluidasLista.length} liquidada(s)`
            : 'Nenhum pagamento retido nesta conta'}
        </div>
        ${slipHtml}
      </div>
      <div class="stat-card">
        <div class="stat-label">Vistorias pendentes</div>
        <div class="stat-figure">${vistoria}</div>
        <div class="stat-delta">Aguardando sua inspeção</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Meus chamados</div>
        <div class="stat-figure">${minhas.length}</div>
        <div class="stat-delta">
          ${minhas.length > 0
            ? `<span class="pos">${concluidasLista.length} liquidado(s)</span> no histórico`
            : ' Conta recém-criada'}
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Profissionais na região</div>
        <div class="stat-figure">${state.prestadores.length}</div>
        <div class="stat-delta">Cadastro ativo em Volta Redonda</div>
      </div>
    `;
  } else if (u.papel === 'PRESTADOR') {
    const abertas = state.ordens.filter(o => ['PENDENTE', 'PROPOSTA_RECEBIDA'].includes(o.status) && !o.prestador_id).length;
    const assumidas = state.ordens.filter(o => o.prestador_id === u.id);
    const ativas = assumidas.filter(o => ['EM_CUSTODIA', 'A_CAMINHO', 'EM_EXECUCAO', 'AGUARDANDO_VISTORIA'].includes(o.status));
    const concluidasLista = assumidas.filter(o => o.status === 'CONCLUIDO');
    const liquidadoPrest = concluidasLista.reduce((acc, o) => acc + Number(o.valor_mao_obra || 0), 0);
    const slipHtml = criarObjetoEscrowHtml(ativas[0]);

    ordensEscopo = assumidas;
    retidoEscopo = Number(u.saldo_custodia || 0);
    liquidadoEscopo = liquidadoPrest;

    kpiBox.innerHTML = `
      <div class="stat-card ${slipHtml ? 'has-object' : ''}">
        <div class="stat-label">Disponível para PIX</div>
        <div class="stat-figure">${moeda(u.saldo_disponivel)}</div>
        <div class="stat-delta"><span class="pos">Liberado</span> pós-vistoria</div>
        ${slipHtml}
      </div>
      <div class="stat-card">
        <div class="stat-label">Reservado em custódia</div>
        <div class="stat-figure">${moeda(u.saldo_custodia)}</div>
        <div class="stat-delta"><span class="acc">Garantido</span> antes da visita</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Chamados para orçar</div>
        <div class="stat-figure">${abertas}</div>
        <div class="stat-delta">Abertos no mural da região</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Nota média</div>
        <div class="stat-figure">${concluidasLista.length > 0 ? Number(u.reputacao).toFixed(1) : '—'}</div>
        <div class="stat-delta">${assumidas.length > 0 ? `Em ${assumidas.length} serviço(s) atendido(s)` : 'Sem atendimentos avaliados'}</div>
      </div>
    `;
  } else {
    const ordemAtivaAdmin = state.ordens.find(o => ['EM_CUSTODIA', 'A_CAMINHO', 'EM_EXECUCAO', 'AGUARDANDO_VISTORIA'].includes(o.status));
    const slipHtml = criarObjetoEscrowHtml(ordemAtivaAdmin);

    ordensEscopo = state.ordens;
    retidoEscopo = Number(state.stats.saldo_em_custodia || 0);
    liquidadoEscopo = Number(state.stats.total_repassado || 0);

    kpiBox.innerHTML = `
      <div class="stat-card ${slipHtml ? 'has-object' : ''}">
        <div class="stat-label">Saldo sob custódia</div>
        <div class="stat-figure">${moeda(state.stats.saldo_em_custodia)}</div>
        <div class="stat-delta"><span class="acc">Retido</span> em contas vinculadas</div>
        ${slipHtml}
      </div>
      <div class="stat-card">
        <div class="stat-label">Repasses liquidados</div>
        <div class="stat-figure">${moeda(state.stats.total_repassado)}</div>
        <div class="stat-delta"><span class="pos">${state.stats.ordens_concluidas || 0} ordens</span> homologadas</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total de chamados</div>
        <div class="stat-figure">${state.stats.total_ordens || 0}</div>
        <div class="stat-delta">Registrados no banco</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Contas ativas</div>
        <div class="stat-figure">${state.usuarios.length}</div>
        <div class="stat-delta">${state.prestadores.length} prestadores cadastrados</div>
      </div>
    `;
  }

  renderizarGraficoOverview(ordensEscopo, retidoEscopo, liquidadoEscopo, u.papel);

  const recentes = ordensEscopo.slice(0, 5);
  const listaBox = document.getElementById('overview-orders-list');
  const btnVerTodos = document.getElementById('btn-ver-todos-overview');
  if (btnVerTodos) btnVerTodos.classList.toggle('hidden', recentes.length === 0);
  if (recentes.length === 0) {
    listaBox.innerHTML = u.papel === 'PRESTADOR'
      ? `
        <div class="empty-state-inline">
          <div style="margin-bottom: 10px;">Nenhum serviço contratado na sua conta até o momento.</div>
          <button type="button" class="btn btn-secondary btn-sm" data-action="navegar-app" data-page="mural">Consultar mural de chamados</button>
        </div>
      `
      : `
        <div class="empty-state-inline">
          <div style="margin-bottom: 10px;">Nenhum chamado aberto na sua conta até o momento.</div>
          <button type="button" class="btn btn-secondary btn-sm" data-action="navegar-app" data-page="nova">Abrir chamado gratuito</button>
        </div>
      `;
    return;
  }

  listaBox.innerHTML = recentes.map(o => {
    const meta = STATUS_META[o.status] || { label: o.status, dot: '' };
    return `
      <div class="compact-order-row" role="button" tabindex="0" data-action="abrir-detalhes" data-id="${o.id}">
        <div style="min-width: 0;">
          <div style="font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(o.titulo)}</div>
          <div class="status-inline" style="margin-top: 2px;">
            <span class="dot ${meta.dot}"></span>
            <span>${meta.label}</span>
            <span class="mono" style="color: var(--text-3);">· ${codigoOrdem(o.id)}</span>
          </div>
        </div>
        <span class="mono" style="font-size: 13px; color: var(--text-1); flex-shrink: 0;">
          ${o.valor_total > 0 ? moeda(o.valor_total) : 'Aberto'}
        </span>
      </div>
    `;
  }).join('');
}

function renderizarGraficoOverview(ordensEscopo = [], retidoEscopo = 0, liquidadoEscopo = 0, papel = 'CLIENTE') {
  const box = document.getElementById('overview-chart');
  if (!box) return;

  document.getElementById('chart-subtitle').textContent = `${moeda(retidoEscopo)} retidos · ${moeda(liquidadoEscopo)} liquidados`;

  if (!ordensEscopo || ordensEscopo.length === 0) {
    box.innerHTML = papel === 'PRESTADOR'
      ? `
        <div class="empty-state">
          <div class="empty-state-title">Sem movimentação financeira na sua conta</div>
          <p class="empty-state-desc">Assim que um morador aceitar sua proposta e depositar o valor em custódia, o gráfico das suas ordens aparecerá aqui.</p>
          <button type="button" class="btn btn-primary btn-sm" data-action="navegar-app" data-page="mural">Ver chamados disponíveis</button>
        </div>
      `
      : `
        <div class="empty-state">
          <div class="empty-state-title">Sem movimentação financeira na sua conta</div>
          <p class="empty-state-desc">Este é o seu primeiro acesso. Publique o reparo desejado para receber orçamentos de profissionais verificados com pagamento protegido em custódia.</p>
          <button type="button" class="btn btn-primary btn-sm" data-action="navegar-app" data-page="nova">Solicitar primeiro reparo</button>
        </div>
      `;
    return;
  }

  const ordensComValor = [...ordensEscopo].reverse().slice(-6);
  const maxVal = Math.max(400, ...ordensComValor.map(o => Number(o.valor_total || 180)));
  const teto = Math.ceil(maxVal / 100) * 100;

  const w = 640;
  const h = 240;
  const padL = 68;
  const padR = 16;
  const padT = 16;
  const padB = 32;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const linhasGrade = [0, 0.5, 1].map(f => {
    const y = padT + plotH * (1 - f);
    const val = Math.round(teto * f);
    return `
      <line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" stroke="rgba(23,23,23,0.07)" stroke-width="1"/>
      <text x="${padL - 10}" y="${y + 4}" text-anchor="end" font-family="IBM Plex Mono, monospace" font-size="11" fill="#737373">R$ ${val}</text>
    `;
  }).join('');

  const slotW = plotW / Math.max(1, ordensComValor.length);
  const barW = Math.min(40, slotW * 0.46);

  const barras = ordensComValor.map((o, idx) => {
    const val = Number(o.valor_total || 0);
    const barH = val > 0 ? Math.max(6, (val / teto) * plotH) : 4;
    const x = padL + idx * slotW + (slotW - barW) / 2;
    const y = padT + plotH - barH;
    const emCustodia = ['EM_CUSTODIA', 'A_CAMINHO', 'EM_EXECUCAO', 'AGUARDANDO_VISTORIA'].includes(o.status);
    const fill = emCustodia ? '#b45309' : (o.status === 'CONCLUIDO' ? '#d4d4d8' : '#e4e4e7');
    return `
      <rect x="${x}" y="${y}" width="${barW}" height="${barH}" rx="4" fill="${fill}"/>
      <text x="${x + barW / 2}" y="${h - 10}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="11" fill="#737373">${codigoOrdem(o.id)}</text>
    `;
  }).join('');

  box.innerHTML = `
    <svg viewBox="0 0 ${w} ${h}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Gráfico de valores por ordem de serviço">
      ${linhasGrade}
      ${barras}
    </svg>
  `;
}

// =========================================================================
// ORDENS, CARTEIRA, PROFISSIONAIS, LIVRO-RAZÃO, ADMIN E PERFIL
// =========================================================================
function montarCardOrdemHtml(o) {
  const meta = STATUS_META[o.status] || { label: o.status, dot: '', step: 1 };
  const segs = [1, 2, 3, 4, 5].map(n => {
    const cls = o.status === 'CONCLUIDO' ? 'settled' : (n <= meta.step ? 'filled' : '');
    return `<div class="lock-seg ${cls}"></div>`;
  }).join('');

  const papel = state.user ? state.user.papel : 'CLIENTE';
  const isDonoCliente = state.user && o.cliente_id === state.user.id;
  const isPrestadorOrdem = state.user && o.prestador_id === state.user.id;

  let acoes = `<button type="button" class="btn btn-secondary btn-sm" data-action="abrir-detalhes" data-id="${o.id}">Detalhes</button>`;

  if (papel === 'CLIENTE' && isDonoCliente) {
    if (o.status === 'PENDENTE' || o.status === 'PROPOSTA_RECEBIDA') {
      acoes = `<button type="button" class="btn btn-primary btn-sm" data-action="abrir-detalhes" data-id="${o.id}">Propostas (${o.total_propostas || 0})</button>`;
    } else if (o.status === 'AGUARDANDO_VISTORIA') {
      acoes = `
        <button type="button" class="btn btn-danger-quiet btn-sm" data-action="abrir-disputa" data-id="${o.id}">Contestar</button>
        <button type="button" class="btn btn-accent btn-sm" data-action="abrir-aprovacao" data-id="${o.id}">Aprovar vistoria</button>
      `;
    } else if (['EM_CUSTODIA', 'A_CAMINHO', 'EM_EXECUCAO'].includes(o.status)) {
      acoes = `
        <button type="button" class="btn btn-secondary btn-sm" data-action="abrir-detalhes" data-id="${o.id}">Detalhes</button>
        <button type="button" class="btn btn-danger-quiet btn-sm" data-action="abrir-disputa" data-id="${o.id}">Disputa</button>
      `;
    }
  } else if (papel === 'PRESTADOR') {
    if (o.status === 'PENDENTE' || o.status === 'PROPOSTA_RECEBIDA') {
      acoes = `<button type="button" class="btn btn-primary btn-sm" data-action="abrir-proposta" data-id="${o.id}">Enviar proposta</button>`;
    } else if (isPrestadorOrdem) {
      if (o.status === 'EM_CUSTODIA') {
        acoes = `<button type="button" class="btn btn-primary btn-sm" data-action="atualizar-status" data-id="${o.id}" data-status="A_CAMINHO">Iniciar deslocamento</button>`;
      } else if (o.status === 'A_CAMINHO') {
        acoes = `<button type="button" class="btn btn-primary btn-sm" data-action="atualizar-status" data-id="${o.id}" data-status="EM_EXECUCAO">Iniciar reparo</button>`;
      } else if (o.status === 'EM_EXECUCAO') {
        acoes = `<button type="button" class="btn btn-accent btn-sm" data-action="abrir-conclusao" data-id="${o.id}">Solicitar vistoria</button>`;
      } else if (o.status === 'CONCLUIDO') {
        acoes = `<button type="button" class="btn btn-secondary btn-sm" data-action="abrir-avaliar-cliente" data-id="${o.id}">Avaliar cliente</button>`;
      }
    }
  } else if (papel === 'ADMIN' && o.status === 'EM_DISPUTA') {
    acoes = `<button type="button" class="btn btn-primary btn-sm" data-action="abrir-arbitragem" data-id="${o.id}">Arbitrar</button>`;
  }

  return `
    <article class="order-item">
      <div>
        <div class="order-top">
          <span class="order-code">${codigoOrdem(o.id)} · ${escapeHtml(o.categoria)}</span>
          <span class="status-inline"><span class="dot ${meta.dot}"></span>${meta.label}</span>
        </div>
        <h3 class="order-name">${escapeHtml(o.titulo)}</h3>
        <p class="order-body">${escapeHtml(o.descricao)}</p>
        <div class="order-loc">${escapeHtml(o.endereco)} · <span class="mono">${escapeHtml(o.cep)}</span></div>
        <div class="lock-track">${segs}</div>
      </div>

      <div class="order-bottom">
        <div>
          <span style="display: block; font-size: 12px; color: var(--text-3);">${o.valor_total > 0 ? 'Custódia' : 'Orçamento'}</span>
          <span class="order-amount">${o.valor_total > 0 ? moeda(o.valor_total) : 'Aberto'}</span>
        </div>
        <div style="display: flex; gap: 8px;">${acoes}</div>
      </div>
    </article>
  `;
}

function renderizarMuralOrdens() {
  const busca = (document.getElementById('filtro-busca').value || '').toLowerCase().trim();
  const statusF = document.getElementById('filtro-status').value;
  const catF = document.getElementById('filtro-categoria').value;

  const baseLista = state.user && state.user.papel === 'CLIENTE'
    ? state.ordens.filter(o => o.cliente_id === state.user.id)
    : state.ordens;

  const filtradas = baseLista.filter(o => {
    if (statusF && o.status !== statusF) return false;
    if (catF && o.categoria !== catF) return false;
    if (busca) {
      const alvo = `${o.titulo} ${o.descricao} ${o.cep} ${o.endereco} ${o.categoria} ${codigoOrdem(o.id)}`.toLowerCase();
      if (!alvo.includes(busca)) return false;
    }
    return true;
  });

  const container = document.getElementById('orders-container');
  if (baseLista.length === 0 && state.user && state.user.papel === 'CLIENTE') {
    container.innerHTML = `
      <div class="card-surface" style="grid-column: 1 / -1;">
        <div class="empty-state" style="border: none; background: transparent; min-height: 120px; padding: 4px 0;">
          <div class="empty-state-title">Você ainda possui zero ordens de serviço cadastradas</div>
          <p class="empty-state-desc">Abra seu primeiro pedido gratuito informando o endereço e o defeito observado para receber propostas dos profissionais de Volta Redonda.</p>
          <button type="button" class="btn btn-primary btn-sm" data-action="navegar-app" data-page="nova">Solicitar reparo</button>
        </div>
      </div>
    `;
    return;
  }

  if (filtradas.length === 0) {
    container.innerHTML = `<div class="card-surface" style="grid-column: 1 / -1; color: var(--text-3);">Nenhuma ordem corresponde aos filtros informados.</div>`;
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
  const isCliente = state.user && state.user.papel === 'CLIENTE';
  const isPrestador = state.user && state.user.papel === 'PRESTADOR';
  const lista = isPrestador
    ? state.prestadores.filter(p => p.id === state.user.id)
    : state.prestadores;

  box.innerHTML = lista.map(p => {
    const catNorm = normalizarCategoriaOrdem(p.especialidade) || 'Elétrica';
    const obras = (p.portfolio || []).map(item => `
      <div style="margin-top: 8px; padding: 10px 12px; background: var(--bg-page); border: 1px solid var(--hairline); border-radius: var(--r-control);">
        <div style="display:flex; justify-content:space-between; font-size: 13px;">
          <span style="font-weight: 500;">${escapeHtml(item.titulo)}</span>
          <span style="color: var(--text-3); font-size: 12px;">${escapeHtml(item.categoria)}</span>
        </div>
        <p style="font-size: 12px; color: var(--text-2); margin-top: 4px;">${escapeHtml(item.descricao || '')}</p>
      </div>
    `).join('');

    const rodapeCliente = isCliente ? `
      <div class="order-bottom">
        <span class="mono" style="font-size: 12px; color: var(--text-3);">${escapeHtml(catNorm)}</span>
        <button
          type="button"
          class="btn btn-primary btn-sm"
          data-action="pedir-orcamento-interno"
          data-cat="${escapeHtml(catNorm)}"
          data-prestador="${escapeHtml(p.nome)}"
        >Pedir orçamento</button>
      </div>
    ` : (isPrestador ? `
      <div class="order-bottom">
        <span class="mono" style="font-size: 12px; color: var(--text-3);">Portfólio público</span>
        <button type="button" class="btn btn-primary btn-sm" data-action="abrir-portfolio">Adicionar obra</button>
      </div>
    ` : '');

    return `
      <div class="order-item">
        <div>
          <div class="order-top">
            <span class="order-code">${escapeHtml(p.especialidade || 'Serviços gerais')}</span>
            <span class="status-inline">
              <span class="dot ${p.verificado === 1 ? 'dot-pos' : 'dot-accent'}"></span>
              ${p.verificado === 1 ? 'Verificado' : 'Em análise'}
            </span>
          </div>
          <h3 class="order-name">${escapeHtml(p.nome)}</h3>
          <div style="font-size: 13px; color: var(--text-2);">
            Nota <span class="mono">${Number(p.reputacao).toFixed(1)}</span> · <span class="mono">${escapeHtml(p.telefone || '-')}</span>
          </div>
          <div style="margin-top: 16px;">
            <div style="font-size: 12px; color: var(--text-3);">Obras publicadas (${(p.portfolio || []).length})</div>
            ${obras || '<div style="font-size: 13px; color: var(--text-3); margin-top: 6px;">Sem registros de obra nesta conta até o momento</div>'}
          </div>
        </div>
        ${rodapeCliente}
      </div>
    `;
  }).join('');
}

function renderizarTransacoes() {
  const tbody = document.getElementById('transacoes-tbody');
  if (state.transacoes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="color:var(--text-3);">Nenhuma movimentação em custódia registrada nesta conta</td></tr>`;
    return;
  }
  const mapOp = {
    BLOQUEIO_ESCROW: { label: 'Bloqueio em custódia', dot: 'dot-accent' },
    LIBERACAO_REPASSE: { label: 'Liberação de repasse', dot: 'dot-pos' },
    ESTORNO_DISPUTA: { label: 'Estorno / disputa', dot: 'dot-neg' }
  };
  tbody.innerHTML = state.transacoes.map(t => {
    const op = mapOp[t.tipo] || { label: t.tipo, dot: '' };
    return `
      <tr>
        <td class="mono">#${String(t.id).padStart(3, '0')}</td>
        <td class="mono" style="font-size: 12px; color: var(--text-3);">${t.criado_em ? new Date(t.criado_em).toLocaleString('pt-BR') : '-'}</td>
        <td><span class="mono">${codigoOrdem(t.ordem_id)}</span> · ${escapeHtml(t.ordem_titulo || '')}</td>
        <td><span class="status-inline"><span class="dot ${op.dot}"></span>${op.label}</span></td>
        <td style="color: var(--text-2); font-size: 12px;">${escapeHtml(t.status)}</td>
        <td style="color: var(--text-2); max-width: 320px;">${escapeHtml(t.detalhes || '')}</td>
        <td class="align-right mono">${moeda(t.valor)}</td>
      </tr>
    `;
  }).join('');
}

function renderizarDisputas() {
  const ordensProprias = obterOrdensDoUsuarioAtual();
  const disputas = ordensProprias.filter(o => o.status === 'EM_DISPUTA');
  const box = document.getElementById('disputas-container');
  if (disputas.length === 0) {
    box.innerHTML = `<div class="card-surface" style="grid-column: 1 / -1; color: var(--text-3);">Nenhuma ordem em mediação nesta conta</div>`;
    return;
  }
  box.innerHTML = disputas.map(o => `
    <div class="order-item">
      <div>
        <div class="order-top">
          <span class="order-code">${codigoOrdem(o.id)}</span>
          <span class="status-inline"><span class="dot dot-neg"></span>Custódia congelada</span>
        </div>
        <h3 class="order-name">${escapeHtml(o.titulo)}</h3>
        <p class="order-body">${escapeHtml(o.descricao)}</p>
        <div class="order-loc">Titular: ${escapeHtml(o.cliente_nome)}</div>
      </div>
      <div class="order-bottom">
        <span class="order-amount">${moeda(o.valor_total)}</span>
        ${state.user && state.user.papel === 'ADMIN'
          ? `<button type="button" class="btn btn-primary btn-sm" data-action="abrir-arbitragem" data-id="${o.id}">Decidir caso</button>`
          : `<button type="button" class="btn btn-secondary btn-sm" data-action="abrir-detalhes" data-id="${o.id}">Ver ordem</button>`}
      </div>
    </div>
  `).join('');
}

function renderizarNotificacoes() {
  const tbody = document.getElementById('notificacoes-tbody');
  if (state.notificacoes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="color:var(--text-3);">Nenhum aviso enviado para esta conta até o momento</td></tr>`;
    return;
  }
  tbody.innerHTML = state.notificacoes.map(n => `
    <tr>
      <td class="mono">#${String(n.id).padStart(3, '0')}</td>
      <td class="mono" style="font-size: 12px; color: var(--text-3);">${n.criado_em ? new Date(n.criado_em).toLocaleString('pt-BR') : '-'}</td>
      <td><span class="status-inline"><span class="dot ${n.canal === 'WHATSAPP' ? 'dot-pos' : 'dot-accent'}"></span>${n.canal === 'WHATSAPP' ? 'WhatsApp' : 'E-mail'}</span></td>
      <td class="mono" style="font-size: 12px;">${escapeHtml(n.destinatario)}</td>
      <td>${escapeHtml(n.usuario_nome || 'Sistema')}</td>
      <td style="max-width: 360px; color: var(--text-2);">${escapeHtml(n.mensagem)}</td>
      <td style="font-size: 12px; color: var(--text-3);">${escapeHtml(n.status)}</td>
    </tr>
  `).join('');
}

async function renderizarPainelAdmin() {
  try {
    const res = await fetch('/api/admin/metricas');
    const json = await res.json();
    if (json.sucesso) {
      const m = json.dados;
      document.getElementById('admin-metrics-grid').innerHTML = `
        <div class="stat-card"><div class="stat-label">Conversão de ordens</div><div class="stat-figure">${m.taxa_conversao_percentual}%</div><div class="stat-delta">${m.ordens_concluidas} de ${m.total_ordens} concluídas</div></div>
        <div class="stat-card"><div class="stat-label">Ticket médio</div><div class="stat-figure">${moeda(m.ticket_medio)}</div><div class="stat-delta">Por chamado contratado</div></div>
        <div class="stat-card"><div class="stat-label">Receita de taxas</div><div class="stat-figure">${moeda(m.receita_taxas)}</div><div class="stat-delta">Intermediação acumulada</div></div>
        <div class="stat-card"><div class="stat-label">Prestadores verificados</div><div class="stat-figure">${m.prestadores_verificados}/${m.total_prestadores}</div><div class="stat-delta">Documentação homologada</div></div>
      `;
    }
  } catch (err) {
    console.error(err);
  }

  const candidatos = state.usuarios.filter(u => u.papel !== 'ADMIN');
  document.getElementById('admin-verificacoes-list').innerHTML = candidatos.map(u => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding: 10px 0; border-bottom: 1px solid var(--hairline); gap: 12px;">
      <div>
        <div style="font-size: 14px; font-weight: 500;">${escapeHtml(u.nome)} <span style="font-weight: 400; font-size: 12px; color: var(--text-3);">· ${u.papel === 'PRESTADOR' ? 'Prestador' : 'Cliente'}</span></div>
        <div class="mono" style="font-size: 12px; color: var(--text-3);">
          ${u.documento_url ? escapeHtml(u.documento_url) : 'Sem documento anexado'}
        </div>
      </div>
      ${u.verificado === 1
        ? '<span class="status-inline"><span class="dot dot-pos"></span>Homologado</span>'
        : `<button type="button" class="btn btn-primary btn-sm" data-action="aprovar-usuario" data-id="${u.id}">Homologar</button>`}
    </div>
  `).join('');

  document.getElementById('admin-cupons-list').innerHTML = state.cupons.map(c => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding: 10px 0; border-bottom: 1px solid var(--hairline);">
      <div>
        <span class="mono" style="font-size: 13px; font-weight: 500;">${escapeHtml(c.codigo)}</span>
        <span style="font-size: 13px; color: var(--text-2); margin-left: 8px;">${c.desconto_percentual}% na taxa</span>
      </div>
      <button type="button" class="btn btn-secondary btn-sm" data-action="alternar-cupom" data-id="${c.id}">
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
  badge.innerHTML = state.user.verificado === 1
    ? '<span class="dot dot-pos"></span>Verificado'
    : '<span class="dot dot-accent"></span>Em análise';

  try {
    const resAv = await fetch(`/api/avaliacoes?avaliado_id=${state.user.id}`);
    const jAv = await resAv.json();
    const avBox = document.getElementById('perf-avaliacoes-list');
    if (jAv.sucesso && jAv.dados.length > 0) {
      avBox.innerHTML = jAv.dados.map(a => `
        <div style="padding: 10px 0; border-bottom: 1px solid var(--hairline);">
          <div style="display:flex; justify-content:space-between; font-size: 13px;">
            <span style="font-weight: 500;">${escapeHtml(a.avaliador_nome)}</span>
            <span class="mono" style="color: var(--text-2);">Nota ${a.nota}/5</span>
          </div>
          <p style="font-size: 13px; color: var(--text-2); margin-top: 2px;">${escapeHtml(a.comentario || '')}</p>
        </div>
      `).join('');
    } else {
      avBox.innerHTML = `<div style="font-size: 13px; color: var(--text-3);">Sem avaliações recebidas até o momento</div>`;
    }
  } catch (err) {
    console.error(err);
  }
}

// =========================================================================
// MODAIS (SEM INLINE HANDLERS)
// =========================================================================
function abrirModal(html) {
  document.getElementById('modal-body').innerHTML = html;
  document.getElementById('modal').classList.remove('hidden');
}

function fecharModal() {
  document.getElementById('modal').classList.add('hidden');
}

async function abrirModalDetalhes(ordemId) {
  try {
    const res = await fetch(`/api/ordens/${ordemId}`, { headers: authHeaders() });
    const json = await res.json();
    if (!json.sucesso) return toast(json.mensagem, 'error');

    const o = json.dados;
    const propostas = o.propostas || [];
    const podeContratar = state.user && state.user.id === o.cliente_id && ['PENDENTE', 'PROPOSTA_RECEBIDA'].includes(o.status);

    const listaPropHtml = propostas.length === 0
      ? `<div style="font-size: 13px; color: var(--text-3); padding: 8px 0;">Aguardando envio de orçamentos pelos profissionais</div>`
      : propostas.map(p => `
          <div style="border: 1px solid var(--hairline); border-radius: var(--r-control); padding: 12px; margin-bottom: 8px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div>
                <span style="font-weight: 500;">${escapeHtml(p.prestador_nome)}</span>
                <span class="mono" style="font-size: 12px; color: var(--text-3); margin-left: 6px;">Nota ${Number(p.prestador_reputacao || 5).toFixed(1)}</span>
              </div>
              <span class="mono" style="font-weight: 500;">${moeda(p.valor)}</span>
            </div>
            <div style="font-size: 13px; color: var(--text-2); margin-top: 4px;">Prazo: ${escapeHtml(p.prazo_estimado)} · ${escapeHtml(p.mensagem || '')}</div>
            ${podeContratar ? `
              <button
                type="button"
                class="btn btn-primary btn-sm"
                style="margin-top: 10px; width: 100%;"
                data-action="abrir-checkout"
                data-ordem-id="${o.id}"
                data-proposta-id="${p.id}"
                data-valor="${Number(p.valor)}"
              >
                Contratar com custódia (${moeda(p.valor)} + taxa)
              </button>
            ` : ''}
          </div>
        `).join('');

    abrirModal(`
      <div class="modal-top">
        <h3>${codigoOrdem(o.id)} · ${escapeHtml(o.categoria)}</h3>
        <button type="button" class="btn btn-secondary btn-sm" data-action="fechar-modal">Fechar</button>
      </div>
      <div style="font-size: 15px; font-weight: 500; margin-bottom: 4px;">${escapeHtml(o.titulo)}</div>
      <p style="font-size: 13px; color: var(--text-2); margin-bottom: 16px;">${escapeHtml(o.descricao)}</p>
      <div style="background: var(--bg-page); border: 1px solid var(--hairline); padding: 12px; border-radius: var(--r-control); font-size: 13px; margin-bottom: 16px;">
        <div>Titular: ${escapeHtml(o.cliente_nome)}</div>
        <div>Endereço: ${escapeHtml(o.endereco)} (<span class="mono">${escapeHtml(o.cep)}</span>)</div>
        ${o.prestador_nome ? `<div>Prestador: ${escapeHtml(o.prestador_nome)}</div>` : ''}
        ${o.foto_conclusao ? `<div>Evidência: <a href="${escapeHtml(o.foto_conclusao)}" target="_blank" rel="noopener noreferrer" style="color:var(--accent);">Abrir foto</a></div>` : ''}
      </div>
      <div style="font-size: 13px; font-weight: 500; margin-bottom: 8px;">Propostas (${propostas.length})</div>
      ${listaPropHtml}
    `);
  } catch {
    toast('Falha ao consultar detalhes da ordem', 'error');
  }
}

function abrirModalCheckout(ordemId, propostaId, valorMaoObra) {
  const taxaBase = Math.max(15, Math.round(valorMaoObra * 0.08 * 100) / 100);
  abrirModal(`
    <div class="modal-top">
      <h3>Retenção em custódia · ${codigoOrdem(ordemId)}</h3>
      <button type="button" class="btn btn-secondary btn-sm" data-action="fechar-modal">Fechar</button>
    </div>
    <p style="font-size: 13px; color: var(--text-2); margin-bottom: 16px;">
      O valor total permanece guardado na plataforma até você homologar a vistoria presencial.
    </p>
    <div class="field-group">
      <label class="field-label">Forma de pagamento</label>
      <select id="chk-metodo" class="field">
        <option value="PIX">PIX</option>
        <option value="CARTAO_CREDITO">Cartão de crédito</option>
      </select>
    </div>
    <div class="field-group">
      <label class="field-label">Cupom de desconto na taxa</label>
      <input type="text" id="chk-cupom" class="field mono" placeholder="Ex: FREELA10" data-input-action="recalcular-checkout" data-valor="${valorMaoObra}">
    </div>
    <div style="background: var(--bg-page); border: 1px solid var(--hairline); border-radius: var(--r-control); padding: 12px; margin-bottom: 16px; font-size: 13px;">
      <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>Mão de obra</span><span class="mono">${moeda(valorMaoObra)}</span></div>
      <div style="display:flex; justify-content:space-between; margin-bottom:8px;"><span>Taxa de custódia</span><span class="mono" id="chk-taxa-val">${moeda(taxaBase)}</span></div>
      <div style="display:flex; justify-content:space-between; padding-top:8px; border-top:1px solid var(--hairline); font-weight: 500;"><span>Total retido</span><span class="mono" id="chk-total-val">${moeda(valorMaoObra + taxaBase)}</span></div>
    </div>
    <div style="display:flex; justify-content:flex-end; gap:8px;">
      <button type="button" class="btn btn-secondary" data-action="fechar-modal">Cancelar</button>
      <button type="button" class="btn btn-primary" data-action="confirmar-checkout" data-ordem-id="${ordemId}" data-proposta-id="${propostaId}">Confirmar pagamento</button>
    </div>
  `);
}

function recalcularPreviewCheckout(valorMaoObra) {
  let taxa = Math.max(15, Math.round(valorMaoObra * 0.08 * 100) / 100);
  const cod = (document.getElementById('chk-cupom')?.value || '').trim().toUpperCase();
  if (cod) {
    const cup = state.cupons.find(c => c.codigo === cod && c.ativo === 1);
    if (cup) taxa = Math.round(taxa * (1 - cup.desconto_percentual / 100) * 100) / 100;
    else if (cod === 'FREELA10') taxa = Math.round(taxa * 0.5 * 100) / 100;
  }
  const elTaxa = document.getElementById('chk-taxa-val');
  const elTotal = document.getElementById('chk-total-val');
  if (elTaxa) elTaxa.textContent = moeda(taxa);
  if (elTotal) elTotal.textContent = moeda(valorMaoObra + taxa);
}

async function confirmarCheckout(ordemId, propostaId, btn) {
  const metodo_pagamento = document.getElementById('chk-metodo').value;
  const cupom = document.getElementById('chk-cupom').value.trim();
  if (btn) btn.disabled = true;
  try {
    const res = await fetch(`/api/ordens/${ordemId}/checkout`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ proposta_id: propostaId, metodo_pagamento, cupom })
    });
    const json = await res.json();
    if (json.sucesso) {
      fecharModal();
      toast('Pagamento retido em custódia', 'success');
      await sincronizarDadosBase();
      navegarApp(state.page);
    } else {
      toast(json.mensagem, 'error');
    }
  } catch {
    toast('Falha ao processar o pagamento em custódia', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function abrirModalProposta(ordemId) {
  abrirModal(`
    <div class="modal-top">
      <h3>Enviar orçamento · ${codigoOrdem(ordemId)}</h3>
      <button type="button" class="btn btn-secondary btn-sm" data-action="fechar-modal">Fechar</button>
    </div>
    <div class="field-row">
      <div class="field-group">
        <label class="field-label">Mão de obra (R$)</label>
        <input type="number" id="prop-valor" class="field mono" placeholder="280.00" min="10" step="1">
      </div>
      <div class="field-group">
        <label class="field-label">Prazo de execução</label>
        <input type="text" id="prop-prazo" class="field" placeholder="Ex: Hoje às 15h">
      </div>
    </div>
    <div class="field-group">
      <label class="field-label">Condições técnicas</label>
      <textarea id="prop-msg" class="field" rows="3" placeholder="Ferramentas e escopo incluído"></textarea>
    </div>
    <div style="display:flex; justify-content:flex-end; gap:8px;">
      <button type="button" class="btn btn-secondary" data-action="fechar-modal">Cancelar</button>
      <button type="button" class="btn btn-primary" data-action="enviar-proposta" data-id="${ordemId}">Enviar proposta</button>
    </div>
  `);
}

async function enviarPropostaOrdem(ordemId, btn) {
  const valor = parseFloat(document.getElementById('prop-valor').value);
  const prazo_estimado = document.getElementById('prop-prazo').value.trim();
  const mensagem = document.getElementById('prop-msg').value.trim();

  if (!valor || valor <= 0) return toast('Informe o valor da mão de obra', 'error');
  if (!prazo_estimado) return toast('Informe o prazo estimado de atendimento', 'error');

  if (btn) btn.disabled = true;
  try {
    const res = await fetch(`/api/ordens/${ordemId}/propostas`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ prestador_id: state.user.id, valor, prazo_estimado, mensagem })
    });
    const json = await res.json();
    if (json.sucesso) {
      fecharModal();
      toast('Proposta registrada no chamado', 'success');
      await sincronizarDadosBase();
      navegarApp(state.page);
    } else {
      toast(json.mensagem, 'error');
    }
  } catch {
    toast('Falha ao enviar proposta', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function atualizarStatusOrdem(ordemId, novoStatus, fotoConclusao = null) {
  try {
    const res = await fetch(`/api/ordens/${ordemId}/status`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ novo_status: novoStatus, foto_conclusao: fotoConclusao })
    });
    const json = await res.json();
    if (json.sucesso) {
      fecharModal();
      toast('Etapa operacional atualizada', 'success');
      await sincronizarDadosBase();
      navegarApp(state.page);
    } else {
      toast(json.mensagem, 'error');
    }
  } catch {
    toast('Falha ao atualizar status operacional', 'error');
  }
}

function abrirModalConclusaoPrestador(ordemId) {
  abrirModal(`
    <div class="modal-top">
      <h3>Solicitar vistoria · ${codigoOrdem(ordemId)}</h3>
      <button type="button" class="btn btn-secondary btn-sm" data-action="fechar-modal">Fechar</button>
    </div>
    <p style="font-size: 13px; color: var(--text-2); margin-bottom: 16px;">
      O cliente receberá aviso para inspecionar o serviço e liberar o saldo em custódia.
    </p>
    <div class="field-group">
      <label class="field-label">Foto do reparo concluído (URL opcional)</label>
      <input type="text" id="conc-foto" class="field" placeholder="https://...">
    </div>
    <div style="display:flex; justify-content:flex-end; gap:8px;">
      <button type="button" class="btn btn-secondary" data-action="fechar-modal">Cancelar</button>
      <button type="button" class="btn btn-accent" data-action="confirmar-conclusao" data-id="${ordemId}">Enviar para vistoria</button>
    </div>
  `);
}

function selecionarNota(n) {
  state.selectedStarRating = n;
  document.querySelectorAll('.rating-key').forEach(b => {
    b.classList.toggle('selected', Number(b.dataset.val) <= n);
  });
}

function abrirModalAprovacao(ordemId) {
  state.selectedStarRating = 5;
  abrirModal(`
    <div class="modal-top">
      <h3>Aprovar vistoria · ${codigoOrdem(ordemId)}</h3>
      <button type="button" class="btn btn-secondary btn-sm" data-action="fechar-modal">Fechar</button>
    </div>
    <p style="font-size: 13px; color: var(--text-2); margin-bottom: 16px;">
      A confirmação transfere o saldo guardado em custódia para a carteira disponível do prestador.
    </p>
    <div class="field-group">
      <label class="field-label">Nota de 1 a 5</label>
      <div class="rating-row">
        ${[1, 2, 3, 4, 5].map(n => `<button type="button" class="rating-key selected" data-action="selecionar-nota" data-val="${n}">${n}</button>`).join('')}
      </div>
    </div>
    <div class="field-group">
      <label class="field-label">Comentário sobre a entrega</label>
      <textarea id="aprov-comentario" class="field" rows="3" placeholder="Pontualidade, acabamento e limpeza do local"></textarea>
    </div>
    <div style="display:flex; justify-content:flex-end; gap:8px;">
      <button type="button" class="btn btn-secondary" data-action="fechar-modal">Cancelar</button>
      <button type="button" class="btn btn-accent" data-action="confirmar-aprovacao" data-id="${ordemId}">Liberar repasse</button>
    </div>
  `);
}

async function confirmarAprovacaoVistoria(ordemId, btn) {
  const comentario = document.getElementById('aprov-comentario').value.trim();
  if (btn) btn.disabled = true;
  try {
    const res = await fetch(`/api/ordens/${ordemId}/aprovar`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ cliente_id: state.user.id, nota: state.selectedStarRating, comentario })
    });
    const json = await res.json();
    if (json.sucesso) {
      fecharModal();
      toast(`Repasse de ${moeda(json.valor_liberado)} liberado`, 'success');
      await sincronizarDadosBase();
      navegarApp(state.page);
    } else {
      toast(json.mensagem, 'error');
    }
  } catch {
    toast('Falha ao liberar repasse da vistoria', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function abrirModalAvaliarCliente(ordemId) {
  state.selectedStarRating = 5;
  abrirModal(`
    <div class="modal-top">
      <h3>Avaliar cliente · ${codigoOrdem(ordemId)}</h3>
      <button type="button" class="btn btn-secondary btn-sm" data-action="fechar-modal">Fechar</button>
    </div>
    <div class="field-group">
      <label class="field-label">Nota de 1 a 5</label>
      <div class="rating-row">
        ${[1, 2, 3, 4, 5].map(n => `<button type="button" class="rating-key selected" data-action="selecionar-nota" data-val="${n}">${n}</button>`).join('')}
      </div>
    </div>
    <div class="field-group">
      <label class="field-label">Observação</label>
      <textarea id="avcli-comentario" class="field" rows="3" placeholder="Clareza nas informações e recepção no local"></textarea>
    </div>
    <div style="display:flex; justify-content:flex-end; gap:8px;">
      <button type="button" class="btn btn-secondary" data-action="fechar-modal">Cancelar</button>
      <button type="button" class="btn btn-primary" data-action="confirmar-avaliar-cliente" data-id="${ordemId}">Salvar avaliação</button>
    </div>
  `);
}

async function confirmarAvaliacaoCliente(ordemId, btn) {
  const comentario = document.getElementById('avcli-comentario').value.trim();
  if (btn) btn.disabled = true;
  try {
    const res = await fetch(`/api/ordens/${ordemId}/avaliar-cliente`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ prestador_id: state.user.id, nota: state.selectedStarRating, comentario })
    });
    const json = await res.json();
    if (json.sucesso) {
      fecharModal();
      toast('Avaliação registrada', 'success');
      await sincronizarDadosBase();
    } else {
      toast(json.mensagem, 'error');
    }
  } catch {
    toast('Falha ao salvar avaliação', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function abrirModalDisputa(ordemId) {
  abrirModal(`
    <div class="modal-top">
      <h3>Contestar entrega · ${codigoOrdem(ordemId)}</h3>
      <button type="button" class="btn btn-secondary btn-sm" data-action="fechar-modal">Fechar</button>
    </div>
    <div class="field-group">
      <label class="field-label">Motivo técnico</label>
      <input type="text" id="disp-motivo" class="field" placeholder="Descreva a inconformidade encontrada">
    </div>
    <div class="field-group">
      <label class="field-label">Detalhes para a mediação</label>
      <textarea id="disp-detalhes" class="field" rows="3" placeholder="Relate o estado atual do reparo"></textarea>
    </div>
    <div style="display:flex; justify-content:flex-end; gap:8px;">
      <button type="button" class="btn btn-secondary" data-action="fechar-modal">Cancelar</button>
      <button type="button" class="btn btn-danger-quiet" data-action="confirmar-disputa" data-id="${ordemId}">Congelar custódia</button>
    </div>
  `);
}

async function confirmarDisputa(ordemId, btn) {
  const motivo = document.getElementById('disp-motivo').value.trim();
  const detalhes = document.getElementById('disp-detalhes').value.trim();
  if (!motivo) return toast('Informe o motivo da contestação', 'error');

  if (btn) btn.disabled = true;
  try {
    const res = await fetch(`/api/ordens/${ordemId}/disputa`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ motivo, detalhes })
    });
    const json = await res.json();
    if (json.sucesso) {
      fecharModal();
      toast('Custódia congelada para análise', 'info');
      await sincronizarDadosBase();
      navegarApp('disputas');
    } else {
      toast(json.mensagem, 'error');
    }
  } catch {
    toast('Falha ao registrar contestação', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function abrirModalArbitragem(ordemId) {
  abrirModal(`
    <div class="modal-top">
      <h3>Arbitragem · ${codigoOrdem(ordemId)}</h3>
      <button type="button" class="btn btn-secondary btn-sm" data-action="fechar-modal">Fechar</button>
    </div>
    <div class="field-group">
      <label class="field-label">Decisão</label>
      <select id="arb-decisao" class="field">
        <option value="ESTORNO_CLIENTE">Estorno integral ao cliente</option>
        <option value="REPASSE_PRESTADOR">Repasse integral ao prestador</option>
      </select>
    </div>
    <div class="field-group">
      <label class="field-label">Parecer para o livro-razão</label>
      <textarea id="arb-justificativa" class="field" rows="3" placeholder="Fundamentação técnica da decisão"></textarea>
    </div>
    <div style="display:flex; justify-content:flex-end; gap:8px;">
      <button type="button" class="btn btn-secondary" data-action="fechar-modal">Cancelar</button>
      <button type="button" class="btn btn-primary" data-action="confirmar-arbitragem" data-id="${ordemId}">Registrar decisão</button>
    </div>
  `);
}

async function confirmarArbitragem(ordemId, btn) {
  const decisao = document.getElementById('arb-decisao').value;
  const justificativa = document.getElementById('arb-justificativa').value.trim();
  if (btn) btn.disabled = true;
  try {
    const res = await fetch(`/api/disputas/${ordemId}/resolver`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ decisao, justificativa })
    });
    const json = await res.json();
    if (json.sucesso) {
      fecharModal();
      toast('Decisão gravada no livro-razão', 'success');
      await sincronizarDadosBase();
      navegarApp('disputas');
    } else {
      toast(json.mensagem, 'error');
    }
  } catch {
    toast('Falha ao registrar decisão de arbitragem', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function abrirModalPortfolio() {
  abrirModal(`
    <div class="modal-top">
      <h3>Nova obra no portfólio</h3>
      <button type="button" class="btn btn-secondary btn-sm" data-action="fechar-modal">Fechar</button>
    </div>
    <div class="field-group">
      <label class="field-label">Título do serviço</label>
      <input type="text" id="port-titulo" class="field" placeholder="Ex: Adequação de quadro bifásico">
    </div>
    <div class="field-group">
      <label class="field-label">Área</label>
      <select id="port-cat" class="field">
        <option value="Elétrica">Elétrica</option>
        <option value="Hidráulica">Hidráulica</option>
        <option value="Pintura">Pintura</option>
        <option value="Alvenaria">Alvenaria</option>
        <option value="Climatização">Climatização</option>
      </select>
    </div>
    <div class="field-group">
      <label class="field-label">Descrição técnica</label>
      <textarea id="port-desc" class="field" rows="3" placeholder="Materiais e procedimentos executados"></textarea>
    </div>
    <div style="display:flex; justify-content:flex-end; gap:8px;">
      <button type="button" class="btn btn-secondary" data-action="fechar-modal">Cancelar</button>
      <button type="button" class="btn btn-primary" data-action="salvar-portfolio">Publicar obra</button>
    </div>
  `);
}

async function salvarItemPortfolio(btn) {
  const titulo = document.getElementById('port-titulo').value.trim();
  const categoria = document.getElementById('port-cat').value;
  const descricao = document.getElementById('port-desc').value.trim();
  if (!titulo) return toast('Informe o título da obra', 'error');

  if (btn) btn.disabled = true;
  try {
    const res = await fetch(`/api/prestadores/${state.user.id}/portfolio`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ titulo, categoria, descricao })
    });
    const json = await res.json();
    if (json.sucesso) {
      fecharModal();
      toast('Obra adicionada ao portfólio', 'success');
      await sincronizarDadosBase();
      renderizarPrestadores();
    } else {
      toast(json.mensagem, 'error');
    }
  } catch {
    toast('Falha ao publicar obra no portfólio', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function aprovarSeloUsuario(userId) {
  try {
    const res = await fetch(`/api/admin/usuarios/${userId}/aprovar`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ admin_id: state.user.id })
    });
    const json = await res.json();
    if (json.sucesso) {
      toast('Cadastro homologado', 'success');
      await sincronizarDadosBase();
      renderizarPainelAdmin();
    } else {
      toast(json.mensagem, 'error');
    }
  } catch {
    toast('Falha ao homologar cadastro', 'error');
  }
}

async function alternarCupom(cupomId) {
  try {
    const res = await fetch(`/api/admin/cupons/${cupomId}/toggle`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ admin_id: state.user.id })
    });
    if (res.ok) {
      await sincronizarDadosBase();
      renderizarPainelAdmin();
    }
  } catch {
    toast('Falha ao alterar estado do cupom', 'error');
  }
}

// =========================================================================
// FORMULÁRIOS FIXOS COM VALIDAÇÃO CLARA E TRATAMENTO DE REDE
// =========================================================================
function atualizarEstimativaPreco() {
  const sel = document.getElementById('select-categoria');
  if (!sel) return;
  const cat = sel.value;
  const info = ESTIMATIVAS_PRECO[cat] || { min: '150,00', max: '400,00', desc: '' };
  document.getElementById('estimator-title').textContent = `Referência em Volta Redonda · ${cat}`;
  document.getElementById('estimator-text').textContent = `Faixa usual: R$ ${info.min} a R$ ${info.max}. ${info.desc}`;
}

function configurarFormulariosFixos() {
  document.getElementById('select-categoria').addEventListener('change', atualizarEstimativaPreco);
  document.getElementById('filtro-busca').addEventListener('input', renderizarMuralOrdens);
  document.getElementById('filtro-status').addEventListener('change', renderizarMuralOrdens);
  document.getElementById('filtro-categoria').addEventListener('change', renderizarMuralOrdens);

  document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    mostrarFeedbackForm('auth-feedback', '');
    const email = document.getElementById('login-email').value.trim();
    const senha = document.getElementById('login-senha').value;

    if (!email || !email.includes('@')) {
      mostrarFeedbackForm('auth-feedback', 'Informe um endereço de e-mail válido.');
      document.getElementById('login-email').focus();
      return;
    }
    if (!senha) {
      mostrarFeedbackForm('auth-feedback', 'Informe sua senha para entrar.');
      document.getElementById('login-senha').focus();
      return;
    }

    const btn = document.getElementById('btn-submit-login');
    btn.disabled = true;
    try {
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
        const destino = resolverDestinoPosAuth(json.dados);
        await iniciarWorkspace(destino);
        if (destino === 'nova') aplicarIntencaoFormularioNovaOrdem();
      } else {
        mostrarFeedbackForm('auth-feedback', json.mensagem || 'E-mail ou senha inválidos.');
        toast('E-mail ou senha inválidos', 'error');
      }
    } catch {
      mostrarFeedbackForm('auth-feedback', 'Falha de comunicação com o servidor.');
      toast('Falha de comunicação com o servidor', 'error');
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('form-register').addEventListener('submit', async (e) => {
    e.preventDefault();
    mostrarFeedbackForm('auth-feedback', '');

    const nome = document.getElementById('reg-nome').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const telefone = document.getElementById('reg-telefone').value.trim() || '(24) 99999-0000';
    const papel = document.getElementById('reg-papel').value;
    const especialidade = document.getElementById('reg-especialidade').value;
    const senha = document.getElementById('reg-senha').value;

    if (!nome || nome.length < 2) {
      mostrarFeedbackForm('auth-feedback', 'Informe seu nome completo.');
      document.getElementById('reg-nome').focus();
      return;
    }
    if (!email || !email.includes('@')) {
      mostrarFeedbackForm('auth-feedback', 'Informe um endereço de e-mail válido.');
      document.getElementById('reg-email').focus();
      return;
    }
    if (!senha || senha.length < 6) {
      mostrarFeedbackForm('auth-feedback', 'A senha precisa ter no mínimo 6 caracteres.');
      document.getElementById('reg-senha').focus();
      return;
    }

    const btn = document.getElementById('btn-submit-register');
    btn.disabled = true;
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, email, telefone, papel, especialidade, senha })
      });
      const json = await res.json();
      if (json.sucesso) {
        state.token = json.token;
        state.user = json.dados;
        localStorage.setItem(STORAGE_TOKEN_KEY, json.token);
        e.target.reset();
        selecionarPapelCadastro('CLIENTE');
        toast(`Conta criada para ${json.dados.nome}`, 'success');
        const destino = resolverDestinoPosAuth(json.dados);
        await iniciarWorkspace(destino);
        if (destino === 'nova') aplicarIntencaoFormularioNovaOrdem();
      } else {
        mostrarFeedbackForm('auth-feedback', json.mensagem || 'Falha ao cadastrar conta.');
        toast(json.mensagem || 'Falha ao cadastrar conta', 'error');
      }
    } catch {
      mostrarFeedbackForm('auth-feedback', 'Falha de comunicação com o servidor.');
      toast('Falha de comunicação com o servidor', 'error');
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('form-nova-solicitacao').addEventListener('submit', async (e) => {
    e.preventDefault();
    mostrarFeedbackForm('nova-ordem-feedback', '');

    const categoria = document.getElementById('select-categoria').value;
    const urgencia = document.getElementById('select-urgencia').value;
    const titulo = document.getElementById('input-titulo').value.trim();
    const descricao = document.getElementById('input-descricao').value.trim();
    const cep = document.getElementById('input-cep').value.trim();
    const endereco = document.getElementById('input-endereco').value.trim();

    if (!titulo || titulo.length < 5) {
      mostrarFeedbackForm('nova-ordem-feedback', 'Informe um resumo do reparo com pelo menos 5 caracteres.');
      document.getElementById('input-titulo').focus();
      return;
    }
    if (!descricao || descricao.length < 10) {
      mostrarFeedbackForm('nova-ordem-feedback', 'Descreva o defeito observado com pelo menos 10 caracteres.');
      document.getElementById('input-descricao').focus();
      return;
    }
    if (!cep) {
      mostrarFeedbackForm('nova-ordem-feedback', 'Informe o CEP do imóvel.');
      document.getElementById('input-cep').focus();
      return;
    }
    if (!endereco) {
      mostrarFeedbackForm('nova-ordem-feedback', 'Informe o endereço do atendimento.');
      document.getElementById('input-endereco').focus();
      return;
    }

    const btn = document.getElementById('btn-submit-nova-ordem');
    btn.disabled = true;
    try {
      const res = await fetch('/api/ordens', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          cliente_id: state.user.id,
          categoria,
          urgencia,
          titulo,
          descricao,
          cep,
          endereco
        })
      });
      const json = await res.json();
      if (json.sucesso) {
        e.target.reset();
        atualizarEstimativaPreco();
        toast('Pedido de orçamento publicado no mural', 'success');
        await sincronizarDadosBase();
        navegarApp('mural');
      } else {
        mostrarFeedbackForm('nova-ordem-feedback', json.mensagem || 'Erro ao publicar pedido.');
        toast(json.mensagem || 'Erro ao publicar pedido', 'error');
      }
    } catch {
      mostrarFeedbackForm('nova-ordem-feedback', 'Falha de comunicação com o servidor.');
      toast('Falha de comunicação com o servidor', 'error');
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('form-saque').addEventListener('submit', async (e) => {
    e.preventDefault();
    const valor = parseFloat(document.getElementById('saque-valor').value);
    const chave_pix = document.getElementById('saque-pix').value.trim();
    try {
      const res = await fetch('/api/prestador/saque', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ prestador_id: state.user.id, valor, chave_pix })
      });
      const json = await res.json();
      if (json.sucesso) {
        e.target.reset();
        toast('Transferência PIX enviada', 'success');
        await sincronizarDadosBase();
        renderizarCarteira();
      } else {
        toast(json.mensagem, 'error');
      }
    } catch {
      toast('Falha ao processar transferência PIX', 'error');
    }
  });

  document.getElementById('form-novo-cupom').addEventListener('submit', async (e) => {
    e.preventDefault();
    const codigo = document.getElementById('cupom-codigo').value.trim();
    const desconto_percentual = document.getElementById('cupom-desconto').value;
    try {
      const res = await fetch('/api/admin/cupons', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ admin_id: state.user.id, codigo, desconto_percentual })
      });
      const json = await res.json();
      if (json.sucesso) {
        e.target.reset();
        toast('Cupom adicionado', 'success');
        await sincronizarDadosBase();
        renderizarPainelAdmin();
      } else {
        toast(json.mensagem, 'error');
      }
    } catch {
      toast('Falha ao criar cupom', 'error');
    }
  });

  document.getElementById('form-perfil').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
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
        toast('Dados salvos', 'success');
      } else {
        toast(json.mensagem, 'error');
      }
    } catch {
      toast('Falha ao salvar dados do perfil', 'error');
    }
  });

  document.getElementById('form-documento').addEventListener('submit', async (e) => {
    e.preventDefault();
    const documento_url = document.getElementById('perf-doc-url').value.trim();
    try {
      const res = await fetch(`/api/usuarios/${state.user.id}/verificar-documento`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ documento_url })
      });
      const json = await res.json();
      if (json.sucesso) {
        toast('Documento enviado para análise', 'success');
        await sincronizarDadosBase();
        renderizarPerfil();
      } else {
        toast(json.mensagem, 'error');
      }
    } catch {
      toast('Falha ao enviar documento', 'error');
    }
  });
}
