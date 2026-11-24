import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches

OUTPUT_DIR = r"C:\Users\06165\Desktop\FreeLA\docs\img"

def gerar_diagrama_der():
    fig, ax = plt.subplots(figsize=(16, 11), dpi=200)
    fig.patch.set_facecolor('#0B0F19')
    ax.set_facecolor('#0B0F19')
    ax.set_xlim(0, 16)
    ax.set_ylim(0, 11)
    ax.axis('off')

    # Título do DER
    ax.text(8, 10.4, 'FreeLA — Diagrama de Entidade-Relacionamento (DER Relacional)', 
            fontsize=18, fontweight='bold', color='#FFFFFF', ha='center', va='center', fontfamily='sans-serif')
    ax.text(8, 9.9, 'Modelo Lógico em 3FN • SQLite com PRAGMA foreign_keys = ON • Suporte a Custódia Escrow', 
            fontsize=11, color='#94A3B8', ha='center', va='center')

    # Caixas das Tabelas
    tabelas = [
        {
            'nome': 'USUARIOS',
            'pos': (0.8, 4.8),
            'w': 4.2,
            'h': 4.3,
            'header_color': '#1E293B',
            'border_color': '#38BDF8',
            'cols': [
                ('PK', 'id', 'INTEGER PRIMARY KEY'),
                ('', 'nome', 'VARCHAR(100) NOT NULL'),
                ('', 'email', 'VARCHAR(100) UNIQUE'),
                ('', 'papel', "CHECK ('CLIENTE','PRESTADOR','ADMIN')"),
                ('', 'telefone', 'VARCHAR(20) NOT NULL'),
                ('', 'especialidade', 'VARCHAR(50) NULL'),
                ('', 'reputacao', 'DECIMAL(2,1) DEFAULT 5.0'),
                ('', 'saldo_disponivel', 'INTEGER NOT NULL DEFAULT 0'),
                ('', 'saldo_custodia', 'INTEGER NOT NULL DEFAULT 0'),
                ('', 'verificado', 'INTEGER DEFAULT 0'),
                ('', 'criado_em', 'DATETIME CURRENT_TIMESTAMP')
            ]
        },
        {
            'nome': 'ORDENS_SERVICO',
            'pos': (5.9, 4.2),
            'w': 4.4,
            'h': 4.9,
            'header_color': '#1E293B',
            'border_color': '#3B82F6',
            'cols': [
                ('PK', 'id', 'INTEGER PRIMARY KEY'),
                ('FK', 'cliente_id', 'INTEGER -> usuarios(id)'),
                ('FK', 'prestador_id', 'INTEGER NULL -> usuarios(id)'),
                ('', 'categoria', 'VARCHAR(50) NOT NULL'),
                ('', 'titulo', 'VARCHAR(150) NOT NULL'),
                ('', 'descricao', 'TEXT NOT NULL'),
                ('', 'cep', 'VARCHAR(9) NOT NULL'),
                ('', 'endereco', 'VARCHAR(200) NOT NULL'),
                ('', 'urgencia', "CHECK ('BAIXA','MEDIA','ALTA','EMERG')"),
                ('', 'status', 'VARCHAR(25) NOT NULL'),
                ('', 'valor_mao_obra', 'INTEGER DEFAULT 0'),
                ('', 'taxa_plataforma', 'INTEGER DEFAULT 0'),
                ('', 'valor_total', 'INTEGER DEFAULT 0'),
                ('', 'metodo_pagamento', 'VARCHAR(20) NULL'),
                ('', 'foto_avaria', 'TEXT NULL'),
                ('', 'foto_conclusao', 'TEXT NULL'),
                ('', 'criado_em', 'DATETIME CURRENT_TIMESTAMP'),
                ('', 'atualizado_em', 'DATETIME CURRENT_TIMESTAMP')
            ]
        },
        {
            'nome': 'PROPOSTAS',
            'pos': (11.1, 6.2),
            'w': 4.2,
            'h': 2.9,
            'header_color': '#1E293B',
            'border_color': '#A855F7',
            'cols': [
                ('PK', 'id', 'INTEGER PRIMARY KEY'),
                ('FK', 'ordem_id', 'INTEGER -> ordens_servico(id)'),
                ('FK', 'prestador_id', 'INTEGER -> usuarios(id)'),
                ('', 'valor', 'INTEGER NOT NULL'),
                ('', 'prazo_estimado', 'VARCHAR(50) NOT NULL'),
                ('', 'mensagem', 'TEXT NULL'),
                ('', 'status', "CHECK ('PENDENTE','ACEITA','RECUSADA')"),
                ('', 'criado_em', 'DATETIME CURRENT_TIMESTAMP')
            ]
        },
        {
            'nome': 'TRANSACOES_CUSTODIA',
            'pos': (11.1, 2.5),
            'w': 4.2,
            'h': 2.9,
            'header_color': '#1E293B',
            'border_color': '#10B981',
            'cols': [
                ('PK', 'id', 'INTEGER PRIMARY KEY'),
                ('FK', 'ordem_id', 'INTEGER -> ordens_servico(id)'),
                ('', 'valor', 'INTEGER NOT NULL'),
                ('', 'tipo', "CHECK ('BLOQUEIO_ESCROW','LIBERACAO_REPASSE','ESTORNO_DISPUTA')"),
                ('', 'status', "CHECK ('CONFIRMADO','EM_ANALISE','ESTORNADO')"),
                ('', 'detalhes', 'TEXT NULL'),
                ('', 'criado_em', 'DATETIME CURRENT_TIMESTAMP')
            ]
        },
        {
            'nome': 'AVALIACOES (1:N Mútua)',
            'pos': (0.8, 0.6),
            'w': 4.2,
            'h': 2.8,
            'header_color': '#1E293B',
            'border_color': '#F59E0B',
            'cols': [
                ('PK', 'id', 'INTEGER PRIMARY KEY'),
                ('FK', 'ordem_id', 'INTEGER -> ordens_servico(id)'),
                ('FK', 'avaliador_id', 'INTEGER -> usuarios(id)'),
                ('FK', 'avaliado_id', 'INTEGER -> usuarios(id)'),
                ('', 'nota', 'INTEGER CHECK (nota BETWEEN 1 AND 5)'),
                ('', 'comentario', 'TEXT NULL'),
                ('', 'criado_em', 'DATETIME CURRENT_TIMESTAMP')
            ]
        },
        {
            'nome': 'NOTIFICACOES_LOG',
            'pos': (5.9, 0.6),
            'w': 4.4,
            'h': 2.8,
            'header_color': '#1E293B',
            'border_color': '#EC4899',
            'cols': [
                ('PK', 'id', 'INTEGER PRIMARY KEY'),
                ('FK', 'usuario_id', 'INTEGER NULL -> usuarios(id)'),
                ('', 'canal', "CHECK ('WHATSAPP','EMAIL')"),
                ('', 'destinatario', 'VARCHAR(100) NOT NULL'),
                ('', 'assunto', 'VARCHAR(150) NULL'),
                ('', 'mensagem', 'TEXT NOT NULL'),
                ('', 'status', "VARCHAR(20) DEFAULT 'ENVIADO'"),
                ('', 'criado_em', 'DATETIME CURRENT_TIMESTAMP')
            ]
        }
    ]

    for t in tabelas:
        x, y = t['pos']
        w, h = t['w'], t['h']
        
        # Fundo do card
        rect = patches.FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.08,rounding_size=0.15",
                                      facecolor='#0F172A', edgecolor=t['border_color'], linewidth=1.5)
        ax.add_patch(rect)
        
        # Header da tabela
        header_h = 0.5
        header_rect = patches.FancyBboxPatch((x, y + h - header_h), w, header_h, 
                                             boxstyle="round,pad=0.08,rounding_size=0.15",
                                             facecolor=t['header_color'], edgecolor=t['border_color'], linewidth=1)
        ax.add_patch(header_rect)
        
        # Título da tabela
        ax.text(x + w/2, y + h - header_h/2, t['nome'], color='#F8FAFC', 
                fontsize=10.5, fontweight='bold', ha='center', va='center')
        
        # Linhas de atributos
        num_cols = len(t['cols'])
        line_spacing = (h - header_h - 0.2) / max(num_cols, 1)
        cur_y = y + h - header_h - 0.2
        
        for key_type, col_name, col_type in t['cols']:
            # Key badge
            if key_type == 'PK':
                ax.text(x + 0.25, cur_y, 'PK', color='#F59E0B', fontsize=7.5, fontweight='bold', va='center')
            elif key_type == 'FK':
                ax.text(x + 0.25, cur_y, 'FK', color='#38BDF8', fontsize=7.5, fontweight='bold', va='center')
            else:
                ax.text(x + 0.25, cur_y, '•', color='#64748B', fontsize=8, va='center')
                
            ax.text(x + 0.65, cur_y, col_name, color='#E2E8F0', fontsize=8, fontweight='bold', va='center')
            ax.text(x + w - 0.15, cur_y, col_type, color='#94A3B8', fontsize=7, ha='right', va='center')
            cur_y -= line_spacing

    # Setas e Relacionamentos
    # usuarios -> ordens_servico (1:N cliente e prestador)
    ax.annotate('', xy=(5.9, 7.5), xytext=(5.0, 7.5),
                arrowprops=dict(arrowstyle="->", color="#38BDF8", lw=1.5, ls='--'))
    ax.text(5.45, 7.7, "1:N (cliente/prest)", color="#38BDF8", fontsize=7.5, ha='center')

    # ordens_servico -> propostas (1:N)
    ax.annotate('', xy=(11.1, 7.5), xytext=(10.3, 7.5),
                arrowprops=dict(arrowstyle="->", color="#A855F7", lw=1.5, ls='--'))
    ax.text(10.7, 7.7, "1:N", color="#A855F7", fontsize=8, ha='center')

    # ordens_servico -> transacoes_custodia (1:N)
    ax.annotate('', xy=(11.1, 4.0), xytext=(10.3, 4.8),
                arrowprops=dict(arrowstyle="->", color="#10B981", lw=1.5, ls='--'))
    ax.text(10.7, 4.6, "1:N (escrow)", color="#10B981", fontsize=8, ha='center')

    # ordens_servico -> avaliacoes (1:N) e usuarios -> avaliacoes
    ax.annotate('', xy=(3.0, 3.4), xytext=(6.5, 4.2),
                arrowprops=dict(arrowstyle="->", color="#F59E0B", lw=1.5, ls='--'))
    ax.text(4.7, 3.6, "1:N (mútua)", color="#F59E0B", fontsize=8, ha='center')

    # Legenda explicativa
    ax.text(8, 0.15, 'Nota: Todos os valores monetários são representados como inteiros (centavos) para evitar imprecisões de ponto flutuante IEEE 754.',
            fontsize=8.5, color='#CBD5E1', ha='center', va='center', style='italic')

    plt.tight_layout()
    out_path = f"{OUTPUT_DIR}/diagrama_der.png"
    plt.savefig(out_path, dpi=200, bbox_inches='tight', facecolor='#0B0F19')
    plt.close()
    print("✓ Diagrama DER gerado com sucesso:", out_path)

