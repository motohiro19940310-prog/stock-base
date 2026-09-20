-- A1 ロールバック（A1のマイグレーション5本を取り消す）。新しいオブジェクトの削除と、元の制約・ポリシーの復元のみ。
-- 既存のデータ(salons/profiles/items/stock_logs等の行)には触れない。ただし A1 で追加した列の値(SHINEY等)と新テーブルの中身は失われる。
-- 実行: supabase db query --linked -f supabase/rollbacks/20260920_a1_down.sql
-- その後、schema_migrations の 20260920100000〜20260920100400 を repair で reverted にする:
--   supabase migration repair --status reverted 20260920100000 20260920100100 20260920100200 20260920100300 20260920100400
begin;

-- A1e
drop policy if exists audit_logs_read_own_salon on public.audit_logs;
drop function if exists public.get_my_access();
drop function if exists public.has_permission(text);
drop function if exists public.salon_access_level(uuid);

-- A1d
drop table if exists public.credential_links;
drop table if exists public.signup_requests;
drop table if exists public.login_attempts;
drop table if exists public.super_admins;
drop table if exists public.audit_logs;
drop function if exists public.audit_logs_immutable();

-- A1c
drop table if exists public.app_settings;
drop table if exists public.stripe_events;
drop table if exists public.payments;
drop table if exists public.subscriptions;
drop table if exists public.plan_prices;
drop table if exists public.plans;
drop table if exists public.billing_accounts;

-- A1b
drop table if exists public.profile_private;
drop index if exists public.profiles_salon_login_id_key;
alter table public.profiles
  drop constraint if exists profiles_login_id_format,
  drop column if exists login_id,
  drop column if exists password_changed_at,
  drop column if exists last_login_at,
  drop column if exists last_login_method,
  drop column if exists deactivated_at,
  drop column if exists deactivated_by;

drop trigger if exists salons_assign_code on public.salons;
drop function if exists public.salons_assign_code();
drop index if exists public.salons_salon_code_key;
alter table public.salons
  drop constraint if exists salons_salon_code_format,
  drop column if exists salon_code,
  drop column if exists access_status,
  drop column if exists suspended_at;
drop function if exists public.generate_salon_code();

-- 旧ポリシー・権限の復元
grant insert on public.salons to authenticated;
create policy "サロン作成" on public.salons for insert with check (auth.uid() is not null);

-- A1a
alter table public.profiles add constraint profiles_role_check check (role = any (array['owner'::text, 'admin'::text, 'staff'::text]));
alter table public.profiles drop constraint if exists profiles_role_fkey;
drop table if exists public.role_permissions;
drop table if exists public.permissions;
drop table if exists public.roles;

commit;
