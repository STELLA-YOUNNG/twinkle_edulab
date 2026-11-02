#!/usr/bin/env bash
set -euo pipefail
PROJECT_ID="stella-5969b"
SITE_ID="$PROJECT_ID"
BASE="https://raw.githubusercontent.com/STELLA-YOUNNG/twinkle_edulab/main/wanted-words-webapp"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "[1/7] Enabling Firebase Hosting API..."
gcloud services enable firebasehosting.googleapis.com --project="$PROJECT_ID" >/dev/null
TOKEN="$(gcloud auth print-access-token)"
AUTH="Authorization: Bearer $TOKEN"

echo "[2/7] Preparing site..."
SITES_JSON="$(curl -fsS -H "$AUTH" "https://firebasehosting.googleapis.com/v1beta1/projects/$PROJECT_ID/sites")"
HAS_SITE="$(python3 -c 'import json,sys; site=sys.argv[1]; d=json.loads(sys.argv[2]); print("yes" if any(x.get("name","").endswith("/"+site) for x in d.get("sites",[])) else "no")' "$SITE_ID" "$SITES_JSON")"
if [ "$HAS_SITE" != "yes" ]; then
  curl -fsS -X POST -H "$AUTH" -H "Content-Type: application/json" \
    "https://firebasehosting.googleapis.com/v1beta1/projects/$PROJECT_ID/sites?siteId=$SITE_ID" >/dev/null
fi

echo "[3/7] Downloading site file..."
curl -fsSL "$BASE/index.html.xz.b64" -o "$WORK/index.html.xz.b64"
base64 -d "$WORK/index.html.xz.b64" | xz -d > "$WORK/index.html"
gzip -9 -c "$WORK/index.html" > "$WORK/index.html.gz"
HASH="$(sha256sum "$WORK/index.html.gz" | awk '{print $1}')"

echo "[4/7] Creating Hosting version..."
VERSION_JSON="$(curl -fsS -X POST -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"config":{}}' \
  "https://firebasehosting.googleapis.com/v1beta1/sites/$SITE_ID/versions")"
VERSION_NAME="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["name"])' <<<"$VERSION_JSON")"
VERSION_ID="${VERSION_NAME##*/}"

echo "[5/7] Uploading content..."
POP_JSON="$(curl -fsS -X POST -H "$AUTH" -H "Content-Type: application/json" \
  -d "{\"files\":{\"/index.html\":\"$HASH\"}}" \
  "https://firebasehosting.googleapis.com/v1beta1/sites/$SITE_ID/versions/$VERSION_ID:populateFiles")"
UPLOAD_URL="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["uploadUrl"])' <<<"$POP_JSON")"
NEEDED="$(python3 -c 'import json,sys; d=json.load(sys.stdin); print("yes" if d.get("uploadRequiredHashes") else "no")' <<<"$POP_JSON")"
if [ "$NEEDED" = "yes" ]; then
  curl -fsS -X POST -H "$AUTH" -H "Content-Type: application/octet-stream" \
    --data-binary @"$WORK/index.html.gz" "$UPLOAD_URL/$HASH" >/dev/null
fi

echo "[6/7] Finalizing version..."
curl -fsS -X PATCH -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"status":"FINALIZED"}' \
  "https://firebasehosting.googleapis.com/v1beta1/sites/$SITE_ID/versions/$VERSION_ID?update_mask=status" >/dev/null

echo "[7/7] Releasing..."
curl -fsS -X POST -H "$AUTH" \
  "https://firebasehosting.googleapis.com/v1beta1/sites/$SITE_ID/releases?versionName=$VERSION_NAME" >/dev/null

echo
printf 'DEPLOY COMPLETE\nhttps://%s.web.app\n' "$SITE_ID"