def gerar_diagrama_componentes():
    fig, ax = plt.subplots(figsize=(16, 9), dpi=200)
    fig.patch.set_facecolor('#0B0F19')
    ax.set_facecolor('#0B0F19')
    ax.set_xlim(0, 16)
    ax.set_ylim(0, 9)
    ax.axis('off')

    # Título do Diagrama de Componentes
    ax.text(8, 8.5, 'FreeLA SaaS — Diagrama de Arquitetura de Componentes', 
            fontsize=18, fontweight='bold', color='#FFFFFF', ha='center', va='center')
    ax.text(8, 8.05, 'Separação em Camadas • Escrow Engine Desacoplado • Mensageria Multicanal • CSS3 Modular (Vanilla)', 
            fontsize=10.5, color='#94A3B8', ha='center', va='center')

    # Camadas (Caixas Grandes)
    camadas = [
        ("CAMADA DE APRESENTAÇÃO (Frontend SPA)", 0.8, 4.4, 4.2, 3.1, "#38BDF8"),
        ("CAMADA DE SERVIÇOS & NEGÓCIO (Node.js/Express)", 5.6, 1.8, 5.8, 5.7, "#3B82F6"),
        ("INFRAESTRUTURA & PERSISTÊNCIA", 12.0, 1.8, 3.2, 5.7, "#10B981")
    ]

    for nome, x, y, w, h, cor in camadas:
        rect = patches.FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.1,rounding_size=0.15",
                                      facecolor='#0F172A', edgecolor=cor, linewidth=1.8)
        ax.add_patch(rect)
        ax.text(x + w/2, y + h - 0.35, nome, color=cor, fontsize=9.5, fontweight='bold', ha='center', va='center')

    # Componentes Internos
    # Frontend
    comp_frontend = [
        ("Single Page Application (index.html)", 1.1, 6.2, 3.6, 0.6, "#1E293B", "#94A3B8"),
        ("Controlador de Estado (app.js)", 1.1, 5.3, 3.6, 0.6, "#1E293B", "#94A3B8"),
        ("Estilização CSS3 Pura / BEM (style.css)", 1.1, 4.4, 3.6, 0.6, "#1E293B", "#94A3B8")
    ]
    for nome, x, y, w, h, bg, border in comp_frontend:
        r = patches.FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.05,rounding_size=0.1", facecolor=bg, edgecolor=border, lw=1)
        ax.add_patch(r)
        ax.text(x + w/2, y + h/2, nome, color='#FFFFFF', fontsize=8, ha='center', va='center')

    # Backend
    comp_backend = [
        ("Servidor Express Hardened (server.js)", 5.9, 6.3, 5.2, 0.65, "#1E293B", "#38BDF8"),
        ("Middlewares (Helmet, RateLimit, CORS)", 5.9, 5.4, 5.2, 0.65, "#1E293B", "#64748B"),
        ("API Router & Controller (ordensController.js)", 5.9, 4.4, 5.2, 0.75, "#1E293B", "#3B82F6"),
        ("Motor de Custódia Escrow (escrowService.js)", 5.9, 3.2, 5.2, 0.9, "#1E293B", "#F59E0B"),
        ("Serviço de Mensageria (notificationService.js)", 5.9, 2.0, 5.2, 0.9, "#1E293B", "#EC4899")
    ]
    for nome, x, y, w, h, bg, border in comp_backend:
        r = patches.FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.05,rounding_size=0.1", facecolor=bg, edgecolor=border, lw=1.2)
        ax.add_patch(r)
        ax.text(x + w/2, y + h/2, nome, color='#FFFFFF', fontsize=8.5, fontweight='bold', ha='center', va='center')

    # Infra & DB
    comp_infra = [
        ("SQLite 3 Engine (node:sqlite)", 12.3, 5.8, 2.6, 0.8, "#1E293B", "#10B981"),
        ("freela.db (PRAGMA foreign_keys = ON)", 12.3, 4.6, 2.6, 0.8, "#1E293B", "#10B981"),
        ("Gateway Pagamentos (Simulado PIX/CC)", 12.3, 3.3, 2.6, 0.9, "#1E293B", "#F59E0B"),
        ("Canais WhatsApp & Email (Simulado)", 12.3, 2.0, 2.6, 0.9, "#1E293B", "#EC4899")
    ]
    for nome, x, y, w, h, bg, border in comp_infra:
        r = patches.FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.05,rounding_size=0.1", facecolor=bg, edgecolor=border, lw=1)
        ax.add_patch(r)
        ax.text(x + w/2, y + h/2, nome, color='#FFFFFF', fontsize=7.5, ha='center', va='center')

    # Setas de Comunicação
    ax.annotate('', xy=(5.6, 5.7), xytext=(5.0, 5.7),
                arrowprops=dict(arrowstyle="<->", color="#38BDF8", lw=1.5))
    ax.text(5.3, 6.0, "JSON / HTTP REST", color="#38BDF8", fontsize=7.5, ha='center')

    ax.annotate('', xy=(12.0, 5.2), xytext=(11.4, 5.2),
                arrowprops=dict(arrowstyle="<->", color="#10B981", lw=1.5))
    ax.text(11.7, 5.5, "ACID Tx / SQL", color="#10B981", fontsize=7.5, ha='center')

    ax.annotate('', xy=(12.0, 3.65), xytext=(11.1, 3.65),
                arrowprops=dict(arrowstyle="->", color="#F59E0B", lw=1.5))
    ax.text(11.55, 3.9, "PIX / Token", color="#F59E0B", fontsize=7.5, ha='center')

    ax.annotate('', xy=(12.0, 2.45), xytext=(11.1, 2.45),
                arrowprops=dict(arrowstyle="->", color="#EC4899", lw=1.5))
    ax.text(11.55, 2.7, "Dispatch", color="#EC4899", fontsize=7.5, ha='center')

    # Legenda / Rodapé
    ax.text(8, 0.8, "Arquitetura validada segundo critérios C2 e C4 • Total desacoplamento do motor de garantia financeira", 
            fontsize=8.5, color="#64748B", ha='center', va='center')

    plt.tight_layout()
    out_path = f"{OUTPUT_DIR}/diagrama_componentes.png"
    plt.savefig(out_path, dpi=200, bbox_inches='tight', facecolor='#0B0F19')
    plt.close()
    print("✓ Diagrama de Componentes gerado com sucesso:", out_path)

if __name__ == '__main__':
    gerar_diagrama_der()
    gerar_diagrama_componentes()
