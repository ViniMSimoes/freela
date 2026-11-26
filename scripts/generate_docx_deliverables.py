import os
import docx
from docx.shared import Inches, Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls

BASE_DIR = r"C:\Users\06165\Desktop\FreeLA"
IMG_DIR = os.path.join(BASE_DIR, "docs", "img")
OUTPUT_DIR = os.path.join(BASE_DIR, "documentos_entrega_docx")
os.makedirs(OUTPUT_DIR, exist_ok=True)

PRETO = RGBColor(0, 0, 0)
CINZA_ESCURO = RGBColor(55, 65, 81)

def aplicar_margens_abnt(section):
    # Margens padrão ABNT (NBR 14724): Superior 3cm, Esquerda 3cm, Inferior 2cm, Direita 2cm
    section.top_margin = Cm(3.0)
    section.left_margin = Cm(3.0)
    section.bottom_margin = Cm(2.0)
    section.right_margin = Cm(2.0)

def configurar_estilos(doc):
    styles = doc.styles
    normal = styles['Normal']
    normal.font.name = 'Arial'
    normal.font.size = Pt(12)
    normal.font.color.rgb = PRETO
    normal.paragraph_format.line_spacing = 1.5
    normal.paragraph_format.space_before = Pt(0)
    normal.paragraph_format.space_after = Pt(0)

