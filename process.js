#!/usr/bin/env node

/**
 * Bee Daily Digest Processor
 * Reads synced Bee conversations, triages them, and writes a digest to Obsidian.
 *
 * Usage: node process.js [--date YYYY-MM-DD] [--days N] [--email] [--reminders]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { getCalendarEvents, matchConversationToEvent } = require('./calendar');

// ─── Config ──────────────────────────────────────────────────────────────────

const config = require('./config');

const SYNC_DIR = path.join(process.env.HOME, 'Projects/Bee/sync/conversations');
const OBSIDIAN_BEE = path.join(
  process.env.HOME,
  `Library/Mobile Documents/iCloud~md~obsidian/Documents/${config.OBSIDIAN_VAULT_NAME}/BEE`
);
const OBSIDIAN_CONVOS = path.join(OBSIDIAN_BEE, 'conversations');

const EMAIL_ADDRESSES = config.EMAIL_ADDRESSES;
const REMINDERS_LIST = config.REMINDERS_LIST;
const TRACKER_FILE = path.join(process.env.HOME, 'Projects/Bee/.processed.json');

// ─── Processed Conversation Tracker ──────────────────────────────────────────

function loadTracker() {
  try {
    return JSON.parse(fs.readFileSync(TRACKER_FILE, 'utf8'));
  } catch {
    return { emailed: [], reminded: [], drafted: [] };
  }
}

function saveTracker(tracker) {
  fs.writeFileSync(TRACKER_FILE, JSON.stringify(tracker, null, 2), 'utf8');
}

// Parse flags
const args = process.argv.slice(2);
const dateIdx = args.indexOf('--date');
const daysIdx = args.indexOf('--days');
const dateArg = dateIdx !== -1 ? args[dateIdx + 1] : null;
const daysArg = daysIdx !== -1 ? args[daysIdx + 1] : null;
const SEND_EMAIL = args.includes('--email');
const SEND_REMINDERS = args.includes('--reminders');
const CREATE_DRAFTS = args.includes('--drafts');

const targetDate = dateArg || new Date().toISOString().slice(0, 10);
const daysBack = daysArg ? parseInt(daysArg) : 0;

// Build list of dates to process
const dates = [];
for (let i = daysBack; i >= 0; i--) {
  const d = new Date(targetDate);
  d.setDate(d.getDate() - i);
  dates.push(d.toISOString().slice(0, 10));
}

// ─── Triage Scoring ───────────────────────────────────────────────────────────

const HIGH_KEYWORDS = [
  'meeting', 'decision', 'project', 'planning', 'action item', 'deadline',
  'network', 'system', 'build', 'implement', 'budget', 'approval', 'client',
  'infrastructure', 'deploy', 'security', 'automation', 'quote',
  'coordinate', 'hire', 'contract', 'strategy', 'goal',
  ...(config.MY_HIGH_KEYWORDS || [])
];

const LOW_KEYWORDS = [
  'lunch', 'dinner', 'breakfast', 'food', 'restaurant', 'toll', 'errand',
  'traffic', 'weather', 'sports', 'movie', 'tv show', 'personal call',
  'hold music', 'automated system', 'ivr', 'phone queue',
  ...(config.MY_LOW_KEYWORDS || [])
];

function scoreConversation(conv) {
  let score = 0;
  const text = (conv.shortSummary + ' ' + conv.summary + ' ' + conv.takeaways.join(' ')).toLowerCase();
  const shortText = conv.shortSummary.toLowerCase();

  // Duration scoring
  const minutes = conv.durationMinutes;
  if (minutes < 2) score += 0;
  else if (minutes < 5) score += 2;
  else if (minutes < 10) score += 3;
  else if (minutes < 20) score += 5;
  else score += 7;

  // Keyword boosts
  if (HIGH_KEYWORDS.some(k => text.includes(k))) score += 2;
  if (LOW_KEYWORDS.some(k => text.includes(k))) score -= 3;
  if (LOW_KEYWORDS.some(k => shortText.includes(k))) score -= 3;

  // Content quality
  if (conv.takeaways.length > 2) score += 1;
  if (conv.actionItems.length > 0) score += 2;

  return Math.max(0, score);
}

function tier(score) {
  if (score >= 6) return 'HIGH';
  if (score >= 3) return 'MEDIUM';
  return 'LOW';
}

// ─── Markdown Parser ──────────────────────────────────────────────────────────

function parseConversation(filePath, date) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const id = path.basename(filePath, '.md');

  const get = (label) => {
    const re = new RegExp(`#{1,3} ${label}\\s+([\\s\\S]*?)(?=\\n#{1,3} |$)`, 'i');
    const m = raw.match(re);
    return m ? m[1].trim() : '';
  };

  const startMatch = raw.match(/start_time:\s*(.+)/);
  const endMatch = raw.match(/end_time:\s*(.+)/);
  const startTime = startMatch ? new Date(startMatch[1].trim()) : null;
  const endTime = endMatch ? new Date(endMatch[1].trim()) : null;
  const durationMinutes = startTime && endTime
    ? Math.round((endTime - startTime) / 60000)
    : 0;

  const shortSummary = get('Short Summary');
  const summaryBlock = get('Summary');
  const summary = summaryBlock.replace(/^#+\s+\w+\n/gm, '').trim().split('\n')[0];

  const takeawaysBlock = get('Key Take aways') || get('Key Takeaways');
  const takeaways = takeawaysBlock
    .split('\n')
    .filter(l => l.match(/^[-*•]/))
    .map(l => l.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean);

  const actionBlock = get('Action Items');
  const actionItems = actionBlock
    .split('\n')
    .filter(l => l.match(/^[-*•\[]/))
    .map(l => l.replace(/^[-*•\[\]\s]+/, '').trim())
    .filter(l => l.length > 3);

  const locationMatch = raw.match(/^- (\d+.+,\s*(?:TN|NY|CA|FL|TX|GA|AL|SC|NC|VA|OH|IN|IL|MI|WI|MN|WA|OR|CO|AZ|NV|UT|KS|MO|AR|MS|LA|OK|NE|SD|ND|MT|ID|WY|NM|AK|HI)[, ].+)$/m);
  const location = locationMatch ? locationMatch[1].replace(/\s*\([\d., -]+\).*/, '').trim() : null;

  const timeStr = startTime
    ? startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: config.TIMEZONE })
    : 'Unknown time';

  return {
    id, date, filePath,
    shortSummary, summary,
    takeaways, actionItems, location,
    startTime, endTime, durationMinutes, timeStr
  };
}

