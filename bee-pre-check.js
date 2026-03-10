#!/usr/bin/env node

/**
 * Bee Environment Check
 *
 * Verifies your setup before first run. Checks for all dependencies, confirms
 * your config is valid, and tells you exactly what PATH line to add to crontab.
 *
 * Usage: node bee-pre-check.js
 *
 * Run this when setting up a new machine. Fix any ❌ items before running the
 * processor. ⚠️ warnings are worth reviewing but won't block basic operation.
 */

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

let passed = 0, failed = 0, warned = 0;

function ok(msg)         { console.log(`  ✅ ${msg}`); passed++; }
function fail(msg, fix)  { console.log(`  ❌ ${msg}${fix ? `\n     → ${fix}` : ''}`); failed++; }
function warn(msg, fix)  { console.log(`  ⚠️  ${msg}${fix ? `\n     → ${fix}` : ''}`); warned++; }
function section(name)   { console.log(`\n${name}`); }
function info(msg)       { console.log(`  ℹ️  ${msg}`); }

// ─── System ───────────────────────────────────────────────────────────────────

console.log(`\n🐝 Bee Environment Check`);
console.log(`   Verifying your setup...\n`);

section('System');

if (process.platform === 'darwin') {
  ok('macOS detected — required for Mail, Reminders, and Calendar integration');
} else {
  fail(
    `macOS required (detected: ${process.platform})`,
    'This tool uses AppleScript and is macOS-only.'
  );
}

// ─── Node.js ──────────────────────────────────────────────────────────────────

section('Node.js');

const nodePath = run('which node');
if (nodePath) {
  ok(`Node ${process.version} at ${nodePath}`);
} else {
  fail('Node not found', 'Run: brew install node');
}

const npxPath = run('which npx');
if (npxPath) {
  ok(`npx at ${npxPath}`);
} else {
  fail('npx not found', 'It should come with Node. Try: npm install -g npm');
}

// ─── Bee CLI ──────────────────────────────────────────────────────────────────

section('Bee CLI');

const beeVersion = run('npx @beeai/cli --version');
if (beeVersion) {
  ok(`Bee CLI installed (${beeVersion})`);
} else {
  fail('Bee CLI not found', 'Run: npm install -g @beeai/cli');
}

const beeStatus = run('npx @beeai/cli status');
if (beeStatus && beeStatus.toLowerCase().includes('verified')) {
  const verifiedLine = beeStatus.split('\n').find(l => l.toLowerCase().includes('verified')) || 'Verified';
  ok(`Authenticated — ${verifiedLine.trim()}`);
} else {
  fail('Not logged in to Bee', 'Run: npx @beeai/cli login');
}

// ─── Configuration ────────────────────────────────────────────────────────────

section('Configuration');

const configPath  = path.join(__dirname, 'config.js');
const examplePath = path.join(__dirname, 'config.example.js');

if (!fs.existsSync(configPath)) {
  if (fs.existsSync(examplePath)) {
    fail(
      'config.js not found',
      'Run: cp config.example.js config.js   then edit it with your settings'
    );
  } else {
    fail('Neither config.js nor config.example.js found — are you in the right directory?');
  }
} else {
  ok('config.js found');

  let config;
  try {
    config = require('./config');
  } catch (e) {
    fail(`config.js has a syntax error: ${e.message}`);
    config = null;
  }

  if (config) {
    // Obsidian vault
    if (!config.OBSIDIAN_VAULT_NAME || config.OBSIDIAN_VAULT_NAME === 'YourVaultName') {
      warn('OBSIDIAN_VAULT_NAME is still the placeholder', 'Edit config.js and set your actual Obsidian vault folder name');
    } else {
      const vaultPath = path.join(
        process.env.HOME,
        `Library/Mobile Documents/iCloud~md~obsidian/Documents/${config.OBSIDIAN_VAULT_NAME}`
      );
      if (fs.existsSync(vaultPath)) {
        ok(`Obsidian vault accessible: ${config.OBSIDIAN_VAULT_NAME}`);
      } else {
        warn(
          `Obsidian vault not found at expected path`,
          `Check that OBSIDIAN_VAULT_NAME in config.js matches the folder name inside iCloud~md~obsidian/Documents/`
        );
      }
    }

    // Email addresses
    const placeholderEmails = ['you@work.com', 'you@personal.com', 'example.com'];
    const hasPlaceholder = config.EMAIL_ADDRESSES?.some(e =>
      placeholderEmails.some(p => e.includes(p))
    );
    if (hasPlaceholder || !config.EMAIL_ADDRESSES?.length) {
      warn('EMAIL_ADDRESSES still contains placeholder values', 'Edit config.js and set your real email addresses');
    } else {
      ok(`Email configured: ${config.EMAIL_ADDRESSES.join(', ')}`);
    }

    // Name
    if (!config.MY_NAME || config.MY_NAME === 'Your Name') {
      warn('MY_NAME is still the placeholder', 'Edit config.js and set your name');
    } else {
      ok(`Name configured: ${config.MY_NAME}`);
    }

    // Timezone
    if (config.TIMEZONE) {
      ok(`Timezone: ${config.TIMEZONE}`);
    } else {
      warn('TIMEZONE not set', 'Add TIMEZONE to config.js, e.g. "America/Chicago"');
    }
  }
}

