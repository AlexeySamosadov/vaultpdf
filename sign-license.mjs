#!/usr/bin/env node
/**
 * Manual license issuer (works day 1, no server needed).
 * Use when a buyer pays and sends you their tx hash before the worker is deployed.
 *
 *   node sign-license.mjs buyer@email.com            # lifetime license
 *   node sign-license.mjs buyer@email.com 365        # 365-day license
 *
 * Output is the license key to send to the buyer. They paste it into VaultPDF.
 * The private key never leaves your machine.
 */
import { readFileSync } from "node:fs";

const privJwk = JSON.parse(readFileSync(new URL("./license_private_key.json", import.meta.url)));
const email = process.argv[2];
const days = process.argv[3] ? Number(process.argv[3]) : 0;
if (!email) { console.error("usage: node sign-license.mjs <email> [daysValid]"); process.exit(1); }

const payload = { email, plan: "pro", iat: Math.floor(Date.now() / 1000) };
if (days > 0) payload.exp = payload.iat + days * 86400;

const b64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const key = await crypto.subtle.importKey("jwk", privJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
const pb = new TextEncoder().encode(JSON.stringify(payload));
const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, pb);

console.log("\nLicense for " + email + (days ? ` (${days} days)` : " (lifetime)") + ":\n");
console.log(b64url(pb) + "." + b64url(sig) + "\n");
