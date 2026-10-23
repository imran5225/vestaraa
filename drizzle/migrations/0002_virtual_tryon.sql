CREATE TABLE public.virtual_models (
  user_id uuid PRIMARY KEY,
  photo_path text,
  consent_at timestamptz,
  onboarding_done boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.virtual_models TO authenticated;
GRANT ALL ON public.virtual_models TO service_role;
ALTER TABLE public.virtual_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own virtual model" ON public.virtual_models FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.tryon_looks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tryon_looks TO authenticated;
GRANT ALL ON public.tryon_looks TO service_role;
ALTER TABLE public.tryon_looks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tryon looks" ON public.tryon_looks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX tryon_looks_user_idx ON public.tryon_looks(user_id, created_at DESC);