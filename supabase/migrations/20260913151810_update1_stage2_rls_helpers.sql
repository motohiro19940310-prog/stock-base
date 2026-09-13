-- Update1 Stage2: RLS強化（Stage6）で使う予定のヘルパー関数を先行して追加。
-- 既存のget_my_salon_id()と同じ命名規則・security definerパターン。
-- この時点ではどのポリシーからも参照されていないため、追加しても挙動は変わらない。

create or replace function public.get_my_role()
returns text
language sql
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function public.get_my_status()
returns text
language sql
security definer
set search_path = public
as $$
  select status from profiles where id = auth.uid();
$$;
