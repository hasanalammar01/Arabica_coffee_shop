# Arabica deli-café website

Next.js 16 (App Router) + TypeScript + Tailwind CSS 4. Every page is static, so it is fast and cheap to host.

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build (fails if the menu data is invalid)
npm run lint && npm run typecheck && npm test
```

## Edit the menu: the admin at `/admin`

Staff manage the menu at `https://your-domain/admin`, a dashboard built from the approved Figma design ("Staff dashboard design"):

- **Menu items:** search, add, edit, duplicate, move up/down and delete items. Each item has a name, a price in L.L (or prices by size), and optional description, photo, flavours/choices, tags and an "add-on" switch, with a live preview. **Order options** are choice groups such as Nestlé (pick one, optional: With / Without) or Presses (pick one, required: 1 · 1½ · 2), with optional extra prices; guests see them as bullet lists in the item's details and choose when ordering. "Copy choices from another item" reuses a set on other drinks.
- **Sections:** rename, reorder, add and delete sections. A section with items can't be deleted, and a new section stays hidden on the site until it has an item.
- **Shop info:** address, Google Maps link, phone, WhatsApp, Instagram, email and opening hours (`data/site.json`).

Clicking **Publish** saves one commit to GitHub (menu and any new photo together), and the live site updates about a minute later. Before publishing, the admin checks the whole menu (every item needs a name and a price) and explains what to fix. If someone else published in the meantime, it stops and asks you to reload instead of overwriting their work. Uploaded photos are resized to 800px WebP in the browser, so a phone photo of several MB becomes about 100 KB.

Tags (`Vegan`, `New`…) turn on the filter buttons on the public menu automatically.

### Try it on your computer

```bash
npm run dev
```

Open http://localhost:3000/admin. With no `ADMIN_PASSWORD` set, it opens without a login and **Publish** writes straight to `data/menu.json` / `data/site.json` (photos go to `public/menu/`), so http://localhost:3000/menu updates right away. Nothing is sent to GitHub until you commit.

### Go live (one-time setup)

