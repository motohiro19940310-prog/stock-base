-- 重大バグ修正: 2026-09-09のsalons RLS有効化以降、新規サロン登録が機能していなかった。
--
-- app/(auth)/signup/page.tsxはクライアントから直接
-- `.from('salons').insert({name}).select().single()` していた。
-- salonsのSELECTポリシーは `id = get_my_salon_id()` だが、サインアップ直後の
-- ユーザーはまだprofiles.salon_idを持たない（これから作るところ）ため、
-- get_my_salon_id()は常にnullを返す。INSERT自体は許可されても、
-- INSERT ... RETURNING は暗黙にSELECTポリシーを要求するため、
-- 「new row violates row-level security policy for table salons」で
-- 常に失敗していた（実データで再現・特定済み）。
--
-- accept_invitation()と同じパターンで、サロン作成とオーナープロフィール作成を
-- 1つのsecurity definer RPCに集約し、RLSのチェーン依存を解消する。

create or replace function public.create_salon(p_name text)
returns table(salon_id uuid, salon_name text)
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

  select salon_id into v_existing_salon_id from profiles where id = auth.uid();

  if v_existing_salon_id is not null then
    -- 既にサロンに所属済み（再サインアップ等）。そのまま返す。冪等性のため。
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
