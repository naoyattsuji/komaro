let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const clientId = process.env.GA_CLIENT_ID;
  const clientSecret = process.env.GA_CLIENT_SECRET;
  const refreshToken = process.env.GA_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("GA OAuth env vars are not set");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token refresh failed: ${err}`);
  }

  const data = await res.json();
  cachedToken = { token: data.access_token, expiresAt: Date.now() + 3500 * 1000 };
  return data.access_token;
}

async function runReport(propertyId: string, body: object) {
  const token = await getAccessToken();
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) throw new Error(`GA4 API error: ${await res.text()}`);
  return res.json();
}

async function runRealtimeReport(propertyId: string, body: object) {
  const token = await getAccessToken();
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runRealtimeReport`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) throw new Error(`GA4 Realtime error: ${await res.text()}`);
  return res.json();
}

export interface AnalyticsData {
  realtime: { activeUsers: number };
  today: { sessions: number; pageViews: number };
  last7days: {
    activeUsers: number;
    sessions: number;
    pageViews: number;
    eventCreated: number;
    lineShareClicks: number;
    eventViews: number;
  };
  last30days: {
    activeUsers: number;
    sessions: number;
    pageViews: number;
    newUsers: number;
    topPages: { page: string; views: number }[];
  };
}

export async function fetchAnalytics(): Promise<AnalyticsData> {
  const propertyId = process.env.GA4_PROPERTY_ID;
  if (!propertyId || propertyId === "PLACEHOLDER") {
    throw new Error("GA4_PROPERTY_ID is not configured");
  }

  const [realtime, todayReport, last7Report, last30Report, last7Events, last30Pages] =
    await Promise.all([
      runRealtimeReport(propertyId, { metrics: [{ name: "activeUsers" }] }),
      runReport(propertyId, {
        dateRanges: [{ startDate: "today", endDate: "today" }],
        metrics: [{ name: "sessions" }, { name: "screenPageViews" }],
      }),
      runReport(propertyId, {
        dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
        metrics: [{ name: "activeUsers" }, { name: "sessions" }, { name: "screenPageViews" }],
      }),
      runReport(propertyId, {
        dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
        metrics: [
          { name: "activeUsers" },
          { name: "sessions" },
          { name: "screenPageViews" },
          { name: "newUsers" },
        ],
      }),
      runReport(propertyId, {
        dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
        dimensions: [{ name: "eventName" }],
        metrics: [{ name: "eventCount" }],
      }),
      runReport(propertyId, {
        dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
        dimensions: [{ name: "pagePath" }],
        metrics: [{ name: "screenPageViews" }],
        orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
        limit: 5,
      }),
    ]);

  const getMetric = (report: { rows?: { metricValues?: { value: string }[] }[] }, index: number) =>
    parseInt(report.rows?.[0]?.metricValues?.[index]?.value ?? "0");

  const eventMap: Record<string, number> = {};
  for (const row of last7Events.rows ?? []) {
    eventMap[row.dimensionValues?.[0]?.value ?? ""] = parseInt(row.metricValues?.[0]?.value ?? "0");
  }

  return {
    realtime: {
      activeUsers: parseInt(realtime.rows?.[0]?.metricValues?.[0]?.value ?? "0"),
    },
    today: {
      sessions: getMetric(todayReport, 0),
      pageViews: getMetric(todayReport, 1),
    },
    last7days: {
      activeUsers: getMetric(last7Report, 0),
      sessions: getMetric(last7Report, 1),
      pageViews: getMetric(last7Report, 2),
      eventCreated: eventMap["event_created"] ?? 0,
      lineShareClicks: eventMap["line_share_click"] ?? 0,
      eventViews: eventMap["event_view"] ?? 0,
    },
    last30days: {
      activeUsers: getMetric(last30Report, 0),
      sessions: getMetric(last30Report, 1),
      pageViews: getMetric(last30Report, 2),
      newUsers: getMetric(last30Report, 3),
      topPages: (last30Pages.rows ?? []).map((row: { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] }) => ({
        page: row.dimensionValues?.[0]?.value ?? "",
        views: parseInt(row.metricValues?.[0]?.value ?? "0"),
      })),
    },
  };
}