Staff sign in with a username and password (username `admin` and `ADMIN_PASSWORD` until they're changed in **Settings**); they don't need a GitHub account. When they publish, the website itself saves the change to this GitHub repository using a key that only the server knows. Every change is a commit, so nothing is ever lost and any change can be undone.

1. Deploy the repository on Vercel (Import → `hasanalammar01/Arabica_coffee_shop`).
2. Create the website's GitHub key: GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
   - Repository access: **Only select repositories** → `Arabica_coffee_shop`.
   - Permissions: **Contents → Read and write** (nothing else).
   - Expiration: pick a date and set a reminder; when it expires, publishing stops with a clear message until you paste a new token.
3. In Vercel → Project → **Settings → Environment Variables**, add (see `.env.example`):
   - `ADMIN_PASSWORD`: the first admin password (username `admin`). Use a long one (four or more random words). Once it's changed in the admin's Settings, the new one (stored hashed in the database) is used instead.
   - `GITHUB_TOKEN`: the key from step 2.
4. Redeploy (Vercel → Deployments → ⋯ → Redeploy) so the new variables take effect.

The repository and branch are set in `lib/admin/store.ts` (`REPO`, `BRANCH`).

### Staff accounts

The super admin (the login above, with the PIN) creates staff accounts in **Settings → Staff accounts**: a username, a password (10+ characters) and the pages they can open. New accounts get Menu items, Sections, Shop info and Orders; Statistics, Payment methods and Settings are off until ticked. Staff sign in on the same `/admin` page (no PIN step) and every staff member can change their own password under Settings. Staff can never manage staff accounts or change the super admin's login, PIN or the WhatsApp number, even with Settings access. The server enforces all of this on every request (`lib/admin/permissions.ts`, `lib/admin/guard.ts`); changing, disabling or deleting an account signs that person out, and menu commits record who published them.

Accounts live in the `staff` table (passwords hashed with scrypt), never in this repository.

New accounts and password resets get a generated password (`xxxx-xxxx-xxxx`, no look-alike characters) and a **Download PDF** with the sign-in address, username, password and pages. The PDF is made in the browser (`lib/admin/credentials-pdf.ts`) and the password is shown only that once, since the server keeps only its hash. Each account shows **Online now** (active in the last 5 minutes), **Signed out …**, **Last seen …** or **Never signed in**.

### Activity log

**Activity** (super admin only) lists everything done in the admin, newest first: sign-ins and sign-outs, wrong passwords and PINs, menu and shop publishes, order status changes, settings saves (which parts changed), staff account changes, test messages and PIN resets. Filter by person. Entries are kept 90 days (`activity` table); passwords and codes are never recorded, and a username is only logged for a failed sign-in when it belongs to a real account.

### Sign-in PIN

Once a 4-digit PIN is created in **Settings → Sign-in PIN**, signing in takes the password and then the PIN. Changing the login, the PIN or the WhatsApp number needs the PIN too, and wrong PINs count towards the same lockout as wrong passwords (5 tries, then 15 minutes).

**Forgot PIN?** on the PIN screen (only after the correct password) sends a 6-digit code to the admin WhatsApp number from Settings (CallMeBot), valid 10 minutes and once; at most 3 codes an hour. If WhatsApp isn't set up, remove the PIN from the database instead (Neon → SQL Editor, on the `main` branch); the admin then creates a new one:

```sql
update settings set data = data - 'pinHash' - 'pinReset' where id = 1;
```

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

## Online orders

Customers order from the menu (an **+** button on each item, a cart bar, and a checkout page at `/order`) when **Settings → Accept online orders** is on. Orders are only taken during the opening hours from Shop info, and the server always re-prices the cart from the menu. Payment isn't taken online: customers pick one of the methods set under **Payment methods** (cash on delivery, Whish, card on delivery…) and see its instructions.

Staff see orders under **Orders** (a "new" badge, a sound and the count in the tab title; Accept → Mark as done, or Cancel), and totals for today, this week, this month and all time under **Statistics**.

Orders and settings live in a Postgres database, never in this public repository (they hold customers' phones and addresses). One-time setup:

1. Vercel → **Storage → Create → Neon**, connect it to the project (prefix `DATABASE`, so the variable is `DATABASE_URL`). The tables are created automatically.
2. Locally, put the same connection string in `.env.local` as `DATABASE_URL=…` (never committed). Local and live share this database.
3. Notifications, both optional, set in the admin under **Settings**:
   - **WhatsApp** via [CallMeBot](https://www.callmebot.com/blog/free-api-whatsapp-messages/) (free, messages your own phone): activate it once from the phone that should get orders, then paste the number and key.
   - **Email** via [Resend](https://resend.com) (free plan): add `RESEND_API_KEY` in Vercel and redeploy. Without a verified domain, Resend only delivers to the email you signed up with; verify a domain and set `EMAIL_FROM` to send elsewhere.

A notification that fails never loses an order: it's already saved and shows in the admin.

## Shop details and opening hours

Edit them in the admin under **Shop info**, or by hand in **`data/site.json`** (also holds the site's domain, `url`). Empty fields are hidden on the site. The Google Maps field takes a pasted link (opens directly) or a place name (also shows an embedded map on the contact page). Hours use 24h time, days are 0 = Sunday … 6 = Saturday, and a closing time earlier than the opening time means "after midnight":

```json
"hours": [
  { "days": [1, 2, 3, 4, 5], "open": "08:00", "close": "23:00" },
  { "days": [6, 0], "open": "10:00", "close": "01:00" }
]
```

"Open now / Closed now" is calculated in the visitor's browser using Beirut time (`timeZone`).

## Colours, fonts and other design tokens

All in **`app/globals.css`**, in the `@theme` block (light mode) and the `prefers-color-scheme: dark` block below it. Change a hex value there and it updates everywhere. The cement-tile pattern is the `.tile` class in the same file.

Fonts are loaded in `app/layout.tsx` with `next/font` (Young Serif for headings, Readex Pro for text). To swap one, import another family from `next/font/google` and keep the same `variable` name.

## Images

- Menu photos live in `public/menu/` (WebP or PNG; transparent cut-outs look best on the brown tiles). Upload them in the admin, or reference them from `data/menu.json`. Next.js resizes and converts them automatically.
- The photos currently on the site were extracted from the PDF and are about 250px wide. Higher-resolution versions (800px+) will look sharper on phones.
- The logo is `public/logo.svg` (full) and `public/logo-mark.svg` (Arabic only), extracted from the PDF as vectors.
- `public/arabica-menu.pdf` is the "Download PDF menu" file. Replace it whenever the printed menu changes, or remove the button in `app/menu/page.tsx`.

## QR code

```bash
npm run qr                                   # uses url from data/site.json + /menu
npm run qr -- https://your-domain.com/menu   # or any URL
```

Writes `public/qr-menu.svg` (for print) and `public/qr-menu.png` (1200px), with the Arabica logo in the middle (high error correction keeps it scannable). The current code points at `https://arabica-deli-cafe.vercel.app/menu`. Printed codes can't be changed, so if the site ever moves to another domain, keep this address redirecting to it in Vercel → Domains.

## Analytics (off by default)

Set `NEXT_PUBLIC_PLAUSIBLE_DOMAIN=your-domain.com` in the hosting dashboard to turn on [Plausible](https://plausible.io) (no cookies, no consent banner needed). Leave it unset and no analytics script loads.

## Deploy

- **Vercel:** import the repository, no settings needed.
- **Netlify:** import the repository; it detects Next.js automatically.

After the first deploy, set `url` in `data/site.json` to the live domain (used for SEO, the sitemap and the QR code) and redeploy.

## What's where

```
app/(site)/     public pages: home, menu, about, contact (Visit), error, loading
app/admin/      staff dashboard page and its styles (admin.css, scoped under .admin)
app/api/admin/  session (sign-in), files (read/publish menu files), orders and settings
app/api/orders/ public: ordering on/off + payment methods (GET), place an order (POST)
app/            root layout, 404, SEO files (sitemap, robots, share image, icon)
components/     public site: MenuBrowser, DrinkCard, Price, Visit, OpenStatus, Header, Footer, Logo
components/admin/  dashboard screens: AdminApp, MenuItems, ItemEditor, Sections, ShopInfo, Orders, Settings, ui
components/order/  online ordering: Add button + choice sheet, cart bar, checkout
data/           menu.json + site.json (edited via /admin), menu.ts + site.ts (types)
lib/            menu validation (menu-core.ts runs in the browser too), orders-core.ts (pricing, validation,
                statistics), db.ts (Postgres), notify.ts (WhatsApp/email), opening hours, formatting, tests
lib/admin/      draft <-> JSON conversion, photo resizing (+ tests); auth.ts + store.ts run on the server
public/         images, logo, PDF, service worker (offline menu), QR code
assets/         original PDF and raw extracted images (not served)
scripts/qr.mjs  QR code generator
```
