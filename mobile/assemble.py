"""Put the phone app's web files together in mobile/build/www.

Most of it is mobile/www. A few pieces are shared with the desktop app and copied in so there is one copy to keep up to date:
the music engine and instrument samples (Groove), the Nunito font, the workspace icons, and the Caveat handwriting font
from the website. The Android build packs mobile/build/www into the APK; it can also be opened in a browser to try it.
"""
import shutil
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
OUT = HERE / 'build' / 'www'


def main():
    if OUT.exists():
        shutil.rmtree(OUT)
    shutil.copytree(HERE / 'www', OUT)
    shared = [
        (ROOT / 'web/js/music-engine.js', OUT / 'js/music-engine.js'),
        (ROOT / 'web/fonts/Nunito.ttf', OUT / 'fonts/Nunito.ttf'),
        (ROOT / 'web/fonts/OFL.txt', OUT / 'fonts/Nunito-OFL.txt'),
        (ROOT / 'docs/assets/Caveat.ttf', OUT / 'fonts/Caveat.ttf'),
        (ROOT / 'docs/assets/Caveat-OFL.txt', OUT / 'fonts/Caveat-OFL.txt'),
    ]
    for name in ('opia-icon', 'opia-image-icon', 'opia-pdf-icon', 'opia-music-icon'):
        shared.append((ROOT / f'web/img/{name}.svg', OUT / f'img/{name}.svg'))
    for src, dst in shared:
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
    shutil.copytree(ROOT / 'web/samples', OUT / 'samples')
    size = sum(f.stat().st_size for f in OUT.rglob('*') if f.is_file())
    print(f'{OUT} ({size / 1048576:.1f} MB)')


if __name__ == '__main__':
    main()
