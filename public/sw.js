/**
 * 最小限のService Worker。
 *
 * 目的は2つ。
 * 1. Chromeが「ホーム画面に追加」を提案する条件（fetchを扱うService Workerがある）を満たす。
 *    これが無いと beforeinstallprompt が発火せず、Android向けの案内を出せない。
 * 2. 通信できないときに、白い画面ではなく案内を出す。
 *
 * **ページの読み込みには手を入れない。** 画面遷移の要求だけを見て、通信に失敗したときだけ
 * 同梱の offline.html を返す。それ以外の要求（画像・JS・APIなど）には一切触れないので、
 * 通常の表示や更新の挙動は変わらない。
 */
const CACHE = "komaro-offline-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.add(OFFLINE_URL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  // 画面遷移以外には手を出さない
  if (event.request.mode !== "navigate") return;

  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(OFFLINE_URL).then((res) => res ?? Response.error())
    )
  );
});
