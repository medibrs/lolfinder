-- Add live_proxy_host column to tournament_matches
-- Stores the IP:PORT of the spectator PC running lol-live-proxy
ALTER TABLE public.tournament_matches
  ADD COLUMN IF NOT EXISTS live_proxy_host text;
