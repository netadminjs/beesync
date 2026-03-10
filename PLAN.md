# Bee Automation — Project Plan

---

## ✅ Completed
- [x] Unlock Bee Developer Mode (iOS app)
- [x] Install Bee CLI (`npx @beeai/cli`)
- [x] Authenticate with Bee account
- [x] Full sync of all conversations to `~/Projects/Bee/sync/`
- [x] Build triage engine (scores conversations, filters noise)
- [x] Build daily digest processor (`process.js`)
- [x] Next Steps section — To Do, To Schedule, Ideas to Explore
- [x] Facts filter — reduces false To Do items from descriptive statements
- [x] Wikilinks to full transcripts inside Obsidian
- [x] Output to Obsidian BEE folder (auto-syncs to iPhone/iPad via iCloud)
- [x] Email digest to work + personal address (`--email` flag)
- [x] Apple Reminders integration (`--reminders` flag)
- [x] Processed conversation tracker (`.processed.json`) — deduplication across runs
- [x] `bee-process.sh` — standard end-of-day script
- [x] `bee-hot.sh` — urgent post-meeting script, fires immediately, safe anytime
- [x] Backfill full history
- [x] SETUP.md — full reconnect + new machine guide
- [x] PLAN.md — this file
- [x] `bee-tune.js` — keyword tuner: frequency analysis across high/low conversation buckets to suggest MY_HIGH_KEYWORDS / MY_LOW_KEYWORDS additions
- [x] `bee-pre-check.js` — pre-flight check: verifies all prerequisites, config, data, scripts, and outputs the exact crontab PATH line for the current machine. Doubles as post-setup validator.
- [x] `config.js` / `config.example.js` — personal settings separated from public code

---

## 🔲 Immediate — Next Session

### Mac Mini Setup (when back at work)
- [ ] Install Node + Bee CLI on Mac Mini
- [ ] Log in and verify
- [ ] Set up three cron jobs (Mac Mini only):
  ```
  # Hourly — sync + process (deduplication ensures no duplicate emails/reminders)
  0 * * * * cd ~/Projects/Bee && npx @beeai/cli sync --output sync && node process.js --email --reminders

  # 5:30 PM weekdays — end of work day
  30 17 * * 1-5 cd ~/Projects/Bee && node process.js --email --reminders

  # 11:50 PM weekdays — catches any evening meetings
  50 23 * * 1-5 cd ~/Projects/Bee && npx @beeai/cli sync --output sync && node process.js --email --reminders
  ```

### MacBook Neo Setup (arriving this week)
- [ ] Install Node + Bee CLI
- [ ] Log in and verify
- [ ] No cron jobs — manual trigger only

---

## 📋 Up Next (prioritized)

### Outputs
- [ ] **Incremental sync** — use `bee changed --cursor` instead of full sync each time (confirmed working)
- [ ] **Specify email sender** — work address for work digest, personal for personal
- [x] **Meeting follow-up email DRAFTS** — one draft per high-value conversation, you review before sending (never auto-send to others)
- [ ] **Apple Calendar** — create follow-up events from To Schedule items
- [ ] **Microsoft To Do** — push tasks with due dates once Outlook is installed
- [ ] **Teams message** — post highlights to a channel or DM yourself
- [ ] **OneNote** — dump meeting notes into a notebook

### Calendar & Attendees (unlocked when Outlook installed)
- [ ] **Install Outlook** on Mac with school account → unlocks full Microsoft graph
- [ ] **Add all email accounts** to Mail.app (school, personal M365, Yahoo)
- [ ] **Calendar cross-reference** — match Bee recording timestamps to calendar events
- [ ] **Retro-update discipline** — update calendar for ad-hoc meetings at end of day
- [ ] **Attendee list pull** — from matched calendar event → auto-address follow-up drafts
- [ ] **Speaker labeling** — use attendee list to label "Unknown" speakers in transcripts
- [ ] **Assign action items** to the right person based on who was in the meeting
- [ ] **Calendar match flag** — store per conversation, re-check on next run if unmatched

### Quality
- [ ] **Triage tuning** — refine as daily patterns emerge
- [ ] **Deduplicate action items** across conversations covering the same topic
- [ ] **Location display cleanup** — strip extra spaces

### Workflow
- [ ] **Mac Shortcut / menu bar trigger** — one tap, no terminal needed (works on all Macs)
- [ ] **Weekly rollup** — Friday digest summarizing the whole week's highlights

### Intelligence
- [ ] **Project tagging** — auto-tag conversations by project
- [ ] **Cross-day linking** — surface related conversations from past recordings
- [ ] **Natural language search** — "what did I decide about X?" across all recordings

### Archive & Cleanup
- [ ] **Auto-archive** low-signal conversations after N days
- [ ] **Duplicate detection** — near-identical conversations from same time period

---

## ⚠️ Design Principles
- **Never auto-send email to others** — always drafts for external recipients, you review and send
- **Calendar match retry** — if unmatched at sync time, re-check on next run (calendar updated retroactively)
- **Record liberally, filter automatically** — don't add upfront discipline, add end-of-day discipline
- **If you didn't document it, you aren't finished**
- **Outlier workflows for outlier situations** — don't rebuild everything for a maybe

---

## 💡 Ideas Parking Lot
- Private GitHub repo for transcripts — query via Claude across all history
- Obsidian Dataview dashboard — open action items across all days in one view
- "Human 2.0" — AI that learns patterns from recordings over time, predicts needs
- Y bot / network monitoring integration — work context awareness
- Voice trigger — say a keyword during recording to flag it as high priority
- BeeMCP server — connect Bee data directly to Claude Code for live querying
- Post meeting recap auto-posted to the right Teams channel
