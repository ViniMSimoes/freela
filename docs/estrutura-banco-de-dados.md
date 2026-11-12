# Estrutura do Banco de Dados — FreeLA SaaS
**Critério de Avaliação C4 — Reunião de Acompanhamento (13/11)**  
**Projeto:** FreeLA (SaaS de Contratação e Gestão de Serviços Manuais com Custódia Protegida)  
**Disciplina:** Práticas Extensionistas Integradoras III — Engenharia de Software (UBM)  
**Equipe:** Vinicius Marcello Simoes, Kaique, Caio, Yago, Lucas Augusto, Lucas Gabriel  
**Docente:** Profa. Ma. Laila Alves Santos  

---

## 1. Visão Geral da Arquitetura de Dados

A persistência do **FreeLA** no estágio MVP é provida por um banco de dados relacional **SQLite 3** embutido (`freela.db`), gerenciado nativamente pelo módulo `node:sqlite` do runtime Node.js 24 LTS.

A modelagem foi concebida para atender rigorosamente a todos os casos de uso modelados na Aula 5, ao fluxo de liquidação financeira e custódia do BPMN (Aula 6) e aos componentes desacoplados da Aula 7. O banco implementa integridade referencial com chaves primárias autoincrementais, chaves estrangeiras (`FOREIGN KEY`), restrições de verificação (`CHECK constraints`) para garantia de tipos enumerados e campos com controle temporal automático (`CURRENT_TIMESTAMP`).

---

## 2. Diagrama Entidade-Relacionamento (DER / MER)

O diagrama abaixo representa a estrutura lógica relacional implementada e suas cardinalidades:

![Diagrama Entidade-Relacionamento do FreeLA](img/diagrama_der.png)

---

## 3. Dicionário de Dados e Tabelas Implementadas

### 3.1 Tabela `usuarios`
Armazena todos os atores do sistema (clientes consumidores e prestadores autônomos de serviços). Modela a herança da classe abstrata `Usuario` do Diagrama de Classes.

| Campo | Tipo | Nulo? | Chave | Descrição & Regras de Validação |
| :--- | :--- | :---: | :---: | :--- |
| `id` | `INTEGER` | Não | **PK** | Identificador único autoincremental do usuário |
| `nome` | `TEXT` | Não | — | Nome completo do usuário |
| `email` | `TEXT` | Não | **UNIQUE** | Endereço de e-mail único para login e notificações |
| `papel` | `TEXT` | Não | — | Perfil no sistema: `CHECK(papel IN ('CLIENTE', 'PRESTADOR', 'ADMIN'))` |
| `telefone` | `TEXT` | Sim | — | Telefone/WhatsApp para contato operacional |
| `especialidade` | `TEXT` | Sim | — | Categoria de atuação do prestador (ex.: Elétrica, Pintura) |
| `reputacao` | `REAL` | Sim | — | Média ponderada de avaliações (1.0 a 5.0). Padrão: `5.0` |
| `saldo_disponivel` | `REAL` | Não | — | Saldo liberado para saque pós-aprovação de vistoria. Padrão: `0.0` |
| `saldo_custodia` | `REAL` | Não | — | Saldo retido em garantia (Escrow) aguardando vistoria. Padrão: `0.0` |
| `verificado` | `INTEGER` | Não | — | Indicador de validação documental (0 = Não, 1 = Sim). Padrão: `1` |
| `criado_em` | `DATETIME`| Não | — | Data e hora de cadastro no sistema |

---

### 3.2 Tabela `ordens_servico`
Entidade central do negócio. Controla o ciclo de vida da demanda residencial, localização geográfica, precificação e o estado da máquina de custódia.

