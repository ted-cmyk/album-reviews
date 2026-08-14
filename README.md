# 🎵 Album Review Widgets — Setup Guide

This is a permanent home for your interactive album rating widgets. Each album gets its own HTML file. You deploy once, and every widget stays online forever at its own URL.

---

## How This Folder Works

```
album-reviews/
├── TEMPLATE.html          ← Copy this for each new album (never edit this file directly)
├── README.md              ← You're reading this
└── albums/
    ├── 042-rumours.html   ← Each album is one file
    ├── 041-pet-sounds.html
    └── ...etc
```

The naming convention is `[rank]-[album-name].html` — all lowercase, dashes instead of spaces. This keeps things organized and gives you clean URLs.

---

## ONE-TIME SETUP (do this once, takes ~10 minutes)

### Step 1: Push to GitHub

1. Go to [github.com](https://github.com) and log in
2. Click the **+** button (top right) → **New repository**
3. Name it `album-reviews`
4. Set it to **Public**
5. Click **Create repository**
6. Upload this entire folder to that repo:
   - Click **"uploading an existing file"** on the empty repo page
   - Drag the `albums/` folder, `TEMPLATE.html`, and this `README.md` into the upload area
   - Click **Commit changes**

### Step 2: Connect Vercel

1. Go to [vercel.com](https://vercel.com) and sign up with your GitHub account
2. Click **Add New → Project**
3. It will show your GitHub repos — select **album-reviews**
4. Leave all settings as default (no framework, no build command needed — these are plain HTML files)
5. Click **Deploy**
6. Vercel gives you a URL like: `album-reviews.vercel.app`

That's it. Your albums are now live at:
```
https://album-reviews.vercel.app/albums/042-rumours.html
```

---

## EVERY TIME YOU WRITE A NEW POST (the regular workflow)

### Step 1: Create the album files

For each album in your post (usually 3):

1. Open `TEMPLATE.html` in any text editor (VS Code, TextEdit, Notepad — anything)
2. Find the section at the top that says **🎵 FILL IN YOUR ALBUM INFO BELOW 🎵**
3. Change these fields:
   - `rank` → the album's position on the Rolling Stone list
   - `title` → album name (in quotes)
   - `artist` → artist name (in quotes)
   - `year` → release year
   - `tracks` → list of songs with tier ratings

4. **Save As** into the `albums/` folder with the naming format:
   ```
   [rank]-[album-name].html
   ```
   Examples: `039-blue.html`, `038-abbey-road.html`

5. Repeat for the other 2 albums

### Here's what the edit section looks like:

```javascript
const ALBUM = {
  rank: 39,
  title: "Blue",
  artist: "Joni Mitchell",
  year: 1971,

  tracks: [
    { name: "All I Want",           tier: "S" },
    { name: "My Old Man",           tier: "A" },
    { name: "Little Green",         tier: "A" },
    { name: "Carey",                tier: "S" },
    { name: "Blue",                 tier: "B" },
    { name: "California",           tier: "S" },
    { name: "This Flight Tonight",  tier: "B" },
    { name: "River",                tier: "S" },
    { name: "A Case of You",        tier: "S" },
    { name: "The Last Time I Saw Richard", tier: "C" },
  ]
};
```

**Tier options:** `S` = Masterpiece, `A` = Great, `B` = Good, `C` = Not For Me

### Step 2: Upload to GitHub

1. Go to your `album-reviews` repo on GitHub
2. Navigate into the `albums/` folder
3. Click **Add file → Upload files**
4. Drag your new `.html` files in
5. Click **Commit changes**

Vercel automatically detects the new files and deploys them (usually takes about 30 seconds).

### Step 3: Embed in Substack

For each album widget in your post:

1. In the Substack editor, place your cursor where you want the widget
2. Click **+** → **Embed**
3. Paste the URL:
   ```
   https://album-reviews.vercel.app/albums/039-blue.html
   ```
4. Substack shows a preview — it should display the interactive widget
5. Repeat for the other 2 albums

---

## COMMON QUESTIONS

**Can I update an album after it's published?**
Yes. Edit the file on GitHub, commit the change, and Vercel redeploys automatically. The Substack embed updates because the URL stays the same.

**What if Substack's embed doesn't show the full widget?**
Some Substack embeds crop the height. If that happens, try wrapping the embed in a "Custom HTML" block instead:
```html
<iframe src="https://album-reviews.vercel.app/albums/042-rumours.html" width="100%" height="900" frameborder="0"></iframe>
```
Adjust the `height` number until it looks right (900 is a good starting point for most albums).

**What if I mess up a file?**
The TEMPLATE is your safety net — it never changes. Just copy it again and start over. You can also use GitHub's history to undo any changes.

**Can I edit files directly on GitHub?**
Yes! Click any file on GitHub, then click the pencil icon (edit). Change the album data, then click **Commit changes**. Vercel auto-deploys. This is handy for quick fixes.

**Do I need to pay for anything?**
No. GitHub (free for public repos), Vercel (free tier handles this easily), and Substack embeds are all free.

---

## MOBILE SHARE WIDGETS (`widgets/`)

Three infographics built for a phone screen first, each one designed to double
as the share image people see when the link gets posted. Same tier data as the
vinyl template, three different ways of reading it:

| Widget | What it shows | Best for |
| --- | --- | --- |
| `widgets/tier-spectrum.html` | One stacked bar of the tier split, plus exact counts and percentages | Making the shape of an album obvious in one glance |
| `widgets/track-grid.html` | Every track as a colour-coded square, tap for the title | Records where the track-by-track run matters |
| `widgets/score-card.html` | A single 0–100 score in a tier-segmented gauge | A headline number people can argue with |

They read the same `ALBUM` block as `TEMPLATE.html`, in the same place — near the
top of the file, above the "don't edit below this line" marker. Editing one is
exactly like editing an album file.

### Sharing them

Each page carries real Open Graph and Twitter Card tags pointing at a committed
1200x630 PNG in `og/`. Paste the URL into Substack, iMessage, Slack, Bluesky, or
anywhere else and the infographic shows up as the preview image instead of a
blank card.

**After you change an album's data, regenerate the share image:**

```bash
node tools/render-og.mjs              # all three
node tools/render-og.mjs score-card   # just one
```

Then commit the updated PNGs. If you skip this, the page updates but the image
people see when they share it still shows the old album. The script needs Chrome
or Chromium installed and nothing else — no `npm install`.

Adding `?og=1` to any widget URL shows you exactly what the share image will look
like, which is what the renderer screenshots.

### Downloading the graphics

Every widget has **Download SVG** and **Download PNG** buttons under the chart.
Both formats come out with the fonts embedded, so they look right on a machine
that has never had Bebas Neue installed — drop the PNG straight into a post, or
open the SVG in Figma or Illustrator to recolour it.

The download buttons need the page served over http, which is how it works on
Vercel. Opening the file straight off your desktop (a `file://` URL) still
renders the widget fine, but the browser blocks the font embedding — the export
falls back to a system font.

### If you deploy somewhere other than `album-reviews.vercel.app`

Open Graph requires absolute URLs, so the domain is written into each widget's
`<head>`. Search for `album-reviews.vercel.app` in the three files in `widgets/`
and replace it with your domain, then re-run the render script.

### What's in `widgets/shared/`

`widget-core.css` and `widget-core.js` hold everything the three widgets have in
common — the tier colours, the score maths, the share-card layout, the export
buttons. Change something there and all three change together. The fonts live in
`widgets/shared/fonts/` and are checked in on purpose; see the README in that
folder for why.
