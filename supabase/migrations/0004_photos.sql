-- =============================================================================
-- Complaint photos. Run after 0003_english.sql.
--   * grievances.photo_url = storage PATH of an optional photo of the problem
--   * worker-photo-vault   = PRIVATE bucket (no storage policies, like the audio
--     vault): only the server writes; admins get short-lived signed URLs.
-- Photos are re-encoded in the browser before upload, which strips EXIF data
-- (GPS position, phone model) so they cannot identify an anonymous worker.
-- =============================================================================

alter table public.grievances add column if not exists photo_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('worker-photo-vault', 'worker-photo-vault', false, 5242880,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