| Campo | Tipo | Nulo? | Chave | Descrição & Regras de Validação |
| :--- | :--- | :---: | :---: | :--- |
| `id` | `INTEGER` | Não | **PK** | Número identificador único da Ordem de Serviço (OS) |
| `cliente_id` | `INTEGER` | Não | **FK** | Referência ao usuário contratante (`usuarios.id`) |
| `prestador_id` | `INTEGER` | Sim | **FK** | Referência ao prestador contratado (`usuarios.id`). Nulo na triagem inicial |
| `categoria` | `TEXT` | Não | — | Especialidade (`Elétrica`, `Hidráulica`, `Pintura`, `Alvenaria`, `Climatização`) |
| `titulo` | `TEXT` | Não | — | Título resumido da necessidade (ex.: "Troca de Disjuntor Geral") |
| `descricao` | `TEXT` | Não | — | Relato técnico detalhado do defeito ou reparo |
| `cep` | `TEXT` | Não | — | CEP do local da residência para cálculo de proximidade |
| `endereco` | `TEXT` | Não | — | Endereço completo (Rua, número, complemento e bairro) |
| `urgencia` | `TEXT` | Não | — | `CHECK(urgencia IN ('BAIXA', 'MEDIA', 'ALTA', 'EMERGENCIAL'))` |
| `status` | `TEXT` | Não | — | Máquina de estados: `PENDENTE`, `PROPOSTA_RECEBIDA`, `EM_CUSTODIA`, `A_CAMINHO`, `EM_EXECUCAO`, `AGUARDANDO_VISTORIA`, `CONCLUIDO`, `EM_DISPUTA`, `CANCELADO` |
| `valor_mao_obra` | `REAL` | Não | — | Valor líquido acordado para a remuneração do prestador |
| `taxa_plataforma`| `REAL` | Não | — | Taxa de intermediação e garantia da plataforma FreeLA |
| `valor_total` | `REAL` | Não | — | Montante total pago pelo cliente e retido na conta de custódia |
| `metodo_pagamento`| `TEXT` | Sim | — | Método de pagamento (`PIX` ou `CARTAO_CREDITO`) |
| `foto_avaria` | `TEXT` | Sim | — | URL ou caminho de imagem do problema reportado pelo cliente |
| `foto_conclusao` | `TEXT` | Sim | — | URL ou caminho de imagem do reparo finalizado enviada pelo prestador |
| `criado_em` | `DATETIME`| Não | — | Carimbo de data/hora de abertura da OS |
| `atualizado_em` | `DATETIME`| Não | — | Carimbo de data/hora da última alteração de status |

---

### 3.3 Tabela `propostas`
Armazena os orçamentos enviados por prestadores autônomos concorrentes para uma determinada ordem de serviço.

| Campo | Tipo | Nulo? | Chave | Descrição & Regras de Validação |
| :--- | :--- | :---: | :---: | :--- |
| `id` | `INTEGER` | Não | **PK** | Identificador único da proposta |
| `ordem_id` | `INTEGER` | Não | **FK** | Referência à ordem de serviço (`ordens_servico.id`) |
| `prestador_id` | `INTEGER` | Não | **FK** | Referência ao profissional proponente (`usuarios.id`) |
| `valor` | `REAL` | Não | — | Valor proposto para a execução da mão de obra (R$) |
| `prazo_estimado` | `TEXT` | Não | — | Estimativa de conclusão informada pelo prestador |
| `mensagem` | `TEXT` | Sim | — | Justificativa técnica, detalhes de ferramentas ou observações |
| `status` | `TEXT` | Não | — | `CHECK(status IN ('PENDENTE', 'ACEITA', 'RECUSADA'))`. Padrão: `PENDENTE` |
| `criado_em` | `DATETIME`| Não | — | Data e hora do envio do orçamento |

---

### 3.4 Tabela `transacoes_custodia` (Módulo Escrow)
Livro-razão financeiro auditável que registra todas as movimentações de retenção, repasse pós-vistoria e congelamento por disputa.

| Campo | Tipo | Nulo? | Chave | Descrição & Regras de Validação |
| :--- | :--- | :---: | :---: | :--- |
| `id` | `INTEGER` | Não | **PK** | Identificador sequencial da transação |
| `ordem_id` | `INTEGER` | Não | **FK** | Referência à ordem vinculada (`ordens_servico.id`) |
| `valor` | `REAL` | Não | — | Quantia movimentada na operação |
| `tipo` | `TEXT` | Não | — | `CHECK(tipo IN ('BLOQUEIO_ESCROW', 'LIBERACAO_REPASSE', 'ESTORNO_DISPUTA'))` |
| `status` | `TEXT` | Não | — | Estado da transação bancária (`CONFIRMADO`, `EM_ANALISE`) |
| `detalhes` | `TEXT` | Sim | — | Histórico descritivo da movimentação financeira para auditoria |
| `criado_em` | `DATETIME`| Não | — | Carimbo de data/hora da transação |

