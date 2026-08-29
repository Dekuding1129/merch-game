#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TOOLS="$ROOT/tools"
MAILPIT="$TOOLS/mailpit"

if [[ ! -x "$MAILPIT" ]]; then
  mkdir -p "$TOOLS"
  tmp="$(mktemp)"
  curl -fsSL --max-time 120 https://github.com/axllent/mailpit/releases/download/v1.31.0/mailpit-linux-amd64.tar.gz -o "$tmp"
  tar -xzf "$tmp" -C "$TOOLS"
  rm -f "$tmp"
  chmod +x "$MAILPIT"
fi

if ! curl -fsS --max-time 2 http://127.0.0.1:8025/api/v1/messages >/dev/null 2>&1; then
  "$MAILPIT" --listen 127.0.0.1:8025 --smtp 127.0.0.1:1025 --database "$ROOT/mailpit.db" >/tmp/loot-mailpit.log 2>&1 &
fi

if ! curl -fsS --max-time 2 http://127.0.0.1:8787/api/health >/dev/null 2>&1; then
  EMAIL_ENABLED=1 SMTP_HOST=127.0.0.1 SMTP_PORT=1025 node "$ROOT/backend/server.js" >/tmp/loot-backend.log 2>&1 &
fi

printf 'Mailpit inbox: http://127.0.0.1:8025\n'
printf 'Backend: http://127.0.0.1:8787\n'
printf 'Email mode: local only (no real email is sent)\n'
