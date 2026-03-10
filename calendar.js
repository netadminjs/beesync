#!/usr/bin/env node

/**
 * Bee Calendar Matcher
 * Matches Bee conversation timestamps against Outlook/Apple Calendar events.
 * Extracts attendees to label meetings and drive follow-up drafts.
 *
 * Called by process.js — not run directly.
 */

const { execSync } = require('child_process');

// How many minutes of overlap needed to consider a Bee recording part of a calendar event
const OVERLAP_THRESHOLD_MINUTES = 5;

/**
 * Query calendar events for a given date range via AppleScript.
 * Tries Outlook first (work calendar), falls back to Apple Calendar.
 */
function getCalendarEvents(date) {
  const dateStr = date; // YYYY-MM-DD

  // Try Outlook first
  const outlookScript = `
    tell application "Microsoft Outlook"
      set targetDate to (current date)
      set year of targetDate to ${dateStr.slice(0,4)}
      set month of targetDate to ${parseInt(dateStr.slice(5,7))}
      set day of targetDate to ${parseInt(dateStr.slice(8,10))}
      set hours of targetDate to 0
      set minutes of targetDate to 0
      set seconds of targetDate to 0
      set dayEnd to targetDate + (24 * 60 * 60)

      set output to {}
      set dayEvents to every calendar event whose start time >= targetDate and start time < dayEnd
      repeat with e in dayEvents
        set attList to every attendee of e
        set attData to {}
        repeat with a in attList
          set attEmail to ""
          try
            set attEmail to email address of a
          end try
          set end of attData to (name of a as string) & "|" & attEmail
        end repeat
        set AppleScript's text item delimiters to "^^"
        set attStr to attData as string
        set AppleScript's text item delimiters to ""
        set end of output to (subject of e) & "||" & (start time of e as string) & "||" & (end time of e as string) & "||" & attStr
      end repeat
      return output
    end tell
  `;

  // Apple Calendar fallback
  const appleCalScript = `
    tell application "Calendar"
      set targetDate to (current date)
      set year of targetDate to ${dateStr.slice(0,4)}
      set month of targetDate to ${parseInt(dateStr.slice(5,7))}
      set day of targetDate to ${parseInt(dateStr.slice(8,10))}
      set hours of targetDate to 0
      set minutes of targetDate to 0
      set seconds of targetDate to 0
      set dayEnd to targetDate + (24 * 60 * 60)

      set output to {}
      set workCals to {"Work", "Calendar"}
      repeat with calName in workCals
        try
          set cal to calendar calName
          set dayEvents to (every event of cal whose start date >= targetDate and start date < dayEnd)
          repeat with e in dayEvents
            set attList to attendees of e
            set attData to {}
            repeat with a in attList
              set attEmail to ""
              try
                set attEmail to email of a
              end try
              set end of attData to (display name of a as string) & "|" & attEmail
            end repeat
            set AppleScript's text item delimiters to "^^"
            set attStr to attData as string
            set AppleScript's text item delimiters to ""
            set end of output to (summary of e) & "||" & (start date of e as string) & "||" & (end date of e as string) & "||" & attStr
          end repeat
        end try
      end repeat
      return output
    end tell
  `;

  let raw = '';

  // Try Outlook
  try {
    raw = execSync(`osascript -e '${outlookScript.replace(/'/g, "'\"'\"'")}'`, {
      encoding: 'utf8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
  } catch (e) {}

  // Fall back to Apple Calendar if Outlook returned nothing
  if (!raw || raw === '') {
    try {
      raw = execSync(`osascript -e '${appleCalScript.replace(/'/g, "'\"'\"'")}'`, {
        encoding: 'utf8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe']
      }).trim();
    } catch (e) {}
  }

  if (!raw || raw === '') return [];

  return raw.split(', ').map(entry => {
    const [title, startStr, endStr, attendeesStr] = entry.split('||');
    const attendees = (attendeesStr || '').split('^^')
      .filter(Boolean)
      .map(a => {
        const [name, email] = a.split('|');
        return { name: name?.trim(), email: email?.trim() };
      })
      .filter(a => a.name && a.name !== 'missing value');

    return {
      title: title?.trim(),
      start: new Date(startStr?.trim()),
      end: new Date(endStr?.trim()),
      attendees
    };
  }).filter(e => e.title && !isNaN(e.start));
}

/**
 * Find the best matching calendar event for a Bee conversation.
 * Matches by time overlap — at least OVERLAP_THRESHOLD_MINUTES of shared time.
 */
function matchConversationToEvent(conversation, calendarEvents) {
  const convStart = conversation.startTime;
  const convEnd = conversation.endTime;
  if (!convStart || !convEnd) return null;

  let bestMatch = null;
  let bestOverlap = 0;

  for (const event of calendarEvents) {
    if (!event.start || !event.end) continue;

    // Calculate overlap in minutes
    const overlapStart = Math.max(convStart.getTime(), event.start.getTime());
    const overlapEnd = Math.min(convEnd.getTime(), event.end.getTime());
    const overlapMinutes = (overlapEnd - overlapStart) / 60000;

    if (overlapMinutes >= OVERLAP_THRESHOLD_MINUTES && overlapMinutes > bestOverlap) {
      bestOverlap = overlapMinutes;
      bestMatch = event;
    }
  }

  return bestMatch;
}

module.exports = { getCalendarEvents, matchConversationToEvent };
