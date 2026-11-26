import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches

OUT_PATH = r"C:\Users\06165\Desktop\FreeLA\docs\img\diagrama_ci_cd.png"

def gerar_diagrama_ci():
    fig, ax = plt.subplots(figsize=(14, 6.5), dpi=200)
    fig.patch.set_facecolor('#FFFFFF')
    ax.set_facecolor('#FFFFFF')
    ax.set_xlim(0, 14)
    ax.set_ylim(0, 6.5)
    ax.axis('off')

    ax.text(7, 5.95, 'FreeLA: Fluxo de Integração Contínua (GitHub Actions CI)',
            fontsize=15, fontweight='bold', color='#111827', ha='center', va='center', fontfamily='sans-serif')
    ax.text(7, 5.48, 'Workflow automatizado em .github/workflows/ci.yml para Node.js 22.x e 24.x',
            fontsize=10, color='#4B5563', ha='center', va='center')

    etapas = [
        ("1. Gatilho Git", "Push ou Pull Request\nna branch main", 0.6, 2.7, 2.2, 1.7, "#F3F4F6", "#111827"),
        ("2. Ambiente CI", "Ubuntu Latest\nMatriz Node 22.x / 24.x", 3.3, 2.7, 2.2, 1.7, "#F3F4F6", "#111827"),
        ("3. Dependências", "npm ci\nCache de pacotes", 6.0, 2.7, 2.2, 1.7, "#F3F4F6", "#111827"),
        ("4. Banco Isolado", "DB_PATH temporário\nPRAGMA foreign_keys = ON", 8.7, 2.7, 2.2, 1.7, "#F3F4F6", "#111827"),
        ("5. Testes API", "npm test (16 cenários)\nPortão de Qualidade", 11.4, 2.7, 2.0, 1.7, "#E5E7EB", "#111827")
    ]

    for titulo, desc, x, y, w, h, bg, border in etapas:
        rect = patches.FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.06,rounding_size=0.12",
                                      facecolor=bg, edgecolor=border, linewidth=1.4)
        ax.add_patch(rect)
        ax.text(x + w/2, y + h - 0.42, titulo, color='#111827', fontsize=10, fontweight='bold', ha='center', va='center')
        ax.plot([x + 0.15, x + w - 0.15], [y + h - 0.72, y + h - 0.72], color='#9CA3AF', lw=0.8)
        ax.text(x + w/2, y + 0.55, desc, color='#374151', fontsize=8.5, ha='center', va='center', linespacing=1.4)

    for i in range(4):
        x_start = etapas[i][2] + etapas[i][4] + 0.08
        x_end = etapas[i+1][2] - 0.08
        ax.annotate('', xy=(x_end, 3.55), xytext=(x_start, 3.55),
                    arrowprops=dict(arrowstyle="->", color="#111827", lw=1.6))

    # Portão de decisão
    gate = patches.FancyBboxPatch((3.3, 0.7), 7.4, 1.15, boxstyle="round,pad=0.06,rounding_size=0.12",
                                  facecolor='#F9FAFB', edgecolor='#111827', linewidth=1.2)
    ax.add_patch(gate)
    ax.text(7.0, 1.45, 'Critério de Aprovação do Merge (Quality Gate)', fontsize=10, fontweight='bold', color='#111827', ha='center')
    ax.text(7.0, 1.0, 'Exit code 0 (16/16 testes aprovados) libera o merge na branch main. Qualquer falha bloqueia a integração.',
            fontsize=8.5, color='#374151', ha='center')

    ax.annotate('', xy=(12.4, 2.7), xytext=(10.7, 1.28),
                arrowprops=dict(arrowstyle="<-", color="#4B5563", lw=1.2, ls='--'))

    plt.tight_layout()
    plt.savefig(OUT_PATH, dpi=200, bbox_inches='tight', facecolor='#FFFFFF')
    plt.close()
    print("✓ Diagrama CI gerado:", OUT_PATH)

if __name__ == '__main__':
    gerar_diagrama_ci()