// ─── Next Steps Classifier ────────────────────────────────────────────────────

const SCHEDULE_KEYWORDS = [
  'schedule', 'follow up', 'follow-up', 'appointment',
  'next week', 'tomorrow', 'next month', 'by end of', 'deadline',
  'due date', 'early april', 'upcoming meeting', 'set a meeting', 'set a call',
  'meet with', 'meeting with', 'scheduled to meet', 'in the morning', 'in the afternoon',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'this weekend',
  'next year', 'by july', 'by may', 'before the end'
];

// Specific action verbs — requires verb form, not noun form
// Use trailing space or word-boundary phrasing to avoid matching inside nouns
// e.g. "install " won't match "installation", "resolve " won't match "resolution"
const TODO_KEYWORDS = [
  'need to', 'needs to', 'must ', 'send ', 'submit', 'approve', 'review',
  'contact', 'update', 'create', 'install ', 'set up', 'configure', 'check on',
  'verify', 'identify', 'retrieve', 'fix ', 'resolve ', 'implement', 'purchase',
  'order ', 'request', 'coordinate', 'ensure', 'remind', 'notify', 'upload',
  'assign', 'complete', 'finish', 'close out', 'follow through', 'get quotes',
  'reach out', 'sync with', 'touch base', 'build ', 'deploy '
];

