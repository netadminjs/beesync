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
- [x] `bee-pre-check.js` — pre-flight check: verifies all prerequisites, config, data, and scripts. `--setup-permissions` grants macOS TCC permissions upfront so launchd runs silently.
- [x] `config.js` / `config.example.js` — personal settings separated from public code
- [x] launchd user agents — replaces cron; runs in full login session with Keychain access (hourly, end-of-day, cleanup, monthly tune)
- [x] `bee-tune.js --backlog` — appends monthly keyword suggestions to `local/keyword-backlog.md` with Apple Reminder; `local/` is gitignored and machine-local

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
- [ ] **Speaker labeling (calendar signal)** — use attendee list as one input for labeling `Unknown:` speakers; complements fingerprinting in the People Intelligence section below
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

### People Intelligence
Bee labels speakers only as `James:` or `Unknown:`. Since the device only records when it's with you, you are in every conversation — which makes you a reliable reference speaker and your memory the ground truth for confirming identities. These features turn raw transcripts into a people-aware layer.

- [ ] **Speaker fingerprinting** — build text-based style fingerprints (vocabulary, discourse markers, catchphrases, sentence cadence) for the user and for each clustered Unknown
- [ ] **Unknown speaker clustering** — group `Unknown:` turns across all recordings by stylistic similarity; rank clusters by frequency (the iPhone Photos approach)
- [ ] **Confirm-to-label flow** — dashboard surfaces top unknown clusters with sample lines + dates + locations; user confirms identity from memory, cluster is locked in
- [ ] **Multi-signal triangulation** — combine fingerprint + calendar attendees + location + time-of-day; any two matching signals raise confidence
- [ ] **Confidence scores first-class** — every attribution carries a score; low-confidence cases surfaced for review, never auto-applied
- [ ] **One-on-one first, multi-speaker later** — seed fingerprints from high-confidence 1:1 conversations (user + single Unknown), then subtract identified speakers from group recordings to expose the residual
- [ ] **Relationship graph** — who co-occurs with whom; infer working groups and social circles
- [ ] **Per-person topic profiles** — word clouds and topic clusters per identified person
- [ ] **Per-person action/commitment tracking** — actions mentioned alongside each person, outstanding asks
- [ ] **Talk-time gap alerts** — "haven't spoken with X in N weeks" for people the user wants to stay connected to
- [ ] **Name disambiguation** — separate multiple people who share a surface name
- [ ] **Privacy/zone classification** — location + time + speaker ID routes conversations to work/home/personal channels
- [ ] **Conversation importance scoring** — length × speakers × action density × emotional intensity; surface top-N per week
- [ ] **Weekly per-person digest** — what each important person said/did this week

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
- **You are in every conversation** — Bee only records when device + phone are together; every transcript has the user as a known reference speaker. Downstream algorithms can rely on this.
- **Augment Bee, don't replace it** — Bee handles the hard first mile (audio → transcripts, summaries, location, timestamps). This pipeline builds the meaning layer on top using cross-references Bee can't see (calendar, wins, git, Reminders, memory).
- **Memory is the ground truth** — the user was present in every recording; confirmation flows can rely on human recall, not forensic audio replay

---

## 💡 Ideas Parking Lot
- Private GitHub repo for transcripts — query via Claude across all history
- Obsidian Dataview dashboard — open action items across all days in one view
- "Human 2.0" — AI that learns patterns from recordings over time, predicts needs
- Y bot / network monitoring integration — work context awareness
- Voice trigger — say a keyword during recording to flag it as high priority
- BeeMCP server — connect Bee data directly to Claude Code for live querying
- Post meeting recap auto-posted to the right Teams channel
