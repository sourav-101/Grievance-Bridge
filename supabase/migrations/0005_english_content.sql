-- =============================================================================
-- English versions of worker-facing content. Run after 0004_photos.sql.
-- Filled automatically: `npm run translate:content` for existing rows, and on
-- every save in Admin → Content Manager. Hindi stays the source of truth; when
-- the Hindi text changes, the English copy is regenerated.
-- =============================================================================

alter table public.knowledge_base add column if not exists title_english text;
alter table public.knowledge_base add column if not exists content_english text;
alter table public.helplines add column if not exists instructions_english text;
