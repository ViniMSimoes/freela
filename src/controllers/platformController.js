const crypto = require('node:crypto');
const db = require('../database/connection');
const notificationService = require('../services/notificationService');

const TOKEN_SECRET = process.env.JWT_SECRET || 'freela-ubm-secret-key-2026';

function sanitizarTexto(str, maxLen = 255) {
  if (typeof str !== 'string') return '';
  return str.replace(/<[^>]*>?/gm, '').trim().substring(0, maxLen);
}

function hashSenha(senha) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(senha, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verificarSenha(senha, armazenado) {
  if (!armazenado || !armazenado.includes(':')) return false;
  const [salt, keyHex] = armazenado.split(':');
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derived = crypto.scryptSync(senha, salt, 64);
  if (keyBuf.length !== derived.length) return false;
  return crypto.timingSafeEqual(keyBuf, derived);
}

function gerarToken(usuario) {
  const payload = Buffer.from(JSON.stringify({
    id: usuario.id,
    papel: usuario.papel,
    exp: Date.now() + 24 * 60 * 60 * 1000
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function extrairUsuarioAutenticado(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  const partes = token.split('.');
  if (partes.length !== 2) return null;
  const [payloadB64, sigB64] = partes;
  const expectedSig = crypto.createHmac('sha256', TOKEN_SECRET).update(payloadB64).digest('base64url');
  const sigBuf = Buffer.from(sigB64);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    const dados = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (!dados.exp || dados.exp < Date.now()) return null;
    const usuario = db.prepare('SELECT id, nome, email, papel, telefone, especialidade, reputacao, saldo_disponivel, saldo_custodia, verificado, documento_url, criado_em FROM usuarios WHERE id = ?').get(dados.id);
    return usuario || null;
  } catch {
    return null;
  }
}

function verificarAdmin(adminId) {
  const id = parseInt(adminId, 10);
  if (isNaN(id)) return null;
  const user = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id);
  if (!user || user.papel !== 'ADMIN') return null;
  return user;
}

exports.extrairUsuarioAutenticado = extrairUsuarioAutenticado;

// 1. Cadastro de Usuário (Item 11: inicia com verificado = 0)
exports.registrarUsuario = (req, res) => {
  try {
    const { nome, email, senha, papel, telefone, especialidade } = req.body;
    const nomeSan = sanitizarTexto(nome, 100);
    const emailSan = sanitizarTexto(email, 100).toLowerCase();
    const papelSan = papel === 'PRESTADOR' ? 'PRESTADOR' : 'CLIENTE';

    if (!nomeSan || !emailSan || !senha || String(senha).length < 6) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'Informe nome, e-mail válido e senha com no mínimo 6 caracteres.'
      });
    }

    const existente = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(emailSan);
    if (existente) {
      return res.status(400).json({ sucesso: false, mensagem: 'Este e-mail já está cadastrado.' });
    }

    const senhaHash = hashSenha(String(senha));
    const telSan = sanitizarTexto(telefone, 20) || '(24) 99999-0000';
    const espSan = papelSan === 'PRESTADOR' ? (sanitizarTexto(especialidade, 60) || 'Serviços Gerais') : null;

    const info = db.prepare(`
      INSERT INTO usuarios (nome, email, papel, telefone, especialidade, reputacao, saldo_disponivel, saldo_custodia, verificado, senha_hash)
      VALUES (?, ?, ?, ?, ?, 5.0, 0.0, 0.0, 0, ?)
    `).run(nomeSan, emailSan, papelSan, telSan, espSan, senhaHash);

    const novoUsuario = db.prepare('SELECT id, nome, email, papel, telefone, especialidade, reputacao, saldo_disponivel, saldo_custodia, verificado FROM usuarios WHERE id = ?').get(info.lastInsertRowid);
    const token = gerarToken(novoUsuario);

    res.status(201).json({
      sucesso: true,
      mensagem: 'Conta criada com sucesso! Envie seu documento para receber o selo Verificado.',
      token,
      dados: novoUsuario
    });
  } catch (error) {
    console.error('[ERRO registrarUsuario]:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao cadastrar usuário.' });
  }
};

