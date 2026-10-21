// For .ilike(column, value) used as a case-insensitive *exact* match:
// escapes % and _ so "St. Mary_s" can't match other names.
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&')
}
