-- =====================================================================================
-- Website 4: products created from the admin Products page are shown on the website.
--   * new products are visible on the website by default
--   * every existing product becomes visible (hide individual ones from the Products page)
-- Run once in the Supabase SQL editor.
-- =====================================================================================
alter table public.products alter column is_visible_on_website set default true;
update public.products set is_visible_on_website = true where not is_visible_on_website;
