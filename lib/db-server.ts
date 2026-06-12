import { supabaseAdmin } from './supabaseAdmin'
import type { SiteContent } from './db'

export async function getSiteContentServer(): Promise<SiteContent | null> {
  const { data, error } = await supabaseAdmin
    .from('site_content')
    .select('*')
    .limit(1)
    .single()
  
  if (error) {
    console.error('Error fetching site content (server):', error)
    return null
  }
  return data as SiteContent
}
