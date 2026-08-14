/* ==========================================================
   SHARED WIDGET ENGINE
   Used by every file in widgets/. Don't edit unless you want
   the change to apply to all three widgets at once.
   ========================================================== */

window.AlbumWidget = (function () {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';

  var TIER_COLORS = { S: '#FF69B4', A: '#5AC8FA', B: '#34C759', C: '#FF9500' };
  var TIER_LABELS = { S: 'Masterpiece', A: 'Great', B: 'Good', C: 'Not For Me' };
  var TIER_POINTS = { S: 4, A: 3, B: 2, C: 1 };
  var TIER_ORDER = ['S', 'A', 'B', 'C'];

  /* Fonts are repeated as literal strings (not CSS vars) because exported
     SVG travels away from this stylesheet and has to stand on its own. */
  var FONT_DISPLAY = "'Bebas Neue','Oswald',Impact,Haettenschweiler,sans-serif";
  var FONT_MONO = "'Space Mono','DejaVu Sans Mono',ui-monospace,monospace";

  var BG = '#0a0a0a';
  var TEXT = '#f0ece4';
  var TEXT_MUTED = '#8a8580';

  // ---------- small helpers ----------

  function el(tag, attrs) {
    var node = document.createElementNS(SVG_NS, tag);
    if (attrs) {
      for (var key in attrs) {
        if (Object.prototype.hasOwnProperty.call(attrs, key)) {
          node.setAttribute(key, attrs[key]);
        }
      }
    }
    return node;
  }

  function text(str, attrs) {
    var node = el('text', attrs);
    node.textContent = str;
    return node;
  }

  function slug(str) {
    return String(str).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  /* Read an album and hand back everything the three widgets need.
     Tracks with an unrecognised tier are dropped rather than crashing
     the render — a typo in the data block shouldn't blank the page. */
  function stats(album) {
    var tracks = [];
    var skipped = [];

    (album.tracks || []).forEach(function (track) {
      if (TIER_ORDER.indexOf(track.tier) === -1) skipped.push(track);
      else tracks.push(track);
    });

    if (skipped.length) {
      console.warn('[album-widget] ignored ' + skipped.length +
        ' track(s) with an unknown tier. Valid tiers are S, A, B, C.', skipped);
    }

    var counts = {};
    TIER_ORDER.forEach(function (tier) { counts[tier] = 0; });
    tracks.forEach(function (track) { counts[track.tier] += 1; });

    var total = tracks.length;
    var points = tracks.reduce(function (sum, track) {
      return sum + TIER_POINTS[track.tier];
    }, 0);

    return {
      tracks: tracks,
      counts: counts,
      total: total,
      // 0-100, where every track being S-tier is 100.
      score: total ? Math.round((points / (total * TIER_POINTS.S)) * 100) : 0,
      tiersUsed: TIER_ORDER.filter(function (tier) { return counts[tier] > 0; })
    };
  }

  function isOgMode() {
    var value = new URLSearchParams(window.location.search).get('og');
    return value !== null && value !== '0' && value !== 'false';
  }

  // ---------- export ----------

  /* An exported SVG leaves this page behind, and when the PNG exporter loads it
     into an <img> the browser isolates it from the document entirely — no
     stylesheet, no @font-face, no webfont. So the export has to carry its own
     fonts, base64'd straight into the file. ~40KB, and worth it: without this
     every downloaded graphic silently comes out in the wrong typeface. */
  var FONT_FILES = [
    { family: 'Bebas Neue', weight: 400, url: 'shared/fonts/bebas-neue-400.woff2' },
    { family: 'Space Mono', weight: 400, url: 'shared/fonts/space-mono-400.woff2' },
    { family: 'Space Mono', weight: 700, url: 'shared/fonts/space-mono-700.woff2' }
  ];

  var fontCssPromise = null;

  function toBase64(buffer) {
    var bytes = new Uint8Array(buffer);
    var binary = '';
    // Chunked — fromCharCode.apply blows the stack on a whole font at once.
    for (var i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    }
    return btoa(binary);
  }

  function loadFontCss() {
    if (fontCssPromise) return fontCssPromise;

    fontCssPromise = Promise.all(FONT_FILES.map(function (font) {
      return fetch(font.url).then(function (response) {
        if (!response.ok) throw new Error(font.url + ' -> ' + response.status);
        return response.arrayBuffer();
      }).then(function (buffer) {
        return "@font-face{font-family:'" + font.family + "';font-style:normal;" +
          'font-weight:' + font.weight + ';src:url(data:font/woff2;base64,' +
          toBase64(buffer) + ") format('woff2');}";
      });
    })).then(function (rules) {
      return rules.join('\n');
    }).catch(function (error) {
      /* Opening the file straight off disk (file://) trips CORS here. The
         export still works, it just falls back to a system font. */
      console.warn('[album-widget] could not embed fonts in the export — text ' +
        'will use a fallback font. This is expected when opening the file ' +
        'locally rather than over http.', error);
      return '';
    });

    return fontCssPromise;
  }

  /* Colours and font names are already inline presentation attributes at draw
     time, so all this adds is the backdrop and the font payload. */
  function serialize(svg, width, height, fontCss) {
    var clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', SVG_NS);
    clone.setAttribute('width', width);
    clone.setAttribute('height', height);

    if (fontCss) {
      var style = el('style', { type: 'text/css' });
      style.textContent = fontCss;
      clone.insertBefore(style, clone.firstChild);
    }

    var backdrop = el('rect', { x: 0, y: 0, width: '100%', height: '100%', fill: BG });
    clone.insertBefore(backdrop, clone.firstChild);

    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
      new XMLSerializer().serializeToString(clone);
  }

  function saveBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Give the browser a beat to start the download before tearing the URL down.
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function exportSVG(svg, filename, width, height) {
    return loadFontCss().then(function (fontCss) {
      saveBlob(new Blob([serialize(svg, width, height, fontCss)], {
        type: 'image/svg+xml;charset=utf-8'
      }), filename + '.svg');
    });
  }

  /* SVG -> canvas -> PNG. Rasterising at 2x keeps the text crisp when the
     image gets dropped into a post at full width. */
  function exportPNG(svg, filename, width, height, scale) {
    var ratio = scale || 2;

    return loadFontCss().then(function (fontCss) {
      return new Promise(function (resolve, reject) {
        var source = serialize(svg, width, height, fontCss);
        var image = new Image();

        image.onload = function () {
          var canvas = document.createElement('canvas');
          canvas.width = width * ratio;
          canvas.height = height * ratio;

          var ctx = canvas.getContext('2d');
          ctx.fillStyle = BG;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

          canvas.toBlob(function (blob) {
            if (blob) { saveBlob(blob, filename + '.png'); resolve(); }
            else reject(new Error('canvas.toBlob returned null'));
          }, 'image/png');
        };

        image.onerror = function () {
          reject(new Error('the browser refused to rasterise the SVG'));
        };

        image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(source);
      });
    });
  }

  // ---------- page chrome ----------

  /* Fills in the bits every widget shares: heading, legend, export buttons,
     and the ?og=1 switch. Each widget then draws its own figure. */
  function init(album, options) {
    var data = stats(album);
    var opts = options || {};
    var ogMode = isOgMode();

    if (ogMode) document.body.classList.add('og-mode');

    var setText = function (selector, value) {
      var node = document.querySelector(selector);
      if (node) node.textContent = value;
    };

    setText('[data-tool-tag]', opts.toolName || '');
    setText('[data-album-rank]', '#' + album.rank + " on Rolling Stone's Top 100");
    setText('[data-album-title]', album.title);
    setText('[data-album-artist]', album.artist + ' · ' + album.year);

    var legend = document.querySelector('[data-legend]');
    if (legend) {
      data.tiersUsed.forEach(function (tier) {
        var item = document.createElement('div');
        item.className = 'legend-item';

        var dot = document.createElement('span');
        dot.className = 'legend-dot';
        dot.style.background = TIER_COLORS[tier];

        item.appendChild(dot);
        item.appendChild(document.createTextNode(
          tier + ' · ' + TIER_LABELS[tier] + ' · ' + data.counts[tier]
        ));
        legend.appendChild(item);
      });
    }

    return {
      data: data,
      ogMode: ogMode,
      /* Call once the widget has drawn its figure, so the export buttons
         know what they're exporting. */
      wireExports: function (svg, width, height) {
        var filename = slug(album.artist + '-' + album.title + '-' + (opts.toolName || 'widget'));

        /* Embedding the fonts means the first click has to fetch ~46KB, so the
           button reports that it's working rather than looking dead. */
        var bind = function (selector, run) {
          var button = document.querySelector(selector);
          if (!button) return;

          button.addEventListener('click', function () {
            if (button.disabled) return;

            var label = button.textContent;
            button.disabled = true;
            button.textContent = 'Preparing…';

            run().catch(function (error) {
              console.error('[album-widget] export failed', error);
              window.alert('Sorry — the export failed: ' + error.message);
            }).then(function () {
              button.disabled = false;
              button.textContent = label;
            });
          });
        };

        bind('[data-export-svg]', function () { return exportSVG(svg, filename, width, height); });
        bind('[data-export-png]', function () { return exportPNG(svg, filename, width, height, 2); });
      }
    };
  }

  return {
    TIER_COLORS: TIER_COLORS,
    TIER_LABELS: TIER_LABELS,
    TIER_ORDER: TIER_ORDER,
    FONT_DISPLAY: FONT_DISPLAY,
    FONT_MONO: FONT_MONO,
    BG: BG,
    TEXT: TEXT,
    TEXT_MUTED: TEXT_MUTED,
    el: el,
    text: text,
    stats: stats,
    init: init
  };
}());
