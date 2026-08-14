#!/usr/bin/env node
/**
 * Regenerate the 1200x630 share images in og/.
 *
 * Run this after editing any widget's ALBUM block, otherwise the image people
 * see when they share the link will still show the old data.
 *
 *   node tools/render-og.mjs              # all widgets
 *   node tools/render-og.mjs score-card   # just one
 *
 * Requires Chrome or Chromium, and Node 18+. No npm install — it talks to the
 * browser over the DevTools protocol using Node's built-in WebSocket.
 *
 * Why not `chrome --screenshot --window-size=1200,630`? Because --window-size
 * sizes the *window*, and headless Chrome subtracts its own UI from that: asking
 * for 630 gets you a 543px viewport and an image quietly cropped at the bottom.
 * Setting the viewport explicitly over CDP is the only way to be sure the PNG is
 * the size Open Graph was promised.
 */

import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'og');

const WIDTH = 1200;
const HEIGHT = 630;
const ALL_WIDGETS = ['tier-spectrum', 'track-grid', 'score-card'];

// ---------------------------------------------------------------- chrome

const CHROME_CANDIDATES = [
  process.env.CHROME_BIN,
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
];

async function findChrome() {
  // Playwright's bundled builds move around by version, so glob for them first.
  const pwRoot = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  const { readdir } = await import('node:fs/promises');

  try {
    const entries = await readdir(pwRoot);
    for (const entry of entries.filter((name) => name.startsWith('chromium-'))) {
      CHROME_CANDIDATES.push(join(pwRoot, entry, 'chrome-linux', 'chrome'));
    }
  } catch {
    // No Playwright install here — fine, the standard paths below still apply.
  }

  for (const candidate of CHROME_CANDIDATES) {
    if (!candidate) continue;
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      // keep looking
    }
  }

  throw new Error(
    'Could not find Chrome or Chromium.\n' +
    'Install it, or point CHROME_BIN at the binary and re-run.'
  );
}

function launch(binary, profileDir) {
  const chrome = spawn(binary, [
    '--headless',
    '--remote-debugging-port=0',
    `--user-data-dir=${profileDir}`,
    '--no-sandbox',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--disable-extensions',
    '--force-color-profile=srgb',
    'about:blank'
  ]);

  return new Promise((resolve, reject) => {
    let stderr = '';

    const timer = setTimeout(() => {
      chrome.kill();
      reject(new Error('Chrome did not report a DevTools endpoint within 30s.\n' + stderr));
    }, 30000);

    chrome.stderr.on('data', (chunk) => {
      stderr += chunk;
      const match = stderr.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) {
        clearTimeout(timer);
        resolve({ chrome, endpoint: match[1] });
      }
    });

    chrome.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Chrome exited early (code ${code}).\n${stderr}`));
    });
  });
}

// ---------------------------------------------------------------- CDP

/** Minimal DevTools client: enough to open a page, size it, and photograph it. */
class Devtools {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = [];

    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);

      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
        return;
      }

      this.listeners.forEach((listener) => listener(message));
    });
  }

  static connect(endpoint) {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(endpoint);
      socket.addEventListener('open', () => resolve(new Devtools(socket)));
      socket.addEventListener('error', () => reject(new Error('Could not connect to ' + endpoint)));
    });
  }

  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify(payload));
    });
  }

  once(method, sessionId, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.listeners = this.listeners.filter((l) => l !== listener);
        reject(new Error(`Timed out waiting for ${method}`));
      }, timeoutMs);

      const listener = (message) => {
        if (message.method !== method) return;
        if (sessionId && message.sessionId !== sessionId) return;
        clearTimeout(timer);
        this.listeners = this.listeners.filter((l) => l !== listener);
        resolve(message.params);
      };

      this.listeners.push(listener);
    });
  }

  close() {
    this.socket.close();
  }
}

// ---------------------------------------------------------------- render

async function render(client, widget) {
  const source = join(ROOT, 'widgets', `${widget}.html`);
  await access(source, constants.R_OK);

  const { targetId } = await client.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await client.send('Target.attachToTarget', { targetId, flatten: true });

  try {
    // The viewport, not the window. This is the whole point of using CDP.
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: WIDTH,
      height: HEIGHT,
      deviceScaleFactor: 1,
      mobile: false
    }, sessionId);

    await client.send('Page.enable', {}, sessionId);

    const loaded = client.once('Page.loadEventFired', sessionId);
    // ?og=1 switches the page into its fixed 1200x630 share-card layout.
    await client.send('Page.navigate', {
      url: `${pathToFileURL(source).href}?og=1`
    }, sessionId);
    await loaded;

    // Fonts are bundled in the repo, but they're still loaded asynchronously —
    // capturing before they resolve bakes a fallback typeface into the PNG.
    await client.send('Runtime.evaluate', {
      expression: 'document.fonts.ready.then(() => true)',
      awaitPromise: true
    }, sessionId);

    const { data } = await client.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT, scale: 1 }
    }, sessionId);

    const target = join(OUT_DIR, `${widget}.png`);
    await writeFile(target, Buffer.from(data, 'base64'));
    return target;
  } finally {
    await client.send('Target.closeTarget', { targetId });
  }
}

// ---------------------------------------------------------------- main

const requested = process.argv.slice(2);
const widgets = requested.length ? requested : ALL_WIDGETS;

const binary = await findChrome();
const profileDir = join(tmpdir(), `og-render-${process.pid}`);
await mkdir(OUT_DIR, { recursive: true });

const { chrome, endpoint } = await launch(binary, profileDir);
const client = await Devtools.connect(endpoint);

try {
  for (const widget of widgets) {
    process.stdout.write(`Rendering ${widget} -> og/${widget}.png\n`);
    await render(client, widget);
  }
  process.stdout.write('\nDone. Commit the PNGs in og/ so the share previews pick them up.\n');
} finally {
  client.close();

  // Chrome keeps writing to its profile for a moment after the kill signal, so
  // removing the directory immediately races it and throws ENOTEMPTY.
  const exited = new Promise((resolve) => chrome.once('exit', resolve));
  chrome.kill();
  await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 5000))]);

  // A leftover temp directory is not worth failing the render over.
  await rm(profileDir, { recursive: true, force: true }).catch(() => {});
}
