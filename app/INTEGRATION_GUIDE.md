# Townstir — Today's Changes Integration Guide
_April 20, 2026_

Three deliverables today:
1. `app/lib/tokens.ts` — design tokens (single source of truth)
2. `app/components/Header.tsx` — shared header component
3. Category/tag data fix — use the helpers in `tokens.ts`

---

## 1. Place the files

```
app/
  lib/
    tokens.ts          ← copy tokens.ts here
  components/
    Header.tsx         ← copy Header.tsx here
```

---

## 2. Update every page to use the shared Header

### Homepage (`app/page.tsx`)
Find your existing nav/header markup and replace it:

```tsx
// BEFORE: inline nav markup in page.tsx
// <nav style={{ background: '#1a3d2b', ... }}>
//   <span>town</span><span>stir</span>
//   ...
// </nav>

// AFTER:
import Header from '@/app/components/Header';

// Inside your JSX, at the top:
<Header
  rightSlot={
    <a href="/post-event" style={/* amber button from tokens */}>Post Event</a>
  }
/>
```

### Admin page (`app/admin/page.tsx`)
```tsx
import { AdminHeader } from '@/app/components/Header';

// Replace old admin header with:
<AdminHeader />
// or with a right slot:
<AdminHeader rightSlot={<button onClick={handleLogout}>Log out</button>} />
```

### Org Dashboard (`app/org/dashboard/page.tsx`)

This is the big one — the dashboard currently has the old "townSTIR" branding. 

```tsx
import { OrgHeader } from '@/app/components/Header';

// Replace old header block entirely with:
<OrgHeader
  rightSlot={
    <>
      <button onClick={() => setShowAddEvent(true)} style={primaryButtonStyle}>
        + Add Event
      </button>
      <button onClick={handleLogout} style={ghostButtonStyle}>
        Log out
      </button>
    </>
  }
/>

// Then immediately below the header, add the org hero section:
<div style={{
  backgroundColor: '#fff',
  borderBottom: '1px solid #e5e7eb',
  padding: '24px 32px 20px',
}}>
  <h1 style={{
    fontFamily: "'Helvetica Neue', Arial, sans-serif",
    fontSize: '22px',
    fontWeight: 600,
    color: '#1a1a1a',
    margin: 0,
  }}>
    {orgName}
  </h1>
  <p style={{
    fontFamily: "'Helvetica Neue', Arial, sans-serif",
    fontSize: '13px',
    color: '#767e8a',
    margin: '4px 0 0',
    fontWeight: 400,
  }}>
    Organization Dashboard
  </p>
</div>
```

This gives "Org Name" as the hero element with "Organization Dashboard" as the secondary label — exactly per spec.

### Org Login (`app/org/login/page.tsx`)
```tsx
import Header from '@/app/components/Header';
<Header />
```

### Org Signup (`app/org/signup/page.tsx`)
```tsx
import Header from '@/app/components/Header';
<Header />
```

### Post Event form (`app/post-event/page.tsx`)
```tsx
import Header from '@/app/components/Header';
<Header rightSlot={/* optional */} />
```

### Import page (`app/admin/import/page.tsx`)
```tsx
import { AdminHeader } from '@/app/components/Header';
<AdminHeader />
```

### Event detail page (`app/event/[id]/page.tsx`)
```tsx
import Header from '@/app/components/Header';
<Header />
```

---

## 3. Fix the category/tag column issue

This is the root cause of "classes" appearing in the wrong column: some events store data in `category` (string) and others in `cats` (array). The helpers in `tokens.ts` handle both.

### In your event card component (or wherever you render pills):

```tsx
import {
  resolveCategories,
  resolveTags,
  CATEGORIES,
  TAGS,
  isCategory,
  isTag,
} from '@/app/lib/tokens';

// Inside your event card render:
const categories = resolveCategories(event);  // handles both `cats` and `category`
const tags = resolveTags(event);              // handles both `tags` and `tag`

// Render category pills (rounded rect)
{categories.map((key) => {
  const cat = CATEGORIES[key];
  if (!cat) return null;
  return (
    <span key={key} style={{
      display: 'inline-block',
      borderRadius: '8px',
      backgroundColor: cat.color,
      fontSize: '11px',
      padding: '3px 8px',
      marginBottom: '3px',
      color: '#3a3a3a',
      fontFamily: "'Helvetica Neue', Arial, sans-serif",
    }}>
      {cat.label}
    </span>
  );
})}

// Render tag pills (full pill)
{tags.map((key) => {
  const tag = TAGS[key];
  if (!tag) return null;
  return (
    <span key={key} style={{
      display: 'inline-block',
      borderRadius: '999px',
      backgroundColor: '#f0f0f0',
      fontSize: '11px',
      padding: '3px 10px',
      marginBottom: '3px',
      color: '#767e8a',
      fontFamily: "'Helvetica Neue', Arial, sans-serif",
    }}>
      {tag.label}
    </span>
  );
})}
```

### Important: the `family` key ambiguity

`family` is both a legacy **category** key (maps to "Youth") AND a **tag** key (maps to "Family-friendly"). The `isCategory` / `isTag` helpers handle this:

```tsx
// If you ever need to disambiguate a single key:
import { isCategory, isTag } from '@/app/lib/tokens';

// Check which column it belongs to:
if (isCategory(key)) { /* render as category pill */ }
else if (isTag(key))  { /* render as tag pill */ }
```

The `CATEGORIES` object gives `family` priority as a category key → maps to "Youth". In practice this should be rare since events now use `youth` as the category key and `family` only appears as a tag.

### Supabase migration (optional but recommended)

Once the UI fix is confirmed working, standardize the database column:

```sql
-- Run in Supabase SQL editor
-- 1. Migrate single-value `category` string → `cats` array
UPDATE events
SET cats = ARRAY[category]
WHERE cats IS NULL AND category IS NOT NULL;

-- 2. Migrate `family` category key → `youth` in cats array
UPDATE events
SET cats = array_replace(cats, 'family', 'youth')
WHERE 'family' = ANY(cats);

-- 3. After verifying everything works, you can drop the old column:
-- ALTER TABLE events DROP COLUMN category;
```

---

## 4. Quick style reference from tokens.ts

Instead of hardcoding colors in components, import from tokens:

```tsx
import { colors, fonts, styles } from '@/app/lib/tokens';

// Use colors:
color: colors.orgGreen          // org name on cards
backgroundColor: colors.navBg  // #1a3d2b
color: colors.textSecondary     // #767e8a

// Use pre-built style objects:
style={styles.buttonPrimary}    // amber CTA button
style={styles.eventCard}        // white card with shadow
style={styles.categoryPill}     // rounded rect pill
style={styles.tagPill}          // full pill

// Merge with active state:
style={{
  ...styles.categoryPill,
  ...(isActive ? styles.pillActive : {}),
}}
```

---

## 5. Deploy

```bash
npx vercel --prod
```

That's it. After this session you'll have:
- ✅ One header, used everywhere — no more logo drift
- ✅ Design tokens as single source of truth
- ✅ Category/tag data handled correctly regardless of which DB column is populated
- ✅ Org dashboard with correct branding and spacing hierarchy