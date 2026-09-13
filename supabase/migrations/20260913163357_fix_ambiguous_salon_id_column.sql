-- 重大バグ修正: create_salon()・accept_invitation()の両方で、
-- RETURNS TABLE(salon_id uuid, ...) のOUTパラメータ名がテーブル列名 salon_id と
-- 衝突し、"column reference salon_id is ambiguous" で実行時エラーになっていた
-- （PL/pgSQLの既知の落とし穴: RETURNS TABLEのOUT引数は関数本体内で暗黙の変数になる）。
-- 呼び出し元(signup/page.tsx, InviteSignup.tsx)は戻り値のカラム名を参照していない
-- ため、OUTパラメータ名の変更は互換性に影響しない。

-- OUTパラメータ名(戻り値の行型)を変更するため、CREATE OR REPLACEでは不可。
-- 先にDROPしてから作り直す。
drop function if exists public.create_salon(text);
drop function if exists public.accept_invitation(text, text);

create or replace function public.create_salon(p_name text)
returns table(out_salon_id uuid, out_salon_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_salon_id uuid;
  v_new_salon_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select profiles.salon_id into v_existing_salon_id from profiles where id = auth.uid();

  if v_existing_salon_id is not null then
    return query select s.id, s.name from salons s where s.id = v_existing_salon_id;
    return;
  end if;

  insert into salons (name) values (p_name) returning id into v_new_salon_id;

  insert into profiles (id, salon_id, display_name, role, status)
  values (auth.uid(), v_new_salon_id, p_name, 'owner', 'active')
  on conflict (id) do update
    set salon_id = excluded.salon_id,
        display_name = excluded.display_name,
        role = excluded.role,
        status = 'active';

  return query select s.id, s.name from salons s where s.id = v_new_salon_id;
end;
$$;

create or replace function public.accept_invitation(p_token text, p_full_name text)
returns table(out_salon_id uuid, out_salon_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv invitations%rowtype;
begin
  select * into v_inv from invitations where token = p_token for update;

  if not found then
    raise exception 'invalid_token';
  end if;

  if v_inv.used_at is not null then
    raise exception 'token_used';
  end if;

  if v_inv.expires_at is not null and v_inv.expires_at < now() then
    raise exception 'token_expired';
  end if;

  insert into profiles (id, salon_id, full_name, role, status)
  values (auth.uid(), v_inv.salon_id, p_full_name, coalesce(v_inv.role, 'staff'), 'active')
  on conflict (id) do update
    set salon_id = excluded.salon_id,
        full_name = excluded.full_name,
        role = excluded.role,
        status = 'active';

  update invitations set used_at = now() where id = v_inv.id;

  return query select s.id, s.name from salons s where s.id = v_inv.salon_id;
end;
$$;
