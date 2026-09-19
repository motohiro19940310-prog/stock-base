-- 招待・プロフィールまわりの権限昇格/テナント越えの穴を塞ぐ。
--
-- 1) invitationsの「同じサロンのメンバーなら全操作可(ALL)」ポリシーにより、
--    スタッフがAPI直叩きで role='admin' の招待を作り、自分で受諾して管理者に
--    なれた。INSERTを「有効なowner/adminのみ。adminの招待はownerのみ」に限定する。
-- 2) 「未使用なら誰でもSELECT可」ポリシーにより、未ログインでも有効な招待トークンを
--    一覧取得でき、誰でもサロンに参加できた。匿名SELECTを廃止する
--    (招待ページはサーバー側でトークン1件のみ検索するよう変更済み)。
-- 3) profilesの自己INSERT/UPDATEポリシーにより、ログイン済みユーザーが自分の
--    role/status/salon_idを書き換えられた(スタッフが自分をownerにできる)。
--    プロフィールの作成・更新は全てsecurity definer RPC(create_salon /
--    accept_invitation)とservice role(スタッフ管理)経由になったため、
--    クライアントからの直接書き込みポリシーを廃止する。

drop policy if exists "public can read unused invitations" on public.invitations;
drop policy if exists "salon members can manage invitations" on public.invitations;

create policy "invitations_select_own_salon"
  on public.invitations for select
  to authenticated
  using (salon_id = get_my_salon_id());

create policy "invitations_insert_by_owner_or_admin"
  on public.invitations for insert
  to authenticated
  with check (
    salon_id = get_my_salon_id()
    and get_my_status() = 'active'
    and invited_by = auth.uid()
    and (
      (role = 'staff' and get_my_role() in ('owner', 'admin'))
      or (role = 'admin' and get_my_role() = 'owner')
    )
  );

drop policy if exists "プロフィール作成" on public.profiles;
drop policy if exists "プロフィール更新" on public.profiles;

-- 招待ページはservice role経由に変更済みのため不要。
drop function if exists public.get_invitation_salon_name(text);
