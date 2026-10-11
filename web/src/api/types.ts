// Types mirroring SPEC.md API contract.

export type Slot = 'morning' | 'afternoon' | 'evening'
export type FriendStatus = 'none' | 'pending_out' | 'pending_in' | 'friends' | 'self'
export type ParticipationStatus = 'host' | 'going' | 'requested' | 'waitlist' | 'declined'
export type Level = 'any' | 'beginner' | 'intermediate' | 'advanced'
export type Tier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Legendary'

export interface Hobby {
  id: string
  name: string
  emoji: string
  category: string
}

export interface Neighborhood {
  name: string
  lat: number
  lng: number
}

export interface UserHobby {
  hobby_id: string
  level: number
  years?: number | null
  open_to_plans?: boolean
}

export interface AvailabilitySlot {
  weekday: number
  slot: Slot
}

export interface Badge {
  hobby_id: string
  tier: Tier | string
  count: number
  next_tier?: string | null
  next_at?: number | null
}

export interface Me {
  id: number
  email: string
  first_name: string
  last_name: string
  birth_year?: number | null
  neighborhood?: string | null
  lat?: number | null
  lng?: number | null
  bio?: string | null
  languages?: string[]
  instagram?: string | null
  avatar?: string | null
  friend_code: string
  open_to_plans: boolean
  vibe?: Record<string, number> | null
  is_business?: boolean
  business_name?: string | null
  hobbies?: UserHobby[]
  availability?: AvailabilitySlot[]
  badges?: Badge[]
  stats?: Record<string, number>
  display_name?: string
  age?: number | null
  vibe_summary?: string[]
  onboarded?: boolean
}

export interface MiniUser {
  id: number
  display_name: string
  avatar?: string | null
  is_business?: boolean
}

export interface UserCard extends MiniUser {
  age?: number | null
  neighborhood?: string | null
  bio?: string | null
  hobbies: UserHobby[]
  score: number
  top_reason?: string | null
  friend_status: FriendStatus
}

export interface BreakdownItem {
  key: string
  label: string
  points: number
  max: number
  detail?: string
}

export interface SharedHobby {
  hobby_id: string
  my_level?: number
  their_level?: number
  rarity?: number
  [k: string]: unknown
}

export interface ActivityCard {
  id: number
  title: string
  hobby_id: string
  host: MiniUser
  starts_at: string
  ends_at: string
  venue_name?: string | null
  neighborhood?: string | null
  lat: number
  lng: number
  cost_cents: number
  level: Level | string
  capacity?: number | null
  going_count: number
  my_status?: ParticipationStatus | null
  friends_going: MiniUser[]
  recurring_weekly?: boolean
  cancelled?: boolean
}

export interface PersonDetail extends UserCard {
  vibe?: Record<string, number> | null
  languages?: string[]
  instagram?: string | null
  badges?: Badge[]
  breakdown: BreakdownItem[]
  shared_hobbies: (SharedHobby | string)[]
  upcoming_activities: ActivityCard[]
}

export interface ActivityDetail extends ActivityCard {
  description?: string | null
  location_privacy: 'exact' | 'area'
  requires_approval: boolean
  attendees: (MiniUser & Partial<UserCard> & { is_host?: boolean; checked_in?: boolean })[]
  requests?: (MiniUser & Partial<UserCard> & { note?: string | null })[]
  chat_id?: number | null
  cancelled: boolean
  is_past: boolean
  can_check_in?: boolean
  checked_in?: boolean
  my_rating?: number | null
  avg_rating?: number | null
  rating_count?: number
  waitlist_count?: number
}

export interface GroupSuggestion {
  hobby_id: string
  weekday: number
  weekday_name?: string
  member_ids?: number[]
  next_date?: string
  slot: Slot
  members: UserCard[]
  score: number
  reason?: string
}

export interface ChatSummary {
  id: number
  kind: 'activity' | 'group' | 'dm'
  name?: string | null
  activity_id?: number | null
  avatar_hobby_id?: string | null
  last_message?: Message | null
  unread: number
  members: MiniUser[]
  activity_starts_at?: string | null
  activity_cancelled?: boolean
}

export interface Message {
  id: number
  chat_id: number
  user: MiniUser
  body: string
  created_at: string
}

export interface VibeQuestion {
  id: string
  hobby_id?: string | null
  prompt: string
  options: { id: string; text: string }[]
}

export interface FriendsResponse {
  friends: UserCard[]
  incoming: UserCard[]
  outgoing: UserCard[]
}

export interface NewActivity {
  hobby_id: string
  title: string
  description: string
  starts_at: string
  ends_at: string
  venue_name: string
  neighborhood: string
  lat: number
  lng: number
  location_privacy: 'exact' | 'area'
  capacity?: number | null
  cost_cents: number
  level: Level
  requires_approval: boolean
  recurring_weekly: boolean
}
