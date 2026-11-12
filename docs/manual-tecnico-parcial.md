# Manual Técnico Parcial — FreeLA

Versão: 1.0 · Data: 12/11/2026 · Repositório: https://github.com/ViniMSimoes/freela

## 1. Público-alvo e tarefas

Este manual se destina a: desenvolvedores e engenheiros de software que assumirão a manutenção evolutiva, testes e sustentação da plataforma FreeLA nos próximos ciclos acadêmicos ou profissionais.

Ao final da leitura, essa pessoa deve conseguir:

- Compreender a arquitetura básica em 3 camadas, a máquina de estados de serviços e a responsabilidade de cada componente no fluxo de custódia financeira protegida (resolvido na seção 2).
- Integrar novas telas ou serviços externos à API RESTful, consumindo as rotas de solicitação, orçamentação, bloqueio em escrow, avanço de status e liberação pós-vistoria de acordo com seus contratos (resolvido na seção 3).

## 2. Arquitetura Básica

### Visão geral

O sistema FreeLA foi projetado seguindo uma arquitetura em três camadas desacopladas (Apresentação, Serviços/Negócio e Persistência), priorizando simplicidade operacional, alta coesão e zero atrito de instalação. A camada de apresentação é uma Single Page Application (SPA) que interage exclusivamente com a API RESTful construída em Node.js com Express. Todas as regras de negócio críticas — especialmente a máquina de estados das Ordens de Serviço e o bloqueio e liquidação de fundos no motor de custódia financeira (Escrow Engine) — residem no backend, garantindo atomicidade e rastreabilidade transacional no banco de dados SQLite.

### Componentes e responsabilidades

| Componente | Responsabilidade | Tecnologia | Pasta no repositório |
|---|---|---|---|
| Interface Web (SPA) | Apresentar telas de solicitação (wizard), murais com filtros, checkout com custódia e modal de vistoria pós-obra | HTML5, CSS3 Neutro, JavaScript W3C | `public/` |
| API Gateway & Roteador | Centralizar o roteamento das requisições HTTP, validação de cabeçalhos CORS e formato JSON | Node.js 24.18.0 / Express 4.21.2 | `src/routes/api.js` |
| Controlador de Ordens e Negócio | Orquestrar o ciclo de vida das ordens de serviço, gerenciar propostas e disparar eventos da máquina de estados | JavaScript ES6+ | `src/controllers/ordensController.js` |
| Motor de Custódia (Escrow Engine) | Executar o bloqueio financeiro no checkout e a liquidação ou estorno dos valores apenas após validação de vistoria | Lógica Transacional Integrada | `src/controllers/ordensController.js` |
| Camada de Persistência (Database) | Conexão, execução de schema e migrações/seed com garantia ACID (detalhado em [docs/estrutura-banco-de-dados.md](estrutura-banco-de-dados.md)) | SQLite 3 (`node:sqlite` nativo) | `src/database/` |
| Suíte de Testes Automatizados | Validar os fluxos ponta a ponta da API REST de ponta a ponta sem dependências externas | Script de Teste / Node.js Assert | `tests/api.test.js` |

### Diagrama

O diagrama de componentes abaixo ilustra as fronteiras de responsabilidade, a comunicação interna e as interfaces expostas pelo sistema FreeLA:

![Diagrama de componentes](img/diagrama_componentes.png)

### Decisões técnicas

1. **Uso de SQLite Embutido via `node:sqlite` (Node.js 24 LTS):**
   Optou-se por utilizar o módulo nativo `node:sqlite` incluído no runtime do Node.js moderno. Essa decisão elimina a necessidade de compilação de binários nativos no ambiente do desenvolvedor (evitando erros frequentes com `node-gyp` ou Python build tools) e dispensa a instalação e configuração de servidores de banco de dados externos (como PostgreSQL ou MySQL) durante a fase de prototipagem e validação do MVP, mantendo integridade relacional e transações ACID completas.

2. **Isolamento da Lógica de Custódia (Escrow) na Camada de Negócio:**
   Para garantir que nenhum valor financeiro seja transferido sem a devida vistoria, a liberação de fundos não é tratada como um simples atributo booleano no frontend. O backend implementa uma máquina de estados estrita: uma ordem só permite transição para `CONCLUIDO` se estiver com status prévio `AGUARDANDO_VISTORIA`. O saldo da carteira do prestador é mantido em uma coluna separada (`saldo_custodia`) e apenas promovido a `saldo_disponivel` no momento da confirmação atômica da vistoria pelo cliente.

3. **Frontend Desacoplado em JavaScript Vanilla e Paleta Neutra:**
   A interface gráfica foi construída sem frameworks pesados de frontend (como React ou Angular) para reduzir a complexidade de empacotamento (`webpack`, `vite`, `node_modules` gigantes) e garantir que qualquer colaborador execute o projeto em segundos diretamente pelo Express. O design system segue rigorosamente uma paleta clean em escala de Slate/Cinza e alto contraste, sem cores berrantes, priorizando usabilidade e clareza nas tomadas de decisão de pagamento e vistoria.

