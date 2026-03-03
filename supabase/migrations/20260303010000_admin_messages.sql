-- Admin Messages: captain <-> admin communication
CREATE TABLE public.admin_messages (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  team_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  sender_role text NOT NULL CHECK (sender_role IN ('captain', 'admin')),
  subject text NOT NULL,
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT admin_messages_pkey PRIMARY KEY (id),
  CONSTRAINT admin_messages_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE,
  CONSTRAINT admin_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id)
);

-- Index for fast lookups
CREATE INDEX idx_admin_messages_team_id ON public.admin_messages(team_id);
CREATE INDEX idx_admin_messages_sender_role ON public.admin_messages(sender_role);
CREATE INDEX idx_admin_messages_read ON public.admin_messages(read) WHERE read = false;
CREATE INDEX idx_admin_messages_created_at ON public.admin_messages(created_at DESC);

-- RLS
ALTER TABLE public.admin_messages ENABLE ROW LEVEL SECURITY;

-- Captains can read messages for their own team
CREATE POLICY "Captains can read their team messages"
  ON public.admin_messages FOR SELECT
  USING (
    team_id IN (SELECT id FROM public.teams WHERE captain_id = auth.uid())
  );

-- Captains can insert messages as 'captain'
CREATE POLICY "Captains can send messages"
  ON public.admin_messages FOR INSERT
  WITH CHECK (
    sender_role = 'captain'
    AND sender_id = auth.uid()
    AND team_id IN (SELECT id FROM public.teams WHERE captain_id = auth.uid())
  );

-- Admins bypass RLS via service role key