// ─── Data & Scripts ───────────────────────────────────────────────────────────

section('Data');

const syncDir = path.join(__dirname, 'sync/conversations');
if (fs.existsSync(syncDir)) {
  const dateDirs = fs.readdirSync(syncDir).filter(f => {
    try { return fs.statSync(path.join(syncDir, f)).isDirectory(); } catch { return false; }
  });
  if (dateDirs.length > 0) {
    ok(`Sync folder has data (${dateDirs.length} days of conversations)`);
  } else {
    warn('Sync folder exists but is empty', 'Run: bee sync --output ./sync');
  }
} else {
  warn('Sync folder not found — no data yet', 'Run: bee sync --output ./sync');
}

const launchdLogsDir = path.join(process.env.HOME, 'Library/Logs/beesync');
if (fs.existsSync(launchdLogsDir)) {
  ok('launchd log folder exists (~/Library/Logs/beesync/)');
} else {
  warn('launchd log folder missing — needed if you use scheduled jobs', 'Run: mkdir -p ~/Library/Logs/beesync');
}

section('Scripts');

for (const script of ['bee-process.sh', 'bee-hot.sh']) {
  const scriptPath = path.join(__dirname, script);
  if (!fs.existsSync(scriptPath)) {
    warn(`${script} not found`);
    continue;
  }
  try {
    fs.accessSync(scriptPath, fs.constants.X_OK);
    ok(`${script} is executable`);
  } catch {
    fail(`${script} is not executable`, `Run: chmod +x ~/Projects/Bee/${script}`);
  }
}

// ─── launchd PATH ─────────────────────────────────────────────────────────────

section('Scheduled Jobs (launchd)');

if (nodePath) {
  const nodeBinDir = path.dirname(nodePath);
  console.log(`  ℹ️  If setting up launchd agents, use this PATH in your plist EnvironmentVariables:\n`);
  console.log(`     ${nodeBinDir}:/usr/bin:/bin:/usr/sbin:/sbin\n`);
  console.log(`  ℹ️  See SETUP.md for the full plist files and setup instructions.`);
  console.log(`     Logs go to: ~/Library/Logs/beesync/process.log`);
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(60)}`);

if (failed === 0 && warned === 0) {
  console.log(`\n✅ All checks passed — you're ready to run!\n`);
  console.log(`   Quick start:`);
  console.log(`     node process.js                        # Process today`);
  console.log(`     ./bee-process.sh --email --reminders   # Full end-of-day run\n`);
} else {
  if (failed > 0) {
    console.log(`\n❌ ${failed} issue${failed !== 1 ? 's' : ''} must be fixed before running.`);
  }
  if (warned > 0) {
    console.log(`⚠️  ${warned} warning${warned !== 1 ? 's' : ''} to review.`);
  }
  console.log(`\n   Fix the items above and run: node bee-pre-check.js\n`);
}
