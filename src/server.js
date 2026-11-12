const express = require('express');
const cors = require('cors');
const path = require('node:path');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Rotas da API
app.use('/api', apiRoutes);

// Fallback para SPA
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ sucesso: false, mensagem: 'Rota de API não encontrada.' });
  }
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Inicialização do Servidor
if (require.main === module) {
  app.listen(PORT, () => {
    console.log('====================================================');
    console.log(` FreeLA SaaS — Servidor Ativo na porta ${PORT}`);
    console.log(` Acesse no navegador: http://localhost:${PORT}`);
    console.log(` API REST base: http://localhost:${PORT}/api/ordens`);
    console.log('====================================================');
  });
}

module.exports = app;