const IDEA_KEYWORDS = [
  'exploring', 'consider', 'potential', 'could be', 'thinking about',
  'possibility', 'interested in', 'might be', 'looking into', 'investigate',
  'plan to', 'hoping to', 'want to', 'worth exploring', 'idea to',
  'research whether', 'evaluate', 'assess'
];

// Patterns that indicate a pure fact — skip these even if they contain action words
const ME = config.MY_NAME.toLowerCase();
const FACT_PATTERNS = [
  /\$[\d,]+/,                                                          // price/cost: "$2,500"
  / successfully /i,                                                   // past achievement mid-sentence
  new RegExp(`^${ME} (successfully|created|configured|installed|built|set up|implemented|completed|sent|deployed|advocated|impressed|noted|feels|discussed|explained|shared|expressed|reflected|is scheduled|was|has|had|will be meeting)`, 'i'), // user past tense / feelings / already-scheduled
  /^(the|a|an|both|all|this|that|there is|it )/i,                     // descriptive opener
  /^(explanation|description|overview|summary|detail|discussion|running|using) /i, // noun/gerund phrases
  /^the other person/i,                                                // someone else's action
  /^(he|she|they|his|her) /i,                                         // any third-party opener
  new RegExp(`^(?!${ME}\\b)[A-Z][a-z]+( [A-Z][a-z]+)? (needs? to|should |successfully |created |installed |implemented |will receive|plans? to|is going)`, 'i'), // Named third-party (Andrew, Randy Smith, etc.)
  /^none identified/i,                                                 // Bee placeholder
  /^n\/a/i,                                                            // Bee placeholder
  /\bare being (considered|explored|discussed|evaluated|planned)\b/i,  // passive voice
  /\b(is|are|was|were|has been|have been)\b.{0,40}(capability|feature|tool|option|approach|method|solution|process)/i,
  /\bwill (shut|close|impact|affect|disconnect|be implemented|be rolled out|receive)\b/i, // future org-level events
  /^(hiring|onboarding|training|construction|renovation|the (school|district|team|process|system))/i, // org-level facts
  /^if (new|the|a|an|there)/i,                                        // conditional statements
  /\bshows? (inconsistent|unexpected|incorrect|limited|poor)\b/i       // app behavior observations
];

function looksLikeFact(text) {
  // Must have at least one action keyword to not be a fact
  const lower = text.toLowerCase();
  const hasAction =
    TODO_KEYWORDS.some(k => lower.includes(k)) ||
    SCHEDULE_KEYWORDS.some(k => lower.includes(k)) ||
    IDEA_KEYWORDS.some(k => lower.includes(k));
  if (!hasAction) return true;

  // Even if it has an action word, check if it's clearly a descriptive statement
  return FACT_PATTERNS.some(p => p.test(text));
}

function classifyTakeaway(text) {
  if (looksLikeFact(text)) return null;
  const t = text.toLowerCase();
  if (SCHEDULE_KEYWORDS.some(k => t.includes(k))) return 'schedule';
  if (IDEA_KEYWORDS.some(k => t.includes(k))) return 'idea';
  if (TODO_KEYWORDS.some(k => t.includes(k))) return 'todo';
  return null;
}

// ─── Outputs: Email & Reminders ───────────────────────────────────────────────

