"""Lê um PDF de sprites (no formato do assets/modelo-sprites.pdf) e coloca as imagens no jogo.

Para cada página: acha o código do sprite no título, pega a maior imagem da página,
remove fundo verde (#00FF00) se houver, ajusta à proporção esperada, salva em
assets/sprites/<codigo>.png e ativa a linha correspondente em assets/sprites.js.

Também compara com o modelo (assets/modelos) para calcular a escala e a altura dos pés:
assim um desenho que ocupa o quadro inteiro fica do mesmo tamanho do modelo no jogo.

Uso: python3 ferramentas/pdf_para_sprites.py arquivo.pdf
"""
import os
import re
import sys

from PIL import Image
from pypdf import PdfReader

sys.path.insert(0, os.path.dirname(__file__))
from sprites_comum import CODES_BY_LENGTH  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPRITES_DIR = os.path.join(ROOT, "assets", "sprites")
MODELS_DIR = os.path.join(ROOT, "assets", "modelos")

# Altura padrão da imagem inteira no jogo e ponto de apoio, por tipo (mesmos valores do js/art.js).
ANCHOR = {"personagem": 0.95, "inimigo": 0.55, "chefão": 0.55, "cenário": 150 / 170}
# Quanto maior que o desenho do modelo a arte nova deve aparecer.
SIZE_BOOST = {"personagem": 1.1, "inimigo": 1.2, "chefão": 1.05, "cenário": 1.0}
MANIFEST = os.path.join(ROOT, "assets", "sprites.js")


def find_code(text):
    """O código é a primeira palavra do título da página (ex.: "cavaleiro - Cavaleiro Esqueleto")."""
    words = re.findall(r"[a-z-]+", text.strip().lower()[:80])
    by_code = {e[0]: e for e in CODES_BY_LENGTH}
    if words and words[0].strip("-") in by_code:
        return by_code[words[0].strip("-")]
    for word in words:
        if word in by_code:
            return by_code[word]
    return None


def remove_green(img):
    """Fundo verde chapado vira transparente (com uma margem de tolerância)."""
    img = img.convert("RGBA")
    px = img.load()
    for yy in range(img.height):
        for xx in range(img.width):
            r, g, b, a = px[xx, yy]
            if g > 180 and r < 110 and b < 110:
                px[xx, yy] = (0, 0, 0, 0)
    return img


def fit(img, frames, fw, fh):
    """Mantém a imagem com a proporção de quadros esperada, centralizando se precisar."""
    want = (fw * frames) / fh
    w, h = img.size
    if abs(w / h - want) < 0.02:
        return img
    if w / h > want:
        new_w, new_h = w, round(w / want)
    else:
        new_w, new_h = round(h * want), h
    canvas = Image.new("RGBA", (new_w, new_h), (0, 0, 0, 0))
    canvas.paste(img, ((new_w - w) // 2, new_h - h))
    print(f"   aviso: proporção diferente do modelo; imagem centralizada em {new_w}x{new_h}")
    return canvas


def content_box(img):
    """Fração (topo, base) ocupada pelo desenho, somando todos os quadros."""
    box = img.getchannel("A").point(lambda a: 255 if a > 40 else 0).getbbox()
    if not box:
        return 0.0, 1.0
    return box[1] / img.height, box[3] / img.height


def fit_to_model(img, code, kind):
    """Escala e ponto de apoio para o desenho ficar do tamanho e na altura do modelo."""
    model_path = os.path.join(MODELS_DIR, f"{code}.png")
    if not os.path.exists(model_path):
        # personagem sem modelo próprio usa o do mago como referência de tamanho
        if kind != "personagem":
            return None
        model_path = os.path.join(MODELS_DIR, "mago.png")
    model = Image.open(model_path).convert("RGBA")
    mt, mb = content_box(model)
    nt, nb = content_box(img)
    scale = SIZE_BOOST[kind] * (mb - mt) / max(0.05, nb - nt)
    a = ANCHOR[kind]
    # os pés do desenho novo ficam no mesmo lugar que os pés do modelo
    anchor = nb - (mb - a) / scale
    return round(scale, 3), round(anchor, 3)


def enable_in_manifest(code, fit_values=None):
    with open(MANIFEST, encoding="utf-8") as f:
        text = f.read()
    new = re.sub(r"^(\s*)//\s*(\w+:\s*\{\s*file:\s*'" + re.escape(code) + r"\.png')", r"\1\2", text, flags=re.M)
    if fit_values:
        scale, anchor = fit_values
        line = re.compile(r"^(\s*\w+:\s*\{\s*file:\s*'" + re.escape(code) + r"\.png'[^}\n]*?)(,\s*scale:[^}]*)?\s*\}", re.M)
        new = line.sub(lambda m: f"{m.group(1)}, scale: {scale}, anchorY: {anchor} }}", new)
    with open(MANIFEST, "w", encoding="utf-8") as f:
        f.write(new)


def main(pdf_path):
    reader = PdfReader(pdf_path)
    os.makedirs(SPRITES_DIR, exist_ok=True)
    done = []
    for n, page in enumerate(reader.pages, 1):
        entry = find_code(page.extract_text() or "")
        if not entry:
            continue
        code, _id, name, kind, frames, (fw, fh) = entry
        images = list(page.images)
        if not images:
            print(f"página {n} ({code}): sem imagem, ignorada")
            continue
        biggest = max(images, key=lambda im: im.image.width * im.image.height)
        img = biggest.image.convert("RGBA")
        if img.getextrema()[3][0] == 255:  # sem transparência: tenta remover fundo verde
            img = remove_green(img)
        img = fit(img, frames, fw, fh)
        out = os.path.join(SPRITES_DIR, f"{code}.png")
        img.save(out)
        fit_values = fit_to_model(img, code, kind)
        enable_in_manifest(code, fit_values)
        done.append(code)
        extra = f"  escala {fit_values[0]}, apoio {fit_values[1]}" if fit_values else ""
        print(f"página {n}: {code} ({name}) -> assets/sprites/{code}.png  {img.width}x{img.height}{extra}")
    print(f"\n{len(done)} sprite(s) importado(s).")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1])
