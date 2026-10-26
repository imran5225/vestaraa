-- ==============================================================================
-- VÉSTARA: Username-based Authentication Support
-- Adds username column with unique index and updates profile provisioning
-- ==============================================================================

-- 1. Add username column to profiles if not present
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS username text;

-- 2. Create case-insensitive unique index on username
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE tablename = 'profiles' AND indexname = 'idx_profiles_username_unique'
  ) THEN
    CREATE UNIQUE INDEX idx_profiles_username_unique ON public.profiles (LOWER(username)) WHERE username IS NOT NULL;
  END IF;
END $$;

-- 3. Update handle_new_user trigger to record username
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  extracted_username text;
BEGIN
  extracted_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    NEW.raw_user_meta_data->>'display_name',
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO public.profiles (id, display_name, username)
  VALUES (
    NEW.id,
    extracted_username,
    extracted_username
  )
  ON CONFLICT (id) DO UPDATE
  SET username = COALESCE(public.profiles.username, EXCLUDED.username),
      display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name);

  RETURN NEW;
END;
$$;
