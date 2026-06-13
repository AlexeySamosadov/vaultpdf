# VaultPDF 🔒

**A PDF toolkit that never sees your files.** Merge, reorder, rotate, split, watermark and extract text — everything runs **100% in the browser**. Documents are never uploaded, never stored, never seen by a server. Close the tab and they're gone.

→ **Live:** `https://<your-gh-username>.github.io/vaultpdf/`

It's a single static `index.html`. No build step, no backend, $0 hosting.

---

## Why it sells

Every free online PDF tool uploads your file to someone's server. For contracts, IDs, medical records, financials — people **don't want that**. VaultPDF does the same jobs with the file never leaving the device. Privacy is the product.

- **Free:** merge, reorder (drag), rotate, delete pages, split/selection export, extract text.
- **Pro (one-time, paid in crypto):** watermark every page, batch tools, no limits — unlocked by an offline-verifiable license key.

## How payment works (crypto, no processor, no KYC)

Money goes **straight to your wallet**. No Stripe, no Gumroad cut.

1. Buyer clicks *Unlock Pro* → sends **$19 USDC** (configurable) to your wallet on **Base** (cheap gas).
2. Buyer pastes the **transaction hash** + email.
3. The serverless `worker/` verifies the payment **on-chain** and returns a **signed license key**.
4. The app verifies that key **offline** (ECDSA P-256, public key embedded) and unlocks Pro forever.

No server can leak your files because there is no file server. The only backend is a tiny payment-verifier.

## Setup (3 things, then it's autonomous)

1. **Wallet** — put your receiving address in `index.html` → `PAY.wallet` and `worker/wrangler.toml` → `WALLET`.
2. **Publish the app** (free, static):
   ```bash
   gh repo create vaultpdf --public --source=. --push   # or push to an existing repo
   # then enable GitHub Pages (Settings → Pages → branch: main, /root)
   ```
3. **Deploy the payment verifier** (Cloudflare Workers, free tier):
   ```bash
   cd worker
   npm i -g wrangler && wrangler login
   wrangler kv namespace create REDEEMED      # paste id into wrangler.toml
   wrangler secret put PRIVATE_JWK            # paste contents of ../license_private_key.json
   wrangler deploy                            # copy the URL into index.html PAY.issuer
   ```
   Until the worker is live, sales still work manually: buyer sends you their tx hash, you run
   `node sign-license.mjs buyer@email.com` and send back the key.

## 🔑 Security — read this

`license_private_key.json` is the **master key**. Anyone who has it can mint unlimited free Pro licenses. It is **gitignored** and must never be committed or shared. Back it up somewhere safe (it was generated once and cannot be regenerated without invalidating every issued license). The app only ships the **public** key.

## Files

| file | what |
|---|---|
| `index.html` | the entire app + landing + crypto checkout (ship this) |
| `worker/license-issuer.js` | serverless on-chain payment verifier → license issuer |
| `worker/wrangler.toml` | worker config (wallet, price, chain) |
| `sign-license.mjs` | manual license issuer (day-1 fallback) |
| `public_jwk.json` | public verification key (embedded in app) |
| `license_private_key.json` | **secret** signing key — never publish |
| `LAUNCH.md` | go-to-market copy (Show HN, Reddit, Product Hunt, X) |
