/**
 * シンプルなスライディングウィンドウ式 rate limiter
 * Vercel serverless 環境でインスタンス内の乱用を防ぐ
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// 古いエントリを定期的に掃除（メモリリーク防止）
function cleanup() {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}

let lastCleanup = Date.now();

export interface RateLimitOptions {
  /** 識別子（IP + エンドポイント等） */
  key: string;
  /** 最大リクエスト数 */
  limit: number;
  /** ウィンドウ幅（秒） */
  windowSec: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit({ key, limit, windowSec }: RateLimitOptions): RateLimitResult {
  const now = Date.now();

  // 5分ごとに古いエントリを掃除
  if (now - lastCleanup > 5 * 60 * 1000) {
    cleanup();
    lastCleanup = now;
  }

  const entry = store.get(key);
  const windowMs = windowSec * 1000;

  if (!entry || entry.resetAt <= now) {
    // 新しいウィンドウ開始
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (entry.count >= limit) {
    return { success: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { success: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

/**
 * NextRequest から IP を取得する
 */
export function getIP(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * rate limit 超過時のレスポンスを返す
 */
export function rateLimitResponse(resetAt: number): Response {
  const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
  return Response.json(
    { error: { code: "RATE_LIMIT_EXCEEDED", message: "リクエストが多すぎます。しばらくしてから再試行してください。" } },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
      },
    }
  );
}
