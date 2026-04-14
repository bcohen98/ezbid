ALTER TABLE public.proposals
ADD COLUMN custom_accent_color text DEFAULT NULL,
ADD COLUMN font_style text DEFAULT 'modern',
ADD COLUMN header_style text DEFAULT 'dark';