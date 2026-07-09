// Auto-moderation: titles matching these patterns are rejected automatically
// Add new patterns here as needed — applies to both iCal and AI extract pipelines

const BLOCKED_TITLE_PATTERNS = [
  /\bboard meeting\b/i,
  /\bcommittee meeting\b/i,
  /\bbusiness meeting\b/i,
  /\bstaff meeting\b/i,
  /\badvisory meeting\b/i,
  /\bobserved\b/i,
  /\boffice closed\b/i,
  /\bholiday closure\b/i,
    /\bboard of directors\b/i,
  /\bboard of trustees\b/i,
  /\bcommission meeting\b/i,
  /\bmonthly meeting\b/i

]

export const AUTO_REJECT_NOTE = 'Auto-rejected: administrative event not suitable for public calendar.'

export function shouldAutoReject(title: string): boolean {
  if (!title) return false
  return BLOCKED_TITLE_PATTERNS.some(pattern => pattern.test(title))
}