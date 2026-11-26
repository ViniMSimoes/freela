require('dotenv').config();
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

// Carrega caminho do banco definido no .env ou fallback para freela.db
const rawDbPath = process.env.DB_PATH || './freela.db';
const dbPath = path.isAbsolute(rawDbPath)
  ? rawDbPath
  : path.resolve(process.cwd(), rawDbPath);

const db = new DatabaseSync(dbPath);

// Ativa obrigatoriamente a verificação de chaves estrangeiras no SQLite
db.exec('PRAGMA foreign_keys = ON;');

// Inicializa tabelas
const schemaPath = path.resolve(__dirname, 'schema.sql');
const schemaSql = fs.readFileSync(schemaPath, 'utf8');
db.exec(schemaSql);

// Migração segura de colunas adicionadas na Sprint 2 (compatível com bancos já existentes)
const userCols = db.prepare('PRAGMA table_info(usuarios)').all().map(c => c.name);
if (!userCols.includes('senha_hash')) {
  db.exec('ALTER TABLE usuarios ADD COLUMN senha_hash TEXT;');
}
if (!userCols.includes('documento_url')) {
  db.exec('ALTER TABLE usuarios ADD COLUMN documento_url TEXT;');
}

// Inserir dados iniciais caso o banco esteja novo
const countUsers = db.prepare('SELECT COUNT(*) as total FROM usuarios').get().total;

