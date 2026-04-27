// app/lib/tokens.ts
// Townstir Design Tokens — Single source of truth for all colors, fonts, and styles.
// Import this file into any component or page to maintain consistency.

export const colors = {
  // Brand core
  navBg: '#1a3d2b',          // Forest green — nav/header background (admin-configurable per town, always dark)
  logoAccent: '#7EC8A4',     // Mint green — "stir" in logo
  primary: '#C9952A',        // Amber — primary buttons (Post Event, Post Opportunity, Search)
  orgGreen: '#3a7d44',       // Dark green — org name / venue on event cards
  activeFilter: '#1a3d2b',   // Matches navBg — active filter pill state

  // Page chrome
  pageBg: '#f2f3f5',         // Light grey — page background
  cardBg: '#ffffff',         // White — event cards and opportunity cards
  cardShadow: '0 1px 4px rgba(0,0,0,0.08)',

  // Text — all pass WCAG AA on white background
  textPrimary: '#1a1a1a',
  textSecondary: '#6b7280',  // Body / description text — passes WCAG AA (replaces #767e8a and #9ca3af throughout)
  textWhite: '#ffffff',

  // UI borders
  divider: '#e5e7eb',
  borderLight: '#e5e7eb',    // Unified — was split between #e0e0e0 and #e5e7eb, now one value

  // New badge
  newBadge: '#C9952A',       // Amber — same as primary

  // Community Board category colors
  // Each has bg (fill), text (foreground), border
  boardVolunteers: {
    bg: '#dbeafe', text: '#1e40af', border: '#bfdbfe',
  },
  boardDonations: {
    bg: '#fce7f3', text: '#9d174d', border: '#fbcfe8',
  },
  boardICanHelp: {
    bg: '#d1fae5', text: '#065f46', border: '#a7f3d0',
  },
  boardStudent: {
    bg: '#fef3c7', text: '#92400e', border: '#fde68a',
  },

  // Community Board icon backgrounds (circle behind SVG)
  boardVolunteersIconBg: '#dbeafe',
  boardDonationsIconBg: '#fce7f3',
  boardICanHelpIconBg: '#d1fae5',
} as const

export const fonts = {
  sans: "'Helvetica Neue', Arial, sans-serif",   // Body font
  serif: "Georgia, 'Times New Roman', serif",     // Logo accent, Mill Valley pill, event titles on detail page
} as const

export const radii = {
  card: '10px',
  categoryPill: '8px',    // Category filter: rounded rectangle
  tagPill: '999px',       // Tag filter: full pill
  button: '6px',
} as const

export const spacing = {
  navHeight: '56px',
  pageMaxWidth: '1100px',
  cardPadding: '16px 20px',
} as const

// CSS-in-JS style objects for common patterns
export const styles = {
  // The shared nav/header bar
  nav: {
    backgroundColor: colors.navBg,
    height: spacing.navHeight,
    display: 'flex',
    alignItems: 'center',
    padding: '0 24px',
    position: 'sticky' as const,
    top: 0,
    zIndex: 100,
    width: '100%',
  },

  // "town" part of logo
  logoTown: {
    fontFamily: fonts.sans,
    fontSize: '21px',
    fontWeight: 400,
    color: colors.textWhite,
    letterSpacing: '-0.01em',
  },

  // "stir" part of logo
  logoStir: {
    fontFamily: fonts.serif,
    fontSize: '21px',
    fontWeight: 400,
    fontStyle: 'italic',
    color: colors.logoAccent,
  },

  // Primary CTA button (amber) — Post Event, Post Opportunity, Search
  buttonPrimary: {
    backgroundColor: colors.primary,
    color: colors.textWhite,
    fontFamily: fonts.sans,
    fontSize: '13px',
    fontWeight: 500,
    borderRadius: radii.button,
    border: 'none',
    cursor: 'pointer',
    padding: '7px 14px',
    textDecoration: 'none',
    display: 'inline-block',
    whiteSpace: 'nowrap' as const,
  },

  // Ghost button — Back, Org Login, nav secondary actions
  buttonGhost: {
    backgroundColor: 'transparent',
    color: 'rgba(255,255,255,0.7)',
    fontFamily: fonts.sans,
    fontSize: '12px',
    fontWeight: 400,
    borderRadius: radii.tagPill,
    border: '1px solid rgba(255,255,255,0.3)',
    cursor: 'pointer',
    padding: '6px 14px',
  },

  // Category filter pill (rounded rect)
  categoryPill: {
    borderRadius: radii.categoryPill,
    backgroundColor: colors.cardBg,
    border: `1px solid ${colors.borderLight}`,
    fontSize: '13px',
    padding: '6px 14px',
    cursor: 'pointer',
    fontFamily: fonts.sans,
    color: colors.textPrimary,
    whiteSpace: 'nowrap' as const,
  },

  // Tag filter pill (full pill)
  tagPill: {
    borderRadius: radii.tagPill,
    backgroundColor: colors.cardBg,
    border: `1px solid ${colors.borderLight}`,
    fontSize: '12px',
    padding: '5px 13px',
    cursor: 'pointer',
    fontFamily: fonts.sans,
    color: colors.textSecondary,
    whiteSpace: 'nowrap' as const,
  },

  // Active state for both pill types
  pillActive: {
    backgroundColor: colors.activeFilter,
    color: colors.textWhite,
    borderColor: colors.activeFilter,
  },

  // Event card / opportunity card
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.card,
    border: `0.5px solid ${colors.borderLight}`,
    padding: spacing.cardPadding,
    marginBottom: '10px',
  },

  // New badge (amber pill)
  newBadge: {
    background: colors.primary,
    color: colors.textWhite,
    fontSize: '10px',
    padding: '2px 7px',
    borderRadius: radii.tagPill,
    marginLeft: '8px',
    verticalAlign: 'middle' as const,
    fontWeight: 400,
  },

  // Section count label above card list
  sectionLabel: {
    fontSize: '11px',
    color: colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    marginBottom: '8px',
  },

  // Page background wrapper
  page: {
    minHeight: '100vh',
    background: colors.pageBg,
    fontFamily: fonts.sans,
  },

  // Centered content container
  container: {
    maxWidth: '960px',
    margin: '0 auto',
    padding: '28px 24px 60px',
  },
} as const

