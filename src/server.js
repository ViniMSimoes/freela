require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('node:path');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

// Desabilitar cabeçalho informativo de tecnologia (OWASP)
app.disable('x-powered-by');

// Middleware de cabeçalhos de segurança HTTP (Helmet)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: false
  })
);

// Limitação de taxa de requisições (Rate Limiting) para prevenção de DoS e Brute-force
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // Janela de 15 minutos
  max: 200, // Limite de 200 requisições por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    sucesso: false,
    mensagem: 'Muitas requisições originadas deste IP. Por favor, tente novamente mais tarde.'
  }
});
app.use('/api', apiLimiter);

// Configuração segura de CORS (Restringido ao mesmo host ou configurável)
app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Proteção contra Payloads excessivos (Buffer Overflow / Memory Exhaustion)
app.use(express.json({ limit: '100kb' }));

// Servir arquivos estáticos da pasta pública com revalidação imediata
app.use(express.static(path.join(__dirname, '../public'), {
  dotfiles: 'ignore',
  etag: true,
  maxAge: 0,
  setHeaders(res) {
    res.setHeader('Cache-Control', 'no-cache');
  }
}));

// Rotas da API
app.use('/api', apiRoutes);

// Fallback para SPA
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ sucesso: false, mensagem: 'Endpoint da API não encontrado.' });
  }
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Middleware centralizado de tratamento de erros (Evita vazamento de stack trace)
app.use((err, req, res, next) => {
  console.error('[ERRO INTERNO]:', err);
  res.status(500).json({
    sucesso: false,
    mensagem: 'Ocorreu um erro interno no servidor ao processar a solicitação.'
  });
});

// Inicialização do Servidor
if (require.main === module) {
  app.listen(PORT, () => {
    console.log('====================================================');
    console.log(` FreeLA SaaS (Hardened) — Servidor Ativo na porta ${PORT}`);
    console.log(` Proteções ativas: Helmet, Rate Limiting, Sanitização`);
    console.log(` Acesse no navegador: http://localhost:${PORT}`);
    console.log('====================================================');
  });
}

module.exports = app;