## 3. Referência da API

### Visão geral

Esta referência cobre todos os endpoints públicos da API REST do FreeLA para o ciclo de vida de ordens, propostas, retenção de custódia e vistorias. Todas as requisições que enviam dados utilizam o cabeçalho `Content-Type: application/json`. As respostas são sempre retornadas em formato JSON com a estrutura `{ sucesso: boolean, dados?: any, mensagem?: string }`.

Endereço base local: **`http://localhost:3000/api`**

---

#### GET /ordens

Lista todas as ordens de serviço cadastradas, com suporte a filtros opcionais por status e categoria.

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `status` | texto | Não | Filtra pelo status atual da ordem (ex.: `PENDENTE`, `EM_CUSTODIA`, `AGUARDANDO_VISTORIA`) |
| `categoria` | texto | Não | Filtra por especialidade (`Elétrica`, `Hidráulica`, `Pintura`, `Alvenaria`, `Climatização`) |
| `cliente_id` | inteiro | Não | Filtra ordens pertencentes a um cliente específico |
| `prestador_id` | inteiro | Não | Filtra ordens vinculadas a um determinado prestador |

Resposta de sucesso: `200 OK`

```json
{
  "sucesso": true,
  "total": 3,
  "dados": [
    {
      "id": 1,
      "cliente_id": 1,
      "prestador_id": 2,
      "categoria": "Elétrica",
      "titulo": "Troca de Disjuntor Geral e Fiação",
      "descricao": "Disjuntor central desarmando com frequência após ligar o chuveiro elétrico.",
      "cep": "27253-000",
      "endereco": "Rua 16, nº 142 - Volta Redonda/RJ",
      "urgencia": "ALTA",
      "status": "EM_EXECUCAO",
      "valor_total": 320.0,
      "cliente_nome": "Maria Santos",
      "prestador_nome": "Carlos Silva (Eletricista)"
    }
  ]
}
```

Erros possíveis: `500 Internal Server Error` em falhas inesperadas no banco de dados.

---

#### POST /ordens

Cadastra uma nova demanda de reparo residencial solicitada por um cliente.

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `cliente_id` | inteiro | Sim | Identificador do usuário cliente solicitante |
| `categoria` | texto | Sim | Categoria do serviço (`Elétrica`, `Hidráulica`, etc.) |
| `titulo` | texto | Sim | Título curto resumindo o problema |
| `descricao` | texto | Sim | Detalhamento do reparo necessário |
| `cep` | texto | Sim | CEP do local do atendimento |
| `endereco` | texto | Sim | Logradouro, número, complemento e bairro |
| `urgencia` | texto | Não | Nível de urgência (`BAIXA`, `MEDIA`, `ALTA`, `EMERGENCIAL`). Padrão: `MEDIA` |

Exemplo de requisição:

```json
{
  "cliente_id": 1,
  "categoria": "Pintura",
  "titulo": "Pintura de Fachada Residencial",
  "descricao": "Aplicação de tinta acrílica lavável na parede externa com impermeabilizante.",
  "cep": "27255-000",
  "endereco": "Rua 21, nº 45 - Volta Redonda/RJ",
  "urgencia": "MEDIA"
}
```

Resposta de sucesso: `201 Created`

```json
{
  "sucesso": true,
  "mensagem": "Solicitação de reparo criada com sucesso.",
  "dados": {
    "id": 4,
    "cliente_id": 1,
    "status": "PENDENTE",
    "titulo": "Pintura de Fachada Residencial",
    "criado_em": "2026-11-12 12:30:00"
  }
}
```

Erros possíveis: `400 Bad Request` se campos obrigatórios estiverem ausentes.

---

#### GET /ordens/:id

Retorna os detalhes completos de uma ordem de serviço, incluindo seu histórico de propostas, transações financeiras de custódia e avaliação.

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | inteiro (URL) | Sim | Identificador numérico da ordem de serviço |

Resposta de sucesso: `200 OK` contendo o objeto da ordem, array `propostas`, array `transacoes` e objeto `avaliacao`.

Erros possíveis: `404 Not Found` caso o ID informado não exista no banco.

---

#### POST /ordens/:id/propostas

Registra o envio de uma proposta orçamentária por um prestador de serviços autônomo.

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `prestador_id` | inteiro | Sim | ID do profissional autor da proposta |
| `valor` | decimal | Sim | Valor cobrado pela mão de obra em Reais (R$) |
| `prazo_estimado` | texto | Sim | Previsão de início ou tempo de execução |
| `mensagem` | texto | Não | Explicações técnicas ou detalhes sobre os materiais |

Exemplo de requisição:

