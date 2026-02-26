-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.api_metrics_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  endpoint character varying NOT NULL,
  method character varying NOT NULL,
  status_code integer NOT NULL,
  response_time_ms integer,
  user_id uuid,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT api_metrics_logs_pkey PRIMARY KEY (id),
  CONSTRAINT api_metrics_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.broadcast_assignments (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  match_id uuid NOT NULL UNIQUE,
  caster_name text,
  observer_name text,
  stream_platform text DEFAULT 'Twitch'::text,
  stream_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT broadcast_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT broadcast_assignments_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.tournament_matches(id)
);
CREATE TABLE public.chat_messages (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  room_name text NOT NULL,
  content text NOT NULL,
  user_name text NOT NULL,
  user_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT chat_messages_pkey PRIMARY KEY (id),
  CONSTRAINT chat_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.feature_attachments (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  feature_request_id uuid NOT NULL,
  user_id uuid NOT NULL,
  file_name character varying NOT NULL,
  file_path character varying NOT NULL,
  file_size integer NOT NULL,
  file_type character varying NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT feature_attachments_pkey PRIMARY KEY (id),
  CONSTRAINT feature_attachments_feature_request_id_fkey FOREIGN KEY (feature_request_id) REFERENCES public.feature_requests(id),
  CONSTRAINT feature_attachments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.players(id)
);
CREATE TABLE public.feature_categories (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name character varying NOT NULL UNIQUE,
  description text,
  color character varying DEFAULT '#6366f1'::character varying,
  icon character varying DEFAULT 'star'::character varying,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT feature_categories_pkey PRIMARY KEY (id)
);
CREATE TABLE public.feature_comments (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  feature_request_id uuid NOT NULL,
  user_id uuid NOT NULL,
  comment text NOT NULL,
  is_admin_response boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT feature_comments_pkey PRIMARY KEY (id),
  CONSTRAINT feature_comments_feature_request_id_fkey FOREIGN KEY (feature_request_id) REFERENCES public.feature_requests(id),
  CONSTRAINT feature_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.players(id)
);
CREATE TABLE public.feature_requests (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  title character varying NOT NULL,
  description text NOT NULL,
  category_id uuid REFERENCES public.feature_categories(id),
  priority character varying NOT NULL DEFAULT 'Medium'::character varying CHECK (priority::text = ANY (ARRAY['Low'::character varying::text, 'Medium'::character varying::text, 'High'::character varying::text])),
  status character varying NOT NULL DEFAULT 'Submitted'::character varying CHECK (status::text = ANY (ARRAY['Submitted'::character varying::text, 'Under Review'::character varying::text, 'Planned'::character varying::text, 'In Progress'::character varying::text, 'Completed'::character varying::text, 'Rejected'::character varying::text])),
  use_case text,
  image_url character varying,
  admin_response text,
  admin_id uuid,
  vote_count integer DEFAULT 0,
  comment_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT feature_requests_pkey PRIMARY KEY (id),
  CONSTRAINT feature_requests_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.players(id),
  CONSTRAINT feature_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.players(id)
);
CREATE TABLE public.feature_votes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  feature_request_id uuid NOT NULL,
  user_id uuid NOT NULL,
  vote_type character varying NOT NULL DEFAULT 'upvote'::character varying CHECK (vote_type::text = ANY (ARRAY['upvote'::character varying::text, 'downvote'::character varying::text])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT feature_votes_pkey PRIMARY KEY (id),
  CONSTRAINT feature_votes_feature_request_id_fkey FOREIGN KEY (feature_request_id) REFERENCES public.feature_requests(id),
  CONSTRAINT feature_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.players(id)
);
CREATE TABLE public.match_disputes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  match_id uuid NOT NULL,
  raised_by uuid NOT NULL,
  reason text NOT NULL,
  evidence_url text,
  status USER-DEFINED DEFAULT 'open'::dispute_status_type,
  resolved_by uuid,
  resolution_notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT match_disputes_pkey PRIMARY KEY (id),
  CONSTRAINT match_disputes_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.tournament_matches(id),
  CONSTRAINT match_disputes_raised_by_fkey FOREIGN KEY (raised_by) REFERENCES public.players(id),
  CONSTRAINT match_disputes_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.players(id)
);
CREATE TABLE public.match_result_audit (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  match_id uuid NOT NULL,
  changed_by uuid,
  previous_team1_score integer,
  new_team1_score integer,
  previous_team2_score integer,
  new_team2_score integer,
  previous_winner_id uuid,
  new_winner_id uuid,
  previous_status USER-DEFINED,
  new_status USER-DEFINED,
  change_reason text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT match_result_audit_pkey PRIMARY KEY (id),
  CONSTRAINT match_result_audit_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.tournament_matches(id),
  CONSTRAINT match_result_audit_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users(id)
);
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  type USER-DEFINED NOT NULL,
  title character varying NOT NULL,
  message text NOT NULL,
  data jsonb,
  read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.player_tournament_histories (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  player_id uuid NOT NULL,
  tournament_id uuid NOT NULL,
  team_id uuid NOT NULL,
  role_in_team character varying,
  performance_data jsonb,
  achievements jsonb,
  career_impact jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT player_tournament_histories_pkey PRIMARY KEY (id),
  CONSTRAINT player_tournament_histories_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id),
  CONSTRAINT player_tournament_histories_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id),
  CONSTRAINT player_tournament_histories_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id)
);
CREATE TABLE public.players (
  id uuid NOT NULL UNIQUE,
  summoner_name character varying NOT NULL,
  discord character varying,
  main_role USER-DEFINED NOT NULL,
  secondary_role USER-DEFINED,
  opgg_link character varying,
  tier USER-DEFINED NOT NULL,
  looking_for_team boolean DEFAULT false,
  team_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  opgg_url text,
  is_substitute boolean DEFAULT false,
  puuid text,
  summoner_level integer,
  profile_icon_id integer,
  rank character varying,
  league_points integer DEFAULT 0,
  wins integer DEFAULT 0,
  losses integer DEFAULT 0,
  is_bot boolean DEFAULT false,
  CONSTRAINT players_pkey PRIMARY KEY (id),
  CONSTRAINT fk_players_team_id FOREIGN KEY (team_id) REFERENCES public.teams(id)
);
CREATE TABLE public.riot_request_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  endpoint character varying NOT NULL,
  method character varying NOT NULL DEFAULT 'GET'::character varying,
  status_code integer NOT NULL,
  response_time_ms integer,
  riot_api_endpoint character varying NOT NULL,
  summoner_name character varying,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT riot_request_logs_pkey PRIMARY KEY (id),
  CONSTRAINT riot_request_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.swiss_match_history (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tournament_id uuid NOT NULL,
  round_number integer NOT NULL,
  team1_id uuid NOT NULL,
  team2_id uuid NOT NULL,
  match_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT swiss_match_history_pkey PRIMARY KEY (id),
  CONSTRAINT swiss_match_history_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id),
  CONSTRAINT swiss_match_history_team1_id_fkey FOREIGN KEY (team1_id) REFERENCES public.teams(id),
  CONSTRAINT swiss_match_history_team2_id_fkey FOREIGN KEY (team2_id) REFERENCES public.teams(id),
  CONSTRAINT swiss_match_history_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.tournament_matches(id),
  CONSTRAINT swiss_match_history_different_teams CHECK (team1_id != team2_id)
);
CREATE TABLE public.tournament_opponents_history (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tournament_id uuid NOT NULL,
  team_id uuid NOT NULL,
  opponent_id uuid NOT NULL,
  match_id uuid,
  round_number integer,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tournament_opponents_history_pkey PRIMARY KEY (id),
  CONSTRAINT tournament_opponents_history_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id),
  CONSTRAINT tournament_opponents_history_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id),
  CONSTRAINT tournament_opponents_history_opponent_id_fkey FOREIGN KEY (opponent_id) REFERENCES public.teams(id),
  CONSTRAINT tournament_opponents_history_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.tournament_matches(id),
  CONSTRAINT tournament_opponents_history_unique_pairing UNIQUE (tournament_id, team_id, opponent_id),
  CONSTRAINT tournament_opponents_history_different_teams CHECK (team_id != opponent_id)
);
CREATE TABLE public.swiss_pairings (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tournament_id uuid NOT NULL,
  round_number integer NOT NULL,
  team1_id uuid NOT NULL,
  team2_id uuid NOT NULL,
  cannot_pair_again boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT swiss_pairings_pkey PRIMARY KEY (id),
  CONSTRAINT swiss_pairings_team1_id_fkey FOREIGN KEY (team1_id) REFERENCES public.teams(id),
  CONSTRAINT swiss_pairings_team2_id_fkey FOREIGN KEY (team2_id) REFERENCES public.teams(id),
  CONSTRAINT swiss_pairings_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id),
  CONSTRAINT swiss_pairings_different_teams CHECK (team1_id != team2_id)
);
CREATE TABLE public.swiss_round_results (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tournament_id uuid NOT NULL,
  team_id uuid NOT NULL,
  round_number integer NOT NULL,
  opponent_id uuid NOT NULL,
  result character varying NOT NULL,
  points_earned integer DEFAULT 0,
  tiebreaker_earned numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT swiss_round_results_pkey PRIMARY KEY (id),
  CONSTRAINT swiss_round_results_opponent_id_fkey FOREIGN KEY (opponent_id) REFERENCES public.teams(id),
  CONSTRAINT swiss_round_results_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id),
  CONSTRAINT swiss_round_results_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id),
  CONSTRAINT swiss_round_results_unique_round UNIQUE (tournament_id, team_id, round_number)
);
CREATE TABLE public.team_invitations (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  team_id uuid NOT NULL,
  invited_player_id uuid NOT NULL,
  invited_by uuid NOT NULL,
  status character varying DEFAULT 'pending'::character varying CHECK (status::text = ANY (ARRAY['pending'::character varying::text, 'accepted'::character varying::text, 'rejected'::character varying::text, 'expired'::character varying::text, 'cancelled'::character varying::text])),
  message text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval),
  CONSTRAINT team_invitations_pkey PRIMARY KEY (id),
  CONSTRAINT team_invitations_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.players(id),
  CONSTRAINT team_invitations_invited_player_id_fkey FOREIGN KEY (invited_player_id) REFERENCES public.players(id),
  CONSTRAINT team_invitations_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id)
);
CREATE TABLE public.team_join_requests (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  team_id uuid NOT NULL,
  player_id uuid NOT NULL,
  message text,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT team_join_requests_pkey PRIMARY KEY (id),
  CONSTRAINT team_join_requests_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id),
  CONSTRAINT team_join_requests_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id)
);
CREATE TABLE public.team_ratings (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  team_id uuid NOT NULL,
  rating numeric NOT NULL DEFAULT 1200,
  rating_type character varying DEFAULT 'Elo'::character varying,
  matches_played integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT team_ratings_pkey PRIMARY KEY (id),
  CONSTRAINT team_ratings_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id)
);
CREATE TABLE public.team_tournament_performances (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tournament_id uuid NOT NULL,
  team_id uuid NOT NULL,
  performance_data jsonb NOT NULL,
  achievements jsonb,
  statistics jsonb,
  milestones jsonb,
  bracket_path jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT team_tournament_performances_pkey PRIMARY KEY (id),
  CONSTRAINT team_tournament_performances_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id),
  CONSTRAINT team_tournament_performances_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id)
);
CREATE TABLE public.teams (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name character varying NOT NULL UNIQUE,
  description text,
  captain_id uuid NOT NULL,
  open_positions ARRAY DEFAULT '{}'::role_type[],
  recruiting_status USER-DEFINED DEFAULT 'Open'::recruiting_status_type,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  team_size USER-DEFINED NOT NULL DEFAULT '5'::team_size_type,
  team_avatar character varying,
  is_bot boolean DEFAULT false,
  average_rank text DEFAULT 'Unranked'::text,
  CONSTRAINT teams_pkey PRIMARY KEY (id),
  CONSTRAINT teams_captain_id_fkey FOREIGN KEY (captain_id) REFERENCES public.players(id)
);
CREATE TABLE public.tournament_admins (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tournament_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role character varying DEFAULT 'admin'::character varying,
  permissions text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tournament_admins_pkey PRIMARY KEY (id),
  CONSTRAINT tournament_admins_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id),
  CONSTRAINT tournament_admins_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.tournament_analytics (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tournament_id uuid NOT NULL,
  analytics_type character varying NOT NULL,
  data_point timestamp with time zone DEFAULT now(),
  metrics jsonb NOT NULL,
  comparisons jsonb,
  insights text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tournament_analytics_pkey PRIMARY KEY (id),
  CONSTRAINT tournament_analytics_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id)
);
CREATE TABLE public.tournament_brackets (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tournament_id uuid NOT NULL,
  round_number integer NOT NULL,
  bracket_position integer NOT NULL,
  parent_match_id uuid,
  winner_bracket_match_id uuid,
  loser_bracket_match_id uuid,
  is_final boolean DEFAULT false,
  is_third_place boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tournament_brackets_pkey PRIMARY KEY (id),
  CONSTRAINT tournament_brackets_loser_bracket_match_id_fkey FOREIGN KEY (loser_bracket_match_id) REFERENCES public.tournament_matches(id),
  CONSTRAINT tournament_brackets_parent_match_id_fkey FOREIGN KEY (parent_match_id) REFERENCES public.tournament_matches(id),
  CONSTRAINT tournament_brackets_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id),
  CONSTRAINT tournament_brackets_winner_bracket_match_id_fkey FOREIGN KEY (winner_bracket_match_id) REFERENCES public.tournament_matches(id)
);
CREATE TABLE public.tournament_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tournament_id uuid NOT NULL,
  action character varying NOT NULL,
  details text,
  user_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  event_category character varying DEFAULT 'general'::character varying,
  impact_level character varying DEFAULT 'low'::character varying,
  team_id uuid,
  match_id uuid,
  round_number integer,
  previous_state text,
  new_state text,
  public_visible boolean DEFAULT false,
  stat_impact boolean DEFAULT false,
  CONSTRAINT tournament_logs_pkey PRIMARY KEY (id),
  CONSTRAINT tournament_logs_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id),
  CONSTRAINT tournament_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.tournament_match_details (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  match_id uuid NOT NULL,
  game_number integer NOT NULL,
  game_duration integer,
  winning_team uuid NOT NULL,
  losing_team uuid,
  game_data jsonb,
  player_performances jsonb,
  notable_events jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tournament_match_details_pkey PRIMARY KEY (id),
  CONSTRAINT tournament_match_details_losing_team_fkey FOREIGN KEY (losing_team) REFERENCES public.teams(id),
  CONSTRAINT tournament_match_details_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.tournament_matches(id),
  CONSTRAINT tournament_match_details_winning_team_fkey FOREIGN KEY (winning_team) REFERENCES public.teams(id)
);
CREATE TABLE public.tournament_match_games (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  match_id uuid NOT NULL,
  game_number integer NOT NULL,
  winner_id uuid NOT NULL,
  duration integer,
  game_data text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tournament_match_games_pkey PRIMARY KEY (id),
  CONSTRAINT tournament_match_games_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.tournament_matches(id),
  CONSTRAINT tournament_match_games_winner_id_fkey FOREIGN KEY (winner_id) REFERENCES public.teams(id)
);
CREATE TABLE public.tournament_matches (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  bracket_id uuid NOT NULL,
  tournament_id uuid NOT NULL,
  team1_id uuid,
  team2_id uuid,
  winner_id uuid,
  status USER-DEFINED DEFAULT 'Scheduled'::match_status_type,
  result USER-DEFINED,
  scheduled_at timestamp with time zone,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  match_number integer NOT NULL,
  best_of integer DEFAULT 1 CHECK (best_of = ANY (ARRAY[1, 3, 5, 7])),
  team1_score integer DEFAULT 0,
  team2_score integer DEFAULT 0,
  match_room text,
  stream_url text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tournament_matches_pkey PRIMARY KEY (id),
  CONSTRAINT fk_tournament_matches_bracket_id FOREIGN KEY (bracket_id) REFERENCES public.tournament_brackets(id),
  CONSTRAINT tournament_matches_team1_id_fkey FOREIGN KEY (team1_id) REFERENCES public.teams(id),
  CONSTRAINT tournament_matches_team2_id_fkey FOREIGN KEY (team2_id) REFERENCES public.teams(id),
  CONSTRAINT tournament_matches_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id),
  CONSTRAINT tournament_matches_winner_id_fkey FOREIGN KEY (winner_id) REFERENCES public.teams(id),
  CONSTRAINT tournament_matches_different_teams CHECK (team1_id IS NULL OR team2_id IS NULL OR team1_id != team2_id)
);
CREATE TABLE public.tournament_milestones (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tournament_id uuid NOT NULL,
  milestone_type character varying NOT NULL,
  description text NOT NULL,
  team_id uuid,
  player_id uuid,
  match_id uuid,
  round_number integer,
  significance_score integer DEFAULT 1,
  public_story text,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tournament_milestones_pkey PRIMARY KEY (id),
  CONSTRAINT tournament_milestones_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.tournament_matches(id),
  CONSTRAINT tournament_milestones_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id),
  CONSTRAINT tournament_milestones_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id)
);
CREATE TABLE public.tournament_participants (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tournament_id uuid NOT NULL,
  team_id uuid NOT NULL,
  seed_number integer,
  initial_bracket_position integer,
  is_active boolean DEFAULT true,
  registration_data text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  swiss_score integer DEFAULT 0,
  tiebreaker_points numeric DEFAULT 0,
  buchholz_score numeric DEFAULT 0,
  dropped_out_at timestamp with time zone,
  CONSTRAINT tournament_participants_pkey PRIMARY KEY (id),
  CONSTRAINT tournament_participants_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id),
  CONSTRAINT tournament_participants_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id),
  CONSTRAINT tournament_participants_unique_team UNIQUE (tournament_id, team_id)
);
CREATE TABLE public.tournament_penalties (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tournament_id uuid NOT NULL,
  team_id uuid NOT NULL,
  player_id uuid,
  type USER-DEFINED NOT NULL,
  reason text NOT NULL,
  issued_by uuid NOT NULL,
  applied_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tournament_penalties_pkey PRIMARY KEY (id),
  CONSTRAINT tournament_penalties_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id),
  CONSTRAINT tournament_penalties_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id),
  CONSTRAINT tournament_penalties_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id),
  CONSTRAINT tournament_penalties_issued_by_fkey FOREIGN KEY (issued_by) REFERENCES auth.users(id)
);
CREATE TABLE public.tournament_registrations (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tournament_id uuid NOT NULL,
  team_id uuid NOT NULL,
  status USER-DEFINED DEFAULT 'Pending'::registration_status_type,
  registered_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tournament_registrations_pkey PRIMARY KEY (id),
  CONSTRAINT tournament_registrations_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id),
  CONSTRAINT tournament_registrations_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id),
  CONSTRAINT tournament_registrations_unique_team UNIQUE (tournament_id, team_id)
);
CREATE TABLE public.tournament_rosters (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tournament_id uuid NOT NULL,
  team_id uuid NOT NULL,
  player_id uuid NOT NULL,
  role USER-DEFINED NOT NULL,
  is_sub boolean DEFAULT false,
  locked_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tournament_rosters_pkey PRIMARY KEY (id),
  CONSTRAINT tournament_rosters_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id),
  CONSTRAINT tournament_rosters_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id),
  CONSTRAINT tournament_rosters_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id),
  CONSTRAINT tournament_rosters_unique_player UNIQUE (tournament_id, team_id, player_id)
);
CREATE TABLE public.tournament_seed_history (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tournament_id uuid NOT NULL,
  team_id uuid NOT NULL,
  seed integer NOT NULL,
  method USER-DEFINED NOT NULL,
  assigned_by uuid,
  assigned_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tournament_seed_history_pkey PRIMARY KEY (id),
  CONSTRAINT tournament_seed_history_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id),
  CONSTRAINT tournament_seed_history_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id),
  CONSTRAINT tournament_seed_history_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES auth.users(id)
);
CREATE TABLE public.tournament_stages (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tournament_id uuid NOT NULL,
  name text NOT NULL,
  format USER-DEFINED NOT NULL DEFAULT 'Single_Elimination'::tournament_format_type,
  stage_order integer NOT NULL DEFAULT 0,
  advancement_rules jsonb DEFAULT '{}'::jsonb,
  status USER-DEFINED NOT NULL DEFAULT 'Registration'::tournament_status_type,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tournament_stages_pkey PRIMARY KEY (id),
  CONSTRAINT tournament_stages_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id)
);
CREATE TABLE public.tournament_standings (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tournament_id uuid NOT NULL,
  team_id uuid NOT NULL,
  placement integer NOT NULL,
  points integer DEFAULT 0,
  wins integer DEFAULT 0,
  losses integer DEFAULT 0,
  prize_awarded text,
  is_final boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tournament_standings_pkey PRIMARY KEY (id),
  CONSTRAINT tournament_standings_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id),
  CONSTRAINT tournament_standings_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id),
  CONSTRAINT tournament_standings_unique_team UNIQUE (tournament_id, team_id)
);
CREATE TABLE public.tournament_state_snapshots (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tournament_id uuid NOT NULL,
  snapshot_type character varying NOT NULL,
  round_number integer,
  timestamp timestamp with time zone DEFAULT now(),
  total_teams integer,
  active_teams integer,
  completed_matches integer,
  total_matches integer,
  current_leaderboard jsonb,
  notable_events jsonb,
  metadata jsonb,
  CONSTRAINT tournament_state_snapshots_pkey PRIMARY KEY (id),
  CONSTRAINT tournament_state_snapshots_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id)
);
CREATE TABLE public.tournaments (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name character varying NOT NULL,
  description text,
  start_date timestamp with time zone NOT NULL,
  end_date timestamp with time zone NOT NULL,
  prize_pool character varying,
  max_teams integer NOT NULL,
  rules text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  status USER-DEFINED DEFAULT 'Registration'::tournament_status_type,
  format USER-DEFINED DEFAULT 'Single_Elimination'::tournament_format_type,
  registration_deadline timestamp with time zone,
  current_round integer DEFAULT 0,
  total_rounds integer DEFAULT 0,
  prize_distribution text,
  bracket_settings text,
  is_active boolean DEFAULT true,
  swiss_rounds integer DEFAULT 5,
  swiss_points_per_win integer DEFAULT 3,
  swiss_points_per_draw integer DEFAULT 1,
  swiss_points_per_loss integer DEFAULT 0,
  top_cut_size integer DEFAULT 8,
  enable_top_cut boolean DEFAULT false,
  tournament_number integer NOT NULL DEFAULT nextval('tournaments_tournament_number_seq'::regclass),
  parent_tournament_id uuid,
  stage_order integer DEFAULT 0,
  stage_type character varying DEFAULT 'Main'::character varying,
  opening_best_of integer DEFAULT 1,
  progression_best_of integer DEFAULT 3,
  elimination_best_of integer DEFAULT 3,
  finals_best_of integer DEFAULT 5,
  banner_image character varying,
  CONSTRAINT tournaments_pkey PRIMARY KEY (id),
  CONSTRAINT tournaments_parent_tournament_id_fkey FOREIGN KEY (parent_tournament_id) REFERENCES public.tournaments(id)
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_tournament_matches_tournament_id ON public.tournament_matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_team1_id ON public.tournament_matches(team1_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_team2_id ON public.tournament_matches(team2_id);
CREATE INDEX IF NOT EXISTS idx_tournament_participants_tournament_id ON public.tournament_participants(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_participants_team_id ON public.tournament_participants(team_id);
CREATE INDEX IF NOT EXISTS idx_swiss_match_history_tournament_id ON public.swiss_match_history(tournament_id);
CREATE INDEX IF NOT EXISTS idx_swiss_pairings_tournament_id ON public.swiss_pairings(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_logs_tournament_id ON public.tournament_logs(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_match_details_match_id ON public.tournament_match_details(match_id);
CREATE INDEX IF NOT EXISTS idx_tournament_match_games_match_id ON public.tournament_match_games(match_id);
CREATE INDEX IF NOT EXISTS idx_match_disputes_match_id ON public.match_disputes(match_id);
CREATE INDEX IF NOT EXISTS idx_match_result_audit_match_id ON public.match_result_audit(match_id);
CREATE INDEX IF NOT EXISTS idx_player_tournament_histories_player_id ON public.player_tournament_histories(player_id);
CREATE INDEX IF NOT EXISTS idx_player_tournament_histories_tournament_id ON public.player_tournament_histories(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_opponents_history_tournament_id ON public.tournament_opponents_history(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_opponents_history_team_id ON public.tournament_opponents_history(team_id);

