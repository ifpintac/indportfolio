# Nicco Pintac — Product & Footwear Design Portfolio

Portfolio site of **Isiah Niccolas Pintac (Nicco)**, product and footwear designer based in Manila, Philippines.

**Live site:** https://niccopintac.com/

It's a single static page with no build step and no dependencies to install. Plain HTML, CSS and JavaScript.

## What's inside

```
index.html            The whole site: markup, styles and scripts
404.html              "Page not found" page for GitHub Pages
img/                  Project images (WebP), 800px mobile versions (*-800.webp)
                      and the social share image (nicco-pintac-portfolio.jpg)
favicon.svg           Browser tab icon
favicon-32.png        PNG fallback icon
apple-touch-icon.png  Home-screen icon for iPhone and iPad
robots.txt            Lets search engines crawl the site
sitemap.xml           Tells search engines where the page is
.nojekyll             Tells GitHub Pages to serve the files as they are
```

## Sections

- **Home:** animated 8-bit topographic hero (WebGL, with a static fallback)
- **Selected projects:** four featured picks and a filterable list of all 14 projects
- **Product design:** Pocket Wrestler, Urban Mobility E-trike, E-kuliglig Tractor, Jolt Board, Exhibition Booths
- **Footwear design:** Wave, Bloom, Finn Cotton, BIGWASI, PAMBA, Patchwork Rag Basketball, Sketchbook
- **3D renders:** Vesper Mini Echo, Meta Quest 3, Formula 1 Car
- **About, Behance archive and contact**

Light mode is the default, and visitors can switch to dark mode with the toggle. Their choice is remembered.

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
