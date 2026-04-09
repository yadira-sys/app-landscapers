
-- Add PIN column to profiles (4-6 digit numeric PIN, unique)
ALTER TABLE public.profiles ADD COLUMN pin text;

-- Create unique index on pin (only non-null values)
CREATE UNIQUE INDEX idx_profiles_pin ON public.profiles (pin) WHERE pin IS NOT NULL;
