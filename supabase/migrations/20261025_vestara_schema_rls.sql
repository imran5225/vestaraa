-- ==============================================================================
-- VÉSTARA: Supabase PostgreSQL Schema & Row Level Security (RLS) Setup
-- Run this in the Supabase Dashboard -> SQL Editor
-- ==============================================================================

-- 1. Profiles Table (1:1 with auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  favorite_colors text[] NOT NULL DEFAULT '{}',
  avoided_colors text[] NOT NULL DEFAULT '{}',
  preferred_styles text[] NOT NULL DEFAULT '{}',
  preferred_fits text[] NOT NULL DEFAULT '{}',
  typical_occasions text[] NOT NULL DEFAULT '{}',
  sizes jsonb NOT NULL DEFAULT '{}'::jsonb,
  comfort_notes text,
  weather_enabled boolean NOT NULL DEFAULT false,
  weather_city text,
  onboarded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
  DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
  DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
END $$;

CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Auto-provision profile on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 2. Wardrobe Items Table
CREATE TABLE IF NOT EXISTS public.wardrobe_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL,
  subcategory text,
  main_color text,
  secondary_colors text[] NOT NULL DEFAULT '{}',
  pattern text,
  style text,
  fit text,
  seasons text[] NOT NULL DEFAULT '{}',
  image_path text,
  sample_key text,
  brand text,
  notes text,
  ai_colors jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_outfit_suggestions jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_sample boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wardrobe_items_user_category_idx ON public.wardrobe_items (user_id, category);
ALTER TABLE public.wardrobe_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can access own wardrobe items" ON public.wardrobe_items;
END $$;

CREATE POLICY "Users can access own wardrobe items" ON public.wardrobe_items
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Outfits Table
CREATE TABLE IF NOT EXISTS public.outfits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  occasion text NOT NULL,
  mood text,
  explanation text NOT NULL DEFAULT '',
  score numeric NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'rules',
  status text NOT NULL DEFAULT 'suggested',
  piece_count int NOT NULL DEFAULT 0,
  signature text NOT NULL,
  weather jsonb,
  parent_outfit_id uuid REFERENCES public.outfits(id) ON DELETE SET NULL,
  worn_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS outfits_user_created_idx ON public.outfits (user_id, created_at DESC);
ALTER TABLE public.outfits ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can access own outfits" ON public.outfits;
END $$;

CREATE POLICY "Users can access own outfits" ON public.outfits
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Outfit Items Join Table
CREATE TABLE IF NOT EXISTS public.outfit_items (
  outfit_id uuid NOT NULL REFERENCES public.outfits(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.wardrobe_items(id) ON DELETE CASCADE,
  slot text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (outfit_id, slot)
);

CREATE INDEX IF NOT EXISTS outfit_items_item_idx ON public.outfit_items (item_id);
ALTER TABLE public.outfit_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can access own outfit pieces" ON public.outfit_items;
END $$;

CREATE POLICY "Users can access own outfit pieces" ON public.outfit_items
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. Feedback Table
CREATE TABLE IF NOT EXISTS public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  outfit_id uuid REFERENCES public.outfits(id) ON DELETE SET NULL,
  action text NOT NULL,
  slot text,
  item_ids uuid[] NOT NULL DEFAULT '{}',
  colors text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feedback_user_idx ON public.feedback (user_id, created_at DESC);
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can access own feedback" ON public.feedback;
END $$;

CREATE POLICY "Users can access own feedback" ON public.feedback
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 6. Conversations & Messages Tables
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Styling session',
  current_outfit_id uuid REFERENCES public.outfits(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversations_user_idx ON public.conversations (user_id, updated_at DESC);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can access own conversations" ON public.conversations;
END $$;

CREATE POLICY "Users can access own conversations" ON public.conversations
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  outfit_id uuid REFERENCES public.outfits(id) ON DELETE SET NULL,
  mode text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_conv_idx ON public.messages (conversation_id, created_at);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can access own messages" ON public.messages;
END $$;

CREATE POLICY "Users can access own messages" ON public.messages
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 7. Virtual Models & Try-On Looks
CREATE TABLE IF NOT EXISTS public.virtual_models (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  photo_path text,
  consent_at timestamptz,
  onboarding_done boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.virtual_models ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can access own virtual model" ON public.virtual_models;
END $$;

CREATE POLICY "Users can access own virtual model" ON public.virtual_models
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.tryon_looks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_path text NOT NULL,
  garment_path text,
  result_path text NOT NULL,
  description text NOT NULL DEFAULT '',
  occasion text,
  styling jsonb NOT NULL DEFAULT '{}'::jsonb,
  saved boolean NOT NULL DEFAULT false,
  reported boolean NOT NULL DEFAULT false,
  parent_id uuid REFERENCES public.tryon_looks(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tryon_looks_user_idx ON public.tryon_looks (user_id, created_at DESC);
ALTER TABLE public.tryon_looks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can access own tryon looks" ON public.tryon_looks;
END $$;

CREATE POLICY "Users can access own tryon looks" ON public.tryon_looks
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 8. Storage Buckets & Policies
DO $$ BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('wardrobe', 'wardrobe', false)
  ON CONFLICT (id) DO NOTHING;

  DROP POLICY IF EXISTS "Users can read own wardrobe images" ON storage.objects;
  DROP POLICY IF EXISTS "Users can upload own wardrobe images" ON storage.objects;
  DROP POLICY IF EXISTS "Users can update own wardrobe images" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete own wardrobe images" ON storage.objects;

  CREATE POLICY "Users can read own wardrobe images" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'wardrobe' AND (storage.foldername(name))[1] = auth.uid()::text);

  CREATE POLICY "Users can upload own wardrobe images" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'wardrobe' AND (storage.foldername(name))[1] = auth.uid()::text);

  CREATE POLICY "Users can update own wardrobe images" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'wardrobe' AND (storage.foldername(name))[1] = auth.uid()::text)
    WITH CHECK (bucket_id = 'wardrobe' AND (storage.foldername(name))[1] = auth.uid()::text);

  CREATE POLICY "Users can delete own wardrobe images" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'wardrobe' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
