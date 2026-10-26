-- =====================================================================================
-- Remove every account (admin, workers, clients) so the login page shows
-- "Créer le compte administrateur" again.
-- Run in Supabase → SQL Editor. This cannot be undone.
--
-- Deleting from auth.users cascades to public.profiles → clients → client_permissions,
-- calculation_history and favorites. Products, recipes, packs, orders and website settings are kept.
-- =====================================================================================

-- 1. See what will be removed
select u.id, u.email, p.username, p.role, u.created_at
from auth.users u
left join public.profiles p on p.id = u.id
order by u.created_at;

-- 2. Delete all accounts
delete from auth.users;

-- Profiles without an auth user (left over from manual inserts)
delete from public.profiles;

-- 3. Restart the client serial numbers at 0001 (optional)
update public.counters set value = 0 where name = 'client';

-- 4. Check: should return false → the "create admin" button is shown on /login
select public.admin_exists();

-- -------------------------------------------------------------------------------------
-- Alternative: remove ONLY the admin account(s), keep workers and clients
-- delete from auth.users where id in (select id from public.profiles where role = 'ADMIN');
--
-- Alternative: remove one account by e-mail
-- delete from auth.users where email = 'someone@example.com';
-- -------------------------------------------------------------------------------------
