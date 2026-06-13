/**
 * VaultPDF license issuer — serverless, $0 (Cloudflare Workers free tier).
 *
 * Flow: buyer pays USDC (or native coin) to YOUR wallet -> pastes the tx hash ->
 * this worker verifies the payment on-chain, then signs and returns a Pro license.
 * No KYC, no payment processor, money goes straight to your crypto wallet.
 *
 * Deploy:
 *   1) npm i -g wrangler && wrangler login
 *   2) wrangler kv namespace create REDEEMED   (put the id in wrangler.toml)
 *   3) wrangler secret put PRIVATE_JWK          (paste contents of ../license_private_key.json)
 *   4) edit wrangler.toml [vars]: WALLET, CHAIN_RPC, TOKEN, USDC_ADDR, PRICE_USDC
 *   5) wrangler deploy   -> copy the worker URL into index.html PAY.issuer
 */
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"; // Transfer(address,address,uint256)

export default {
  async fetch(req, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "content-type",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
    };
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (req.method !== "POST") return json({ error: "POST only" }, 405, cors);

    let body;
    try { body = await req.json(); } catch { return json({ error: "bad json" }, 400, cors); }
    const tx = (body && body.tx || "").trim();
    const email = (body && body.email || "").trim();
    if (!/^0x[0-9a-fA-F]{64}$/.test(tx)) return json({ error: "Missing or invalid transaction hash." }, 400, cors);
    if (!/.+@.+\..+/.test(email)) return json({ error: "Please enter the email to license to." }, 400, cors);

    const txKey = tx.toLowerCase();
    if (await env.REDEEMED.get(txKey)) return json({ error: "This transaction was already redeemed." }, 409, cors);

    const receipt = await rpc(env.CHAIN_RPC, "eth_getTransactionReceipt", [tx]);
    if (!receipt) return json({ error: "Transaction not found yet. Wait for 1 confirmation and retry." }, 404, cors);
    if (receipt.status !== "0x1") return json({ error: "That transaction failed on-chain." }, 400, cors);

    const wallet = env.WALLET.toLowerCase();
    let paid = false;
    if ((env.TOKEN || "usdc") === "native") {
      const t = await rpc(env.CHAIN_RPC, "eth_getTransactionByHash", [tx]);
      const min = BigInt(Math.round(Number(env.PRICE_NATIVE) * 1e18));
      paid = (t.to || "").toLowerCase() === wallet && BigInt(t.value) >= min;
    } else {
      const dec = BigInt(env.USDC_DECIMALS || "6");
      const min = BigInt(env.PRICE_USDC) * (10n ** dec);
      const token = (env.USDC_ADDR || "").toLowerCase();
      for (const log of receipt.logs || []) {
        if (log.address.toLowerCase() !== token) continue;
        if ((log.topics[0] || "").toLowerCase() !== TRANSFER_TOPIC) continue;
        const to = "0x" + log.topics[2].slice(26).toLowerCase();
        if (to === wallet && BigInt(log.data) >= min) { paid = true; break; }
      }
    }
    if (!paid) return json({ error: "No qualifying payment to the seller wallet was found in this transaction." }, 402, cors);

    const license = await signLicense(env.PRIVATE_JWK, {
      email, plan: "pro", iat: Math.floor(Date.now() / 1000), tx: txKey,
    });
    await env.REDEEMED.put(txKey, email, { expirationTtl: 60 * 60 * 24 * 3650 });
    return json({ license }, 200, cors);
  },
};

async function rpc(url, method, params) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await r.json();
  return j.result;
}
function b64url(buf) {
  const s = btoa(String.fromCharCode(...new Uint8Array(buf)));
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function signLicense(privJwkStr, payload) {
  const key = await crypto.subtle.importKey("jwk", JSON.parse(privJwkStr),
    { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const pb = new TextEncoder().encode(JSON.stringify(payload));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, pb);
  return b64url(pb) + "." + b64url(sig);
}
function json(o, status, headers) {
  return new Response(JSON.stringify(o), { status, headers: { ...headers, "content-type": "application/json" } });
}
