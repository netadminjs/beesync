# Bee CLI Setup & Sync Guide

## Key Paths
- **Bee project folder:** `~/Projects/Bee/` (symlink → iCloud)
- **Synced data:** `~/Projects/Bee/sync/`
- **Obsidian vault:** `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/<YourVaultName>/`
- **Obsidian BEE folder:** `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/<YourVaultName>/BEE/`

---

## Device Setup Guide

### ✅ MacBook Air (Home) — DONE
Everything below was completed on March 9, 2026.

### ✅ Mac Mini (Work) — DONE
Completed March 10, 2026. Cron jobs configured.

### 🔲 MacBook Neo (Work, arriving this week) — TODO
Follow "New Machine Setup" below. No cron job on this one.

---

## One-Time Setup (already done on MacBook Air — for reference)

### 1. Unlock Developer Mode in Bee iOS app
- Open Bee app → Settings → tap the version number **5 times**
- Developer Mode toggle will appear and enable it
- ✅ Done

### 2. Prerequisites
```bash
# Check if Homebrew is installed
brew --version

# If not installed:
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Check if Node is installed
node --version

# If not installed:
brew install node
```

### 3. Install the Bee CLI
```bash
npm install -g @beeai/cli
```

### 4. Log in to Bee
```bash
npx @beeai/cli login
```
Follow the prompts to authenticate with your Bee account.

### 5. Verify login
```bash
npx @beeai/cli status
# Should show: Verified as <Your Name>
```

### 6. The project folder is already in iCloud — nothing to clone
Since `~/Projects/Bee/` is a symlink to iCloud, all scripts are already there on every Mac.
```bash
# Verify the scripts are present
ls ~/Projects/Bee/
# Should show: PLAN.md  SETUP.md  bee-process.sh  process.js  sync/
```

### 7. Make the shell script executable
```bash
chmod +x ~/Projects/Bee/bee-process.sh
```

### 8. Full sync (first time on a new machine)
```bash
npx @beeai/cli sync --output ~/Projects/Bee/sync
```
This pulls all conversation history down. Takes a minute. Only needed once per machine — after that, incremental sync keeps it current.

---

## New Machine Setup (Quick Reference)

```bash
# 1. Install Node if needed
brew install node

# 2. Install Bee CLI
npm install -g @beeai/cli

# 3. Log in
npx @beeai/cli login

# 4. Verify
npx @beeai/cli status

# 5. Make script executable
chmod +x ~/Projects/Bee/bee-process.sh

# 6. Full sync to populate local data
npx @beeai/cli sync --output ~/Projects/Bee/sync

# 7. Test the processor
cd ~/Projects/Bee && node process.js
```

---

## Mac Mini Only — Cron Job Setup

The Mac Mini at work runs the hourly background sync and the scheduled end-of-day processing.
**Do not add these cron jobs to other machines.**

```bash
# Open crontab editor
crontab -e
```

First, find your node/npx path:
```bash
which node && which npx
```

Add these lines — replace the PATH with whatever `which node` returned (minus the `/node` filename):
```
# Required: cron runs with a bare PATH and can't find node/npx without this
PATH=/Users/<YOUR_USERNAME>/.nvm/versions/node/<VERSION>/bin:/usr/bin:/bin

# Hourly — sync + full process. Deduplication ensures email/reminders only fire for new conversations.
0 * * * * cd ~/Projects/Bee && npx @beeai/cli sync --output ~/Projects/Bee/sync && node process.js --email --reminders >> ~/Projects/Bee/logs/process.log 2>&1

# End of work day — 5:30 PM weekdays (catches anything from the work day)
30 17 * * 1-5 cd ~/Projects/Bee && node process.js --email --reminders >> ~/Projects/Bee/logs/process.log 2>&1

# Late night cleanup — 11:50 PM weekdays (catches any evening meetings, safe due to deduplication)
50 23 * * 1-5 cd ~/Projects/Bee && npx @beeai/cli sync --output ~/Projects/Bee/sync && node process.js --email --reminders >> ~/Projects/Bee/logs/process.log 2>&1
```

