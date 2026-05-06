import { supabase } from './supabase'

export type TownConfig = {
  slug: string
  name: string
  state: string
  county: string
  tagline: string
  headerColor: string
  accentColor: string
  coordinates: { lat: number; lng: number }
  radius: number
}

export const DEFAULT_TOWN = 'mill-valley'

function rowToConfig(row: any): TownConfig {
  return {
    slug: row.slug,
    name: row.name,
    state: row.state,
    county: row.county,
    tagline: row.tagline || '',
    headerColor: row.header_color,
    accentColor: row.accent_color,
    coordinates: { lat: Number(row.lat), lng: Number(row.lng) },
    radius: Number(row.radius),
  }
}

export async function getAllTowns(): Promise<TownConfig[]> {
  const { data, error } = await supabase
    .from('towns')
    .select('*')
    .eq('active', true)
    .order('name')
  if (error || !data) return []
  return data.map(rowToConfig)
}

export async function getTown(slug: string): Promise<TownConfig> {
  const { data, error } = await supabase
    .from('towns')
    .select('*')
    .eq('slug', slug)
    .single()
  if (error || !data) {
    // fallback to default
    const { data: fallback } = await supabase
      .from('towns')
      .select('*')
      .eq('slug', DEFAULT_TOWN)
      .single()
    return rowToConfig(fallback)
  }
  return rowToConfig(data)
}

export async function getTownsInCounty(county: string): Promise<TownConfig[]> {
  const { data, error } = await supabase
    .from('towns')
    .select('*')
    .eq('county', county)
    .eq('active', true)
    .order('name')
  if (error || !data) return []
  return data.map(rowToConfig)
}