function sendEmail(dateLabel, md, todos, schedules, ideas, newConversations, tracker) {
  const newIds = newConversations.map(c => c.id);
  if (newIds.length === 0) {
    console.log(`  📧 Email skipped — no new conversations since last email`);
    return tracker;
  }

  const subject = `Bee Daily Digest — ${dateLabel}`;

  // Build a plain-text summary for the email body
  let body = `${subject}\n${'═'.repeat(subject.length)}\n\n`;

  if (todos.length) {
    body += `✅ TO DO (${todos.length})\n`;
    todos.forEach(t => { body += t.replace('- [ ] ', '• ').replace(/\s+\*\(.*\)\*$/, '') + '\n'; });
    body += '\n';
  }
  if (schedules.length) {
    body += `📅 TO SCHEDULE (${schedules.length})\n`;
    schedules.forEach(t => { body += t.replace('- [ ] ', '• ').replace(/\s+\*\(.*\)\*$/, '') + '\n'; });
    body += '\n';
  }
  if (ideas.length) {
    body += `💡 IDEAS TO EXPLORE (${ideas.length})\n`;
    ideas.forEach(t => { body += t.replace('- [ ] ', '• ').replace(/\s+\*\(.*\)\*$/, '') + '\n'; });
    body += '\n';
  }

  body += '\n──────────────────────────\nFull digest available in Obsidian → BEE folder.\n';

  const escaped = body.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const toRecipients = EMAIL_ADDRESSES
    .map(addr => `make new to recipient with properties {address:"${addr}"}`)
    .join('\n        ');

  const script = `
    tell application "Mail"
      set newMsg to make new outgoing message with properties {subject:"${subject}", content:"${escaped}", visible:false}
      tell newMsg
        ${toRecipients}
      end tell
      send newMsg
    end tell
  `;

  try {
    execSync(`osascript -e '${script.replace(/'/g, "'\"'\"'")}'`);
    tracker.emailed.push(...newIds);
    console.log(`  📧 Email sent to ${EMAIL_ADDRESSES.join(', ')} (${newIds.length} new conversation(s))`);
  } catch (e) {
    console.log(`  ⚠️  Email failed: ${e.message.slice(0, 80)}`);
  }
  return tracker;
}

function addReminders(newTodos, newConversationIds, tracker) {
  if (newConversationIds.length === 0) {
    console.log(`  🔔 Reminders skipped — no new conversations since last run`);
    return tracker;
  }
  if (newTodos.length === 0) {
    tracker.reminded.push(...newConversationIds);
    return tracker;
  }

  const ensureList = `
    tell application "Reminders"
      if not (exists list "${REMINDERS_LIST}") then
        make new list with properties {name:"${REMINDERS_LIST}"}
      end if
    end tell
  `;
  try { execSync(`osascript -e '${ensureList}'`); } catch (e) {}

  let added = 0;
  for (const item of newTodos) {
    const text = item.replace('- [ ] ', '').replace(/\s+\*\(.*?\)\*$/, '').trim();
    const escaped = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/'/g, "'\"'\"'");
    const script = `
      tell application "Reminders"
        tell list "${REMINDERS_LIST}"
          make new reminder with properties {name:"${escaped}"}
        end tell
      end tell
    `;
    try { execSync(`osascript -e '${script}'`); added++; } catch (e) {}
  }
  tracker.reminded.push(...newConversationIds);
  console.log(`  🔔 ${added} reminder${added !== 1 ? 's' : ''} added to Reminders → ${REMINDERS_LIST}`);
  return tracker;
}

// ─── Follow-Up Draft Generator ────────────────────────────────────────────────

// Your own email addresses — excluded from draft recipients
const JAMES_EMAILS = config.MY_EMAILS;

function isMyEmail(email) {
  if (!email) return true;
  const lower = email.toLowerCase();
  return JAMES_EMAILS.some(e => lower.includes(e));
}

