DROP POLICY owner_workspace_select ON public.owner_workspace;
DROP POLICY owner_workspace_insert ON public.owner_workspace;
DROP POLICY owner_workspace_update ON public.owner_workspace;

CREATE POLICY owner_workspace_select ON public.owner_workspace
  FOR SELECT TO authenticated
  USING (owner_id = (SELECT auth.uid()) AND (SELECT auth.jwt()->>'aal') = 'aal2');
CREATE POLICY owner_workspace_insert ON public.owner_workspace
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = (SELECT auth.uid()) AND (SELECT auth.jwt()->>'aal') = 'aal2');
CREATE POLICY owner_workspace_update ON public.owner_workspace
  FOR UPDATE TO authenticated
  USING (owner_id = (SELECT auth.uid()) AND (SELECT auth.jwt()->>'aal') = 'aal2')
  WITH CHECK (owner_id = (SELECT auth.uid()) AND (SELECT auth.jwt()->>'aal') = 'aal2');
