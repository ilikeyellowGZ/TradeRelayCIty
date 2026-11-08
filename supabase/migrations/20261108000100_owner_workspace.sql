CREATE TABLE public.owner_workspace (
  owner_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_name text NOT NULL DEFAULT 'TradeRelayCity' CHECK (char_length(workspace_name) BETWEEN 1 AND 80),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.owner_workspace ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.owner_workspace FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON public.owner_workspace TO authenticated;

CREATE POLICY owner_workspace_select ON public.owner_workspace
  FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid()));
CREATE POLICY owner_workspace_insert ON public.owner_workspace
  FOR INSERT TO authenticated WITH CHECK (owner_id = (SELECT auth.uid()));
CREATE POLICY owner_workspace_update ON public.owner_workspace
  FOR UPDATE TO authenticated USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE FUNCTION public.touch_owner_workspace() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER owner_workspace_updated_at
BEFORE UPDATE ON public.owner_workspace
FOR EACH ROW EXECUTE FUNCTION public.touch_owner_workspace();
