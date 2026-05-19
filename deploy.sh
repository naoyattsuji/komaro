#!/bin/bash
# KOMARO 本番デプロイスクリプト
# 使い方: ! sh deploy.sh

INCIDENT_URL="https://shin-jobs-line.vercel.app/api/incident"
AUTH="${SHIN_INCIDENT_TOKEN:-}"

echo "🚀 KOMAROをデプロイ中..."

OUTPUT=$(npx vercel --prod --yes 2>&1)
EXIT_CODE=$?

echo "$OUTPUT"

if [ $EXIT_CODE -ne 0 ]; then
  echo ""
  echo "❌ デプロイ失敗 — Jobsに通知します..."
  if [ -n "$AUTH" ]; then
    DETAIL=$(echo "$OUTPUT" | grep -i "error\|Error\|failed\|Failed" | head -3 | tr '\n' ' ')
    curl -s -X POST "$INCIDENT_URL" \
      -H "Authorization: Bearer $AUTH" \
      -H "Content-Type: application/json" \
      -d "{\"project\":\"KOMARO\",\"level\":\"critical\",\"title\":\"本番デプロイ失敗（最新の変更が公開されていません）\",\"detail\":\"$DETAIL\"}" \
      > /dev/null
  else
    echo "⚠️ SHIN_INCIDENT_TOKEN が未設定のため、Jobs通知はスキップしました"
  fi
  exit 1
else
  echo ""
  echo "✅ デプロイ成功"
fi