// Community Board category config — maps db value to display label + colors
export const BOARD_CATEGORIES: Record<string, { label: string; bg: string; text: string; border: string; iconBg: string; iconColor: string }> = {
  volunteers: {
    label: 'Volunteers Needed',
    bg: colors.boardVolunteers.bg,
    text: colors.boardVolunteers.text,
    border: colors.boardVolunteers.border,
    iconBg: colors.boardVolunteersIconBg,
    iconColor: colors.boardVolunteers.text,
  },
  donations: {
    label: 'Donations Needed',
    bg: colors.boardDonations.bg,
    text: colors.boardDonations.text,
    border: colors.boardDonations.border,
    iconBg: colors.boardDonationsIconBg,
    iconColor: colors.boardDonations.text,
  },
  icanhelp: {
    label: 'I Can Help',
    bg: colors.boardICanHelp.bg,
    text: colors.boardICanHelp.text,
    border: colors.boardICanHelp.border,
    iconBg: colors.boardICanHelpIconBg,
    iconColor: colors.boardICanHelp.text,
  },
}

// Student tag colors
export const STUDENT_TAG = {
  bg: colors.boardStudent.bg,
  text: colors.boardStudent.text,
  border: colors.boardStudent.border,
}

// Calendar category display config
export const CATEGORIES: Record<string, { label: string; color: string }> = {
  outdoors:  { label: 'Outdoors, Sports & Movement', color: '#e6f4ec' },
  arts:      { label: 'Arts & Performances',          color: '#f0eaf8' },
  food:      { label: 'Food, Drink & Social',         color: '#fef3e2' },
  community: { label: 'Volunteer & Community',        color: '#e2f0fe' },
  youth:     { label: 'Youth',                        color: '#fde8f0' },
  family:    { label: 'Youth',                        color: '#fde8f0' },
  classes:   { label: 'Classes & Lectures',           color: '#e8f4fd' },
  gov:       { label: "Local Gov't",                  color: '#f5f5f5' },
}

// Tag display config
export const TAGS: Record<string, { label: string }> = {
  free:     { label: 'Free' },
  family:   { label: 'Family-friendly' },
  wellness: { label: 'Wellness' },
  reg:      { label: 'Reg. Required' },
  music:    { label: 'Live Music' },
}

// Helper: resolve categories from an event object
export function resolveCategories(event: {
  category?: string | null
  cats?: string[] | null
}): string[] {
  if (event.cats && Array.isArray(event.cats) && event.cats.length > 0) return event.cats
  if (event.category && typeof event.category === 'string') {
    return event.category.split(',').map(c => c.trim()).filter(Boolean)
  }
  return []
}

// Helper: resolve tags from an event object
export function resolveTags(event: {
  tag?: string | null
  tags?: string[] | null
}): string[] {
  if (event.tags && Array.isArray(event.tags) && event.tags.length > 0) return event.tags
  if (event.tag && typeof event.tag === 'string') {
    return event.tag.split(',').map(t => t.trim()).filter(Boolean)
  }
  return []
}

export function isCategory(key: string): boolean { return key in CATEGORIES }
export function isTag(key: string): boolean { return key in TAGS && !isCategory(key) }