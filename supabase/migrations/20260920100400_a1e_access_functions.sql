-- A1e: アクセス判定の関数（追加のみ。A1時点ではどのRLS・画面からも参照しないので挙動は変わらない）
-- 設計: §2.3 / §7.5
-- 注意(A3で配線するとき): RLSポリシーからは (select public.has_permission('...')) の形で呼び、行ごとの再評価を避ける

-- 利用可否を「現在時刻から」計算する（保存値ではない）。他サロンの状態を覗けないよう service_role のみ実行可
create or replace function public.salon_access_level(p_salon_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_status text;
  v_mode text;
  s public.subscriptions;
  v_grace int;
begin
  select access_status into v_status from public.salons where id = p_salon_id;
  if v_status is null or v_status = 'suspended' then
    return 'blocked';
  end if;

  select billing_mode into v_mode from public.billing_accounts where salon_id = p_salon_id;
  if v_mode = 'exempt' then
    return 'full';
  end if;

  select * into s from public.subscriptions
   where salon_id = p_salon_id and ended_at is null
   order by created_at desc limit 1;
  if not found then
    return 'billing_only';
  end if;

  select coalesce((value #>> '{}')::int, 7) into v_grace from public.app_settings where key = 'billing.grace_days';
  v_grace := coalesce(v_grace, 7);

  if s.status = 'active' then
    if s.current_period_end is null then
      return 'full';
    end if;
    -- 解約予約中は契約終了日ちょうどまで。通常の更新は、Webhook遅延に備えて1日の余裕を持たせる
    if s.cancel_at_period_end then
      if s.current_period_end > now() then return 'full'; end if;
    elsif s.current_period_end + interval '1 day' > now() then
      return 'full';
    end if;
    return 'billing_only';
  elsif s.status = 'past_due' then
    if s.past_due_since is not null and s.past_due_since + make_interval(days => v_grace) > now() then
      return 'full';
    end if;
    return 'billing_only';
  end if;

  return 'billing_only';
end;
$$;
revoke execute on function public.salon_access_level(uuid) from public, anon, authenticated;
grant execute on function public.salon_access_level(uuid) to service_role;

-- 呼び出しユーザーが権限を持つか。在職中であること・サロンの利用可否・ロールの権限を判定
--   full         : ロールの権限どおり
--   billing_only : billing.* のみ（契約が切れたOwnerが再契約できるように）
--   blocked      : 全て不可
create or replace function public.has_permission(p_permission text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_salon uuid;
  v_role text;
  v_level text;
begin
  select pr.salon_id, pr.role into v_salon, v_role
    from public.profiles pr
   where pr.id = auth.uid() and pr.status = 'active';
  if not found or v_salon is null then
    return false;
  end if;

  v_level := public.salon_access_level(v_salon);
  if v_level = 'blocked' then
    return false;
  end if;
  if v_level = 'billing_only' and p_permission not in ('billing.view', 'billing.manage') then
    return false;
  end if;

  return exists (
    select 1 from public.role_permissions rp
     where rp.role_code = v_role and rp.permission_code = p_permission
  );
end;
$$;
revoke execute on function public.has_permission(text) from public, anon;
grant execute on function public.has_permission(text) to authenticated, service_role;

-- レイアウトが1回だけ呼ぶ、自分の状態のまとめ
create or replace function public.get_my_access()
returns table (
  out_salon_id uuid,
  out_salon_code text,
  out_role text,
  out_status text,
  out_access_level text,
  out_permissions text[]
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
  with me as (
    select pr.salon_id as m_salon_id, s.salon_code as m_salon_code, pr.role as m_role, pr.status as m_status,
           case when pr.status <> 'active' or pr.salon_id is null then 'blocked'
                else public.salon_access_level(pr.salon_id) end as m_level
      from public.profiles pr
      left join public.salons s on s.id = pr.salon_id
     where pr.id = auth.uid()
  )
  select me.m_salon_id, me.m_salon_code, me.m_role, me.m_status, me.m_level,
         coalesce((
           select array_agg(rp.permission_code order by rp.permission_code)
             from public.role_permissions rp
            where rp.role_code = me.m_role
              and case me.m_level
                    when 'full' then true
                    when 'billing_only' then rp.permission_code in ('billing.view', 'billing.manage')
                    else false
                  end
         ), array[]::text[])
    from me;
end;
$$;
revoke execute on function public.get_my_access() from public, anon;
grant execute on function public.get_my_access() to authenticated, service_role;

-- 監査ログ: 自サロン分を audit.view 権限者だけ閲覧可
grant select on public.audit_logs to authenticated;
create policy audit_logs_read_own_salon on public.audit_logs
  for select to authenticated
  using (salon_id is not null and salon_id = (select public.get_my_salon_id()) and (select public.has_permission('audit.view')));
