const express = require('express');
const router = express.Router();
const controller = require('../controllers/ordensController');
const platform = require('../controllers/platformController');

// Autenticação e Cadastro (Sprint 2)
router.post('/auth/register', platform.registrarUsuario);
router.post('/auth/login', platform.loginUsuario);
router.get('/auth/me', platform.obterSessaoAtual);
router.patch('/auth/perfil', platform.atualizarPerfil);
router.post('/usuarios/:id/verificar-documento', platform.enviarDocumentoVerificacao);
router.get('/avaliacoes', platform.listarAvaliacoes);

// Rotas de Usuários e Estatísticas
router.get('/stats', controller.obterEstatisticas);
router.get('/usuarios', controller.listarUsuarios);

// Catálogo de Prestadores e Portfólio (Item 10B)
router.get('/prestadores', platform.listarPrestadores);
router.post('/prestadores/:id/portfolio', platform.adicionarPortfolio);

// Rotas de Ordens de Serviço
router.get('/ordens', controller.listarOrdens);
router.post('/ordens', controller.criarOrdem);
router.get('/ordens/:id', controller.obterOrdem);

// Fluxo de Propostas, Escrow e Avaliação Mútua Bilateral
router.post('/ordens/:id/propostas', controller.enviarProposta);
router.post('/ordens/:id/checkout', controller.checkoutCustodia);
router.patch('/ordens/:id/status', controller.atualizarStatus);
router.post('/ordens/:id/aprovar', controller.aprovarVistoria);
router.post('/ordens/:id/avaliar-cliente', controller.avaliarCliente);
router.post('/ordens/:id/disputa', controller.abrirDisputa);

// Livro-Razão Escrow, Saques, Notificações e Mediação
router.get('/transacoes', controller.listarTransacoes);
router.get('/notificacoes', controller.listarNotificacoes);
router.post('/prestador/saque', controller.solicitarSaque);
router.post('/disputas/:id/resolver', controller.resolverDisputa);

// Painel Administrativo: Verificações, Cupons Dinâmicos e Métricas (Itens 11, 12 e 13)
router.get('/cupons', platform.listarCupons);
router.get('/admin/metricas', platform.obterMetricasAdmin);
router.patch('/admin/usuarios/:id/aprovar', platform.aprovarVerificacaoAdmin);
router.post('/admin/cupons', platform.criarCupomAdmin);
router.patch('/admin/cupons/:id/toggle', platform.alternarCupomAdmin);

module.exports = router;
