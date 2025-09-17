#!/usr/bin/env bash
set -e

echo "== Secret scan before push =="
PATTERNS=("SUPABASE_SERVICE_ROLE_KEY" "ADMIN_TOKEN" "TELEGRAM_BOT_TOKEN" "TELEGRAM_CHAT_ID" "NP_API_KEY" "NOVA_POSHTA_KEY" "TURNSTILE_SECRET_KEY")
for p in "${PATTERNS[@]}"; do
  if git grep -n "$p=" -- . ':!*.example' ':!**/*.md' >/dev/null; then
    echo "❌ Found potential secret reference: $p (remove from tracked files or move to .env)"
    exit 1
  fi
done

# common token-like strings (base64-ish 32+ chars)
if git grep -nE '([A-Za-z0-9_\-]{32,})' -- ':!package-lock.json' ':!pnpm-lock.yaml' ':!yarn.lock' ':!*.map' ':!*.png' ':!*.jpg' ':!*.webp' ':!*.svg' > /tmp/scan.txt; then
  echo "⚠️  Manual check recommended. See /tmp/scan.txt"
fi
echo "✅ Done"