if (countUsers === 0) {
  // Inserir usuários padrão (verificado = 1 para prestadores homologados pela equipe)
  const insertUser = db.prepare(`
    INSERT INTO usuarios (nome, email, papel, telefone, especialidade, reputacao, saldo_disponivel, saldo_custodia, verificado)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertUser.run('Maria Santos', 'maria.cliente@email.com', 'CLIENTE', '(24) 98811-2233', null, 5.0, 1500.0, 0.0, 1);
  insertUser.run('Carlos Silva (Eletricista)', 'carlos.eletrica@email.com', 'PRESTADOR', '(24) 99922-3344', 'Elétrica Residencial', 4.9, 850.0, 320.0, 1);
  insertUser.run('Roberto Souza (Encanador)', 'roberto.hidraulica@email.com', 'PRESTADOR', '(24) 98133-4455', 'Hidráulica e Desentupimento', 4.8, 1200.0, 0.0, 1);
  insertUser.run('Administrador FreeLA', 'admin@freela.com.br', 'ADMIN', '(24) 98888-0000', 'Gestão & Mediação', 5.0, 0.0, 0.0, 1);

  // Inserir ordens de serviço exemplo
  const insertOS = db.prepare(`
    INSERT INTO ordens_servico (
      cliente_id, prestador_id, categoria, titulo, descricao, cep, endereco, urgencia, status, valor_mao_obra, taxa_plataforma, valor_total, metodo_pagamento, foto_avaria
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // OS 1: Em execução com custódia ativa
  insertOS.run(
    1, 2, 'Elétrica', 'Troca de Disjuntor Geral e Fiação',
    'Disjuntor central desarmando com frequência após ligar o chuveiro elétrico.',
    '27253-000', 'Rua 16, nº 142 - Vila Santa Cecília, Volta Redonda/RJ',
    'ALTA', 'EM_EXECUCAO', 300.0, 20.0, 320.0, 'PIX',
    'https://images.unsplash.com/photo-1581092160607-ee22621dd758'
  );

  // OS 2: Aguardando propostas
  insertOS.run(
    1, null, 'Hidráulica', 'Vazamento sob a Pia da Cozinha',
    'Cano sifão com rachadura provocando gotejamento constante no armário.',
    '27260-100', 'Av. Paulo de Frontin, nº 580 - Aterrado, Volta Redonda/RJ',
    'MEDIA', 'PENDENTE', 0.0, 0.0, 0.0, null,
    'https://images.unsplash.com/photo-1584622650111-993a426fbf0a'
  );

  // OS 3: Concluída aguardando vistoria
  insertOS.run(
    1, 3, 'Hidráulica', 'Instalação de Válvula de Retenção de Esgoto',
    'Instalação de válvula de segurança contra refluxo no quintal.',
    '27255-010', 'Rua 33, nº 88 - Vila Santa Cecília, Volta Redonda/RJ',
    'MEDIA', 'AGUARDANDO_VISTORIA', 250.0, 20.0, 270.0, 'CARTAO_CREDITO',
    'https://images.unsplash.com/photo-1542013936693-884638332954'
  );

  // OS 4: Concluída e liquidada com sucesso
  insertOS.run(
    1, 2, 'Climatização', 'Higienização e Carga de Gás Ar Split 12.000 BTUs',
    'Aparelho do quarto perdendo rendimento térmico e gotejando pela bandeja interna.',
    '27253-120', 'Rua 40, nº 310 - Vila Santa Cecília, Volta Redonda/RJ',
    'BAIXA', 'CONCLUIDO', 240.0, 19.2, 259.2, 'PIX',
    null
  );

  // Transações de custódia
  db.prepare(`
    INSERT INTO transacoes_custodia (ordem_id, valor, tipo, status, detalhes)
    VALUES (1, 320.0, 'BLOQUEIO_ESCROW', 'CONFIRMADO', 'Fundos retidos via PIX instantâneo aguardando vistoria')
  `).run();

  db.prepare(`
    INSERT INTO transacoes_custodia (ordem_id, valor, tipo, status, detalhes)
    VALUES (3, 270.0, 'BLOQUEIO_ESCROW', 'CONFIRMADO', 'Fundos retidos aguardando homologação de vistoria')
  `).run();

  db.prepare(`
    INSERT INTO transacoes_custodia (ordem_id, valor, tipo, status, detalhes)
    VALUES (4, 259.2, 'BLOQUEIO_ESCROW', 'CONFIRMADO', 'Fundos retidos via PIX na contratação da OS #4')
  `).run();

  db.prepare(`
    INSERT INTO transacoes_custodia (ordem_id, valor, tipo, status, detalhes)
    VALUES (4, 240.0, 'LIBERACAO_REPASSE', 'CONFIRMADO', 'Vistoria presencial homologada pelo cliente titular. Repasse liquidado.')
  `).run();

  // Avaliações mútuas iniciais na OS 4
  db.prepare(`
    INSERT INTO avaliacoes (ordem_id, avaliador_id, avaliado_id, nota, comentario)
    VALUES (4, 1, 2, 5, 'Atendimento pontual, equipamento voltou a gelar perfeitamente e ambiente limpo.')
  `).run();

  db.prepare(`
    INSERT INTO avaliacoes (ordem_id, avaliador_id, avaliado_id, nota, comentario)
    VALUES (4, 2, 1, 5, 'Cliente cordial, acesso livre ao equipamento e vistoria realizada na hora.')
  `).run();

  // Logs iniciais de mensageria
  const insNotif = db.prepare(`
    INSERT INTO notificacoes_log (usuario_id, canal, destinatario, assunto, mensagem, status)
    VALUES (?, ?, ?, ?, ?, 'ENVIADO')
  `);
  insNotif.run(1, 'WHATSAPP', '(24) 98811-2233', null, 'Pagamento confirmado para OS #1! R$ 320,00 retidos com segurança no FreeLA Escrow.');
  insNotif.run(1, 'EMAIL', 'maria.cliente@email.com', 'Vistoria Pendente — OS #3', 'O reparo hidráulico da OS #3 aguarda sua vistoria presencial para liberação do repasse.');
  insNotif.run(2, 'WHATSAPP', '(24) 99922-3344', null, 'Repasse de R$ 240,00 liberado na sua carteira digital referente à OS #4.');

  // Proposta cadastrada para a OS 2
  db.prepare(`
    INSERT INTO propostas (ordem_id, prestador_id, valor, prazo_estimado, mensagem, status)
    VALUES (2, 3, 140.0, 'Hoje até 17h', 'Tenho o sifão novo e ferramentas adequadas para troca imediata.', 'PENDENTE')
  `).run();
}

// Seed de Cupons Dinâmicos (Item 12)
const countCupons = db.prepare('SELECT COUNT(*) as total FROM cupons').get().total;
if (countCupons === 0) {
  const insertCupom = db.prepare('INSERT INTO cupons (codigo, desconto_percentual, ativo) VALUES (?, ?, ?)');
  insertCupom.run('FREELA10', 50, 1);
  insertCupom.run('BEMVINDO20', 20, 1);
}

// Seed de Portfólio de Prestadores (Item 10B)
const countPortfolio = db.prepare('SELECT COUNT(*) as total FROM portfolio_itens').get().total;
if (countPortfolio === 0) {
  const insertPort = db.prepare('INSERT INTO portfolio_itens (prestador_id, titulo, categoria, descricao, foto_url) VALUES (?, ?, ?, ?, ?)');
  insertPort.run(2, 'Reforma de Quadro Trifásico Residencial', 'Elétrica', 'Substituição completa de barramento, disjuntores DIN e aterramento NBR 5410.', 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e');
  insertPort.run(3, 'Instalação Hidráulica Completa Cozinha', 'Hidráulica', 'Tubulação PEX, registros de gaveta e válvulas anti-refluxo com teste de pressão.', 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7');
}

module.exports = db;
