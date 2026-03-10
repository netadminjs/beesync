/**
 * Bee Processor — User Configuration
 *
 * Copy this file to config.js and fill in your values.
 * config.js is gitignored and will never be committed.
 */

module.exports = {

  // Your Obsidian vault name — the folder inside iCloud~/md~obsidian/Documents/
  OBSIDIAN_VAULT_NAME: 'YourVaultName',

  // Email addresses to receive the daily digest
  EMAIL_ADDRESSES: [
    'you@work.com',
    'you@personal.com',
  ],

  // Your own email addresses — used to exclude you from follow-up draft recipients.
  // Include partial matches (e.g. your first name) to catch display-name-only entries.
  MY_EMAILS: [
    'you@work.com',
    'you@personal.com',
    'yourfirstname',
  ],

  // Your name — used in follow-up draft sign-offs
  MY_NAME: 'Your Name',

  // Timezone for timestamps in digests and emails
  // Full list: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
  TIMEZONE: 'America/New_York',

  // Apple Reminders list name to add action items to
  REMINDERS_LIST: 'Bee',

  // ── Personal Keyword Tuning ───────────────────────────────────────────────
  // These extend the generic defaults in process.js without overwriting them.
  // Add terms that are consistently high-signal for YOUR conversations.
  // Examples: industry terms, role-specific words, recurring project names.
  MY_HIGH_KEYWORDS: [
    // 'budget', 'vendor', 'compliance',   // finance/legal context
    // 'patient', 'clinic', 'referral',    // healthcare context
    // 'school', 'district', 'curriculum', // education context
  ],

  // Add terms that are low-signal noise in YOUR recordings.
  // Examples: commute triggers, recurring errands, hold music services.
  MY_LOW_KEYWORDS: [
    // 'e-zpass', 'ezpass',    // toll road commute noise
    // 'alexa', 'hey siri',    // accidental assistant triggers
  ],

};
