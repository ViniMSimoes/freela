const express = require('express');
const router = express.Router();
const controller = require('../controllers/ordensController');

// Rotas de Usuários e Estatísticas
router.get('/stats', controller.obterEstatisticas);
router.get('/usuarios', controller.listarUsuarios);

// Rotas de Ordens de Serviço
router.get('/ordens', controller.listarOrdens);
router.post('/ordens', controller.criarOrdem);
router.get('/ordens/:id', controller.obterOrdem);

// Fluxo de Propostas e Escrow
router.post('/ordens/:id/propostas', controller.enviarProposta);
router.post('/ordens/:id/checkout', controller.checkoutCustodia);
router.patch('/ordens/:id/status', controller.atualizarStatus);
router.post('/ordens/:id/aprovar', controller.aprovarVistoria);
router.post('/ordens/:id/disputa', controller.abrirDisputa);

module.exports = router;