> **Note:** If you use nvm and later upgrade Node, update the PATH line to match the new version. Cron errors go to your local mail — check with `cat /var/mail/$USER` if jobs run silently without producing logs.

Create the log folder first:
```bash
mkdir -p ~/Projects/Bee/logs
```

Note: The 5:30 PM end-of-day run is a safety net. You can still run manually anytime with `./bee-process.sh --email --reminders`. If you already ran it manually, running again is fine — Obsidian overwrites cleanly, email sends a fresh copy, Reminders deduplication is on the roadmap.

---

## Daily Workflow

### Reconnect check (any session)
```bash
npx @beeai/cli status
# If not logged in:
npx @beeai/cli login
```

### Post-meeting sync (optional, anytime)
```bash
cd ~/Projects/Bee && ./bee-process.sh
# Obsidian only — no email, no reminders
```

### End of day (the main event)
```bash
cd ~/Projects/Bee && ./bee-process.sh --email --reminders
```

This:
1. Syncs latest Bee data from cloud
2. Triages all of today's conversations
3. Extracts To Do, To Schedule, Ideas to Explore
4. Writes digest to Obsidian BEE folder (syncs to iPhone/iPad automatically)
5. Emails digest to addresses configured in `config.js`
6. Adds To Do items to Apple Reminders → Bee list

---

## Useful CLI Commands

```bash
npx @beeai/cli status                               # Check login
npx @beeai/cli now                                  # Recent conversations
npx @beeai/cli today                                # Today's brief
npx @beeai/cli conversations                        # List all conversations
npx @beeai/cli conversations get <id>               # Full conversation detail
npx @beeai/cli sync --output ~/Projects/Bee/sync    # Full sync
npx @beeai/cli changed --json                       # Incremental — what changed since last cursor
npx @beeai/cli search "keyword"                     # Search all your data
npx @beeai/cli facts                                # Facts Bee learned about you
npx @beeai/cli todos                                # Your todos
npx @beeai/cli daily                                # Daily summaries
npx @beeai/cli stream                               # Live real-time event stream
```

---

## Script Flags Reference

```bash
./bee-process.sh                              # Sync + Obsidian only
./bee-process.sh --email                      # Sync + Obsidian + email digest
./bee-process.sh --reminders                  # Sync + Obsidian + Apple Reminders
./bee-process.sh --drafts                     # Sync + Obsidian + follow-up drafts in Mail
./bee-process.sh --email --reminders          # Email + Reminders (end of day)
./bee-process.sh --email --reminders --drafts # Everything (full end-of-day)
./bee-process.sh --quick                      # Skip sync, just reprocess existing data
./bee-process.sh --days 7                     # Process last 7 days

node process.js                               # Process today only
node process.js --date 2026-03-01             # Process a specific date
node process.js --days 30                     # Process last 30 days
node process.js --email --reminders --drafts  # With all outputs
```

---

## Synced Folder Structure

```
~/Projects/Bee/sync/
├── conversations/
│   └── YYYY-MM-DD/
│       └── <id>.md       # One file per recording
├── daily/
│   └── YYYY-MM-DD.md     # Daily summaries
├── facts.md              # Things Bee learned about you
└── todos.md              # All your todos
```

Each conversation file contains:
- Short summary & full summary with key takeaways
- Location (if detected)
- Full raw transcript

## Obsidian Output Structure

```
<YourVaultName>/BEE/
├── YYYY-MM-DD.md              # Daily digest (auto-syncs to iPhone/iPad)
└── conversations/
    └── YYYY-MM-DD-<id>.md    # Full transcripts for high/medium conversations
```

---

## Important Notes
- **Phone proximity:** Not required. Bee uploads to cloud servers. Mac just needs internet.
- **Sync lag:** Near-instant. Confirmed March 9, 2026 — recording appeared within seconds.
- **Multiple runs per day:** Safe for Obsidian and email. Reminders deduplication coming soon.
- **Cron job:** Mac Mini only. Other machines trigger manually.
- **Email recipients:** configured in `config.js` — set your own addresses there
- **Never auto-sends to others** — only drafts for external recipients (by design)
