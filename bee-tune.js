#!/usr/bin/env node

/**
 * Bee Keyword Tuner
 *
 * Analyzes your conversation history to suggest additions to MY_HIGH_KEYWORDS
 * and MY_LOW_KEYWORDS in config.js. No AI required — pure frequency analysis.
 *
 * How it works:
 *   1. Reads all synced conversations from the last N days
 *   2. Scores each one using your current keyword config
 *   3. Separates them into HIGH and LOW buckets
 *   4. Counts how often each word/phrase appears in each bucket
 *   5. Surfaces terms that strongly predict high or low signal
 *   6. Filters out anything already in your keyword lists
 *
 * The more recordings you have, the better the suggestions.
 * Run it periodically as your conversation patterns evolve.
 *
 * Usage:
 *   node bee-tune.js               # Analyze last 90 days, show top 10 suggestions
 *   node bee-tune.js --days 180    # Look further back
 *   node bee-tune.js --top 20      # Show more suggestions
 */

const fs = require('fs');
const path = require('path');
const config = require('./config');

// ─── Args ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const daysIdx = args.indexOf('--days');
const topIdx = args.indexOf('--top');
const DAYS_BACK = daysIdx !== -1 ? parseInt(args[daysIdx + 1]) : 90;
const TOP_N = topIdx !== -1 ? parseInt(args[topIdx + 1]) : 10;

// ─── Paths ────────────────────────────────────────────────────────────────────

const SYNC_DIR = path.join(process.env.HOME, 'Projects/Bee/sync/conversations');

// ─── Current keyword lists (to avoid re-suggesting already-known terms) ───────

const EXISTING_HIGH = new Set([
  'meeting', 'decision', 'project', 'planning', 'action item', 'deadline',
  'network', 'system', 'build', 'implement', 'budget', 'approval', 'client',
  'infrastructure', 'deploy', 'security', 'automation', 'quote',
  'coordinate', 'hire', 'contract', 'strategy', 'goal',
  ...(config.MY_HIGH_KEYWORDS || [])
]);

const EXISTING_LOW = new Set([
  'lunch', 'dinner', 'breakfast', 'food', 'restaurant', 'toll', 'errand',
  'traffic', 'weather', 'sports', 'movie', 'tv show', 'personal call',
  'hold music', 'automated system', 'ivr', 'phone queue',
  ...(config.MY_LOW_KEYWORDS || [])
]);

// ─── Stop words ───────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'shall', 'can', 'need', 'must',
  'it', 'its', 'this', 'that', 'these', 'those', 'he', 'she', 'they',
  'we', 'you', 'i', 'me', 'him', 'her', 'us', 'them', 'my', 'your',
  'his', 'our', 'their', 'what', 'which', 'who', 'when', 'where',
  'how', 'why', 'all', 'any', 'both', 'each', 'few', 'more', 'most',
  'other', 'some', 'such', 'no', 'not', 'only', 'same', 'so', 'than',
  'too', 'very', 'just', 'about', 'above', 'after', 'also', 'as',
  'because', 'before', 'between', 'during', 'here', 'if', 'into',
  'out', 'over', 'since', 'there', 'through', 'up', 'use', 'used',
  'using', 'via', 'well', 'while', 'within', 'without', 'already',
  'back', 'down', 'even', 'get', 'go', 'good', 'like', 'look',
  'make', 'number', 'one', 'see', 'still', 'take', 'time', 'two',
  'way', 'work', 'year', 'new', 'now', 'said', 'going', 'come',
  'james', config.MY_NAME.toLowerCase()  // exclude the user's name
]);

// ─── Conversation parser ──────────────────────────────────────────────────────

function parseConversation(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');

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

  return { shortSummary, summary, takeaways, actionItems, durationMinutes };
}

// ─── Scoring (mirrors process.js) ─────────────────────────────────────────────

const HIGH_KEYWORDS = [...EXISTING_HIGH];
const LOW_KEYWORDS = [...EXISTING_LOW];

function scoreConversation(conv) {
  let score = 0;
  const text = (conv.shortSummary + ' ' + conv.summary + ' ' + conv.takeaways.join(' ')).toLowerCase();
  const shortText = conv.shortSummary.toLowerCase();

  const m = conv.durationMinutes;
  if (m < 2) score += 0;
  else if (m < 5) score += 2;
  else if (m < 10) score += 3;
  else if (m < 20) score += 5;
  else score += 7;

  if (HIGH_KEYWORDS.some(k => text.includes(k))) score += 2;
  if (LOW_KEYWORDS.some(k => text.includes(k))) score -= 3;
  if (LOW_KEYWORDS.some(k => shortText.includes(k))) score -= 3;
  if (conv.takeaways.length > 2) score += 1;
  if (conv.actionItems.length > 0) score += 2;

  return Math.max(0, score);
}

function tier(score) {
  if (score >= 6) return 'HIGH';
  if (score >= 3) return 'MEDIUM';
  return 'LOW';
}

// ─── Word / phrase extractor ──────────────────────────────────────────────────

function extractTokens(conv) {
  const text = [conv.shortSummary, conv.summary, ...conv.takeaways]
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9 '-]/g, ' ');

  const words = text
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));

  const tokens = [...words];

  // Add two-word phrases
  for (let i = 0; i < words.length - 1; i++) {
    tokens.push(`${words[i]} ${words[i + 1]}`);
  }

  return tokens;
}

