CREATE TABLE public.profiles (
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.wardrobe_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
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
  is_sample boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wardrobe_items_user_idx ON public.wardrobe_items (user_id, category);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wardrobe_items TO authenticated;
GRANT ALL ON public.wardrobe_items TO service_role;
ALTER TABLE public.wardrobe_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own items" ON public.wardrobe_items FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.outfits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
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
CREATE INDEX outfits_user_idx ON public.outfits (user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.outfits TO authenticated;
GRANT ALL ON public.outfits TO service_role;
ALTER TABLE public.outfits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own outfits" ON public.outfits FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.outfit_items (
  outfit_id uuid NOT NULL REFERENCES public.outfits(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.wardrobe_items(id) ON DELETE CASCADE,
  slot text NOT NULL,
  user_id uuid NOT NULL,
  PRIMARY KEY (outfit_id, slot)
);
CREATE INDEX outfit_items_item_idx ON public.outfit_items (item_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.outfit_items TO authenticated;
GRANT ALL ON public.outfit_items TO service_role;
ALTER TABLE public.outfit_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own outfit items" ON public.outfit_items FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  outfit_id uuid REFERENCES public.outfits(id) ON DELETE SET NULL,
  action text NOT NULL,
  slot text,
  item_ids uuid[] NOT NULL DEFAULT '{}',
  colors text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX feedback_user_idx ON public.feedback (user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feedback TO authenticated;
GRANT ALL ON public.feedback TO service_role;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own feedback" ON public.feedback FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Styling session',
  current_outfit_id uuid REFERENCES public.outfits(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX conversations_user_idx ON public.conversations (user_id, updated_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own conversations" ON public.conversations FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  outfit_id uuid REFERENCES public.outfits(id) ON DELETE SET NULL,
  mode text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_conv_idx ON public.messages (conversation_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own messages" ON public.messages FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_usage_user_idx ON public.ai_usage (user_id, created_at DESC);
GRANT SELECT, INSERT ON public.ai_usage TO authenticated;
GRANT ALL ON public.ai_usage TO service_role;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own usage select" ON public.ai_usage FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own usage insert" ON public.ai_usage FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "wardrobe read own" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'wardrobe' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "wardrobe insert own" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'wardrobe' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "wardrobe update own" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'wardrobe' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "wardrobe delete own" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'wardrobe' AND (storage.foldername(name))[1] = auth.uid()::text);