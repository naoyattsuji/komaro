#!/bin/bash
#
# KOMARO iOS: アーカイブをApp Store Connectへアップロードする。
#
# 前提: App Store Connect APIキーが下記に置かれていること。
#   ~/.appstoreconnect/private_keys/AuthKey_<KEY_ID>.p8
#   ~/.appstoreconnect/issuer_id.txt
#
# 使い方:
#   bash scripts/appstore-upload.sh
#
# この鍵があると、App Store配布用の証明書とプロビジョニングプロファイルも
# 自動生成される（-allowProvisioningUpdates）。
set -euo pipefail

cd "$(dirname "$0")/.."

KEY_DIR="$HOME/.appstoreconnect/private_keys"
ISSUER_FILE="$HOME/.appstoreconnect/issuer_id.txt"
ARCHIVE="build/KOMARO-1.0.0.xcarchive"
EXPORT_DIR="build/appstore-export"
EXPORT_PLIST="build/appstore-export-options.plist"

# ── 認証情報の確認 ─────────────────────────────────────
KEY_PATH=$(ls "$KEY_DIR"/AuthKey_*.p8 2>/dev/null | head -1 || true)
if [ -z "$KEY_PATH" ]; then
  echo "❌ APIキーが見つかりません: $KEY_DIR/AuthKey_*.p8"
  echo "   docs/todo-for-owner.md の A-1 を参照してください。"
  exit 1
fi

KEY_ID=$(basename "$KEY_PATH" | sed 's/^AuthKey_//; s/\.p8$//')

if [ ! -f "$ISSUER_FILE" ]; then
  echo "❌ Issuer IDが見つかりません: $ISSUER_FILE"
  exit 1
fi
ISSUER_ID=$(tr -d '[:space:]' < "$ISSUER_FILE")

echo "✅ APIキー: $KEY_ID"
echo "✅ Issuer ID: ${ISSUER_ID:0:8}…"

# ── アーカイブの確認 ───────────────────────────────────
if [ ! -d "$ARCHIVE" ]; then
  echo "ℹ️  アーカイブが無いため作成します: $ARCHIVE"
  xcodebuild -project ios/App/App.xcodeproj -scheme App \
    -sdk iphoneos -configuration Release \
    -archivePath "$ARCHIVE" archive -allowProvisioningUpdates \
    -authenticationKeyPath "$KEY_PATH" \
    -authenticationKeyID "$KEY_ID" \
    -authenticationKeyIssuerID "$ISSUER_ID"
fi

VERSION=$(/usr/libexec/PlistBuddy -c "Print :ApplicationProperties:CFBundleShortVersionString" "$ARCHIVE/Info.plist")
BUILD=$(/usr/libexec/PlistBuddy -c "Print :ApplicationProperties:CFBundleVersion" "$ARCHIVE/Info.plist")
echo "✅ アーカイブ: バージョン $VERSION (ビルド $BUILD)"

# ── 書き出し設定（destination=upload で直接アップロード）────
cat > "$EXPORT_PLIST" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>destination</key>
	<string>upload</string>
	<key>method</key>
	<string>app-store-connect</string>
	<key>signingStyle</key>
	<string>automatic</string>
	<key>teamID</key>
	<string>243ATW576T</string>
	<key>stripSwiftSymbols</key>
	<true/>
	<key>uploadSymbols</key>
	<true/>
</dict>
</plist>
PLIST

# ── 書き出し＋アップロード ─────────────────────────────
rm -rf "$EXPORT_DIR"
echo "⬆️  App Store Connectへアップロードします…"
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE" \
  -exportPath "$EXPORT_DIR" \
  -exportOptionsPlist "$EXPORT_PLIST" \
  -allowProvisioningUpdates \
  -authenticationKeyPath "$KEY_PATH" \
  -authenticationKeyID "$KEY_ID" \
  -authenticationKeyIssuerID "$ISSUER_ID"

echo ""
echo "✅ アップロード完了。App Store Connect側の処理に5〜30分かかります。"
echo "   処理が終わったらビルドをバージョンに紐付けて審査提出します。"
