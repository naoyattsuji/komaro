#!/usr/bin/env node
/**
 * App Store Connect へスクリーンショットをアップロードする。
 *
 * 使い方: node scripts/asc-upload-screenshots.mjs <localizationId>
 */
import { readFileSync, readdirSync } from "node:fs";
import { createHash, createPrivateKey, sign as cryptoSign } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";

const DIR = join(homedir(), ".appstoreconnect");
const KEY_DIR = join(DIR, "private_keys");
const keyFile = readdirSync(KEY_DIR).find((f) => /^AuthKey_.*\.p8$/.test(f));
const KEY_ID = keyFile.replace(/^AuthKey_/, "").replace(/\.p8$/, "");
const ISSUER_ID = readFileSync(join(DIR, "issuer_id.txt"), "utf8").trim();
const privateKey = createPrivateKey(readFileSync(join(KEY_DIR, keyFile)));
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
function jwt() {
  const now = Math.floor(Date.now() / 1000);
  const u = `${b64({ alg: "ES256", kid: KEY_ID, typ: "JWT" })}.${b64({ iss: ISSUER_ID, iat: now, exp: now + 900, aud: "appstoreconnect-v1" })}`;
  return `${u}.${cryptoSign("sha256", Buffer.from(u), { key: privateKey, dsaEncoding: "ieee-p1363" }).toString("base64url")}`;
}
async function api(method, path, body) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${jwt()}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const t = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}\n${t}`);
  return t ? JSON.parse(t) : null;
}

const LOC_ID = process.argv[2];
const GROUPS = [
  { type: "APP_IPHONE_67", dir: "assets/app-store/screenshots/iphone-6.9" },
  { type: "APP_IPAD_PRO_3GEN_129", dir: "assets/app-store/screenshots/ipad-13" },
];

for (const g of GROUPS) {
  // 既存セットを再利用（重複作成を避ける）
  const existing = await api("GET", `/v1/appStoreVersionLocalizations/${LOC_ID}/appScreenshotSets`);
  let set = existing.data.find((s) => s.attributes.screenshotDisplayType === g.type);
  if (!set) {
    const created = await api("POST", "/v1/appScreenshotSets", {
      data: {
        type: "appScreenshotSets",
        attributes: { screenshotDisplayType: g.type },
        relationships: { appStoreVersionLocalization: { data: { type: "appStoreVersionLocalizations", id: LOC_ID } } },
      },
    });
    set = created.data;
  }
  console.log(`${g.type}: set ${set.id}`);

  const files = readdirSync(g.dir).filter((f) => f.endsWith(".png")).sort();
  for (const name of files) {
    const buf = readFileSync(join(g.dir, name));
    const created = await api("POST", "/v1/appScreenshots", {
      data: {
        type: "appScreenshots",
        attributes: { fileSize: buf.length, fileName: name },
        relationships: { appScreenshotSet: { data: { type: "appScreenshotSets", id: set.id } } },
      },
    });
    const shot = created.data;
    for (const op of shot.attributes.uploadOperations) {
      const headers = Object.fromEntries(op.requestHeaders.map((h) => [h.name, h.value]));
      const chunk = buf.subarray(op.offset, op.offset + op.length);
      const r = await fetch(op.url, { method: op.method, headers, body: chunk });
      if (!r.ok) throw new Error(`upload chunk failed: ${r.status} ${await r.text()}`);
    }
    const md5 = createHash("md5").update(buf).digest("hex");
    await api("PATCH", `/v1/appScreenshots/${shot.id}`, {
      data: { type: "appScreenshots", id: shot.id, attributes: { uploaded: true, sourceFileChecksum: md5 } },
    });
    console.log(`  ✅ ${name} (${buf.length} bytes)`);
  }
}
console.log("完了");
