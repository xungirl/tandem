export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export const WEEKDAYS_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
export const SLOTS = ['morning', 'afternoon', 'evening'] as const
export const SLOT_LABEL: Record<string, string> = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' }
export const LEVELS = ['', 'Beginner', 'Getting there', 'Solid', 'Expert']

/** Category → accent colour, so every hobby gets a consistent tint. */
const CATEGORY_COLORS: Record<string, string> = {
  Games: '#B9A6FF',
  Sports: '#FF6B4A',
  Outdoors: '#1FA59A',
  'Arts & Crafts': '#FFC94A',
  Music: '#FF9CC2',
  'Food & Drink': '#FFB067',
  Learning: '#8EC5FF',
  Wellness: '#9BE3B4',
  Tech: '#A0E7E5',
  Custom: '#E8DCCB',
}
export function categoryColor(category?: string) {
  return CATEGORY_COLORS[category ?? ''] ?? '#E8DCCB'
}

export function parseDate(iso: string) {
  // Backend sends UTC; tolerate missing "Z".
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : iso + 'Z')
}

export function timeLabel(iso: string) {
  return parseDate(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export function dayLabel(iso: string) {
  const d = parseDate(iso)
  const today = new Date()
  const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export function dateParts(iso: string) {
  const d = parseDate(iso)
  return {
    dow: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
    day: d.getDate(),
    month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
  }
}

export function relTime(iso: string) {
  const diff = (Date.now() - parseDate(iso).getTime()) / 1000
  if (diff < 60) return 'now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d`
  return parseDate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function costLabel(cents: number) {
  if (!cents) return 'Free'
  return `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`
}

export function levelLabel(level: string) {
  return level === 'any' ? 'All levels' : level.charAt(0).toUpperCase() + level.slice(1)
}

export function scoreColor(score: number) {
  if (score >= 75) return '#FF6B4A'
  if (score >= 55) return '#FFC94A'
  if (score >= 35) return '#1FA59A'
  return '#B9A6FF'
}

export const TIER_STYLE: Record<string, { bg: string; ring: string; label: string }> = {
  Bronze: { bg: '#F4C9A1', ring: '#B8733A', label: 'Bronze' },
  Silver: { bg: '#E6E8EC', ring: '#8C93A0', label: 'Silver' },
  Gold: { bg: '#FFE08A', ring: '#D19A00', label: 'Gold' },
  Platinum: { bg: '#D9F3F0', ring: '#3BAFA5', label: 'Platinum' },
  Legendary: { bg: '#E3D8FF', ring: '#7B5CFF', label: 'Legendary' },
}

export function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
