// app/lib/tokens.ts
// Townstir Design Tokens — Single source of truth for all colors, fonts, and styles.
// Import this file into any component or page to maintain consistency.

export const colors = {
  // Brand core
  navBg: '#1a3d2b',          // Forest green — nav/header background (admin-configurable per town)
  logoAccent: '#7EC8A4',     // Mint green — "stir" in logo
  primary: '#C9952A',        // Amber — Post Event, Search buttons
  orgGreen: '#3a7d44',       // Dark green — org name / venue on event cards
  activeFilter: '#1a3d2b',   // Matches navBg — active filter pill state

  // Page chrome
  pageBg: '#f2f3f5',         // Light grey — page background
  cardBg: '#ffffff',         // White — event cards
  cardShadow: '0 1px 4px rgba(0,0,0,0.08)',

  // Text
  textPrimary: '#1a1a1a',
  textSecondary: '#767e8a',  // Description text — WCAG AA compliant
  textMuted: '#888888',      // APR label
  textWhite: '#ffffff',

  // UI
  divider: '#e5e7eb',
  borderLight: '#e0e0e0',
} as const;

export const fonts = {
  sans: "'Helvetica Neue', Arial, sans-serif",   // Body font
  serif: "Georgia, 'Times New Roman', serif",     // Logo accent, Mill Valley pill, event titles on detail page
} as const;

export const radii = {
  card: '10px',
  categoryPill: '8px',    // Category filter: rounded rectangle
  tagPill: '999px',       // Tag filter: full pill
  button: '8px',
} as const;

export const spacing = {
  navHeight: '56px',
  pageMaxWidth: '1100px',
  cardPadding: '16px 20px',
} as const;

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

  // Primary CTA button (amber)
  buttonPrimary: {
    backgroundColor: colors.primary,
    color: colors.textWhite,
    fontFamily: fonts.sans,
    fontSize: '14px',
    fontWeight: 600,
    borderRadius: radii.button,
    border: 'none',
    cursor: 'pointer',
    padding: '9px 18px',
    textDecoration: 'none',
    display: 'inline-block',
    whiteSpace: 'nowrap' as const,
  },

  // Category filter pill (rounded rect)
  categoryPill: {
    borderRadius: radii.categoryPill,
    backgroundColor: colors.cardBg,
    border: `1px solid ${colors.borderLight}`,
    fontSize: '13px',
    padding: '5px 12px',
    cursor: 'pointer',
    fontFamily: fonts.sans,
    color: colors.textPrimary,
  },

  // Tag filter pill (full pill)
  tagPill: {
    borderRadius: radii.tagPill,
    backgroundColor: colors.cardBg,
    border: `1px solid ${colors.borderLight}`,
    fontSize: '13px',
    padding: '5px 14px',
    cursor: 'pointer',
    fontFamily: fonts.sans,
    color: colors.textSecondary,
  },

  // Active state for both pill types
  pillActive: {
    backgroundColor: colors.activeFilter,
    color: colors.textWhite,
    borderColor: colors.activeFilter,
  },

  // Event card
  eventCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.card,
    boxShadow: colors.cardShadow,
    padding: spacing.cardPadding,
  },
} as const;

// Category display config
// Key = database key, label = display label, color = tint for pill
export const CATEGORIES: Record<string, { label: string; color: string }> = {
  outdoors:  { label: 'Outdoors, Sports & Movement', color: '#e6f4ec' },
  arts:      { label: 'Arts & Performances',          color: '#f0eaf8' },
  food:      { label: 'Food, Drink & Social',         color: '#fef3e2' },
  community: { label: 'Volunteer & Community',        color: '#e2f0fe' },
  youth:     { label: 'Youth',                        color: '#fde8f0' },
  family:    { label: 'Youth',                        color: '#fde8f0' }, // legacy key → same label
  classes:   { label: 'Classes & Lectures',           color: '#e8f4fd' },
  gov:       { label: "Local Gov't",                  color: '#f5f5f5' },
};

// Tag display config
export const TAGS: Record<string, { label: string }> = {
  free:    { label: 'Free' },
  family:  { label: 'Family-friendly' },
  wellness:{ label: 'Health & Wellness' },
  reg:     { label: 'Reg. Required' },
};

// Helper: resolve categories from an event object
// Handles both `category` (string) and `cats` (array) column naming
export function resolveCategories(event: {
  category?: string | null;
  cats?: string[] | null;
}): string[] {
  if (event.cats && Array.isArray(event.cats) && event.cats.length > 0) {
    return event.cats;
  }
  if (event.category && typeof event.category === 'string') {
    // Could be comma-separated or a single value
    return event.category.split(',').map((c) => c.trim()).filter(Boolean);
  }
  return [];
}

// Helper: resolve tags from an event object
// Handles both `tag` (string) and `tags` (array) column naming
export function resolveTags(event: {
  tag?: string | null;
  tags?: string[] | null;
}): string[] {
  if (event.tags && Array.isArray(event.tags) && event.tags.length > 0) {
    return event.tags;
  }
  if (event.tag && typeof event.tag === 'string') {
    return event.tag.split(',').map((t) => t.trim()).filter(Boolean);
  }
  return [];
}

// Helper: is a key a category or a tag?
export function isCategory(key: string): boolean {
  return key in CATEGORIES;
}

export function isTag(key: string): boolean {
  return key in TAGS && !isCategory(key);
}