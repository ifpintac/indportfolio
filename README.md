# Nicco Pintac — Product & Footwear Design Portfolio

Portfolio site of **Isiah Niccolas Pintac (Nicco)**, product and footwear designer based in Manila, Philippines.

**Live site:** https://niccopintac.com/

It's a single static page with no build step and no dependencies to install. Plain HTML, CSS and JavaScript.

## What's inside

```
index.html                     Home: full-screen panels that snap as you scroll, one per project
product-design/                Industrial and product design overview + one case study per project
footwear-design/               Footwear and sneaker design overview + case studies
3d-rendering/                  3D rendering overview + case studies
404.html                       "Page not found" page for GitHub Pages
Nicco-Pintac-Portfolio-2026.pdf  Printable slide-deck version of the portfolio
img/                           Images (WebP, 800px mobile versions *-800.webp) and share images (*-share.jpg)
favicon*.png, favicon.svg      Browser tab and search result icons
apple-touch-icon.png           Home-screen icon for iPhone and iPad
robots.txt                     Crawling rules (keeps image search on the project photos)
sitemap.xml                    Every page plus its main images, for search engines
google*.html                   Google Search Console ownership check (keep it)
*.txt (32 hex characters)      IndexNow key for Bing and other engines (keep it)
.nojekyll                      Tells GitHub Pages to serve the files as they are
```

## Pages

- **Home:** intro, the filterable project list, then a full-screen panel per discipline and per project (image, short pitch, key facts, link to the case study). Scrolling snaps from panel to panel.
- **Case studies:** one page per project with the full story, specs, process and galleries, at addresses like `/footwear-design/wave-technical-sneaker/`.
- **Discipline pages:** `/product-design/`, `/footwear-design/` and `/3d-rendering/` introduce each discipline and link to its case studies.

## Publish with GitHub Pages

1. Push these files to the `main` branch.
2. On GitHub, open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, then pick `main` and `/ (root)`, and save.
4. After a minute or two the site is live at `https://niccopintac.com/`.

### Custom domain

The site is served at **niccopintac.com** (registered at Porkbun). The `CNAME` file tells GitHub Pages which domain to use.

DNS at Porkbun points the root domain at GitHub Pages with four `A` records (`185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`) and four `AAAA` records (`2606:50c0:8000::153` to `2606:50c0:8003::153`), and `www` is a `CNAME` to `ifpintac.github.io`. HTTPS is enforced in Settings → Pages.

If the domain ever changes, update `CNAME`, the `canonical` link, `og:url`, `og:image`, `twitter:image` and the JSON-LD `url` / `@id` values in `index.html`, plus `robots.txt` and `sitemap.xml`.

## Preview locally

Open `index.html` in a browser, or run a local server from this folder:

```
python3 -m http.server 8000
```

Then visit http://localhost:8000.

## Updating content

- **Text:** edit `index.html`. Each project is an `<article class="case" id="…">` block.
- **Images:** add a WebP to `img/` with a descriptive name (for example `nicco-pintac-wave-technical-sneaker.webp`, which helps image search) and reference it with `width` and `height` set, so the layout doesn't jump while it loads.
- **Project list:** each row lives in `<ol class="board" id="board">`. Rows with `data-feat="1"` are featured.

## Credits

- Typefaces: [Barlow, Barlow Condensed, Barlow Semi Condensed](https://fonts.google.com/specimen/Barlow) by Jeremy Tribby, and [Silkscreen](https://fonts.google.com/specimen/Silkscreen) by Jason Kottke. Both are SIL Open Font License, served by Google Fonts.
- Icons: [Lucide](https://lucide.dev), ISC License. The pixel arrows are custom.
- Simplex noise in the hero shader: Ashima Arts and Stefan Gustavson, MIT License ([webgl-noise](https://github.com/ashima/webgl-noise)).

Meta and Quest are trademarks of Meta Platforms, Inc. Formula 1 and F1 are trademarks of Formula One Licensing B.V. The Quest 3 and Formula 1 renders are independent render studies, with no affiliation to or endorsement by either company.

## Rights

© 2026 Isiah Niccolas Pintac. All rights reserved. The designs, images and text on this site may not be reused without permission. The site's code structure is shared for reference only.
