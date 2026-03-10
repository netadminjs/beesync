#!/bin/zsh

# Bee Hot Sync — urgent post-meeting processing
# Run this immediately after an important meeting to capture action items,
# send email summary, and add reminders — without waiting for the scheduled run.
#
# Usage: ./bee-hot.sh
#
# Only processes and notifies for NEW conversations not yet handled.
# Safe to run anytime — the 5:30 PM scheduled run will skip anything already sent.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SYNC_OUTPUT="$SCRIPT_DIR/sync"

echo ""
echo "╔═══════════════════════════════════════╗"
echo "║           Bee Hot Sync                ║"
echo "║     Post-Meeting Capture Mode         ║"
echo "╚═══════════════════════════════════════╝"
echo ""

echo "▶ Syncing latest Bee data..."
bee sync --output "$SYNC_OUTPUT"
if [ $? -ne 0 ]; then
  echo "❌ Sync failed. Run 'npx @beeai/cli status' to check your login."
  exit 1
fi

echo ""
echo "▶ Processing new conversations..."
node "$SCRIPT_DIR/process.js" --email --reminders

echo ""
echo "✅ Hot sync complete."
echo "   New action items → Reminders, digest update → email + Obsidian."
echo "   The 5:30 PM scheduled run will skip anything already sent."
echo ""