// 2. Autenticação / Login
exports.loginUsuario = (req, res) => {
  try {
    const { email, senha } = req.body;
    const emailSan = sanitizarTexto(email, 100).toLowerCase();
    const usuario = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(emailSan);

    if (!usuario) {
      return res.status(401).json({ sucesso: false, mensagem: 'Credenciais inválidas.' });
    }

    // Contas criadas via cadastro exigem senha; contas seed de demonstração podem autenticar com 'demo123'
    const senhaValida = usuario.senha_hash
      ? verificarSenha(String(senha || ''), usuario.senha_hash)
      : String(senha || '') === 'demo123';

    if (!senhaValida) {
      return res.status(401).json({ sucesso: false, mensagem: 'Credenciais inválidas.' });
    }

    const { senha_hash, ...dadosSeguros } = usuario;
    const token = gerarToken(usuario);

    res.json({
      sucesso: true,
      mensagem: 'Login realizado com sucesso.',
      token,
      dados: dadosSeguros
    });
  } catch (error) {
    console.error('[ERRO loginUsuario]:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao autenticar usuário.' });
  }
};

// 3. Envio de Documento para Verificação (Item 11)
exports.enviarDocumentoVerificacao = (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { documento_url } = req.body;
    const docSan = sanitizarTexto(documento_url, 300);

    if (!docSan) {
      return res.status(400).json({ sucesso: false, mensagem: 'Informe o link ou referência do documento.' });
    }

    const usuario = db.prepare('SELECT id FROM usuarios WHERE id = ?').get(id);
    if (!usuario) {
      return res.status(404).json({ sucesso: false, mensagem: 'Usuário não encontrado.' });
    }

    db.prepare('UPDATE usuarios SET documento_url = ? WHERE id = ?').run(docSan, id);
    res.json({ sucesso: true, mensagem: 'Documento enviado para análise da equipe administrativa.' });
  } catch (error) {
    console.error('[ERRO enviarDocumentoVerificacao]:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao enviar documento.' });
  }
};

// 4. Catálogo de Prestadores e Portfólio (Item 10B)
exports.listarPrestadores = (req, res) => {
  try {
    const prestadores = db.prepare(`
      SELECT id, nome, email, telefone, especialidade, reputacao, verificado, documento_url
      FROM usuarios
      WHERE papel = 'PRESTADOR'
      ORDER BY verificado DESC, reputacao DESC
    `).all();

    const itens = db.prepare('SELECT * FROM portfolio_itens ORDER BY id DESC').all();
    const dados = prestadores.map(p => ({
      ...p,
      portfolio: itens.filter(i => i.prestador_id === p.id)
    }));

    res.json({ sucesso: true, dados });
  } catch (error) {
    console.error('[ERRO listarPrestadores]:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao listar prestadores.' });
  }
};

exports.adicionarPortfolio = (req, res) => {
  try {
    const prestadorId = parseInt(req.params.id, 10);
    const { titulo, categoria, descricao, foto_url } = req.body;

    const prestador = db.prepare("SELECT id FROM usuarios WHERE id = ? AND papel = 'PRESTADOR'").get(prestadorId);
    if (!prestador) {
      return res.status(404).json({ sucesso: false, mensagem: 'Prestador não encontrado.' });
    }

    const tituloSan = sanitizarTexto(titulo, 120);
    const catSan = sanitizarTexto(categoria, 50) || 'Geral';
    const descSan = sanitizarTexto(descricao, 400);
    const fotoSan = sanitizarTexto(foto_url, 400) || 'https://images.unsplash.com/photo-1581092160607-ee22621dd758';

    if (!tituloSan) {
      return res.status(400).json({ sucesso: false, mensagem: 'Informe o título do serviço no portfólio.' });
    }

    const info = db.prepare(`
      INSERT INTO portfolio_itens (prestador_id, titulo, categoria, descricao, foto_url)
      VALUES (?, ?, ?, ?, ?)
    `).run(prestadorId, tituloSan, catSan, descSan, fotoSan);

    res.status(201).json({
      sucesso: true,
      mensagem: 'Item adicionado ao catálogo de portfólio.',
      dados: { id: info.lastInsertRowid, prestador_id: prestadorId, titulo: tituloSan, categoria: catSan }
    });
  } catch (error) {
    console.error('[ERRO adicionarPortfolio]:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao adicionar item ao portfólio.' });
  }
};

