# Bee CLI Setup & Sync Guide

## Key Paths
- **Bee project folder:** wherever you cloned or placed the project
- **Synced data:** `<project>/sync/`
- **Obsidian vault:** `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/<YourVaultName>/`
- **Obsidian BEE folder:** `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/<YourVaultName>/BEE/`
- **Scheduled job logs:** `~/Library/Logs/beesync/process.log`

---

## One-Time Setup

### 1. Unlock Developer Mode in Bee iOS app
- Open Bee app → Settings → tap the version number **5 times**
- Developer Mode toggle will appear and enable it

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

### 6. Get the project files
Clone the repo or copy the project to your machine:
```bash
git clone https://github.com/netadminjs/beesync.git ~/Projects/Bee
# or place it wherever you prefer
```

### 7. Make the shell scripts executable
```bash
chmod +x ~/Projects/Bee/bee-process.sh ~/Projects/Bee/bee-hot.sh
```

### 8. Full sync (first time)
```bash
cd ~/Projects/Bee
bee sync --output ./sync
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

# 5. Clone the project
git clone https://github.com/netadminjs/beesync.git ~/Projects/Bee

# 6. Configure
cp ~/Projects/Bee/config.example.js ~/Projects/Bee/config.js
# Edit config.js with your vault name, email, name, timezone

# 7. Make scripts executable
chmod +x ~/Projects/Bee/bee-process.sh ~/Projects/Bee/bee-hot.sh

# 8. Full sync to populate local data
cd ~/Projects/Bee && bee sync --output ./sync

# 9. Test the processor
node process.js
```

---

## Scheduled Job Setup (launchd — one machine only)

Pick one machine to run the scheduled background jobs.
**Do not set these up on multiple machines** — deduplication ensures only new conversations trigger email and reminders, but you still don't need redundant syncing.

macOS launchd user agents are used instead of cron because they run in your full login session with Keychain access — which is required for `bee` to authenticate.

### 1. Find your Node path

```bash
which node
# e.g. /Users/yourname/.nvm/versions/node/v24.13.1/bin/node
```

### 2. Create the three plist files

Create `~/Library/LaunchAgents/com.beesync.hourly.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.beesync.hourly</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/zsh</string>
        <string>-c</string>
        <string>cd /Users/YOUR_USERNAME/Projects/Bee && bee sync --output /Users/YOUR_USERNAME/Projects/Bee/sync && node process.js --email --reminders</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/Users/YOUR_USERNAME/.nvm/versions/node/VERSION/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
        <key>HOME</key>
        <string>/Users/YOUR_USERNAME</string>
        <key>USER</key>
        <string>YOUR_USERNAME</string>
    </dict>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    <key>StandardOutPath</key>
    <string>/Users/YOUR_USERNAME/Library/Logs/beesync/process.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/YOUR_USERNAME/Library/Logs/beesync/process.log</string>
    <key>RunAtLoad</key>
    <false/>
</dict>
</plist>
```

Create `~/Library/LaunchAgents/com.beesync.endofday.plist` (5:30 PM weekdays, no sync):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.beesync.endofday</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/zsh</string>
        <string>-c</string>
        <string>cd /Users/YOUR_USERNAME/Projects/Bee && node process.js --email --reminders</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/Users/YOUR_USERNAME/.nvm/versions/node/VERSION/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
        <key>HOME</key>
        <string>/Users/YOUR_USERNAME</string>
        <key>USER</key>
        <string>YOUR_USERNAME</string>
    </dict>
    <key>StartCalendarInterval</key>
    <array>
        <dict><key>Hour</key><integer>17</integer><key>Minute</key><integer>30</integer><key>Weekday</key><integer>1</integer></dict>
        <dict><key>Hour</key><integer>17</integer><key>Minute</key><integer>30</integer><key>Weekday</key><integer>2</integer></dict>
        <dict><key>Hour</key><integer>17</integer><key>Minute</key><integer>30</integer><key>Weekday</key><integer>3</integer></dict>
        <dict><key>Hour</key><integer>17</integer><key>Minute</key><integer>30</integer><key>Weekday</key><integer>4</integer></dict>
        <dict><key>Hour</key><integer>17</integer><key>Minute</key><integer>30</integer><key>Weekday</key><integer>5</integer></dict>
    </array>
    <key>StandardOutPath</key>
    <string>/Users/YOUR_USERNAME/Library/Logs/beesync/process.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/YOUR_USERNAME/Library/Logs/beesync/process.log</string>
    <key>RunAtLoad</key>
    <false/>
