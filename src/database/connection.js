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

  // Transações de custódia
  db.prepare(`
    INSERT INTO transacoes_custodia (ordem_id, valor, tipo, status, detalhes)
    VALUES (1, 320.0, 'BLOQUEIO_ESCROW', 'CONFIRMADO', 'Fundos retidos via PIX instantâneo aguardando vistoria')
  `).run();

  db.prepare(`
    INSERT INTO transacoes_custodia (ordem_id, valor, tipo, status, detalhes)
    VALUES (3, 270.0, 'BLOQUEIO_ESCROW', 'CONFIRMADO', 'Fundos retidos aguardando homologação de vistoria')
  `).run();

  // Proposta cadastrada para a OS 2
  db.prepare(`
    INSERT INTO propostas (ordem_id, prestador_id, valor, prazo_estimado, mensagem, status)
    VALUES (2, 3, 140.0, 'Hoje até 17h', 'Tenho o sifão novo e ferramentas adequadas para troca imediata.', 'PENDENTE')
  `).run();
}

module.exports = db;
