# Relatório de Auditoria de Segurança & Hardening — FreeLA SaaS
**Projeto:** FreeLA (SaaS de Serviços Residenciais com Custódia Protegida)  
**Disciplina:** Práticas Extensionistas Integradoras III — Engenharia de Software (UBM)  
**Data:** 12 de novembro de 2026  
**Auditor Responsável:** Equipe de Engenharia de Software  

---

## 1. Sumário Executivo

Foi conduzida uma auditoria de segurança de código estático (SAST) e testes dinâmicos de vulnerabilidade (DAST) no MVP do **FreeLA**. O objetivo foi identificar potenciais vetores de ataque nas camadas de Apresentação (Frontend), Aplicação (API RESTful) e Dados (SQLite), implementando correções imediatas alinhadas com as diretrizes do **OWASP Top 10** e boas práticas de segurança de software (PCI-DSS / LGPD).

Resultado pós-remediação: **0 vulnerabilidades críticas, 0 vulnerabilidades altas e 100% de conformidade nos testes automatizados de segurança**.

---

## 2. Matriz de Vulnerabilidades Identificadas e Corrigidas

| ID | Vulnerabilidade / Fragilidade | Categoria OWASP | Severidade | Status | Correção Aplicada |
| :---: | :--- | :--- | :---: | :---: | :--- |
| **SEC-01** | **Stored Cross-Site Scripting (XSS) no Frontend** | A03:2021 — Injection | **Alta** |  Corrigido | Implementação da função `escapeHtml` para codificação de entidades HTML em todas as interpolações dinâmicas do DOM. |
| **SEC-02** | **Risco de Double-Spending no Checkout do Escrow** | A04:2021 — Insecure Design | **Alta** |  Corrigido | Validação estrita da máquina de estados + encapsulamento em **transação atômica ACID (`BEGIN` / `COMMIT`)**. |
| **SEC-03** | **Ausência de Cabeçalhos de Segurança HTTP** | A05:2021 — Security Misconfiguration | **Média** |  Corrigido | Instalação e configuração do **Helmet**, desativação do cabeçalho `X-Powered-By` e ativação de CSP e `X-Content-Type-Options: nosniff`. |
| **SEC-04** | **Injeção de Valores Negativos ou Inválidos em Propostas** | A04:2021 — Insecure Design | **Média** |  Corrigido | Validação estrita de limites (`1,00 <= valor <= 100.000,00`) e coerção de tipos antes da persistência. |
| **SEC-05** | **Vulnerabilidade a DoS por Requisições em Massa / Força Bruta** | A04:2021 — Insecure Design | **Média** |  Corrigido | Implementação do middleware **`express-rate-limit`** limitando requisições por IP a 200 req / 15 min. |
| **SEC-06** | **Buffer Overflow / Esgotamento de Memória por Payload JSON Ilimitado** | A05:2021 — Security Misconfiguration | **Baixa** |  Corrigido | Restrição estrita do body-parser: `express.json({ limit: '100kb' })`. |
| **SEC-07** | **Vazamento de Stack Trace / Erros Internos da Base de Dados** | A09:2021 — Security Logging and Monitoring Failures | **Baixa** |  Corrigido | Middleware centralizado de tratamento de exceções, ocultando detalhes de infraestrutura em respostas públicas. |

---

## 3. Detalhamento Técnico das Correções

### 3.1 Proteção contra Cross-Site Scripting (XSS)
- **Causa Raiz:** O frontend interpolava variáveis como `o.titulo`, `o.descricao` e `p.mensagem` diretamente na propriedade `innerHTML`.
- **Mitigação:** Criação da rotina de escape de caracteres reservados:
  ```javascript
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  ```
- **Defesa em Profundidade no Backend:** O controlador `ordensController.js` agora higieniza strings removendo tags com `str.replace(/<[^>]*>?/gm, '')` e truncando comprimentos máximos.

### 3.2 Atomicidade e Prevenção Anti Double-Spending no Escrow
- **Causa Raiz:** Requisições simultâneas de checkout poderiam gerar cobrança dupla ou duplicação de saldo na carteira de custódia do prestador.
- **Mitigação:** 
  1. Verificação prévia de estado: rejeita ordens cujo status seja diferente de `PENDENTE` ou `PROPOSTA_RECEBIDA` com código `HTTP 400`.
  2. Execução das 4 operações financeiras (aceite de proposta, recusa das demais, atualização para `EM_CUSTODIA`, inserção no log de auditoria e incremento de saldo) dentro de uma **transação atômica SQLite** (`BEGIN TRANSACTION` / `COMMIT`), com reversão (`ROLLBACK`) em caso de falha.

### 3.3 Cabeçalhos de Segurança (Hardening HTTP)
- Removido o cabeçalho `X-Powered-By: Express` para dificultar reconhecimento e fingerprinting de tecnologias.
- Ativado `X-Content-Type-Options: nosniff` para mitigar MIME-sniffing.
- Ativado `X-Frame-Options: SAMEORIGIN` contra ataques de Clickjacking.
- Configurada Content Security Policy (CSP) restritiva com fallback seguro.

---

## 4. Evidência dos Testes de Segurança

A suíte em `tests/api.test.js` foi expandida para 10 testes automatizados, validando:
1. `GET /api/stats` — Resposta íntegra.
2. `Cabeçalhos Helmet` — Presença de `nosniff`, `SAMEORIGIN` e ausência de `x-powered-by`.
3. `GET /api/ordens` — Listagem com filtros validados.
4. `POST /api/ordens` — Criação com injeção de `<script>` sanitizada com sucesso.
5. `POST /api/ordens/:id/propostas` — Bloqueio de valor negativo com `HTTP 400`.
6. `POST /api/ordens/:id/propostas` — Registro de proposta com valor legítimo.
7. `POST /api/ordens/:id/checkout` — Bloqueio de fundos no Escrow.
8. `POST /api/ordens/:id/checkout` — **Tentativa de checkout duplicado bloqueada com `HTTP 400` (Anti Double-Spending)**.
9. `PATCH /api/ordens/:id/status` — Validação das transições de estado permitidas.
10. `POST /api/ordens/:id/aprovar` — Vistoria aprovada e repasse financeiro liquidado.
