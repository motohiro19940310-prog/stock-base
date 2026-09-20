-- 小さなセキュリティ修正（設計書作成前に実施）
--
-- (1) 操作履歴に操作者を記録する
--     stock_logs.user_id は存在したが未使用で、クライアントから任意の値を入れられ、
--     後から書き換えもできた。INSERT時にDB側で auth.uid() を強制セットし、
--     UPDATEでは user_id を変更不可にする（RLS/アプリ側の実装に依存しない）。
--     操作者名の表示のため profiles への外部キーを追加する（PostgRESTの結合用）。
--
-- (2) 無効化を既存セッションにも即時反映する
--     従来は無効化後も、発行済みのアクセストークンで items / stock_logs / salons を
--     最大トークン有効期間（約1時間）読み書きできた（本番で実測）。
--     RLSが全て get_my_salon_id() を経由しているため、この関数を
--     「有効(active)なユーザーのみ salon_id を返す」ように変えるだけで、
--     無効化した瞬間から全サロンデータへのアクセスがDBレベルで遮断される。
--
-- (3) 無効化ユーザーが招待受諾・サロン作成のRPCで自分を再有効化できた穴を塞ぐ。
--
-- (4) 同じサロンのメンバー名を表示できるよう、profilesの同サロンSELECTを許可する。

-- ---------- (1) operator recording ----------
create or replace function public.stock_logs_guard_operator()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.user_id := auth.uid();
    end if;
  elsif tg_op = 'UPDATE' then
    if auth.uid() is not null then
      new.user_id := old.user_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_stock_logs_guard_operator on public.stock_logs;
create trigger trg_stock_logs_guard_operator
  before insert or update on public.stock_logs
  for each row execute function public.stock_logs_guard_operator();

-- 既存のFK(auth.usersへ)は残したまま、profilesへのFKを追加（履歴の操作者名の結合用）。
-- 既存の履歴153件は user_id が全て NULL のため追加しても違反しない（実データ確認済み）。
alter table public.stock_logs
  add constraint stock_logs_user_id_profiles_fkey
  foreign key (user_id) references public.profiles(id) on delete set null;

-- ---------- (2) immediate deactivation ----------
create or replace function public.get_my_salon_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select salon_id from profiles where id = auth.uid() and status = 'active';
$$;

-- ---------- (3) no self re-activation via RPCs ----------
create or replace function public.accept_invitation(p_token text, p_full_name text)
returns table(out_salon_id uuid, out_salon_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv invitations%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if exists (select 1 from profiles where id = auth.uid() and status = 'inactive') then
    raise exception 'account_disabled';
  end if;

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

  if exists (select 1 from profiles where id = auth.uid() and status = 'inactive') then
    raise exception 'account_disabled';
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

-- ---------- (4) teammates' names ----------
drop policy if exists "profiles_select_same_salon" on public.profiles;
create policy "profiles_select_same_salon"
  on public.profiles for select
  to authenticated
  using (salon_id = get_my_salon_id());
