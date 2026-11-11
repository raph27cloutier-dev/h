#!/usr/bin/env python3
"""Draws each theme's banner glow image (app/hero-mask-<key>.png).

The glow shape is the see-through pattern of app/hero-mask.png; each theme gets the
same shape in its own background colour. Run after adding or recolouring a theme in
app/themes.js. Needs Pillow (pip install pillow).
"""
import pathlib
import re
import sys

from PIL import Image

APP = pathlib.Path(__file__).resolve().parent.parent / "app"
THEME = re.compile(r"key: '([a-z]+)',\s*label: '[^']*',\s*bg: '#([0-9a-fA-F]{6})'")


def main() -> int:
    themes = THEME.findall((APP / "themes.js").read_text())
    if not themes:
        print("No themes found in app/themes.js", file=sys.stderr)
        return 1
    alpha = Image.open(APP / "hero-mask.png").convert("RGBA").getchannel("A")
    for key, colour in themes:
        if key == "classic":
            continue
        rgb = tuple(int(colour[i : i + 2], 16) for i in (0, 2, 4))
        image = Image.new("RGBA", alpha.size, rgb + (0,))
        image.putalpha(alpha)
        target = APP / f"hero-mask-{key}.png"
        image.save(target, optimize=True)
        print(target.name)
    return 0


if __name__ == "__main__":
    sys.exit(main())