// Count how many conversations contain each token (not raw occurrences — per-convo)
function countByConversation(conversations) {
  const freq = {};
  for (const conv of conversations) {
    const seen = new Set(extractTokens(conv));
    for (const token of seen) {
      freq[token] = (freq[token] || 0) + 1;
    }
  }
  return freq;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

if (!fs.existsSync(SYNC_DIR)) {
  console.error(`\n❌ Sync directory not found: ${SYNC_DIR}`);
  console.error(`   Run: npx @beeai/cli sync --output ~/Projects/Bee/sync\n`);
  process.exit(1);
}

// Build cutoff date
const cutoff = new Date();
cutoff.setDate(cutoff.getDate() - DAYS_BACK);

// Load all conversations within the date range
const allConvs = [];
const dateDirs = fs.readdirSync(SYNC_DIR).sort();

for (const dateDir of dateDirs) {
  const d = new Date(dateDir + 'T12:00:00');
  if (d < cutoff) continue;
  const dirPath = path.join(SYNC_DIR, dateDir);
  if (!fs.statSync(dirPath).isDirectory()) continue;
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.md'));
  for (const f of files) {
    try {
      const conv = parseConversation(path.join(dirPath, f));
      conv.score = scoreConversation(conv);
      conv.tier = tier(conv.score);
      allConvs.push(conv);
    } catch (e) {}
  }
}

const highConvs  = allConvs.filter(c => c.tier === 'HIGH');
const medConvs   = allConvs.filter(c => c.tier === 'MEDIUM');
const lowConvs   = allConvs.filter(c => c.tier === 'LOW');

console.log(`\n🐝 Bee Keyword Tuner`);
console.log(`   Analyzed ${allConvs.length} conversations from the last ${DAYS_BACK} days`);
console.log(`   ${highConvs.length} high · ${medConvs.length} medium · ${lowConvs.length} low\n`);

if (allConvs.length === 0) {
  console.log(`⚠️  No conversations found. Try --days 180 to look further back.\n`);
  process.exit(0);
}

const MIN_CONVERSATIONS = 5;
if (highConvs.length < MIN_CONVERSATIONS || lowConvs.length < MIN_CONVERSATIONS) {
  console.log(`⚠️  Not enough data for reliable suggestions yet.`);
  console.log(`   Need at least ${MIN_CONVERSATIONS} high and ${MIN_CONVERSATIONS} low conversations.`);
  console.log(`   Try --days 180 to look further back, or keep recording and run again later.\n`);
  process.exit(0);
}

// Count token frequencies per bucket
const highFreq = countByConversation(highConvs);
const lowFreq  = countByConversation(lowConvs);

const highTotal = highConvs.length;
const lowTotal  = lowConvs.length;

// How much more does this term appear in high vs low (normalized)?
function discriminationScore(term) {
  const hRate = (highFreq[term] || 0) / highTotal;
  const lRate = (lowFreq[term] || 0) / lowTotal;
  return {
    highCount: highFreq[term] || 0,
    lowCount:  lowFreq[term]  || 0,
    ratio: hRate / (lRate + 0.01)
  };
}

// HIGH candidates: frequent in high convos, not already known, clearly discriminating
const highCandidates = Object.keys(highFreq)
  .filter(w => highFreq[w] >= 3 && !EXISTING_HIGH.has(w) && !EXISTING_LOW.has(w))
  .map(w => ({ word: w, ...discriminationScore(w) }))
  .filter(c => c.ratio > 2)
  .sort((a, b) => b.highCount - a.highCount || b.ratio - a.ratio)
  .slice(0, TOP_N);

// LOW candidates: frequent in low convos, not already known, clearly discriminating
const lowCandidates = Object.keys(lowFreq)
  .filter(w => lowFreq[w] >= 3 && !EXISTING_HIGH.has(w) && !EXISTING_LOW.has(w))
  .map(w => ({ word: w, ...discriminationScore(w) }))
  .filter(c => c.ratio < 0.5)
  .sort((a, b) => b.lowCount - a.lowCount || a.ratio - b.ratio)
  .slice(0, TOP_N);

// ─── Output ───────────────────────────────────────────────────────────────────

if (highCandidates.length > 0) {
  console.log(`📈 Suggested MY_HIGH_KEYWORDS additions:`);
  console.log(`   Words that appear frequently in your high-signal conversations\n`);
  for (const c of highCandidates) {
    const label = `   '${c.word}'`;
    const counts = `found in ${c.highCount} high, ${c.lowCount} low`;
    console.log(label.padEnd(34) + counts);
  }
  console.log();
} else {
  console.log(`📈 No new HIGH keyword suggestions — your list looks well-tuned.\n`);
}

if (lowCandidates.length > 0) {
  console.log(`📉 Suggested MY_LOW_KEYWORDS additions:`);
  console.log(`   Words that appear frequently in your low-signal conversations\n`);
  for (const c of lowCandidates) {
    const label = `   '${c.word}'`;
    const counts = `found in ${c.lowCount} low, ${c.highCount} high`;
    console.log(label.padEnd(34) + counts);
  }
  console.log();
} else {
  console.log(`📉 No new LOW keyword suggestions — your list looks well-tuned.\n`);
}

console.log(`💡 Copy what looks right into MY_HIGH_KEYWORDS / MY_LOW_KEYWORDS in config.js.`);
console.log(`   Run again periodically as your conversation patterns evolve.\n`);