---

### 3.5 Tabela `avaliacoes`
Registra a avaliação de satisfação e reputação mútua após o término da ordem de serviço.

| Campo | Tipo | Nulo? | Chave | Descrição & Regras de Validação |
| :--- | :--- | :---: | :---: | :--- |
| `id` | `INTEGER` | Não | **PK** | Identificador da avaliação |
| `ordem_id` | `INTEGER` | Não | **FK** | Referência à ordem finalizada (`ordens_servico.id`) |
| `avaliador_id` | `INTEGER` | Não | **FK** | Usuário que emitiu a nota (`usuarios.id`) |
| `avaliado_id` | `INTEGER` | Não | **FK** | Profissional avaliado (`usuarios.id`) |
| `nota` | `INTEGER` | Não | — | Pontuação numérica de 1 a 5 estrelas: `CHECK(nota BETWEEN 1 AND 5)` |
| `comentario` | `TEXT` | Sim | — | Feedback textual qualitativo |
| `criado_em` | `DATETIME`| Não | — | Carimbo de data/hora do registro |

---

## 4. Relacionamentos e Integridade Referencial

1. **`usuarios` ➔ `ordens_servico` (1:N):**
   - Um cliente pode emitir múltiplas ordens de serviço (`ordens_servico.cliente_id`).
   - Um prestador pode assumir múltiplas ordens (`ordens_servico.prestador_id`), preenchido no momento do checkout.

2. **`ordens_servico` ➔ `propostas` (1:N):**
   - Uma ordem de serviço aberta pode receber propostas orçamentárias de diversos profissionais.
   - Quando uma proposta é aceita no checkout, seu status avança para `ACEITA` e as propostas concorrentes da mesma OS são automaticamente atualizadas para `RECUSADA`.

3. **`ordens_servico` ➔ `transacoes_custodia` (1:N):**
   - Rastreabilidade total: o ciclo de vida gera transações encadeadas (1º Bloqueio de Custódia na contratação; 2º Liberação de Repasse na aprovação da vistoria ou Estorno em disputa).

4. **`ordens_servico` ➔ `avaliacoes` (1:1):**
   - Cada ordem concluída dá direito a um registro formal de avaliação com recálculo automático da média do profissional.

---

## 5. Coerência com os Diagramas do Projeto

* **Diagrama de Classes (Aula 5):**
  - A classe abstrata `Usuario` e suas especializações (`Cliente` e `Prestador`) foram unificadas na tabela `usuarios` com discriminação de papel via campo `papel`, preservando os métodos e atributos de saldo e avaliação.
  - O ciclo de vida exclusivo de Composição (`OrdemServico` *-- `Pagamento` e `ItemServico`) é garantido através do relacionamento estrito com `transacoes_custodia`.
* **Diagrama BPMN 2.0 (Aula 6):**
  - As 4 raias operacionais (*Cliente, Plataforma, Prestador, Gateway*) refletem-se diretamente nos campos e nas transições de status da tabela `ordens_servico` (`PENDENTE` ➔ `PROPOSTA_RECEBIDA` ➔ `EM_CUSTODIA` ➔ `EM_EXECUCAO` ➔ `AGUARDANDO_VISTORIA` ➔ `CONCLUIDO`).
* **Diagrama de Componentes (Aula 7):**
  - O componente de persistência é concretizado pelo arquivo `src/database/schema.sql` e gerenciado pelo adaptador `src/database/connection.js`.

---

## 6. Decisões Técnicas e Evolução de Arquitetura

1. **Garantia ACID no MVP com SQLite Embutido:**
   O uso de transações explícitas (`BEGIN TRANSACTION` e `COMMIT` / `ROLLBACK`) em operações críticas — como o checkout de custódia e a liberação de repasse — garante atomicidade absoluta, impedindo estados parciais e problemas de concorrência financeira (*double-spending*).
2. **Estratégia de Migração para Produção:**
   Por utilizar tipos e sintaxe SQL padrão ANSI (`CREATE TABLE`, `CHECK`, `FOREIGN KEY`), a migração futura para um banco de produção escalável (como PostgreSQL 16) exigirá apenas a substituição da string de conexão e do driver de banco, sem alteração nas regras de negócio da API.
