
set -euo pipefail
ROOT="$(pwd)"
API_BASE="${API_BASE:-http://localhost:10000}"

red(){ printf "\033[31m%s\033[0m\n" "$*"; }
green(){ printf "\033[32m%s\033[0m\n" "$*"; }
yellow(){ printf "\033[33m%s\033[0m\n" "$*"; }

if command -v rg >/dev/null 2>&1; then
  SEARCH='rg -nI -S --hidden --no-ignore -g !node_modules/** -g !.git/**'
else
  yellow "ripgrep (rg) не найден — использую grep."
  SEARCH='grep -RInE --binary-files=without-match --exclude-dir=node_modules --exclude-dir=.git'
fi

echo "=> 1) Скан исходников на возможные секреты"
PATTERN_SRC='ADMIN_TOKEN|TELEGRAM|BOT_TOKEN|NOVA|NP_API|SUPABASE|SERVICE_ROLE|JWT|SECRET|TOKEN|KEY'
bash -c "$SEARCH \"$PATTERN_SRC\" . || true"

echo; echo "=> 2) .env в .gitignore?"
[ -f .gitignore ] && grep -nE '^\s*\.env(\..*)?$' .gitignore || yellow ".gitignore не найден"

echo; echo "=> 3) Скан dist/ (после сборки не должно быть совпадений)"
if [ -d dist ]; then
  PATTERN_DIST='ADMIN_TOKEN|SERVICE_ROLE|BOT|TELEGRAM|NOVA|NP_API|SECRET|SUPABASE_KEY'
  bash -c "$SEARCH \"$PATTERN_DIST\" dist/ || true"
else
  yellow "dist/ нет — сначала: npm run build"
fi

echo; echo "=> 4) Адмін-API (если задан ADMIN_TOKEN)"
if [ -n "${ADMIN_TOKEN:-}" ]; then
  set +e
  echo "# без токена (ожидаем 401/403)"; curl -s -o /dev/null -w 'HTTP %{http_code}\n' "$API_BASE/api/admin/orders"
  echo "# с неверным токеном (ожидаем 401/403)"; curl -s -o /dev/null -w 'HTTP %{http_code}\n' -H "x-admin-token: WRONG" "$API_BASE/api/admin/orders"
  echo "# с верным токеном (ожидаем 200)"; curl -s -o /dev/null -w 'HTTP %{http_code}\n' -H "x-admin-token: $ADMIN_TOKEN" "$API_BASE/api/admin/orders"
  set -e
else
  yellow "ADMIN_TOKEN не задан — пропускаю curl-тесты (export ADMIN_TOKEN='...')"
fi

echo; echo "=> 5) CORS/helmet/x-powered-by в server.mjs"
[ -f server.mjs ] && $SEARCH 'cors|helmet|x-powered-by' server.mjs || yellow "server.mjs не найден"

green "Готово. Совпадения в dist/ — это утечка, напиши — поправим."
