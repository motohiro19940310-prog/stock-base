-- Update1 Stage3: 招待受諾をサーバー側(security definer)で検証するRPCに変更。
-- 従来はクライアントから直接 profiles.upsert({ salon_id }) しており、
-- salon_idを改ざんされても検知できなかった（invitations.tokenの有効性を検証していなかった）。
-- これ以降はこのRPC経由のみで招待受諾を行う。

create or replace function public.accept_invitation(p_token text, p_full_name text)
returns table(salon_id uuid, salon_name text)
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

-- 未ログインの招待受諾ページがサロン名を表示するための読み取り専用RPC。
-- salonsテーブルのRLS有効化(2026-09-09)以降、invitations.salons(name)の結合が
-- 未認証ユーザーには常にnullを返すようになっていた副作用を修正する。
-- 既に使用済み・期限切れの招待では呼ばない（使用済み表示に切り替える）想定。
create or replace function public.get_invitation_salon_name(p_token text)
returns text
language sql
security definer
set search_path = public
as $$
  select s.name
  from invitations i
  join salons s on s.id = i.salon_id
  where i.token = p_token and i.used_at is null;
$$;
