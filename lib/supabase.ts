import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types for database tables
export type Role = 'Top' | 'Jungle' | 'Mid' | 'ADC' | 'Support';
export type Tier = 'Iron' | 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Emerald' | 'Diamond' | 'Master' | 'Grandmaster' | 'Challenger' | 'Unranked';
export type Region = 'NA' | 'EUW' | 'EUNE' | 'KR' | 'BR' | 'LAN' | 'LAS' | 'OCE' | 'RU' | 'TR' | 'JP';
export type RecruitingStatus = 'Open' | 'Closed' | 'Full';
export type RegistrationStatus = 'pending' | 'approved' | 'rejected';

export interface Player {
  id: string;
  summoner_name: string;
  discord: string;
  main_role: Role;
  secondary_role?: Role;
  opgg_url?: string;
  tier: Tier;
  looking_for_team: boolean;
  team_id?: string;
  puuid?: string;
  summoner_level?: number;
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  captain_id: string;
  open_positions: Role[];
  tier: Tier;
  region: Region;
  recruiting_status: RecruitingStatus;
  team_avatar?: string | number;
  created_at: string;
  updated_at: string;
}

export interface Tournament {
  id: string;
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  prize_pool?: string;
  max_teams: number;
  rules?: string;
  created_at: string;
  updated_at: string;
}

export interface TournamentRegistration {
  id: string;
  tournament_id: string;
  team_id: string;
  status: RegistrationStatus;
  registered_at: string;
  updated_at: string;
}
