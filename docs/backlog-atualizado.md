# Product Backlog Atualizado (Versão 2.0) — FreeLA SaaS
**Critério de Avaliação C3 — Reunião de Acompanhamento (13/11)**  
**Projeto:** FreeLA (SaaS de Serviços Manuais com Custódia Protegida)  
**Disciplina:** Práticas Extensionistas Integradoras III — Engenharia de Software (UBM)  
**Equipe:** Vinicius Marcello Simoes, Kaique, Caio, Yago, Lucas Augusto, Lucas Gabriel  
**Docente:** Profa. Ma. Laila Alves Santos  
**Estado do Projeto:** MVP Funcional Entregue + Hardening de Segurança Concluído  

---

## 1. O que Mudou Desde a Entrega Anterior (Changelog 16/10 ➔ 13/11)

A entrega inicial do Product Backlog (realizada em 16/10 no AVA em formato `.xls`/`.pdf`) continha 13 itens teóricos derivados dos Casos de Uso (Aula 5) e do Diagrama de Componentes (Aula 7). 

Durante a execução da **Sprint 1 (Ciclo de Desenvolvimento do MVP)**, a equipe realizou a implementação real do software e conduziu uma auditoria rigorosa de segurança em 12/11. O backlog atualizado reflete as seguintes evoluções concretas:

### 🚀 1.1 Itens Implementados e Concluídos no MVP (Sprint 1 Entregue)
- **Item 1 (Solicitação de Serviço):** 100% implementado na interface web com validação e persistência na API (`POST /api/ordens`).
- **Item 2 (Mural e Propostas de Prestadores):** 100% funcional. Prestadores visualizam ordens filtradas e enviam orçamentos (`POST /api/ordens/:id/propostas`).
- **Item 3 (Item Habilitador — Módulo de Custódia / Escrow Engine):** Implementado no backend em `ordensController.js` e auditável na tabela `transacoes_custodia`.
- **Item 4 (Checkout com Retenção dos Fundos):** Implementado com cálculo de taxa de intermediação e cupom promocional `FREELA10` (`POST /api/ordens/:id/checkout`).
- **Item 5 (Avanço Operacional do Reparo):** Implementado com transição de status (`A_CAMINHO` ➔ `EM_EXECUCAO` ➔ `AGUARDANDO_VISTORIA`).
- **Item 6 (Vistoria e Repasse Financeiro):** 100% concluído. A aprovação da vistoria transfere automaticamente o saldo da custódia para a carteira disponível do profissional.
- **Item 7 (Requisito Não Funcional com Métrica):** Latência média das rotas abaixo de 50ms (muito inferior à meta de <= 2,0s) e testes de integração automatizados rodando em `tests/api.test.js`.
- **Item 8 (Abertura de Disputa / Contestação):** Implementado preventivamente na interface e na API (`POST /api/ordens/:id/disputa`).
- **Item 9 (Avaliação Mútua por Estrelas):** Implementado com nota de 1 a 5 e recálculo da reputação média do prestador.

### 🛡️ 1.2 Novos Itens de Segurança Adicionados ao Backlog (Pós-Auditoria de 12/11)
A partir da auditoria estática e dinâmica de vulnerabilidades, foram criados e imediatamente solucionados 3 novos itens técnicos essenciais:
- **Item 14 (Must):** *Hardening HTTP com Helmet* — Inclusão de cabeçalhos contra Clickjacking e MIME-sniffing, remoção do cabeçalho de tecnologia `X-Powered-By` e Content Security Policy (CSP).
- **Item 15 (Must):** *Prevenção Anti Double-Spending no Escrow* — Encapsulamento das alterações de saldo e status em transações atômicas ACID (`BEGIN TRANSACTION` e `COMMIT`).
- **Item 16 (Should):** *Proteção contra DoS e Força Bruta* — Middleware de Rate Limiting (teto de 200 req / 15 min por IP) e payload JSON limitado a 100 KB.

---

## 2. Painel de Acompanhamento Consolidado

