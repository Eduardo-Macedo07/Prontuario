"""Gera o PDF modelo de sprites (assets/modelo-sprites.pdf) a partir de assets/modelos/*.png.

Uso: python3 ferramentas/gerar_pdf_modelo.py
"""
import os
import sys

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

sys.path.insert(0, os.path.dirname(__file__))
from sprites_comum import SPRITES  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELOS = os.path.join(ROOT, "assets", "modelos")
OUT = os.path.join(ROOT, "assets", "modelo-sprites.pdf")

W, H = landscape(A4)
INK = HexColor("#1a1222")
GOLD = HexColor("#b8862a")
MUTED = HexColor("#6a6280")
GUIDE = HexColor("#e04060")


def checker(c, x, y, w, h, size=8):
    """Xadrez claro atrás da imagem, só para mostrar onde é transparente."""
    c.saveState()
    p = c.beginPath()
    p.rect(x, y, w, h)
    c.clipPath(p, stroke=0, fill=0)
    for i in range(int(w // size) + 1):
        for j in range(int(h // size) + 1):
            c.setFillColor(HexColor("#ececf2") if (i + j) % 2 else HexColor("#ffffff"))
            c.rect(x + i * size, y + j * size, size, size, stroke=0, fill=1)
    c.restoreState()


def cover(c):
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 30)
    c.drawString(20 * mm, H - 28 * mm, "Survivor Browser - Folha de Sprites")
    c.setFont("Helvetica", 12)
    c.setFillColor(MUTED)
    c.drawString(20 * mm, H - 36 * mm, "Modelo para enviar arte nova. Cada página seguinte é um sprite, com a arte atual como referência.")

    rules = [
        "1. Uma página por sprite. O título da página começa com o CÓDIGO do sprite (ex.: mago, esqueleto, arvore-seca).",
        "2. Coloque na página UMA imagem PNG com fundo TRANSPARENTE. Não use JPG nem fundo branco.",
        "   Se não conseguir transparência, use fundo verde chapado (#00FF00), que é removido automaticamente.",
        "3. Quadros lado a lado, da esquerda para a direita, todos do mesmo tamanho (veja a tabela).",
        "4. Personagem olhando para a DIREITA (o jogo espelha sozinho) e com os pés na mesma altura em todos os quadros.",
        "5. Visão de cima em 3/4, como a arte atual: vemos o topo da cabeça e a frente do corpo.",
        "6. Pode ser maior que o tamanho da tabela (2x, 4x...), desde que mantenha a mesma proporção.",
        "7. Não precisa mandar todos: o que não vier continua com o desenho atual.",
        "",
        "As linhas vermelhas nas páginas são só guias (divisão dos quadros e linha dos pés) e são ignoradas.",
    ]
    c.setFillColor(INK)
    c.setFont("Helvetica", 12)
    y = H - 52 * mm
    for line in rules:
        c.drawString(20 * mm, y, line)
        y -= 7 * mm

    # tabela de códigos
    c.setFont("Helvetica-Bold", 12)
    c.setFillColor(GOLD)
    y -= 4 * mm
    c.drawString(20 * mm, y, "Códigos e tamanhos (quadros × tamanho de cada quadro, em pixels)")
    y -= 7 * mm
    c.setFont("Helvetica", 10)
    c.setFillColor(INK)
    col_x = [20 * mm, 112 * mm, 204 * mm]
    rows_per_col = 7
    for i, (code, _id, name, kind, frames, (fw, fh)) in enumerate(SPRITES):
        cx = col_x[i // rows_per_col]
        cy = y - (i % rows_per_col) * 6 * mm
        c.setFont("Helvetica-Bold", 10)
        c.drawString(cx, cy, code)
        c.setFont("Helvetica", 10)
        c.drawString(cx + 24 * mm, cy, f"{frames} × {fw}x{fh}  ({name})")


def sprite_page(c, code, name, kind, frames, fw, fh):
    path = os.path.join(MODELOS, f"{code}.png")
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 22)
    c.drawString(20 * mm, H - 22 * mm, f"{code}  -  {name}")
    c.setFont("Helvetica", 11)
    c.setFillColor(MUTED)
    c.drawString(20 * mm, H - 29 * mm, f"{kind} | {frames} quadro{'s' if frames > 1 else ''} de {fw} x {fh} px | arquivo final: {code}.png")
    if frames > 1:
        c.drawString(20 * mm, H - 35 * mm, "Quadro 1 = parado. Quadros 1 a 4 em sequência = andando.")

    # imagem o maior possível na área útil
    area_w, area_h = W - 40 * mm, H - 60 * mm
    sheet_w, sheet_h = fw * frames, fh
    scale = min(area_w / sheet_w, area_h / sheet_h)
    dw, dh = sheet_w * scale, sheet_h * scale
    x = (W - dw) / 2
    y = 15 * mm + (area_h - dh) / 2
    checker(c, x, y, dw, dh)
    c.drawImage(path, x, y, dw, dh, mask="auto")

    # guias: divisão dos quadros e linha dos pés
    c.setStrokeColor(GUIDE)
    c.setLineWidth(0.8)
    c.rect(x, y, dw, dh, stroke=1, fill=0)
    for i in range(1, frames):
        c.line(x + dw * i / frames, y, x + dw * i / frames, y + dh)
    feet = {"personagem": 0.95, "cenário": 150 / 170}.get(kind)
    if feet:
        c.setDash(4, 3)
        fy = y + dh * (1 - feet)
        c.line(x, fy, x + dw, fy)
        c.setDash()
        c.setFillColor(GUIDE)
        c.setFont("Helvetica", 8)
        c.drawString(x + dw + 2 * mm, fy - 1, "pés")
    c.setFillColor(GUIDE)
    c.setFont("Helvetica", 8)
    for i in range(frames):
        c.drawString(x + dw * i / frames + 2, y + dh + 3, f"quadro {i + 1}")


def main():
    c = canvas.Canvas(OUT, pagesize=(W, H))
    c.setTitle("Survivor Browser - Folha de Sprites")
    cover(c)
    c.showPage()
    for code, _id, name, kind, frames, (fw, fh) in SPRITES:
        sprite_page(c, code, name, kind, frames, fw, fh)
        c.showPage()
    c.save()
    print("PDF gerado:", OUT)


if __name__ == "__main__":
    main()
