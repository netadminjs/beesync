#!/bin/zsh

# Bee Daily Digest — end-of-day processing script
# Usage:
#   ./bee-process.sh                             → sync + process today
#   ./bee-process.sh --email                     → sync + process + email digest
#   ./bee-process.sh --reminders                 → sync + process + add to Apple Reminders
#   ./bee-process.sh --drafts                    → sync + process + follow-up email drafts in Mail
#   ./bee-process.sh --email --reminders         → all outputs except drafts
#   ./bee-process.sh --email --reminders --drafts → everything
#   ./bee-process.sh --quick                     → process today without re-syncing
#   ./bee-process.sh --days 3                    → process last 3 days

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SYNC_OUTPUT="$SCRIPT_DIR/sync"

QUICK=false
DAYS=0
EMAIL_FLAG=""
REMINDERS_FLAG=""
DRAFTS_FLAG=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --quick) QUICK=true ;;
    --days) DAYS="$2"; shift ;;
    --email) EMAIL_FLAG="--email" ;;
    --reminders) REMINDERS_FLAG="--reminders" ;;
    --drafts) DRAFTS_FLAG="--drafts" ;;
  esac
  shift
done

echo ""
echo "╔═══════════════════════════════════════╗"
echo "║         Bee End-of-Day Processor      ║"
echo "╚═══════════════════════════════════════╝"
echo ""

# Step 1: Sync (unless --quick)
if [ "$QUICK" = false ]; then
  echo "▶ Syncing Bee data..."
  bee sync --output "$SYNC_OUTPUT"
  if [ $? -ne 0 ]; then
    echo "❌ Sync failed. Run 'npx @beeai/cli status' to check your login."
    exit 1
  fi
  echo ""
fi

# Step 2: Process and write digest to Obsidian
echo "▶ Processing conversations..."
if [ "$DAYS" -gt 0 ]; then
  node "$SCRIPT_DIR/process.js" --days "$DAYS" $EMAIL_FLAG $REMINDERS_FLAG $DRAFTS_FLAG
else
  node "$SCRIPT_DIR/process.js" $EMAIL_FLAG $REMINDERS_FLAG $DRAFTS_FLAG
fi

echo ""
echo "✅ All done! Check Obsidian → BEE folder for your digest."
echo ""