// 5. Gestão Administrativa: Aprovação de Selo Verificado (Item 11)
exports.aprovarVerificacaoAdmin = (req, res) => {
  try {
    const usuarioId = parseInt(req.params.id, 10);
    const { admin_id } = req.body;

    if (!verificarAdmin(admin_id)) {
      return res.status(403).json({ sucesso: false, mensagem: 'Acesso negado: Apenas administradores podem homologar documentos.' });
    }

    const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(usuarioId);
    if (!usuario) {
      return res.status(404).json({ sucesso: false, mensagem: 'Usuário não encontrado.' });
    }

    db.prepare('UPDATE usuarios SET verificado = 1 WHERE id = ?').run(usuarioId);
    notificationService.enviarWhatsApp(usuario.telefone, `Parabéns ${usuario.nome}! Seu perfil recebeu o selo Verificado FreeLA.`, usuarioId);

    res.json({ sucesso: true, mensagem: `Usuário ${usuario.nome} homologado com selo Verificado.` });
  } catch (error) {
    console.error('[ERRO aprovarVerificacaoAdmin]:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao aprovar verificação.' });
  }
};

// 6. Cupons Dinâmicos (Item 12)
exports.listarCupons = (req, res) => {
  try {
    const cupons = db.prepare('SELECT * FROM cupons ORDER BY id DESC').all();
    res.json({ sucesso: true, dados: cupons });
  } catch (error) {
    console.error('[ERRO listarCupons]:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao listar cupons.' });
  }
};

exports.criarCupomAdmin = (req, res) => {
  try {
    const { admin_id, codigo, desconto_percentual } = req.body;
    if (!verificarAdmin(admin_id)) {
      return res.status(403).json({ sucesso: false, mensagem: 'Acesso negado: Apenas administradores podem criar cupons.' });
    }

    const codigoSan = sanitizarTexto(codigo, 20).toUpperCase().replace(/[^A-Z0-9]/g, '');
    const desconto = parseInt(desconto_percentual, 10);

    if (!codigoSan || isNaN(desconto) || desconto < 1 || desconto > 100) {
      return res.status(400).json({ sucesso: false, mensagem: 'Informe um código alfanumérico e desconto entre 1% e 100%.' });
    }

    const existe = db.prepare('SELECT id FROM cupons WHERE codigo = ?').get(codigoSan);
    if (existe) {
      return res.status(400).json({ sucesso: false, mensagem: 'Código de cupom já cadastrado.' });
    }

    const info = db.prepare('INSERT INTO cupons (codigo, desconto_percentual, ativo) VALUES (?, ?, 1)').run(codigoSan, desconto);
    res.status(201).json({
      sucesso: true,
      mensagem: `Cupom ${codigoSan} (${desconto}% de desconto na taxa) criado com sucesso.`,
      dados: { id: info.lastInsertRowid, codigo: codigoSan, desconto_percentual: desconto, ativo: 1 }
    });
  } catch (error) {
    console.error('[ERRO criarCupomAdmin]:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao criar cupom.' });
  }
};

exports.alternarCupomAdmin = (req, res) => {
  try {
    const cupomId = parseInt(req.params.id, 10);
    const { admin_id } = req.body;
    if (!verificarAdmin(admin_id)) {
      return res.status(403).json({ sucesso: false, mensagem: 'Acesso negado.' });
    }

    const cupom = db.prepare('SELECT * FROM cupons WHERE id = ?').get(cupomId);
    if (!cupom) {
      return res.status(404).json({ sucesso: false, mensagem: 'Cupom não encontrado.' });
    }

    const novoEstado = cupom.ativo === 1 ? 0 : 1;
    db.prepare('UPDATE cupons SET ativo = ? WHERE id = ?').run(novoEstado, cupomId);
    res.json({ sucesso: true, ativo: novoEstado });
  } catch (error) {
    console.error('[ERRO alternarCupomAdmin]:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao alterar status do cupom.' });
  }
};

