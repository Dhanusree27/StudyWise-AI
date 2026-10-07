-- =============================================================
-- StudyWise AI – Profile auto-creation trigger + safety net
-- Run in Supabase: SQL Editor > New query > paste > Run
-- =============================================================

-- 1. Function: auto-create a profiles row when a new auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER          -- runs with full privileges so it can insert into profiles
SET search_path = public  -- prevent search_path hijacking
AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;   -- safe: no duplicate if profile already exists
  RETURN NEW;
END;
$$;

-- 2. Trigger: fire after each new user is inserted into auth.users
--    Drop first so the migration is idempotent (safe to re-run)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 3. Backfill: create profile rows for any existing confirmed users
--    who are missing a profile (fixes the current broken users)
INSERT INTO public.profiles (id)
SELECT id FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- 4. Verify RLS policies exist (the schema.sql creates them, but
--    if they were lost, re-create). This is idempotent.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Check if the "own rows" policy already exists before creating
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'own rows'
  ) THEN
    CREATE POLICY "own rows" ON public.profiles
      FOR ALL
      USING (id = auth.uid())
      WITH CHECK (id = auth.uid());
  END IF;
END $$;
