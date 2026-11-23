-- Schema do Banco de Dados SQLite — FreeLA SaaS
-- Modelo relacional rigorosamente alinhado ao DER e BPMN (Critério C4)

CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    papel TEXT CHECK(papel IN ('CLIENTE', 'PRESTADOR', 'ADMIN')) NOT NULL,
    telefone TEXT,
    especialidade TEXT,
    reputacao REAL DEFAULT 5.0,
    saldo_disponivel REAL DEFAULT 0.0,
    saldo_custodia REAL DEFAULT 0.0,
    verificado INTEGER DEFAULT 0,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ordens_servico (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER NOT NULL,
    prestador_id INTEGER,
    categoria TEXT NOT NULL,
    titulo TEXT NOT NULL,
    descricao TEXT NOT NULL,
    cep TEXT NOT NULL,
    endereco TEXT NOT NULL,
    urgencia TEXT CHECK(urgencia IN ('BAIXA', 'MEDIA', 'ALTA', 'EMERGENCIAL')) DEFAULT 'MEDIA',
    status TEXT CHECK(status IN (
        'PENDENTE',
        'PROPOSTA_RECEBIDA',
        'EM_CUSTODIA',
        'A_CAMINHO',
        'EM_EXECUCAO',
        'AGUARDANDO_VISTORIA',
        'CONCLUIDO',
        'EM_DISPUTA',
        'CANCELADO'
    )) DEFAULT 'PENDENTE',
    valor_mao_obra REAL DEFAULT 0.0,
    taxa_plataforma REAL DEFAULT 0.0,
    valor_total REAL DEFAULT 0.0,
    metodo_pagamento TEXT,
    foto_avaria TEXT,
    foto_conclusao TEXT,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cliente_id) REFERENCES usuarios(id),
    FOREIGN KEY (prestador_id) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS propostas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ordem_id INTEGER NOT NULL,
    prestador_id INTEGER NOT NULL,
    valor REAL NOT NULL,
    prazo_estimado TEXT NOT NULL,
    mensagem TEXT,
    status TEXT CHECK(status IN ('PENDENTE', 'ACEITA', 'RECUSADA')) DEFAULT 'PENDENTE',
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ordem_id) REFERENCES ordens_servico(id),
    FOREIGN KEY (prestador_id) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS transacoes_custodia (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ordem_id INTEGER NOT NULL,
    valor REAL NOT NULL,
    tipo TEXT CHECK(tipo IN ('BLOQUEIO_ESCROW', 'LIBERACAO_REPASSE', 'ESTORNO_DISPUTA')) NOT NULL,
    status TEXT DEFAULT 'CONFIRMADO',
    detalhes TEXT,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ordem_id) REFERENCES ordens_servico(id)
);

-- Tabela de Avaliações Mútuas (1:N com ordens_servico para suportar avaliação de Cliente -> Prestador e Prestador -> Cliente)
CREATE TABLE IF NOT EXISTS avaliacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ordem_id INTEGER NOT NULL,
    avaliador_id INTEGER NOT NULL,
    avaliado_id INTEGER NOT NULL,
    nota INTEGER CHECK(nota BETWEEN 1 AND 5) NOT NULL,
    comentario TEXT,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ordem_id) REFERENCES ordens_servico(id),
    FOREIGN KEY (avaliador_id) REFERENCES usuarios(id),
    FOREIGN KEY (avaliado_id) REFERENCES usuarios(id)
);

-- Tabela de Auditoria e Logs de Notificações (WhatsApp e E-mail)
CREATE TABLE IF NOT EXISTS notificacoes_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER,
    canal TEXT CHECK(canal IN ('WHATSAPP', 'EMAIL', 'PUSH')) NOT NULL,
    destinatario TEXT NOT NULL,
    assunto TEXT,
    mensagem TEXT NOT NULL,
    status TEXT DEFAULT 'ENVIADO',
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);
