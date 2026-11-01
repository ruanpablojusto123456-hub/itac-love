"""Personaliza o projeto Android gerado pelo Capacitor (rodado pelo GitHub Actions).
Copia MainActivity (FLAG_SECURE + detecção de print) e AndroidManifest (permissões, deep link)
e gera ícones e splash a partir de src/assets/logo.png.  Uso: python3 scripts/patch_android.py"""
import glob, os, shutil
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAIN = os.path.join(ROOT, 'android/app/src/main')
shutil.copy(os.path.join(ROOT, 'android-overrides/MainActivity.java'), os.path.join(MAIN, 'java/br/com/itaclove/app/MainActivity.java'))
shutil.copy(os.path.join(ROOT, 'android-overrides/AndroidManifest.xml'), os.path.join(MAIN, 'AndroidManifest.xml'))

logo = Image.open(os.path.join(ROOT, 'src/assets/logo.png')).convert('RGBA')
for d, s in {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}.items():
    base = os.path.join(MAIN, f'res/mipmap-{d}/')
    sq = Image.new('RGBA', (s, s), (255, 255, 255, 255)); l = logo.copy(); l.thumbnail((int(s * .92), int(s * .92)))
    sq.paste(l, ((s - l.width) // 2, (s - l.height) // 2), l); sq.save(base + 'ic_launcher.png')
    m = Image.new('L', (s, s), 0); ImageDraw.Draw(m).ellipse((0, 0, s, s), fill=255)
    r = Image.new('RGBA', (s, s), (0, 0, 0, 0)); r.paste(sq, (0, 0), m); r.save(base + 'ic_launcher_round.png')
    fs = int(s * 108 / 48); fg = Image.new('RGBA', (fs, fs), (0, 0, 0, 0)); l = logo.copy(); l.thumbnail((int(fs * .62), int(fs * .62)))
    fg.paste(l, ((fs - l.width) // 2, (fs - l.height) // 2), l); fg.save(base + 'ic_launcher_foreground.png')
for f in glob.glob(os.path.join(MAIN, 'res/drawable*/splash.png')):
    w, h = Image.open(f).size
    bg = Image.new('RGBA', (w, h), (250, 248, 255, 255)); l = logo.copy(); l.thumbnail((int(min(w, h) * .55),) * 2)
    bg.paste(l, ((w - l.width) // 2, (h - l.height) // 2), l); bg.convert('RGB').save(f)
bgxml = os.path.join(MAIN, 'res/values/ic_launcher_background.xml')
if os.path.exists(bgxml):
    open(bgxml, 'w').write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#FFFFFF</color>\n</resources>\n')
print('Android personalizado: FLAG_SECURE, deep link, permissões, ícones e splash.')