def set_cell_background(cell, color_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{color_hex}"/>')
    tcPr.append(shd)

def set_cell_borders_abnt(cell, is_header=False):
    tcPr = cell._tc.get_or_add_tcPr()
    # Estilo ABNT: bordas horizontais simples (sem bordas verticais externas pesadas)
    bottom_sz = "8" if is_header else "4"
    top_border = f'<w:top w:val="single" w:sz="8" w:space="0" w:color="000000"/>' if is_header else '<w:top w:val="none"/>'
    borders = parse_xml(
        f'<w:tcBorders {nsdecls("w")}>'
        f'{top_border}'
        f'<w:left w:val="none"/>'
        f'<w:bottom w:val="single" w:sz="{bottom_sz}" w:space="0" w:color="000000"/>'
        f'<w:right w:val="none"/>'
        f'</w:tcBorders>'
    )
    tcPr.append(borders)

def set_cell_margins(cell, top=80, bottom=80, left=100, right=100):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(f'<w:tcMar {nsdecls("w")}><w:top w:w="{top}" w:type="dxa"/><w:bottom w:w="{bottom}" w:type="dxa"/><w:left w:w="{left}" w:type="dxa"/><w:right w:w="{right}" w:type="dxa"/></w:tcMar>')
    tcPr.append(tcMar)

def formatar_tabela(table, col_widths, headers, data):
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False

    hdr_cells = table.rows[0].cells
    for i, title in enumerate(headers):
        hdr_cells[i].text = title
        set_cell_background(hdr_cells[i], "F3F4F6")
        set_cell_borders_abnt(hdr_cells[i], is_header=True)
        set_cell_margins(hdr_cells[i], top=100, bottom=100, left=100, right=100)
        p = hdr_cells[i].paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p.paragraph_format.line_spacing = 1.15
        p.paragraph_format.space_after = Pt(0)
        p.paragraph_format.first_line_indent = Cm(0)
        for r in p.runs:
            r.font.name = 'Arial'
            r.font.size = Pt(10)
            r.font.bold = True
            r.font.color.rgb = PRETO

    for row_idx, row_data in enumerate(data):
        row = table.add_row()
        is_last = (row_idx == len(data) - 1)
        for col_idx, cell_value in enumerate(row_data):
            cell = row.cells[col_idx]
            cell.text = str(cell_value)
            set_cell_margins(cell, top=80, bottom=80, left=100, right=100)
            if is_last:
                set_cell_borders_abnt(cell, is_header=False)
            else:
                tcPr = cell._tc.get_or_add_tcPr()
                tcPr.append(parse_xml(
                    f'<w:tcBorders {nsdecls("w")}>'
                    f'<w:top w:val="none"/><w:left w:val="none"/>'
                    f'<w:bottom w:val="single" w:sz="4" w:space="0" w:color="D1D5DB"/>'
                    f'<w:right w:val="none"/>'
                    f'</w:tcBorders>'
                ))
            p = cell.paragraphs[0]
            p.paragraph_format.line_spacing = 1.15
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.first_line_indent = Cm(0)
            for r in p.runs:
                r.font.name = 'Arial'
                r.font.size = Pt(10)
                r.font.color.rgb = PRETO

    for row in table.rows:
        for idx, width in enumerate(col_widths):
            row.cells[idx].width = Inches(width)

def adicionar_cabecalho_institucional(doc, titulo_documento, subtitulo=""):
    p_inst = doc.add_paragraph()
    p_inst.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_inst.paragraph_format.line_spacing = 1.15
    p_inst.paragraph_format.space_after = Pt(18)
    p_inst.paragraph_format.first_line_indent = Cm(0)

    for texto, size, bold in [
        ("CENTRO UNIVERSITÁRIO DE BARRA MANSA (UBM)\n", 12, True),
        ("CURSO DE GRADUAÇÃO EM ENGENHARIA DE SOFTWARE\n", 12, True),
        ("PRÁTICAS EXTENSIONISTAS INTEGRADORAS III\n", 12, False)
    ]:
        r = p_inst.add_run(texto)
        r.font.name = 'Arial'
        r.font.size = Pt(size)
        r.font.bold = bold
        r.font.color.rgb = PRETO

    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.line_spacing = 1.15
    p_title.paragraph_format.space_before = Pt(12)
    p_title.paragraph_format.space_after = Pt(18)
    p_title.paragraph_format.first_line_indent = Cm(0)

    r_tit = p_title.add_run(f"PROJETO FREELA: {titulo_documento.upper()}\n")
    r_tit.font.name = 'Arial'
    r_tit.font.size = Pt(14)
    r_tit.font.bold = True
    r_tit.font.color.rgb = PRETO

    if subtitulo:
        r_sub = p_title.add_run(f"{subtitulo}\n")
        r_sub.font.name = 'Arial'
        r_sub.font.size = Pt(11)
        r_sub.font.color.rgb = CINZA_ESCURO

    p_meta = doc.add_paragraph()
    p_meta.alignment = WD_ALIGN_PARAGRAPH.LEFT
    p_meta.paragraph_format.line_spacing = 1.15
    p_meta.paragraph_format.space_after = Pt(18)
    p_meta.paragraph_format.first_line_indent = Cm(0)

    runs_meta = [
        ("Equipe: ", True),
        ("Vinicius Marcello Simões, Kaique, Caio, Yago, Lucas Augusto, Lucas Gabriel\n", False),
        ("Orientação: ", True),
        ("Profa. Ma. Laila Alves Santos\n", False),
        ("Data: ", True),
        ("26 de novembro de 2026\n", False),
        ("Repositório: ", True),
        ("https://github.com/ViniMSimoes/freela", False)
    ]
    for text, is_bold in runs_meta:
        r = p_meta.add_run(text)
        r.font.name = 'Arial'
        r.font.size = Pt(10)
        r.font.bold = is_bold
        r.font.color.rgb = PRETO

def add_heading_1(doc, text):
    h = doc.add_paragraph()
    h.paragraph_format.line_spacing = 1.5
    h.paragraph_format.space_before = Pt(18)
    h.paragraph_format.space_after = Pt(6)
    h.paragraph_format.first_line_indent = Cm(0)
    r = h.add_run(text)
    r.font.name = 'Arial'
    r.font.size = Pt(12)
    r.font.bold = True
    r.font.color.rgb = PRETO
    return h

def add_heading_2(doc, text):
    h = doc.add_paragraph()
    h.paragraph_format.line_spacing = 1.5
    h.paragraph_format.space_before = Pt(12)
    h.paragraph_format.space_after = Pt(4)
    h.paragraph_format.first_line_indent = Cm(0)
    r = h.add_run(text)
    r.font.name = 'Arial'
    r.font.size = Pt(12)
    r.font.bold = True
    r.font.color.rgb = PRETO
    return h

def add_paragraph(doc, text, indent=True):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.paragraph_format.line_spacing = 1.5
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.first_line_indent = Cm(1.25) if indent else Cm(0)
    r = p.add_run(text)
    r.font.name = 'Arial'
    r.font.size = Pt(12)
    r.font.color.rgb = PRETO
    return p

def add_list_item(doc, text):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.paragraph_format.line_spacing = 1.5
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.left_indent = Cm(1.25)
    p.paragraph_format.first_line_indent = Cm(0)
    r = p.add_run(text)
    r.font.name = 'Arial'
    r.font.size = Pt(12)
    r.font.color.rgb = PRETO
    return p

def add_table_caption(doc, text):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    p.paragraph_format.line_spacing = 1.15
    p.paragraph_format.space_before = Pt(10)
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.first_line_indent = Cm(0)
    r = p.add_run(text)
    r.font.name = 'Arial'
    r.font.size = Pt(10)
    r.font.bold = True
    r.font.color.rgb = PRETO

def add_source_caption(doc, text="Fonte: Elaborado pelos autores (2026)."):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    p.paragraph_format.line_spacing = 1.15
    p.paragraph_format.space_before = Pt(3)
    p.paragraph_format.space_after = Pt(10)
    p.paragraph_format.first_line_indent = Cm(0)
    r = p.add_run(text)
    r.font.name = 'Arial'
    r.font.size = Pt(10)
    r.font.color.rgb = PRETO

def add_figure(doc, img_path, caption, source="Fonte: Elaborado pelos autores (2026).", width_inches=5.8):
    if not os.path.exists(img_path):
        return
    p_cap = doc.add_paragraph()
    p_cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_cap.paragraph_format.space_before = Pt(10)
    p_cap.paragraph_format.space_after = Pt(4)
    p_cap.paragraph_format.first_line_indent = Cm(0)
    r_cap = p_cap.add_run(caption)
    r_cap.font.name = 'Arial'
    r_cap.font.size = Pt(10)
    r_cap.font.bold = True
    r_cap.font.color.rgb = PRETO

    p_img = doc.add_paragraph()
    p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_img.paragraph_format.space_before = Pt(0)
    p_img.paragraph_format.space_after = Pt(3)
    p_img.paragraph_format.first_line_indent = Cm(0)
    p_img.add_run().add_picture(img_path, width=Inches(width_inches))

    p_src = doc.add_paragraph()
    p_src.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_src.paragraph_format.space_before = Pt(0)
    p_src.paragraph_format.space_after = Pt(10)
    p_src.paragraph_format.first_line_indent = Cm(0)
    r_src = p_src.add_run(source)
    r_src.font.name = 'Arial'
    r_src.font.size = Pt(10)
    r_src.font.color.rgb = PRETO

# ==========================================
# 1. MANUAL TÉCNICO PARCIAL
# ==========================================
def gerar_docx_manual_tecnico():
    doc = docx.Document()
    aplicar_margens_abnt(doc.sections[0])
    configurar_estilos(doc)

    adicionar_cabecalho_institucional(
        doc,
        titulo_documento="Manual Técnico Parcial",
        subtitulo="Critério C2: Arquitetura em 3 Camadas, Serviço de Custódia e Referência da API"
    )

    add_heading_1(doc, "1 INTRODUÇÃO E PÚBLICO-ALVO")
    add_paragraph(doc, "Este manual técnico orienta desenvolvedores e estudantes que assumirão a manutenção, a evolução de funcionalidades e os testes da plataforma FreeLA.")
    add_paragraph(doc, "Após a leitura deste documento, o leitor conseguirá:")
    add_list_item(doc, "1. Entender a arquitetura em três camadas, a separação do serviço de custódia financeira e a função de cada módulo no projeto (Seção 2).")
    add_list_item(doc, "2. Consumir os endpoints da API RESTful para criar ordens, enviar propostas, reter valores em garantia e aprovar vistorias de acordo com as regras do sistema (Seção 3).")
    add_list_item(doc, "3. Verificar as seções previstas para a entrega final da disciplina (Seção 4).")

    add_heading_1(doc, "2 ARQUITETURA BÁSICA DO SISTEMA")
    add_heading_2(doc, "2.1 Visão Geral da Arquitetura")
    add_paragraph(doc, "O sistema FreeLA utiliza uma arquitetura em três camadas separadas: Apresentação, Serviços de Negócio e Persistência de Dados.")
    add_paragraph(doc, "A camada de apresentação funciona como uma Single Page Application (SPA) escrita em HTML5, CSS3 modular e JavaScript puro. O navegador envia requisições JSON para a API RESTful construída em Node.js com Express.")
    add_paragraph(doc, "A camada de negócio concentra as regras financeiras fora dos controladores HTTP. O arquivo escrowService.js executa o bloqueio de saldos, a validação de etapas e o repasse após a vistoria. O arquivo notificationService.js registra os envios de avisos para WhatsApp e e-mail na tabela notificacoes_log.")

    add_heading_2(doc, "2.2 Componentes e Responsabilidades")
    add_table_caption(doc, "Tabela 1: Componentes do sistema FreeLA e suas responsabilidades")

    tabela = doc.add_table(rows=1, cols=4)
    headers = ["Componente", "Responsabilidade", "Tecnologia", "Pasta"]
    col_w = [1.4, 2.5, 1.3, 1.1]
    data = [
        ["Interface Web (SPA)", "Exibe mural de ordens, formulários, livro-razão e carteira", "HTML5, CSS3 (BEM), JS", "public/"],
        ["Proteção HTTP", "Adiciona cabeçalhos de segurança e limite de requisições", "Helmet e Rate Limit", "src/server.js"],
        ["Roteador da API", "Mapeia os caminhos URL para os métodos do controlador", "Express Router", "src/routes/api.js"],
        ["Controlador HTTP", "Recebe requisições, sanitiza textos e aciona serviços", "JavaScript (Node.js)", "src/controllers/"],
        ["Motor de Custódia", "Executa bloqueio, repasse, saque PIX e arbitragem", "Classe EscrowService", "src/services/escrowService.js"],
        ["Serviço de Avisos", "Simula envios de WhatsApp e e-mail e grava logs", "NotificationService", "src/services/notificationService.js"],
        ["Gateway Pagamentos", "Simula cobrança via PIX e cartão de crédito no checkout", "Módulo interno", "src/services/escrowService.js"],
        ["Banco de Dados", "Persiste tabelas com chaves estrangeiras e transações", "SQLite 3 (node:sqlite)", "src/database/"]
    ]
    formatar_tabela(tabela, col_w, headers, data)
    add_source_caption(doc)

    add_heading_2(doc, "2.3 Diagrama de Componentes")
    add_figure(
        doc,
        os.path.join(IMG_DIR, "diagrama_componentes.png"),
        caption="Figura 1: Diagrama de componentes e comunicação entre camadas do FreeLA."
    )

    add_heading_2(doc, "2.4 Decisões Técnicas")
    add_paragraph(doc, "1. Uso do SQLite embutido via node:sqlite: dispensa a instalação de servidores externos de banco de dados durante os testes em máquinas de avaliação, mantendo suporte a transações ACID.")
    add_paragraph(doc, "2. Separação do serviço de custódia em escrowService.js: retira a lógica financeira do controlador de rotas e facilita os testes das regras de bloqueio e liberação de pagamento.")
    add_paragraph(doc, "3. Ativação de chaves estrangeiras no SQLite: o arquivo connection.js executa PRAGMA foreign_keys = ON; na abertura da conexão para que o banco rejeite registros órfãos.")
    add_paragraph(doc, "4. Interface em CSS3 puro: evita ferramentas de build no frontend e permite iniciar todo o projeto com apenas npm install e npm start.")

    add_heading_1(doc, "3 REFERÊNCIA DA API RESTFUL")
    add_paragraph(doc, "O endereço base da API local é http://localhost:3000/api. Todas as requisições com corpo utilizam Content-Type: application/json.")
    add_paragraph(doc, "Modelo de autenticação e controle de acesso no MVP: a versão atual identifica o usuário pelo campo cliente_id ou prestador_id enviado no corpo da requisição, sem fluxo de login com senha ou token JWT. Na rota de aprovação de vistoria, o servidor compara o cliente_id enviado com o cliente_id dono da ordem e retorna HTTP 403 Forbidden caso sejam diferentes.")

    endpoints = [
        ("3.1 GET /stats", "Retorna os totais de ordens, saldo em custódia, total repassado e prestadores ativos.", "200 OK com objeto JSON contendo os indicadores."),
        ("3.2 GET /usuarios", "Lista os usuários cadastrados no banco com papel, reputação e saldos.", "200 OK com lista de usuários."),
        ("3.3 GET /ordens", "Lista as ordens de serviço com filtros opcionais por status e categoria.", "200 OK com lista de ordens."),
        ("3.4 POST /ordens", "Cria uma nova solicitação de reparo e remove tags HTML dos campos de texto.", "201 Created com os dados da ordem criada."),
        ("3.5 GET /ordens/:id", "Retorna os detalhes de uma ordem específica e as propostas recebidas.", "200 OK ou 404 Not Found se o ID não existir."),
        ("3.6 POST /ordens/:id/propostas", "Registra uma proposta orçamentária de prestador validando valor maior que zero.", "201 Created com o ID da proposta."),
        ("3.7 POST /ordens/:id/checkout", "Aceita a proposta escolhida, bloqueia o valor em custódia e muda o status para EM_CUSTODIA. Bloqueia tentativas de pagamento duplicado.", "200 OK ou 400 Bad Request em pagamento duplicado."),
        ("3.8 PATCH /ordens/:id/status", "Avança o andamento do serviço entre A_CAMINHO, EM_EXECUCAO e AGUARDANDO_VISTORIA.", "200 OK com o novo status."),
        ("3.9 POST /ordens/:id/aprovar", "Aprova a vistoria presencial e transfere o valor da custódia para o saldo disponível do prestador. Exige status AGUARDANDO_VISTORIA e cliente_id igual ao dono da ordem.", "200 OK, 400 Bad Request se estiver em EM_EXECUCAO ou 403 Forbidden se o cliente não for o titular."),
        ("3.10 POST /ordens/:id/disputa", "Registra contestação do cliente, congela o saldo e muda o status para EM_DISPUTA.", "200 OK com status EM_DISPUTA."),
        ("3.11 GET /transacoes", "Lista todas as movimentações financeiras gravadas no livro-razão (transacoes_custodia).", "200 OK com histórico de transações."),
        ("3.12 POST /prestador/saque", "Debita o valor solicitado do saldo disponível do prestador e simula o envio via PIX.", "200 OK ou 400 Bad Request se o saldo for insuficiente."),
        ("3.13 POST /disputas/:id/resolver", "Finaliza uma disputa em aberto decidindo entre REPASSE_PRESTADOR ou ESTORNO_CLIENTE.", "200 OK com o status final da ordem."),
        ("3.14 GET /notificacoes", "Lista os últimos registros de avisos de WhatsApp e e-mail salvos em notificacoes_log.", "200 OK com o histórico de notificações.")
    ]
    for ep_title, ep_desc, ep_ret in endpoints:
        add_heading_2(doc, ep_title)
        add_paragraph(doc, f"Descrição: {ep_desc}")
        add_paragraph(doc, f"Resposta: {ep_ret}")

    add_heading_1(doc, "4 PRÓXIMAS SEÇÕES PREVISTAS")
    add_paragraph(doc, "Para a versão final do manual técnico na entrega da disciplina, serão adicionadas as seguintes seções:")
    add_list_item(doc, "1. Seção 5 (Implantação e Ambiente de Produção): instruções de empacotamento com Docker e migração da base SQLite para PostgreSQL.")
    add_list_item(doc, "2. Seção 6 (Autenticação e Controle de Acesso): implementação de login com senha criptografada, emissão de tokens JWT e proteção por papéis.")
    add_list_item(doc, "3. Seção 7 (Integração Bancária Real): configuração de webhooks PIX com provedores de pagamento.")
    add_list_item(doc, "4. Seção 8 (Operação de Mediação): guia para o perfil ADMIN analisar evidências e decidir disputas.")

    add_heading_1(doc, "REFERÊNCIAS")
    add_paragraph(doc, "ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS. NBR 6024: Informação e documentação: numeração progressiva das seções de um documento escrito: apresentação. Rio de Janeiro: ABNT, 2012.", indent=False)
    add_paragraph(doc, "ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS. NBR 14724: Informação e documentação: trabalhos acadêmicos: apresentação. Rio de Janeiro: ABNT, 2011.", indent=False)
    add_paragraph(doc, "OPEN WEB APPLICATION SECURITY PROJECT (OWASP). OWASP Top 10: The Ten Most Critical Web Application Security Risks. OWASP Foundation, 2021.", indent=False)

    out_file = os.path.join(OUTPUT_DIR, "FreeLA_Manual_Tecnico_Parcial.docx")
    doc.save(out_file)
    print("✓ Gerado:", out_file)

# ==========================================
# 2. PRODUCT BACKLOG ATUALIZADO (C3)
# ==========================================
def gerar_docx_backlog():
    doc = docx.Document()
    aplicar_margens_abnt(doc.sections[0])
    configurar_estilos(doc)

    adicionar_cabecalho_institucional(
        doc,
        titulo_documento="Product Backlog Atualizado (Versão 2.0)",
        subtitulo="Critério C3: Evolução desde 16/10, Priorização MoSCoW, Métricas e Validação"
    )

    add_heading_1(doc, "1 O QUE MUDOU DESDE A ENTREGA ANTERIOR (16/10 A 26/11)")
    add_paragraph(doc, "A primeira versão do Product Backlog, entregue em 16 de outubro de 2026, reunia 13 itens planejados a partir dos diagramas de casos de uso e de componentes.")
    add_paragraph(doc, "Durante a implementação do MVP e após a auditoria de código e a reunião de acompanhamento, o backlog foi atualizado para refletir o estado real do repositório. O Item 10 foi dividido em 10A (saque PIX, já implementado) e 10B (catálogo de especialidades, Sprint 2). Foram acrescentados os itens 14, 15 e 16 (segurança), o Item 17 (resolução de disputas, já implementado) e o Item 18 (notificações multicanal, já implementado).")

    add_heading_1(doc, "2 PAINEL CONSOLIDADO DE MÉTRICAS")
    add_table_caption(doc, "Tabela 1: Comparativo de itens do Product Backlog entre as versões 1.0 e 2.0")

    tabela = doc.add_table(rows=1, cols=4)
    headers = ["Indicador", "Versão 1.0 (16/10)", "Versão 2.0 (26/11)", "Situação Atual"]
    col_w = [2.0, 1.3, 1.3, 1.7]
    data = [
        ["Total de itens no backlog", "13 itens", "19 itens", "Acréscimo de 6 itens"],
        ["Itens concluídos no MVP", "0 itens", "15 itens", "78,9% do total entregue"],
        ["Itens Must", "7 itens", "9 itens", "9 de 9 concluídos (100%)"],
        ["Itens Should", "4 itens", "7 itens", "6 de 7 concluídos (85,7%)"],
        ["Itens Could", "2 itens", "3 itens", "0 de 3 concluídos (Sprint 2)"],
        ["Habilitadores técnicos", "1 item", "4 itens", "4 de 4 concluídos"],
        ["Requisitos não funcionais", "1 item", "2 itens", "2 de 2 atendidos"]
    ]
    formatar_tabela(tabela, col_w, headers, data)
    add_source_caption(doc)

    add_heading_1(doc, "3 DISTINÇÃO ENTRE HISTÓRIAS DE USUÁRIO E HABILITADORES")
    add_paragraph(doc, "Os itens 3 e 4 tratam de camadas diferentes do processo de pagamento e foram reescritos para evitar sobreposição:")
    add_paragraph(doc, "Item 3 (Habilitador Técnico): consiste na construção do serviço de custódia no backend (escrowService.js), das tabelas de livro-razão (transacoes_custodia) e do controle de saldos separados na tabela usuarios.")
    add_paragraph(doc, "Item 4 (História de Usuário): trata da interação do cliente na tela de contratação ao escolher PIX ou cartão, aplicar cupom de desconto e confirmar o bloqueio do pagamento.")

    add_heading_1(doc, "4 MEDIÇÃO DE PERFORMANCE (ITEM 7)")
    add_paragraph(doc, "Para verificar a meta de resposta abaixo de 2,0 segundos do Item 7, foi executado um script local em Node.js v24.18.0 enviando 100 requisições sequenciais às rotas /api/stats, /api/ordens e /api/transacoes com medição via performance.now().")
    add_paragraph(doc, "Os tempos observados no ambiente local foram: mínimo de 9,4 ms, média de 28,2 ms e máximo de 46,1 ms, com 100% de respostas HTTP 200 OK.")

    add_heading_1(doc, "5 RETORNO DO PARCEIRO EXTENSIONISTA")
    add_paragraph(doc, "Em 05 de novembro de 2026, a equipe conversou com moradores contratantes e dois profissionais autônomos de Volta Redonda/RJ sobre os fluxos do protótipo.")
    add_paragraph(doc, "Os profissionais apontaram a necessidade de confirmar que o pagamento já estava garantido antes do deslocamento e de solicitar saque via PIX de forma direta. Os moradores pediram clareza sobre a taxa da plataforma e comprovantes no WhatsApp. Essas demandas motivaram a priorização do Item 10A (saque PIX) e a criação do Item 18 (notificações automáticas em WhatsApp e e-mail).")

    add_heading_1(doc, "6 TABELA DO PRODUCT BACKLOG PRIORIZADO")
    add_table_caption(doc, "Tabela 2: Lista completa dos 19 itens do Product Backlog atualizado")

    tabela_bkl = doc.add_table(rows=1, cols=5)
    headers_bkl = ["Nº", "Tipo", "Descrição do Item", "MoSCoW", "Status"]
    col_w_bkl = [0.5, 0.9, 3.2, 0.8, 1.2]
    data_bkl = [
        ["1", "História", "Solicitação de reparo com categoria, descrição e CEP", "Must", "CONCLUÍDO (MVP)"],
        ["2", "História", "Mural de ordens e envio de propostas com valor e prazo", "Must", "CONCLUÍDO (MVP)"],
        ["3", "Habilitador", "Motor de custódia (escrowService.js) e livro-razão no banco", "Must", "CONCLUÍDO (MVP)"],
        ["4", "História", "Checkout do cliente via PIX/cartão com retenção em custódia", "Must", "CONCLUÍDO (MVP)"],
        ["5", "História", "Atualização de status da execução até AGUARDANDO_VISTORIA", "Must", "CONCLUÍDO (MVP)"],
        ["6", "História", "Aprovação da vistoria presencial pelo titular com repasse", "Must", "CONCLUÍDO (MVP)"],
        ["7", "RNF", "Tempo de resposta menor que 2,0s (média medida de 28,2 ms)", "Must", "CONCLUÍDO (MVP)"],
        ["8", "História", "Abertura de disputa congelando o saldo em custódia", "Should", "CONCLUÍDO (MVP)"],
        ["9", "História", "Avaliação mútua por estrelas (1 a 5) com recálculo de média", "Should", "CONCLUÍDO (MVP)"],
        ["10A", "História", "Solicitação de saque PIX do saldo disponível do prestador", "Should", "CONCLUÍDO (MVP)"],
        ["10B", "História", "Catálogo de especialidades e portfólio de serviços", "Could", "Sprint 2 (Dezembro)"],
        ["11", "História", "Cadastro com envio de documento para selo verificado", "Should", "Sprint 2 (Dezembro)"],
        ["12", "História", "Painel administrativo para cadastro de cupons dinâmicos", "Could", "Sprint 2 (Dezembro)"],
        ["13", "História", "Painel gerencial de conversão para administradores", "Could", "Sprint 2 (Dezembro)"],
        ["14", "Habilitador", "Cabeçalhos HTTP de segurança com Helmet e política CSP", "Must", "CONCLUÍDO (MVP)"],
        ["15", "Habilitador", "Transações ACID contra pagamento duplo (double-spending)", "Must", "CONCLUÍDO (MVP)"],
        ["16", "RNF", "Rate Limiting (200 req/15min) e payload máximo de 100 KB", "Should", "CONCLUÍDO (MVP)"],
        ["17", "História", "Resolução de disputas com repasse ao prestador ou estorno", "Should", "CONCLUÍDO (MVP)"],
        ["18", "Habilitador", "Serviço de notificações (WhatsApp/e-mail) com log no banco", "Should", "CONCLUÍDO (MVP)"]
    ]
    formatar_tabela(tabela_bkl, col_w_bkl, headers_bkl, data_bkl)
    add_source_caption(doc)

    add_heading_1(doc, "7 RASTREABILIDADE COM TESTES")
    add_paragraph(doc, "Os 15 itens marcados como concluídos no MVP têm comportamento verificado pela suíte de 16 testes de integração localizada em tests/api.test.js.")

    add_heading_1(doc, "REFERÊNCIAS")
    add_paragraph(doc, "ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS. NBR 6024: Informação e documentação: numeração progressiva das seções de um documento escrito: apresentação. Rio de Janeiro: ABNT, 2012.", indent=False)
    add_paragraph(doc, "COHN, Mike. User Stories Applied: For Agile Software Development. Boston: Addison-Wesley, 2004.", indent=False)

    out_file = os.path.join(OUTPUT_DIR, "FreeLA_Product_Backlog_Atualizado_C3.docx")
    doc.save(out_file)
    print("✓ Gerado:", out_file)

# ==========================================
# 3. ESTRUTURA DO BANCO DE DADOS (C4)
# ==========================================
def gerar_docx_banco_dados():
    doc = docx.Document()
    aplicar_margens_abnt(doc.sections[0])
    configurar_estilos(doc)

    adicionar_cabecalho_institucional(
        doc,
        titulo_documento="Estrutura do Banco de Dados",
        subtitulo="Critério C4: Modelo Relacional SQLite, DER, Integridade Referencial e Dicionário"
    )

    add_heading_1(doc, "1 VISÃO GERAL DA PERSISTÊNCIA")
    add_paragraph(doc, "O banco de dados do FreeLA utiliza o SQLite 3 por meio do módulo nativo node:sqlite do Node.js, gravando os dados no arquivo freela.db (configurável pela variável DB_PATH).")
    add_paragraph(doc, "Para que as restrições de chave estrangeira funcionem em tempo de execução, o arquivo src/database/connection.js executa PRAGMA foreign_keys = ON; logo após abrir o banco. Dessa forma, o SQLite rejeita inserções em tabelas filhas que apontem para registros inexistentes.")

    add_heading_1(doc, "2 DIAGRAMA ENTIDADE-RELACIONAMENTO (DER)")
    add_figure(
        doc,
        os.path.join(IMG_DIR, "diagrama_der.png"),
        caption="Figura 1: Diagrama Entidade-Relacionamento (DER) do banco de dados FreeLA."
    )

    add_heading_1(doc, "3 DICIONÁRIO DE DADOS")
    tabelas_espec = [
        ("3.1 Tabela usuarios", "Tabela 1: Campos da tabela usuarios", [
            ["id", "INTEGER", "Não", "PK", "Chave primária autoincremental"],
            ["nome", "TEXT", "Não", "—", "Nome completo do usuário"],
            ["email", "TEXT", "Não", "UNIQUE", "E-mail único para identificação e notificações (MVP sem senha)"],
            ["papel", "TEXT", "Não", "—", "CHECK(papel IN ('CLIENTE', 'PRESTADOR', 'ADMIN'))"],
            ["telefone", "TEXT", "Sim", "—", "Telefone para envio de mensagens"],
            ["especialidade", "TEXT", "Sim", "—", "Área de atuação do prestador"],
            ["reputacao", "REAL", "Sim", "—", "Média de avaliações. Padrão: 5.0"],
            ["saldo_disponivel", "REAL", "Não", "—", "Saldo liberado para saque. Padrão: 0.0"],
            ["saldo_custodia", "REAL", "Não", "—", "Saldo retido aguardando vistoria. Padrão: 0.0"],
            ["verificado", "INTEGER", "Não", "—", "Indicador de validação (0 = não, 1 = sim). Padrão: 0"],
            ["criado_em", "DATETIME", "Não", "—", "Data e hora de criação"]
        ]),
        ("3.2 Tabela ordens_servico", "Tabela 2: Campos da tabela ordens_servico", [
            ["id", "INTEGER", "Não", "PK", "Chave primária autoincremental da ordem"],
            ["cliente_id", "INTEGER", "Não", "FK", "Referência ao cliente (usuarios.id)"],
            ["prestador_id", "INTEGER", "Sim", "FK", "Referência ao prestador (usuarios.id)"],
            ["categoria", "TEXT", "Não", "—", "Categoria do serviço solicitado"],
            ["titulo", "TEXT", "Não", "—", "Título resumido da solicitação"],
            ["descricao", "TEXT", "Não", "—", "Descrição do problema informado"],
            ["cep", "TEXT", "Não", "—", "CEP do local de atendimento"],
            ["endereco", "TEXT", "Não", "—", "Endereço completo"],
            ["urgencia", "TEXT", "Não", "—", "BAIXA, MEDIA, ALTA ou EMERGENCIAL"],
            ["status", "TEXT", "Não", "—", "9 estados do ciclo de vida da ordem"],
            ["valor_mao_obra", "REAL", "Não", "—", "Valor acordado para o prestador"],
            ["taxa_plataforma", "REAL", "Não", "—", "Taxa de intermediação da plataforma"],
            ["valor_total", "REAL", "Não", "—", "Soma retida no checkout"],
            ["metodo_pagamento", "TEXT", "Sim", "—", "PIX ou CARTAO_CREDITO"],
            ["foto_avaria", "TEXT", "Sim", "—", "URL da foto do defeito"],
            ["foto_conclusao", "TEXT", "Sim", "—", "URL da foto do serviço concluído"],
            ["criado_em", "DATETIME", "Não", "—", "Data e hora de abertura"],
            ["atualizado_em", "DATETIME", "Não", "—", "Data e hora da última atualização"]
        ]),
        ("3.3 Tabela propostas", "Tabela 3: Campos da tabela propostas", [
            ["id", "INTEGER", "Não", "PK", "Chave primária da proposta"],
            ["ordem_id", "INTEGER", "Não", "FK", "Referência à ordem (ordens_servico.id)"],
            ["prestador_id", "INTEGER", "Não", "FK", "Referência ao prestador (usuarios.id)"],
            ["valor", "REAL", "Não", "—", "Valor proposto para a mão de obra"],
            ["prazo_estimado", "TEXT", "Não", "—", "Prazo informado pelo prestador"],
            ["mensagem", "TEXT", "Sim", "—", "Observações do orçamento"],
            ["status", "TEXT", "Não", "—", "PENDENTE, ACEITA ou RECUSADA"],
            ["criado_em", "DATETIME", "Não", "—", "Data e hora do envio"]
        ]),
        ("3.4 Tabela transacoes_custodia", "Tabela 4: Campos da tabela transacoes_custodia", [
            ["id", "INTEGER", "Não", "PK", "Chave primária da transação"],
            ["ordem_id", "INTEGER", "Não", "FK", "Referência à ordem (ordens_servico.id)"],
            ["valor", "REAL", "Não", "—", "Quantia movimentada"],
            ["tipo", "TEXT", "Não", "—", "BLOQUEIO_ESCROW, LIBERACAO_REPASSE ou ESTORNO_DISPUTA"],
            ["status", "TEXT", "Não", "—", "CONFIRMADO, EM_ANALISE ou ESTORNADO"],
            ["detalhes", "TEXT", "Sim", "—", "Descrição da operação para conferência"],
            ["criado_em", "DATETIME", "Não", "—", "Data e hora do registro"]
        ]),
        ("3.5 Tabela avaliacoes", "Tabela 5: Campos da tabela avaliacoes", [
            ["id", "INTEGER", "Não", "PK", "Chave primária da avaliação"],
            ["ordem_id", "INTEGER", "Não", "FK", "Referência à ordem (ordens_servico.id)"],
            ["avaliador_id", "INTEGER", "Não", "FK", "Referência ao avaliador (usuarios.id)"],
            ["avaliado_id", "INTEGER", "Não", "FK", "Referência ao avaliado (usuarios.id)"],
            ["nota", "INTEGER", "Não", "—", "CHECK(nota BETWEEN 1 AND 5)"],
            ["comentario", "TEXT", "Sim", "—", "Comentário sobre o atendimento"],
            ["criado_em", "DATETIME", "Não", "—", "Data e hora da avaliação"]
        ]),
        ("3.6 Tabela notificacoes_log", "Tabela 6: Campos da tabela notificacoes_log", [
            ["id", "INTEGER", "Não", "PK", "Chave primária do log"],
            ["usuario_id", "INTEGER", "Sim", "FK", "Referência ao destinatário (usuarios.id)"],
            ["canal", "TEXT", "Não", "—", "WHATSAPP ou EMAIL"],
            ["destinatario", "TEXT", "Não", "—", "Telefone ou e-mail de destino"],
            ["assunto", "TEXT", "Sim", "—", "Assunto do e-mail"],
            ["mensagem", "TEXT", "Não", "—", "Conteúdo da notificação"],
            ["status", "TEXT", "Não", "—", "ENVIADO ou FALHA"],
            ["criado_em", "DATETIME", "Não", "—", "Data e hora do envio"]
        ])
    ]

    for sec_title, cap, sec_data in tabelas_espec:
        add_heading_2(doc, sec_title)
        add_table_caption(doc, cap)
        tbl = doc.add_table(rows=1, cols=5)
        headers = ["Coluna", "Tipo", "Nulo?", "Chave", "Descrição"]
        col_w = [1.3, 0.9, 0.6, 0.7, 2.8]
        formatar_tabela(tbl, col_w, headers, sec_data)
        add_source_caption(doc)

    add_heading_1(doc, "4 RELACIONAMENTOS E CARDINALIDADES")
    add_paragraph(doc, "1. Relação usuarios para ordens_servico (1:N): um cliente cria várias ordens e um prestador assume vários serviços.")
    add_paragraph(doc, "2. Relação ordens_servico para propostas (1:N): uma ordem recebe vários orçamentos concorrentes.")
    add_paragraph(doc, "3. Relação ordens_servico para transacoes_custodia (1:N): uma ordem gera movimentações financeiras de bloqueio, liberação ou estorno.")
    add_paragraph(doc, "4. Relação ordens_servico para avaliacoes (1:N Mútua): como a avaliação prevista no backlog é mútua, uma ordem comporta até dois registros (cliente avalia prestador e prestador avalia cliente).")

    add_heading_1(doc, "5 DECISÕES TÉCNICAS E EVOLUÇÃO PARA PRODUÇÃO")
    add_paragraph(doc, "Precisão Monetária: o MVP utiliza o tipo REAL no schema.sql para simplificar a prototipação. Em produção, as colunas financeiras serão convertidas para INTEGER em centavos (BIGINT) ou NUMERIC(12,2), evitando erros de arredondamento de ponto flutuante (IEEE 754).")
    add_paragraph(doc, "Migração para PostgreSQL 16: a mudança do SQLite para PostgreSQL exige mais do que alterar a string de conexão. Será necessário adaptar chaves primárias para BIGINT GENERATED ALWAYS AS IDENTITY, usar BOOLEAN e TIMESTAMPTZ nativos, configurar pool de conexões com pg.Pool e aplicar isolamento SERIALIZABLE nas transações de custódia.")

    add_heading_1(doc, "REFERÊNCIAS")
    add_paragraph(doc, "ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS. NBR 6024: Informação e documentação: numeração progressiva das seções de um documento escrito: apresentação. Rio de Janeiro: ABNT, 2012.", indent=False)
    add_paragraph(doc, "DATE, C. J. Introdução a Sistemas de Bancos de Dados. 8. ed. Rio de Janeiro: Elsevier, 2004.", indent=False)
    add_paragraph(doc, "IEEE COMPUTER SOCIETY. IEEE Standard for Floating-Point Arithmetic (IEEE Std 754-2019). New York: IEEE, 2019.", indent=False)

    out_file = os.path.join(OUTPUT_DIR, "FreeLA_Estrutura_Banco_de_Dados_C4.docx")
    doc.save(out_file)
    print("✓ Gerado:", out_file)

# ==========================================
# 4. README DO PROJETO
# ==========================================
def gerar_docx_readme():
    doc = docx.Document()
    aplicar_margens_abnt(doc.sections[0])
    configurar_estilos(doc)

    adicionar_cabecalho_institucional(
        doc,
        titulo_documento="README do Projeto",
        subtitulo="Critério C2: Instalação, Pré-requisitos, Capturas Reais e Testes Automatizados"
    )

    add_heading_1(doc, "1 SOBRE O PROJETO")
    add_paragraph(doc, "O FreeLA é uma plataforma web para contratação de serviços residenciais (elétrica, hidráulica, pintura, alvenaria e climatização) com pagamento protegido em custódia (Escrow). O cliente paga ao aceitar a proposta, o valor fica retido na plataforma e o repasse ao prestador ocorre após a vistoria presencial e a aprovação do cliente.")
    add_paragraph(doc, "Parceiro Extensionista: Comunidade de Moradores e Profissionais Autônomos de Volta Redonda/RJ (Práticas Extensionistas Integradoras III, UBM, 2026).")

    add_heading_1(doc, "2 TECNOLOGIAS E PRÉ-REQUISITOS")
    add_paragraph(doc, "O backend utiliza Node.js (versão >= 22.5.0 exigida pelo módulo nativo node:sqlite), Express 4.21.2, Helmet 8.0.0, Express Rate Limit 7.5.0, Dotenv 16.4.7 e CORS 2.8.5. O frontend utiliza HTML5, CSS3 modular e JavaScript puro.")
    add_paragraph(doc, "Observação sobre o Node.js 22: ao iniciar o projeto nessa versão, o terminal exibe o aviso ExperimentalWarning: SQLite is an experimental feature. Esse aviso é esperado pelo uso do módulo nativo e não afeta o funcionamento do sistema.")

    add_heading_1(doc, "3 INSTALAÇÃO E EXECUÇÃO")
    add_list_item(doc, "1. Clone o repositório: git clone https://github.com/ViniMSimoes/freela.git")
    add_list_item(doc, "2. Acesse a pasta: cd freela")
    add_list_item(doc, "3. Instale as dependências: npm install")
    add_list_item(doc, "4. Crie o arquivo de ambiente a partir do modelo: cp .env.example .env (ou Copy-Item .env.example .env no PowerShell). As variáveis PORT e DB_PATH são carregadas pelo pacote dotenv.")
    add_list_item(doc, "5. Inicie o servidor: npm start")
    add_list_item(doc, "6. Acesse no navegador: http://localhost:3000")

    add_heading_1(doc, "4 TELAS DO SISTEMA EM EXECUÇÃO")
    add_figure(doc, os.path.join(IMG_DIR, "print_mural.png"), "Figura 1: Tela inicial com mural de ordens de serviço e indicadores.")
    add_figure(doc, os.path.join(IMG_DIR, "print_escrow.png"), "Figura 2: Livro-razão de movimentações financeiras em custódia.")
    add_figure(doc, os.path.join(IMG_DIR, "print_carteira.png"), "Figura 3: Carteira do prestador e formulário de saque via PIX.")
    add_figure(doc, os.path.join(IMG_DIR, "print_notificacoes.png"), "Figura 4: Histórico de mensagens geradas para WhatsApp e e-mail.")

    add_heading_1(doc, "5 TESTES AUTOMATIZADOS")
    add_paragraph(doc, "Para executar a suíte de testes de integração, execute npm test no terminal. A suíte valida 16 cenários: estatísticas, cabeçalhos Helmet, listagem de usuários e ordens, sanitização XSS, validação de proposta negativa, envio de proposta, checkout em custódia, bloqueio de pagamento duplo, bloqueio de aprovação em EM_EXECUCAO, controle de titularidade (HTTP 403), aprovação válida, livro-razão, saque PIX, notificações e integridade de chaves estrangeiras (PRAGMA foreign_keys = ON).")

    add_heading_1(doc, "6 EQUIPE")
    add_table_caption(doc, "Tabela 1: Integrantes da equipe e perfis no GitHub")

    tbl = doc.add_table(rows=1, cols=2)
    headers = ["Nome Completo", "Usuário no GitHub"]
    col_w = [3.5, 2.5]
    data = [
        ["Vinicius Marcello Simões", "@ViniMSimoes"],
        ["Kaique", "@kaique"],
        ["Caio", "@caio"],
        ["Yago", "@yago"],
        ["Lucas Augusto", "@lucasaugusto"],
        ["Lucas Gabriel", "@lucasgabriel"]
    ]
    formatar_tabela(tbl, col_w, headers, data)
    add_source_caption(doc)

    out_file = os.path.join(OUTPUT_DIR, "FreeLA_README_do_Projeto.docx")
    doc.save(out_file)
    print("✓ Gerado:", out_file)

# ==========================================
# 5. DOCUMENTAÇÃO MESTRE CONSOLIDADA (C1-C4)
# ==========================================
def gerar_docx_consolidado():
    doc = docx.Document()
    aplicar_margens_abnt(doc.sections[0])
    configurar_estilos(doc)

    adicionar_cabecalho_institucional(
        doc,
        titulo_documento="Documentação Técnica Consolidada (Critérios C1 a C4)",
        subtitulo="README, Manual Técnico Parcial, Product Backlog v2.0 e Estrutura do Banco de Dados"
    )

    add_heading_1(doc, "1 APRESENTAÇÃO E INSTALAÇÃO (README)")
    add_paragraph(doc, "O FreeLA intermedia serviços residenciais com pagamento retido em custódia (Escrow) até a vistoria presencial e a aprovação do cliente. O sistema exige Node.js >= 22.5.0 e carrega as variáveis PORT e DB_PATH via dotenv.")
    add_figure(doc, os.path.join(IMG_DIR, "print_mural.png"), "Figura 1: Mural de ordens de serviço do FreeLA.")
    add_figure(doc, os.path.join(IMG_DIR, "print_carteira.png"), "Figura 2: Carteira digital do prestador e saque via PIX.")

    doc.add_page_break()
    add_heading_1(doc, "2 MANUAL TÉCNICO PARCIAL (CRITÉRIO C2)")
    add_paragraph(doc, "A arquitetura em três camadas separa a interface web SPA, o serviço de custódia (escrowService.js), o serviço de mensagens (notificationService.js) e o banco SQLite com PRAGMA foreign_keys = ON;. O manual documenta os 14 endpoints da API, explicita a ausência de fluxo de login com senha e comprova a validação de titularidade (HTTP 403) e o bloqueio de aprovação durante EM_EXECUCAO.")
    add_figure(doc, os.path.join(IMG_DIR, "diagrama_componentes.png"), "Figura 3: Diagrama de componentes do FreeLA.")

    doc.add_page_break()
    add_heading_1(doc, "3 PRODUCT BACKLOG ATUALIZADO (CRITÉRIO C3)")
    add_paragraph(doc, "O backlog atualizado soma 19 itens, com 15 concluídos no MVP (78,9%) e 9 de 9 itens Must finalizados. Inclui o desmembramento do Item 10 (saque PIX 10A concluído e catálogo 10B na Sprint 2), o Item 17 (resolução de disputas), o Item 18 (mensageria), o protocolo de benchmark (média de 28,2 ms) e o retorno da reunião com moradores e prestadores de Volta Redonda/RJ.")

    doc.add_page_break()
    add_heading_1(doc, "4 ESTRUTURA DO BANCO DE DADOS (CRITÉRIO C4)")
    add_paragraph(doc, "O banco relacional freela.db implementa seis tabelas normalizadas com chaves estrangeiras ativas, papel ADMIN, campos foto_avaria e atualizado_em, cardinalidade 1:N mútua para avaliações e plano técnico de migração para PostgreSQL 16.")
    add_figure(doc, os.path.join(IMG_DIR, "diagrama_der.png"), "Figura 4: Diagrama Entidade-Relacionamento do FreeLA.")

    add_heading_1(doc, "REFERÊNCIAS")
    add_paragraph(doc, "ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS. NBR 6024: Informação e documentação: numeração progressiva das seções de um documento escrito: apresentação. Rio de Janeiro: ABNT, 2012.", indent=False)
    add_paragraph(doc, "ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS. NBR 14724: Informação e documentação: trabalhos acadêmicos: apresentação. Rio de Janeiro: ABNT, 2011.", indent=False)
    add_paragraph(doc, "DATE, C. J. Introdução a Sistemas de Bancos de Dados. 8. ed. Rio de Janeiro: Elsevier, 2004.", indent=False)

    out_file = os.path.join(OUTPUT_DIR, "FreeLA_Documentacao_Consolidada_C1_a_C4.docx")
    doc.save(out_file)
    print("✓ Gerado:", out_file)

if __name__ == '__main__':
    gerar_docx_manual_tecnico()
    gerar_docx_backlog()
    gerar_docx_banco_dados()
    gerar_docx_readme()
    gerar_docx_consolidado()
