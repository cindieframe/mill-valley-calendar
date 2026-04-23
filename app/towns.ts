export type TownConfig = {
  slug: string
  name: string
  state: string
  tagline: string
  headerColor: string
  accentColor: string
  coordinates: { lat: number; lng: number }
  radius: number
}

export const TOWNS: Record<string, TownConfig> = {
  'mill-valley': {
    slug: 'mill-valley',
    name: 'Mill Valley',
    state: 'CA',
    tagline: 'Events and happenings in Mill Valley, CA',
    headerColor: '#1a3d2b',
    accentColor: '#C9952A',
    coordinates: { lat: 37.9060, lng: -122.5450 },
    radius: 5,
  },
}

export const DEFAULT_TOWN = 'mill-valley'

export function getTown(slug: string): TownConfig {
  return TOWNS[slug] || TOWNS[DEFAULT_TOWN]
}