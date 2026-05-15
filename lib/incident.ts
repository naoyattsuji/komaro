const INCIDENT_URL = 'https://shin-jobs-line.vercel.app/api/incident'
const AUTH_TOKEN = 'shin-cron-secret-2026'

type Level = 'critical' | 'warning'

export async function notifyIncident(
  level: Level,
  title: string,
  detail?: string
): Promise<void> {
  // 通知失敗でもアプリを止めない
  try {
    await fetch(INCIDENT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AUTH_TOKEN}`,
      },
      body: JSON.stringify({ project: 'KOMARO', level, title, detail }),
    })
  } catch {
    // silent fail
  }
}