function createFollowUpDrafts(conversations, tracker) {
  // Only draft HIGH conversations not yet drafted
  const candidates = conversations.filter(c =>
    tier(c.score) === 'HIGH' && !tracker.drafted.includes(c.id)
  );

  if (candidates.length === 0) {
    console.log(`  ✉️  Drafts skipped — no new high-value conversations`);
    return tracker;
  }

  let created = 0;

  for (const c of candidates) {
    // Build draft body
    const meetingLabel = c.calendarEvent ? c.calendarEvent.title : c.shortSummary;
    const subject = `Follow-up: ${meetingLabel}`;

    // Greeting — use first names if we have attendees, otherwise generic
    const externalAttendees = (c.attendees || []).filter(a => !isMyEmail(a.email));
    const firstNames = externalAttendees.map(a => (a.name || '').split(' ')[0]).filter(Boolean);
    const greeting = firstNames.length > 0
      ? `Hi ${firstNames.join(' and ')},`
      : 'Hi,';

    // Body paragraphs
    let body = `${greeting}\n\n`;
    body += `Thanks for the time today. Here's a quick follow-up from our discussion`;
    body += c.calendarEvent ? ` on ${c.calendarEvent.title}` : '';
    body += `.\n\n`;

    if (c.summary) {
      body += `${c.summary}\n\n`;
    }

    // Key takeaways
    const relevantTakeaways = c.takeaways.filter(t => !looksLikeFact(t));
    if (relevantTakeaways.length > 0) {
      body += `Key takeaways:\n`;
      relevantTakeaways.forEach(t => { body += `• ${t}\n`; });
      body += `\n`;
    }

    // Action items
    const actionTodos = c.actionItems.filter(a => {
      const b = classifyTakeaway(a);
      return b === 'todo' || b === 'schedule';
    });
    if (actionTodos.length > 0) {
      body += `Next steps:\n`;
      actionTodos.forEach(a => { body += `• ${a}\n`; });
      body += `\n`;
    }

    body += `Please let me know if I missed anything or if you have any questions.\n\nBest,\n${config.MY_NAME}`;

    // Escape for AppleScript
    const escapedSubject = subject.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const escapedBody = body.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

    // Build recipient lines (external attendees only)
    const recipientLines = externalAttendees.length > 0
      ? externalAttendees.map(a => {
          const safeName = (a.name || '').replace(/"/g, '\\"');
          const safeEmail = (a.email || '').replace(/"/g, '\\"');
          return `make new to recipient with properties {name:"${safeName}", address:"${safeEmail}"}`;
        }).join('\n        ')
      : `-- no attendees found — address manually`;

    const script = `
      tell application "Mail"
        set newMsg to make new outgoing message with properties {subject:"${escapedSubject}", content:"${escapedBody}", visible:true}
        tell newMsg
          ${recipientLines}
        end tell
      end tell
    `;

    try {
      execSync(`osascript -e '${script.replace(/'/g, "'\"'\"'")}'`);
      created++;
      const recipientNote = externalAttendees.length > 0
        ? `→ ${externalAttendees.map(a => a.name || a.email).join(', ')}`
        : `→ no recipients (address manually)`;
      console.log(`  ✉️  Draft: "${subject}" ${recipientNote}`);
    } catch (e) {
      console.log(`  ⚠️  Draft failed for "${subject}": ${e.message.slice(0, 80)}`);
    }

    tracker.drafted.push(c.id);
  }

  if (created > 0) {
    console.log(`  ✉️  ${created} draft${created !== 1 ? 's' : ''} created in Mail — review and send when ready`);
  }

  return tracker;
}

// ─── Digest Builder ───────────────────────────────────────────────────────────

function buildDigest(date, conversations) {
  const scored = conversations
    .map(c => ({ ...c, score: scoreConversation(c) }))
    .sort((a, b) => b.score - a.score);

  const high = scored.filter(c => tier(c.score) === 'HIGH');
  const medium = scored.filter(c => tier(c.score) === 'MEDIUM');
  const low = scored.filter(c => tier(c.score) === 'LOW');

  const todos = [], schedules = [], ideas = [];

  for (const c of [...high, ...medium]) {
    const source = `*(${c.shortSummary})*`;

    // Explicit action items — still run through fact filter, only include real actions
    for (const a of c.actionItems) {
      const bucket = classifyTakeaway(a);
      if (bucket === 'schedule') schedules.push(`- [ ] ${a}  ${source}`);
      else if (bucket === 'idea') ideas.push(`- [ ] ${a}  ${source}`);
      else if (bucket === 'todo') todos.push(`- [ ] ${a}  ${source}`);
      // null = looks like a fact even though Bee flagged it — skip
    }

    // Takeaways — only include if they look like actions, not facts
    for (const t of c.takeaways) {
      const bucket = classifyTakeaway(t);
      if (bucket === 'schedule') schedules.push(`- [ ] ${t}  ${source}`);
      else if (bucket === 'idea') ideas.push(`- [ ] ${t}  ${source}`);
      else if (bucket === 'todo') todos.push(`- [ ] ${t}  ${source}`);
    }
  }

  // Deduplicate — remove items that are too similar to one already in the list
  function dedupe(items) {
    const seen = [];
    return items.filter(item => {
      const core = item.replace(/- \[ \] /,'').replace(/\s+\*\(.*?\)\*$/,'').toLowerCase()
        .replace(/[^a-z0-9 ]/g, '').trim().split(' ').slice(0, 8).join(' ');
      if (seen.some(s => {
        const overlap = core.split(' ').filter(w => w.length > 4 && s.includes(w)).length;
        return overlap >= 4;
      })) return false;
      seen.push(core);
      return true;
    });
  }

  const dedupedTodos = dedupe(todos);
  const dedupedSchedules = dedupe(schedules);
  const dedupedIdeas = dedupe(ideas);

  const hasNextSteps = dedupedTodos.length || dedupedSchedules.length || dedupedIdeas.length;

  const fmt = (d) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  const dateLabel = fmt(date);

  let md = `# Bee Daily Digest — ${dateLabel}\n\n`;
  md += `> ${conversations.length} conversation${conversations.length !== 1 ? 's' : ''} recorded · `;
  md += `${high.length} high-value · ${medium.length} medium · ${low.length} filtered out\n\n`;
  md += `---\n\n`;

  // Next Steps
  if (hasNextSteps) {
    md += `## Next Steps\n\n`;
    if (dedupedTodos.length > 0) {
      md += `### ✅ To Do\n\n`;
      md += dedupedTodos.join('\n') + '\n\n';
    }
    if (dedupedSchedules.length > 0) {
      md += `### 📅 To Schedule\n\n`;
      md += dedupedSchedules.join('\n') + '\n\n';
    }
    if (dedupedIdeas.length > 0) {
      md += `### 💡 Ideas to Explore\n\n`;
      md += dedupedIdeas.join('\n') + '\n\n';
    }
    md += `---\n\n`;
  }

  // High value conversations
  if (high.length > 0) {
    md += `## Key Conversations\n\n`;
    for (const c of high) {
      md += `### ${c.shortSummary}\n`;
      md += `*${c.timeStr} · ${c.durationMinutes} min*`;
      if (c.location) md += ` · 📍 ${c.location.split(',').slice(0, 2).join(', ')}`;
      md += `\n\n`;
      if (c.calendarEvent) {
        md += `📆 **${c.calendarEvent.title}**\n`;
        if (c.attendees && c.attendees.length > 0) {
          md += `👥 ${c.attendees.map(a => a.name).join(', ')}\n`;
        }
        md += `\n`;
      }
      md += `${c.summary}\n\n`;
      if (c.takeaways.length > 0) {
        md += `**Key Takeaways:**\n`;
        c.takeaways.forEach(t => { md += `- ${t}\n`; });
        md += `\n`;
      }
      md += `> [[conversations/${c.date}-${c.id}|View full transcript]]\n\n`;
    }
    md += `---\n\n`;
  }

  // Medium value
  if (medium.length > 0) {
    md += `## Also Worth Noting\n\n`;
    for (const c of medium) {
      md += `- **${c.shortSummary}** *(${c.timeStr}, ${c.durationMinutes} min)* — ${c.summary.slice(0, 120)}...\n`;
    }
    md += `\n---\n\n`;
  }

  // Low value archive
  if (low.length > 0) {
    md += `## Archived (Low Signal)\n\n`;
    for (const c of low) {
      md += `- ${c.shortSummary} *(${c.timeStr}, ${c.durationMinutes} min)*\n`;
    }
    md += `\n`;
  }

  md += `---\n*Generated by Bee processor · ${new Date().toLocaleString('en-US', { timeZone: config.TIMEZONE })}*\n`;

  return { md, dateLabel, high, medium, low, todos: dedupedTodos, schedules: dedupedSchedules, ideas: dedupedIdeas };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const now = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
console.log(`\n🐝 Bee Digest Processor — ${now}`);
if (SEND_EMAIL) console.log(`📧 Email enabled`);
if (SEND_REMINDERS) console.log(`🔔 Reminders enabled`);
if (CREATE_DRAFTS) console.log(`✉️  Follow-up drafts enabled`);
console.log(`Processing: ${dates.join(', ')}\n`);

// Load tracker — remembers which conversations have already triggered email/reminders
let tracker = loadTracker();
let totalConversations = 0;

for (const date of dates) {
  const dir = path.join(SYNC_DIR, date);
  if (!fs.existsSync(dir)) continue;

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  if (files.length === 0) continue;

  const conversations = files.map(f => parseConversation(path.join(dir, f), date));
  totalConversations += conversations.length;

  // Match conversations to calendar events
  const calEvents = getCalendarEvents(date);
  if (calEvents.length > 0) {
    console.log(`  📆 ${calEvents.length} calendar event(s) found for ${date}`);
  }
  for (const conv of conversations) {
    const match = matchConversationToEvent(conv, calEvents);
    if (match) {
      conv.calendarEvent = match;
      conv.attendees = match.attendees;
    }
  }

  console.log(`📅 ${date}: ${conversations.length} conversation(s)`);

  const { md, dateLabel, high, medium, low, todos, schedules, ideas } = buildDigest(date, conversations);

  // Obsidian always gets the full digest (overwrite is fine)
  if (!fs.existsSync(OBSIDIAN_BEE)) fs.mkdirSync(OBSIDIAN_BEE, { recursive: true });
  if (!fs.existsSync(OBSIDIAN_CONVOS)) fs.mkdirSync(OBSIDIAN_CONVOS, { recursive: true });
  for (const c of [...high, ...medium]) {
    fs.copyFileSync(c.filePath, path.join(OBSIDIAN_CONVOS, `${c.date}-${c.id}.md`));
  }
  fs.writeFileSync(path.join(OBSIDIAN_BEE, `${date}.md`), md, 'utf8');

  console.log(`  ✅ ${high.length} high · ${medium.length} medium · ${low.length} low`);
  console.log(`  📋 ${todos.length} to-do · ${schedules.length} to schedule · ${ideas.length} idea(s)`);
  console.log(`  📝 Written to Obsidian: BEE/${date}.md`);

  // Email, Reminders, Drafts — only fire for conversations not yet processed
  if (SEND_EMAIL || SEND_REMINDERS || CREATE_DRAFTS) {
    const allConvs = [...high, ...medium];

    // New for email = conversations not yet emailed
    const newForEmail = allConvs.filter(c => !tracker.emailed.includes(c.id));
    const newEmailTodos = todos.filter(t =>
      newForEmail.some(c => t.includes(`*(${c.shortSummary})*`))
    );
    const newEmailSchedules = schedules.filter(t =>
      newForEmail.some(c => t.includes(`*(${c.shortSummary})*`))
    );
    const newEmailIdeas = ideas.filter(t =>
      newForEmail.some(c => t.includes(`*(${c.shortSummary})*`))
    );

    // New for reminders = conversations not yet reminded
    const newForReminders = allConvs.filter(c => !tracker.reminded.includes(c.id));
    const newReminderTodos = todos.filter(t =>
      newForReminders.some(c => t.includes(`*(${c.shortSummary})*`))
    );

    if (SEND_EMAIL) {
      tracker = sendEmail(dateLabel, md, newEmailTodos, newEmailSchedules, newEmailIdeas, newForEmail, tracker);
    }
    if (SEND_REMINDERS) {
      tracker = addReminders(newReminderTodos, newForReminders.map(c => c.id), tracker);
    }
    if (CREATE_DRAFTS) {
      tracker = createFollowUpDrafts(high, tracker);
    }
  }
}

// Save updated tracker
saveTracker(tracker);

console.log(`\nDone. ${totalConversations} conversation(s) processed.\n`);