| Indicador | Versão Anterior (16/10) | Versão Atual (13/11) | Status Atual |
| :--- | :---: | :---: | :---: |
| **Total de Itens** | 13 | **16** | +3 itens de segurança adicionados |
| **Itens Concluídos no MVP** | 0 | **11** | 68,7% do escopo total entregue e testado |
| **Itens Must** | 7 | **9** | Todos os 9 itens Must estão 100% concluídos |
| **Itens Habilitadores Técnicos** | 1 (Escrow) | **2 (Escrow + Hardening)** | Ambos concluídos e validados |
| **RNF com Métrica** | 1 (Latência) | **2 (Latência + Rate Limit)** | Ambos atendidos com evidência em código |

---

## 3. Tabela do Product Backlog Atualizado e Priorizado

| Nº | Item (História de Usuário / Habilitador) | Critério de Aceitação (Dado / Quando / Então) | MoSCoW | Valor × Esforço | Status Atual no Projeto |
| :-: | :--- | :--- | :-: | :-: | :---: |
| **1** | Como cliente, quero solicitar um reparo residencial informando categoria, descrição do problema, CEP e fotos, para receber orçamentos de profissionais locais. | **Dado** que preencho o formulário de solicitação com descrição e CEP, **quando** confirmo o envio, **então** a ordem é criada com status 'Pendente' no mural. | **Must** | Alto valor / Baixo esforço | ** CONCLUÍDO (MVP)** |
| **2** | Como prestador, quero visualizar as solicitações abertas e enviar propostas orçamentárias com valor e prazo, para fechar novos serviços. | **Dado** que acesso o mural com filtro de categoria, **quando** informo o valor da mão de obra e prazo, **então** minha proposta fica visível para o cliente. | **Must** | Alto valor / Baixo esforço | ** CONCLUÍDO (MVP)** |
| **3** | Configurar o Módulo de Custódia Financeira (Escrow) com registro em livro-razão (item habilitador), para garantir a retenção segura dos fundos pós-contratação. | **Dado** que um cliente contrata uma proposta, **quando** o pagamento é registrado, **então** o valor total é bloqueado na conta de custódia protegida. | **Must** | Alto valor / Alto esforço | ** CONCLUÍDO (MVP)** |
| **4** | Como cliente, quero pagar a ordem via PIX ou Cartão com retenção em custódia (escrow), garantindo que o dinheiro só seja repassado após a aprovação da vistoria. | **Dado** que escolhi a proposta, **quando** concluo o checkout, **então** a ordem avança para 'Em Custódia' e o saldo fica retido preventivamente. | **Must** | Alto valor / Médio esforço | ** CONCLUÍDO (MVP)** |
| **5** | Como prestador, quero atualizar o andamento do chamado (A caminho, Em execução e Concluído), para comprovar a realização do trabalho. | **Dado** que cheguei ao local e realizei o conserto, **quando** clico em 'Concluir Reparo', **então** o status avança para 'Aguardando Vistoria'. | **Must** | Alto valor / Baixo esforço | ** CONCLUÍDO (MVP)** |
| **6** | Como cliente, quero realizar a vistoria do reparo e aprovar a conclusão do serviço, para autorizar a liberação imediata do repasse financeiro ao prestador. | **Dado** que inspecionei o conserto, **quando** clico em 'Aprovar & Liberar', **então** o sistema transfere o saldo da custódia para a carteira disponível do prestador. | **Must** | Alto valor / Baixo esforço | ** CONCLUÍDO (MVP)** |
| **7** | Garantir alta performance, resiliência e conformidade transacional (RNF transversal com métrica), com tempo de resposta <= 2,0s e auditoria rastreável. | **Dado** a execução de requisições concorrentes na API, **quando** processadas, **então** 100% das respostas devem ocorrer em menos de 2,0 segundos sob auditoria completa. | **Must** | Alto valor / Alto esforço | ** CONCLUÍDO (MVP)** *(Média real: 28ms)* |
| **8** | Como cliente, quero registrar uma contestação e abrir disputa caso o reparo seja inconforme, para congelar o saldo da custódia e acionar mediação. | **Dado** que identifico inconformidades no reparo, **quando** clico em 'Abrir Disputa', **então** o status avança para 'Em Disputa' e o repasse é congelado. | **Should** | Alto valor / Médio esforço | ** CONCLUÍDO (MVP)** |
| **9** | Como cliente, quero avaliar o prestador atribuindo nota de 1 a 5 estrelas e comentários, para contribuir com a reputação pública da comunidade. | **Dado** que a vistoria foi aprovada, **quando** envio minha nota e parecer, **então** a média de reputação do prestador é recalculada e atualizada. | **Should** | Médio valor / Baixo esforço | ** CONCLUÍDO (MVP)** |
| **14** | Implementar Hardening HTTP e cabeçalhos de segurança (item habilitador de segurança), para prevenir Clickjacking, MIME-sniffing e ataques XSS. | **Dado** qualquer resposta HTTP do servidor, **quando** inspecionada, **então** deve conter os cabeçalhos do Helmet (`nosniff`, `SAMEORIGIN`, CSP) e omitir `X-Powered-By`. | **Must** | Alto valor / Médio esforço | ** CONCLUÍDO (MVP)** *(Adicionado pós-auditoria)* |
| **15** | Implementar transações atômicas ACID no checkout e vistoria (item habilitador de segurança), para eliminar risco de Double-Spending financeiro. | **Dado** requisições simultâneas de pagamento na mesma ordem, **quando** submetidas, **então** apenas uma é confirmada com sucesso e as demais são rejeitadas. | **Must** | Alto valor / Médio esforço | ** CONCLUÍDO (MVP)** *(Adicionado pós-auditoria)* |
| **16** | Implementar Rate Limiting e limitação de payload (RNF com métrica), para mitigar ataques de DoS por sobrecarga de requisições. | **Dado** mais de 200 requisições do mesmo IP em 15 minutos ou payloads > 100 KB, **quando** enviadas, **então** o servidor deve bloquear o acesso com `HTTP 429`. | **Should** | Médio valor / Baixo esforço | ** CONCLUÍDO (MVP)** *(Adicionado pós-auditoria)* |
| **10** | Como prestador, quero gerenciar meu catálogo de especialidades e solicitar transferências bancárias para resgate do saldo disponível. | **Dado** que possuo saldo liberado em carteira, **quando** solicito saque PIX, **então** a transferência é processada para minha conta bancária cadastrada. | **Should** | Médio valor / Médio esforço | **Sprint 2 (Dezembro)** |
| **11** | Como novo usuário, quero realizar meu cadastro com upload de documentos com foto, para obtenção do selo de 'Perfil Verificado'. | **Dado** que envio meu documento e comprovante, **quando** validados, **então** minha conta recebe a chancela de perfil verificado e seguro. | **Should** | Médio valor / Médio esforço | **Sprint 2 (Dezembro)** |
| **12** | Como administrador, quero gerenciar regras de cupons promocionais dinâmicos para campanhas sazonais de desconto na taxa da plataforma. | **Dado** que cadastro um novo código no painel administrativo, **quando** aplicado no checkout, **então** o abatimento proporcional é concedido. | **Could** | Baixo valor / Baixo esforço | **Sprint 2 (Dezembro)** *(No MVP: cupom fixo FREELA10 ativo)* |
| **13** | Como usuário, quero receber notificações instantâneas no WhatsApp sobre alterações no status do meu chamado ou proposta aceita. | **Dado** a alteração de status de uma OS, **quando** o evento é gerado, **então** uma mensagem via API do WhatsApp é disparada para o telefone cadastrado. | **Could** | Baixo valor / Médio esforço | **Sprint 2 (Dezembro)** |

---

## 4. Rastreabilidade com a Suíte de Testes Automatizados

O estado de conclusão dos itens 1 a 9, 14, 15 e 16 é comprovado pela execução automatizada em `tests/api.test.js`:
- `Teste 1`: Validação de estatísticas consolidadas (Item 7).
- `Teste 2`: Validação ativa de cabeçalhos de segurança Helmet (Item 14).
- `Teste 3 e 4`: Criação e sanitização anti-XSS de chamados (Item 1).
- `Teste 5 e 6`: Validação e envio de propostas (Item 2).
- `Teste 7 e 8`: Retenção em custódia e **bloqueio de pagamento duplo / Anti Double-Spending** (Itens 3, 4 e 15).
- `Teste 9`: Atualização de status da execução (Item 5).
- `Teste 10`: Vistoria aprovada, liquidação do repasse e avaliação por estrelas (Itens 6 e 9).
