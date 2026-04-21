-- Create private bucket for office branding assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('office-branding', 'office-branding', false)
ON CONFLICT (id) DO NOTHING;