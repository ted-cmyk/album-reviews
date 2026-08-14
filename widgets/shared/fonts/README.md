# Bundled fonts

These are the Latin subsets of the two fonts the widgets use, served from this
repo instead of from Google Fonts.

**Why they're checked in:** the share images in `og/` are rendered by headless
Chrome. If the fonts come off the network at render time, a blocked request or a
slow response produces a share card in a fallback font — and that image then gets
cached by every platform it's shared to. Bundling them makes the render
deterministic, and makes the widget pages themselves load without a round trip to
a third-party domain.

| File | Family | Weight |
| --- | --- | --- |
| `bebas-neue-400.woff2` | Bebas Neue | 400 |
| `space-mono-400.woff2` | Space Mono | 400 |
| `space-mono-700.woff2` | Space Mono | 700 |

## Licensing

Both families are licensed under the SIL Open Font License, Version 1.1, which
permits redistribution. The full license text is in `OFL.txt`.

- Bebas Neue — Copyright © 2010 by Dharma Type
- Space Mono — Copyright 2016 The Space Mono Project Authors
  (https://github.com/googlefonts/spacemono)

## Replacing them

If you swap the widget fonts, download the new `.woff2` files here, update the
`@font-face` blocks at the top of `../widget-core.css`, update the `--display`
and `--mono` variables just below them, and update the `FONT_DISPLAY` /
`FONT_MONO` strings in `../widget-core.js` (the exported SVG carries its own font
names, so it has to be changed in both places). Then re-run `tools/render-og.sh`.
