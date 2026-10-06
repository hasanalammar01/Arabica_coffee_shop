# Arabica deli-café website

Next.js 16 (App Router) + TypeScript + Tailwind CSS 4. Every page is static, so it is fast and cheap to host.

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build (fails if the menu data is invalid)
npm run lint && npm run typecheck && npm test
```

## Edit the menu: the admin at `/admin`

Staff add, edit, reorder and remove **sections** and **items** at `https://your-domain/admin`, in a simple form editor (Decap CMS). Each item has a name, a price in L.L, and optional description, photo, flavours/choices, sizes, tags and an "extra / add-on" switch. Clicking **Publish** saves the menu, and the live site updates about a minute later.

- Sections and items can be dragged to reorder them. A new section stays hidden until it has at least one item.
- Tags (`Vegan`, `New`…) turn on the filter buttons on the menu page automatically.
- If a published change can't be shown (for example an item with no price), the site **keeps the previous menu**, and the build log on Vercel/Netlify lists exactly what to fix.

### Try it on your computer

```bash
npm run dev      # terminal 1
npm run cms      # terminal 2: lets /admin edit the local files, no login
```

Open http://localhost:3000/admin, click **Login**, edit, and **Publish**. Changes are written to `data/menu.json` (photos go to `public/menu/`) and appear on http://localhost:3000/menu straight away.

### Go live (one-time setup)

Editors sign in with a **GitHub account**. Every change is saved as a commit, so nothing is ever lost and any change can be undone.

1. Put this project in a GitHub repository and deploy it on Vercel or Netlify from that repository.
2. The admin is already pointed at `hasanalammar01/Arabica_coffee_shop` on branch `main` (`REPO` in `public/admin/index.html`). Change it there if the repository moves.
3. On GitHub, go to **Settings → Developer settings → OAuth Apps → New OAuth App**:
   - Homepage URL: `https://your-domain`
   - Authorization callback URL: `https://your-domain/api/decap/callback`
4. In the hosting dashboard, add the environment variables `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` from that OAuth app (see `.env.example`), then redeploy.
5. Invite each editor's GitHub account to the repository (**Settings → Collaborators**, write access).

### Editing the file directly

The admin edits `data/menu.json`, which can also be edited by hand:

```json
{ "name": "Iced Latte", "price": 400000, "image": "/menu/iced-latte.webp" }
```

Optional fields: `description`, `options` (`["Peach", "Lemon"]`), `sizes` (`[{ "size": "Large", "price": 450000 }]`, replaces `price`), `tags` (`vegan`, `gluten-free`, `spicy`, `new`, `bestseller`), `addon` (`true`), `image` (path under `public/`). Links to each section (`/menu#cold-drinks`) are made from the section name.

`npm run build` and `npm test` check the menu and list every problem: missing name or price, unknown tag, photo not found.

### Open questions from the PDF

The original PDF left these unclear. They are on the site as printed, so check and correct them in the admin:

- "D.Espresso" was read as **Double Espresso**.
- **Special Tea**: the five blends were printed under it; are they its flavours? How does **Tea Box** differ?
- The six drinks printed under Smoothies (Mint Lemonade, Strawberry Lychee, …) have no heading of their own.
- **Khodra** (70,000) is listed as an add-on; is it a standalone saj?
- **Dark Blue, BoomBoom, Pacha**: bottled brands? **Cocktail** saj, **Cake**, **Nuts**: need a description.
- Hot Chocolate appeared twice in the PDF (same price) and is listed once.

## Shop details and opening hours

Edit **`data/site.ts`**: address, Google Maps search, phone, WhatsApp, email, Instagram, hours and the site's domain. Anything left `undefined` is hidden on the site. Hours use 24h time, and a closing time earlier than the opening time means "after midnight":

```ts
hours: [
  { days: [1, 2, 3, 4, 5], open: "08:00", close: "23:00" }, // Monday–Friday
  { days: [6, 0], open: "10:00", close: "01:00" },          // Saturday–Sunday, until 1am
],
```

"Open now / Closed now" is calculated in the visitor's browser using Beirut time (`timeZone`).

## Colours, fonts and other design tokens

All in **`app/globals.css`**, in the `@theme` block (light mode) and the `prefers-color-scheme: dark` block below it. Change a hex value there and it updates everywhere. The cement-tile pattern is the `.tile` class in the same file.

Fonts are loaded in `app/layout.tsx` with `next/font` (Young Serif for headings, Readex Pro for text). To swap one, import another family from `next/font/google` and keep the same `variable` name.

## Images

- Menu photos live in `public/menu/` (WebP or PNG; transparent cut-outs look best on the green panels). Upload them in the admin, or reference them from `data/menu.json`. Next.js resizes and converts them automatically.
- The photos currently on the site were extracted from the PDF and are about 250px wide. Higher-resolution versions (800px+) will look sharper on phones.
- The logo is `public/logo.svg` (full) and `public/logo-mark.svg` (Arabic only), extracted from the PDF as vectors.
- `public/arabica-menu.pdf` is the "Download PDF menu" file. Replace it whenever the printed menu changes, or remove the button in `app/menu/page.tsx`.

## QR code

```bash
npm run qr                                   # uses site.url from data/site.ts + /menu
npm run qr -- https://your-domain.com/menu   # or any URL
```

Writes `public/qr-menu.svg` (for print) and `public/qr-menu.png` (1200px). Set the real domain in `data/site.ts` first.

## Analytics (off by default)

Set `NEXT_PUBLIC_PLAUSIBLE_DOMAIN=your-domain.com` in the hosting dashboard to turn on [Plausible](https://plausible.io) (no cookies, no consent banner needed). Leave it unset and no analytics script loads.

## Deploy

- **Vercel:** import the repository, no settings needed.
- **Netlify:** import the repository; it detects Next.js automatically.

After the first deploy, set `url` in `data/site.ts` to the live domain (used for SEO, the sitemap and the QR code) and redeploy.

## What's where

```
app/            pages: home, menu, about, contact (Visit), 404, error, loading; SEO files; api/decap (admin login)
components/     MenuBrowser (search, filters, scroll-spy), DrinkCard, Price, Visit, OpenStatus, Header, Footer, Logo
data/           menu.json (edited via /admin), menu.ts (types), site.ts (shop details)
lib/            menu validation, opening-hours logic (+ tests), price formatting
public/         images, logo, PDF, service worker (offline menu), QR code, admin/ (menu editor)
assets/         original PDF and raw extracted images (not served)
scripts/qr.mjs  QR code generator
```