</dict>
</plist>
```

Create `~/Library/LaunchAgents/com.beesync.cleanup.plist` (11:50 PM weekdays, full sync):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.beesync.cleanup</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/zsh</string>
        <string>-c</string>
        <string>cd /Users/YOUR_USERNAME/Projects/Bee && bee sync --output /Users/YOUR_USERNAME/Projects/Bee/sync && node process.js --email --reminders</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/Users/YOUR_USERNAME/.nvm/versions/node/VERSION/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
        <key>HOME</key>
        <string>/Users/YOUR_USERNAME</string>
        <key>USER</key>
        <string>YOUR_USERNAME</string>
    </dict>
    <key>StartCalendarInterval</key>
    <array>
        <dict><key>Hour</key><integer>23</integer><key>Minute</key><integer>50</integer><key>Weekday</key><integer>1</integer></dict>
        <dict><key>Hour</key><integer>23</integer><key>Minute</key><integer>50</integer><key>Weekday</key><integer>2</integer></dict>
        <dict><key>Hour</key><integer>23</integer><key>Minute</key><integer>50</integer><key>Weekday</key><integer>3</integer></dict>
        <dict><key>Hour</key><integer>23</integer><key>Minute</key><integer>50</integer><key>Weekday</key><integer>4</integer></dict>
        <dict><key>Hour</key><integer>23</integer><key>Minute</key><integer>50</integer><key>Weekday</key><integer>5</integer></dict>
    </array>
    <key>StandardOutPath</key>
    <string>/Users/YOUR_USERNAME/Library/Logs/beesync/process.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/YOUR_USERNAME/Library/Logs/beesync/process.log</string>
    <key>RunAtLoad</key>
    <false/>
</dict>
</plist>
```

### 3. Create the log directory and load the agents

```bash
mkdir -p ~/Library/Logs/beesync

launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.beesync.hourly.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.beesync.endofday.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.beesync.cleanup.plist
```

### 4. Verify they loaded

```bash
launchctl list | grep beesync
# Should show all three with exit status 0
```

### 5. Test manually

```bash
launchctl kickstart -k gui/$(id -u)/com.beesync.hourly
# Wait ~60 seconds, then check the log:
cat ~/Library/Logs/beesync/process.log
```

> **Why launchd instead of cron:** macOS cron cannot access the user Keychain, which is how `bee` stores its auth token. launchd user agents (in `~/Library/LaunchAgents/`) run in your full login session with Keychain access — no workarounds needed.
>
> **Why `StandardOutPath` instead of `>>`:** The project folder (`~/Projects/Bee`) is a symlink into iCloud Drive. macOS restricts iCloud Drive writes to processes with explicit permission. launchd can open the log file and pass the file descriptor to the shell; shell-level redirection (`>>`) triggers a separate `open()` call which gets blocked. Keeping the log in `~/Library/Logs/beesync/` (outside iCloud) sidesteps this entirely.
>
> **Node version:** If you upgrade Node via nvm, update the PATH in all three plists and reload the agents.

Note: The 5:30 PM end-of-day run is a safety net. You can still run manually anytime with `./bee-process.sh --email --reminders`. Running again is safe — Obsidian overwrites cleanly, email and Reminders deduplicate by conversation ID.

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
bee sync --output ./sync                 # Full sync (run from project dir)
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
- **Sync lag:** Near-instant — recordings typically appear within seconds of being processed.
- **Multiple runs per day:** Safe for Obsidian and email. Email and Reminders deduplicate by conversation ID.
- **Scheduled jobs:** One machine only. Other machines trigger manually with `./bee-process.sh`.
- **Email recipients:** configured in `config.js` — set your own addresses there.
- **Never auto-sends to others** — only drafts for external recipients (by design).