// 7. Métricas Gerenciais do Painel Admin (Item 13)
exports.obterMetricasAdmin = (req, res) => {
  try {
    const totalOrdens = db.prepare('SELECT COUNT(*) as total FROM ordens_servico').get().total;
    const concluidas = db.prepare("SELECT COUNT(*) as total FROM ordens_servico WHERE status = 'CONCLUIDO'").get().total;
    const disputas = db.prepare("SELECT COUNT(*) as total FROM ordens_servico WHERE status = 'EM_DISPUTA'").get().total;
    const volumeTaxas = db.prepare("SELECT COALESCE(SUM(taxa_plataforma), 0) as total FROM ordens_servico WHERE status IN ('EM_CUSTODIA','A_CAMINHO','EM_EXECUCAO','AGUARDANDO_VISTORIA','CONCLUIDO')").get().total;
    const ticketMedio = db.prepare("SELECT COALESCE(AVG(valor_total), 0) as media FROM ordens_servico WHERE valor_total > 0").get().media;
    const verificados = db.prepare("SELECT COUNT(*) as total FROM usuarios WHERE papel = 'PRESTADOR' AND verificado = 1").get().total;
    const totalPrestadores = db.prepare("SELECT COUNT(*) as total FROM usuarios WHERE papel = 'PRESTADOR'").get().total;

    const taxaConversao = totalOrdens > 0 ? Math.round((concluidas / totalOrdens) * 1000) / 10 : 0;

    res.json({
      sucesso: true,
      dados: {
        total_ordens: totalOrdens,
        ordens_concluidas: concluidas,
        ordens_em_disputa: disputas,
        taxa_conversao_percentual: taxaConversao,
        ticket_medio: Math.round(ticketMedio * 100) / 100,
        receita_taxas: Math.round(volumeTaxas * 100) / 100,
        prestadores_verificados: verificados,
        total_prestadores: totalPrestadores
      }
    });
  } catch (error) {
    console.error('[ERRO obterMetricasAdmin]:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao calcular métricas gerenciais.' });
  }
};

// 8. Sessão Atual via Bearer Token (GET /api/auth/me)
exports.obterSessaoAtual = (req, res) => {
  const usuario = extrairUsuarioAutenticado(req);
  if (!usuario) {
    return res.status(401).json({ sucesso: false, mensagem: 'Sessão inválida ou expirada.' });
  }
  res.json({ sucesso: true, dados: usuario });
};

// 9. Atualização de Perfil Pessoal (PATCH /api/auth/perfil)
exports.atualizarPerfil = (req, res) => {
  try {
    const usuario = extrairUsuarioAutenticado(req);
    if (!usuario) {
      return res.status(401).json({ sucesso: false, mensagem: 'Autenticação obrigatória.' });
    }

    const { nome, telefone, especialidade, nova_senha } = req.body;
    const nomeSan = sanitizarTexto(nome, 100) || usuario.nome;
    const telSan = sanitizarTexto(telefone, 20) || usuario.telefone;
    const espSan = usuario.papel === 'PRESTADOR'
      ? (sanitizarTexto(especialidade, 60) || usuario.especialidade)
      : usuario.especialidade;

    if (nova_senha && String(nova_senha).length >= 6) {
      const novoHash = hashSenha(String(nova_senha));
      db.prepare('UPDATE usuarios SET nome = ?, telefone = ?, especialidade = ?, senha_hash = ? WHERE id = ?')
        .run(nomeSan, telSan, espSan, novoHash, usuario.id);
    } else {
      db.prepare('UPDATE usuarios SET nome = ?, telefone = ?, especialidade = ? WHERE id = ?')
        .run(nomeSan, telSan, espSan, usuario.id);
    }

    const atualizado = db.prepare('SELECT id, nome, email, papel, telefone, especialidade, reputacao, saldo_disponivel, saldo_custodia, verificado, documento_url, criado_em FROM usuarios WHERE id = ?').get(usuario.id);
    res.json({ sucesso: true, mensagem: 'Perfil atualizado com sucesso.', dados: atualizado });
  } catch (error) {
    console.error('[ERRO atualizarPerfil]:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao atualizar perfil.' });
  }
};

// 10. Listagem de Avaliações Públicas e Mútuas (GET /api/avaliacoes)
exports.listarAvaliacoes = (req, res) => {
  try {
    const avaliadoId = req.query.avaliado_id ? parseInt(req.query.avaliado_id, 10) : null;
    let sql = `
      SELECT a.*, o.titulo as ordem_titulo, o.categoria,
             u1.nome as avaliador_nome, u1.papel as avaliador_papel,
             u2.nome as avaliado_nome
      FROM avaliacoes a
      JOIN ordens_servico o ON a.ordem_id = o.id
      JOIN usuarios u1 ON a.avaliador_id = u1.id
      JOIN usuarios u2 ON a.avaliado_id = u2.id
    `;
    const params = [];
    if (avaliadoId) {
      sql += ' WHERE a.avaliado_id = ?';
      params.push(avaliadoId);
    }
    sql += ' ORDER BY a.id DESC LIMIT 50';
    const dados = db.prepare(sql).all(...params);
    res.json({ sucesso: true, dados });
  } catch (error) {
    console.error('[ERRO listarAvaliacoes]:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao listar avaliações.' });
  }
};
