# Bee Digest Processor

Automates daily processing of [Bee](https://bee.computer) wearable recordings into a structured digest — with Obsidian output, email delivery, Apple Reminders integration, and follow-up email drafts.

## What It Does

Each time it runs, the processor:

1. Syncs your latest Bee conversations to local markdown via the Bee CLI
2. Scores and triages conversations by signal value (high / medium / low)
3. Extracts **To Do**, **To Schedule**, and **Ideas to Explore** from takeaways and action items
4. Writes a daily digest to your Obsidian vault (auto-syncs to iPhone/iPad via iCloud)
5. Emails the digest to your configured addresses (only new conversations, deduplicated)
6. Adds action items to Apple Reminders
7. Creates follow-up email drafts in Mail for high-value conversations (you review and send — never auto-sends to others)

## Requirements

- macOS (uses AppleScript for Mail, Reminders, and Outlook/Calendar integration)
- [Bee wearable](https://bee.computer) with Developer Mode enabled
- [Bee CLI](https://docs.bee.computer) (`npm install -g @beeai/cli`)
- Node.js (`brew install node`)
- Obsidian (optional — output goes to a vault folder)
- Microsoft Outlook or Apple Calendar (optional — enables meeting name + attendee matching)

## Setup

### 0. Check your environment first

Before anything else, run the environment check:

```bash
node bee-pre-check.js
```

This tells you what's installed, what's missing, and gives you the exact PATH line you'll need for crontab. Run it again after completing setup to confirm everything is green.

---

### 1. Enable Bee Developer Mode

In the Bee iOS app: Settings → tap the version number **5 times** → enable Developer Mode.

### 2. Install dependencies

```bash
brew install node
npm install -g @beeai/cli
```

### 3. Log in to Bee

```bash
npx @beeai/cli login
npx @beeai/cli status
```

### 4. Configure

```bash
cp config.example.js config.js
```

Edit `config.js` with your Obsidian vault name, email addresses, name, and timezone.

### 5. Make scripts executable

```bash
chmod +x bee-process.sh bee-hot.sh
```

### 6. Initial sync

```bash
npx @beeai/cli sync --output ~/Projects/Bee/sync
```

### 7. Test it

```bash
node process.js
```

## Usage

```bash
./bee-process.sh                            # Sync + write to Obsidian
./bee-process.sh --email                    # + email digest
./bee-process.sh --reminders                # + Apple Reminders
./bee-process.sh --drafts                   # + follow-up email drafts in Mail
./bee-process.sh --email --reminders        # Full end-of-day run
./bee-process.sh --email --reminders --drafts  # Everything
./bee-process.sh --quick                    # Skip sync, reprocess existing data
./bee-process.sh --days 3                   # Process last 3 days

./bee-hot.sh                                # Urgent post-meeting capture (sync + email + reminders)

node process.js --date 2026-03-10           # Process a specific date
node process.js --days 7                    # Process last 7 days
```

## Tuning Your Keywords

The processor scores conversations using keyword lists that boost or suppress signal. The defaults work well out of the box, but your recordings will have patterns specific to your work and life. The keyword tuner finds them for you.

```bash
node bee-tune.js               # Analyze last 90 days, show top 10 suggestions
node bee-tune.js --days 180    # Look further back
node bee-tune.js --top 20      # Show more suggestions
```

**How it works:**

1. Scores all your recent conversations using your current config
2. Separates them into HIGH and LOW buckets
3. Counts how often each word and two-word phrase appears in each bucket
4. Surfaces terms that strongly predict high or low signal — filtered against what you already have
5. Outputs a ranked list ready to copy into `config.js`

**Example output:**

```
📈 Suggested MY_HIGH_KEYWORDS additions:
   Words that appear frequently in your high-signal conversations

   'vendor'                          found in 28 high, 1 low
   'grant'                           found in 19 high, 0 low
   'compliance'                      found in 14 high, 2 low

📉 Suggested MY_LOW_KEYWORDS additions:
   Words that appear frequently in your low-signal conversations

   'pharmacy'                        found in 0 high, 11 low
   'commute'                         found in 0 high, 8 low

💡 Copy what looks right into MY_HIGH_KEYWORDS / MY_LOW_KEYWORDS in config.js.
   Run again periodically as your conversation patterns evolve.
```

Copy the terms that make sense for your context into `config.js`. Skip anything that looks like a coincidence. Run it again after a few more weeks of recordings — the suggestions improve as your dataset grows.

---

## Cron Jobs (optional — one machine only)

To run automatically in the background, add these to `crontab -e` on one machine.

First find your node path:
```bash
which npx
# e.g. /Users/yourname/.nvm/versions/node/v24.13.1/bin/npx
```

Then add to crontab (replace the PATH with the directory from `which npx`):
```
# Required: cron uses a bare PATH and won't find node/npx without this
PATH=/Users/yourname/.nvm/versions/node/v24.13.1/bin:/usr/bin:/bin

# Hourly — sync + full process
0 * * * * cd ~/Projects/Bee && npx @beeai/cli sync --output sync && node process.js --email --reminders >> ~/Projects/Bee/logs/process.log 2>&1

# End of work day — 5:30 PM weekdays
30 17 * * 1-5 cd ~/Projects/Bee && node process.js --email --reminders >> ~/Projects/Bee/logs/process.log 2>&1

# Late night cleanup — 11:50 PM weekdays
50 23 * * 1-5 cd ~/Projects/Bee && npx @beeai/cli sync --output sync && node process.js --email --reminders >> ~/Projects/Bee/logs/process.log 2>&1
```

> If cron runs silently with no log output, check `cat /var/mail/$USER` — cron mails errors to your local account.

Create the log folder first:
```bash
mkdir -p ~/Projects/Bee/logs
```

## Project Structure

```
Bee/
├── process.js          # Main processor
├── calendar.js         # Outlook / Apple Calendar integration
├── bee-process.sh      # End-of-day shell wrapper
├── bee-hot.sh          # Urgent post-meeting wrapper
├── config.js           # Your personal settings (gitignored)
├── config.example.js   # Config template — copy to config.js
├── sync/               # Bee CLI sync output (gitignored)
└── logs/               # Cron job logs (gitignored)
```

## How Triage Scoring Works

Conversations are scored 0–10+ based on:
- **Duration** — longer conversations score higher
- **High-signal keywords** — meeting, decision, project, deadline, etc.
- **Low-signal keywords** — lunch, traffic, hold music, etc.
- **Content quality** — number of takeaways and action items

Scores map to tiers: **High** (≥6), **Medium** (3–5), **Low** (<3). Only High and Medium conversations contribute to the digest's Next Steps section. Low conversations are archived at the bottom.

## Design Principles

- **Never auto-sends email to others** — follow-up drafts go to Mail for your review
- **Safe to re-run** — Obsidian overwrites cleanly; email and Reminders deduplicate by conversation ID
- **No upfront discipline required** — record liberally, filter automatically at end of day

## Roadmap

See [PLAN.md](PLAN.md) for the full feature roadmap.
