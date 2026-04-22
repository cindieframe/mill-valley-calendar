import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async function sitemap() {
  const { data: events } = await supabase
    .from('events')
    .select('id, date')
    .eq('status', 'approved')

  const eventUrls = (events || []).map(ev => ({
    url: `https://www.townstir.com/event/${ev.id}`,
    lastModified: ev.date,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  return [
    {
      url: 'https://www.townstir.com',
      lastModified: new Date(),
      changeFrequency: 'hourly' as const,
      priority: 1.0,
    },
    ...eventUrls,
  ]
}