```json
{
  "prestador_id": 2,
  "valor": 180.00,
  "prazo_estimado": "Amanhã às 14h",
  "mensagem": "Possuo as ferramentas necessárias e vedantes de primeira linha inclusos."
}
```

Resposta de sucesso: `201 Created`

```json
{
  "sucesso": true,
  "mensagem": "Proposta de orçamento enviada com sucesso.",
  "proposta_id": 3
}
```

Erros possíveis: `400 Bad Request` se a ordem já estiver em custódia ou concluída; `404 Not Found` se a ordem não existir.

---

#### POST /ordens/:id/checkout

Efetua a contratação formal da proposta pelo cliente e realiza a retenção dos valores na conta de custódia protegida (Escrow).

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `proposta_id` | inteiro | Sim | ID da proposta aceita pelo cliente |
| `metodo_pagamento`| texto | Não | Método utilizado (`PIX`, `CARTAO_CREDITO`). Padrão: `PIX` |
| `cupom` | texto | Não | Código promocional de desconto na taxa (ex.: `FREELA10`) |

Exemplo de requisição:

```json
{
  "proposta_id": 3,
  "metodo_pagamento": "PIX",
  "cupom": "FREELA10"
}
```

Resposta de sucesso: `200 OK`

```json
{
  "sucesso": true,
  "mensagem": "Pagamento processado com sucesso! Os fundos estão retidos em custódia segura.",
  "dados": {
    "ordem_id": "2",
    "status": "EM_CUSTODIA",
    "valor_mao_obra": 180.0,
    "taxa_plataforma": 15.0,
    "valor_total": 195.0,
    "prestador_id": 2
  }
}
```

Erros possíveis: `400 Bad Request` se a proposta não pertencer à ordem ou não existir; `404 Not Found` se a ordem não existir.

---

#### PATCH /ordens/:id/status

Atualiza o status de execução de uma ordem de serviço em andamento (utilizado pelo prestador).

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `novo_status` | texto | Sim | Um dos seguintes valores: `A_CAMINHO`, `EM_EXECUCAO`, `AGUARDANDO_VISTORIA` |
| `foto_conclusao` | texto | Não | URL ou referência de imagem comprovando o conserto |

Exemplo de requisição:

```json
{
  "novo_status": "AGUARDANDO_VISTORIA"
}
```

Resposta de sucesso: `200 OK`

```json
{
  "sucesso": true,
  "mensagem": "Status da ordem atualizado para 'AGUARDANDO_VISTORIA'.",
  "novo_status": "AGUARDANDO_VISTORIA"
}
```

Erros possíveis: `400 Bad Request` se o status não pertencer à lista de transições permitidas.

---

#### POST /ordens/:id/aprovar

Executa a vistoria e aprovação final da conclusão do serviço pelo cliente, disparando a liquidação irreversível dos fundos retidos em custódia para a carteira disponível do prestador.

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `cliente_id` | inteiro | Não | ID do cliente avaliador |
| `nota` | inteiro | Sim | Nota de avaliação de 1 a 5 estrelas |
| `comentario` | texto | Não | Depoimento textual sobre pontualidade e acabamento |

Exemplo de requisição:

```json
{
  "cliente_id": 1,
  "nota": 5,
  "comentario": "Serviço impecável! O encanador chegou no horário e resolveu o vazamento sem sujeira."
}
```

Resposta de sucesso: `200 OK`

```json
{
  "sucesso": true,
  "mensagem": "Vistoria aprovada! Pagamento liberado com sucesso para a conta do prestador.",
  "valor_liberado": 180.0,
  "status": "CONCLUIDO"
}
```

Erros possíveis: `400 Bad Request` se a ordem não estiver com status `AGUARDANDO_VISTORIA`.

---

#### POST /ordens/:id/disputa

Registra uma contestação formal pelo cliente quando o reparo é insatisfatório ou inconforme, congelando a custódia e abrindo canal de mediação.

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `motivo` | texto | Sim | Motivo da não aprovação da vistoria |
| `detalhes` | texto | Não | Detalhes adicionais sobre os danos ou defeito persistente |

Exemplo de requisição:

```json
{
  "motivo": "O vazamento continuou após o primeiro teste com a torneira aberta."
}
```

Resposta de sucesso: `200 OK`

```json
{
  "sucesso": true,
  "mensagem": "Disputa registrada com sucesso. A liberação do pagamento foi congelada e a mediação foi acionada.",
  "status": "EM_DISPUTA"
}
```

---

#### GET /stats

Retorna os indicadores consolidados (KPIs) para o painel de monitoramento do sistema.

Resposta de sucesso: `200 OK`

```json
{
  "sucesso": true,
  "dados": {
    "total_ordens": 4,
    "ordens_concluidas": 1,
    "saldo_em_custodia": 320.0,
    "total_repassado": 450.0,
    "prestadores_ativos": 2
  }
}
```
