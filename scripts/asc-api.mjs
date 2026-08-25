#!/usr/bin/env node
/**
 * App Store Connect API を叩くための最小クライアント。
 *
 * 使い方:
 *   node scripts/asc-api.mjs GET /v1/apps
 *   node scripts/asc-api.mjs POST /v1/apps '{"data":{...}}'
 *
 * 認証情報は ~/.appstoreconnect/ から読む。鍵の中身は一切出力しない。
 */
import { readFileSync, readdirSync } from "node:fs";
import { createSign, createPrivateKey, sign as cryptoSign } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";

const DIR = join(homedir(), ".appstoreconnect");
const KEY_DIR = join(DIR, "private_keys");

const keyFile = readdirSync(KEY_DIR).find((f) => /^AuthKey_.*\.p8$/.test(f));
if (!keyFile) throw new Error("APIキーが見つかりません");
const KEY_ID = keyFile.replace(/^AuthKey_/, "").replace(/\.p8$/, "");
const ISSUER_ID = readFileSync(join(DIR, "issuer_id.txt"), "utf8").trim();
const privateKey = createPrivateKey(readFileSync(join(KEY_DIR, keyFile)));

const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");

function makeJwt() {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "ES256", kid: KEY_ID, typ: "JWT" };
  const payload = { iss: ISSUER_ID, iat: now, exp: now + 15 * 60, aud: "appstoreconnect-v1" };
  const unsigned = `${b64(header)}.${b64(payload)}`;
  const sig = cryptoSign("sha256", Buffer.from(unsigned), { key: privateKey, dsaEncoding: "ieee-p1363" });
  return `${unsigned}.${sig.toString("base64url")}`;
}

const [method = "GET", path = "/v1/apps", body] = process.argv.slice(2);
const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
  method,
  headers: {
    Authorization: `Bearer ${makeJwt()}`,
    ...(body ? { "Content-Type": "application/json" } : {}),
  },
  ...(body ? { body } : {}),
});
const text = await res.text();
console.log(`HTTP ${res.status}`);
try {
  console.log(JSON.stringify(JSON.parse(text), null, 2));
} catch {
  console.log(text);
}
