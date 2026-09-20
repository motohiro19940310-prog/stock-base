-- A1a: roles / permissions (追加のみ。既存の挙動は変わらない)
-- 設計: .company/product/salon-stock/plan/2026-09-20-account-contract-design.md §4

create table public.roles (
  code text primary key,
  name text not null,
  rank int not null,
  is_system boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.permissions (
  code text primary key,
  description text not null,
  created_at timestamptz not null default now()
);

create table public.role_permissions (
  role_code text not null references public.roles(code) on update cascade on delete cascade,
  permission_code text not null references public.permissions(code) on update cascade on delete cascade,
  primary key (role_code, permission_code)
);

insert into public.roles (code, name, rank) values
  ('owner', 'オーナー', 100),
  ('admin', '管理者', 50),
  ('staff', 'スタッフ', 10);

insert into public.permissions (code, description) values
  ('billing.view',         '請求・支払履歴の閲覧'),
  ('billing.manage',       'カード変更・契約・解約・解約取消'),
  ('staff.view',           'スタッフ一覧の閲覧'),
  ('staff.create',         'スタッフの追加（登録リンク発行）'),
  ('staff.update',         'スタッフ情報の編集'),
  ('staff.deactivate',     'スタッフの停止・再開'),
  ('staff.reset_password', 'パスワード再設定リンクの発行'),
  ('staff.change_role',    'ロール変更（昇格・降格）'),
  ('stock.view',           '在庫の閲覧'),
  ('stock.adjust',         '使用・補充の記録'),
  ('items.manage',         '商品の追加・編集・削除・CSV取込'),
  ('history.view',         '更新履歴の閲覧'),
  ('history.undo_own',     '自分の記録の取消'),
  ('history.undo_any',     '全員の記録の取消'),
  ('audit.view',           'サロン内の監査ログ閲覧');

-- owner: 全権限
insert into public.role_permissions (role_code, permission_code)
select 'owner', code from public.permissions;

-- admin: 契約(billing.*)とロール変更以外すべて
insert into public.role_permissions (role_code, permission_code)
select 'admin', code from public.permissions
where code not in ('billing.view', 'billing.manage', 'staff.change_role');

-- staff: 日常の在庫作業のみ
insert into public.role_permissions (role_code, permission_code) values
  ('staff', 'stock.view'),
  ('staff', 'stock.adjust'),
  ('staff', 'history.view'),
  ('staff', 'history.undo_own');

-- profiles.role を roles への外部キーに置換（現在の値 owner/admin/staff は全てrolesに存在する）
alter table public.profiles
  add constraint profiles_role_fkey foreign key (role) references public.roles(code) on update cascade;
alter table public.profiles drop constraint profiles_role_check;

-- RLS: ログイン済みユーザーは読み取りのみ。書き込みはservice_role/マイグレーションのみ
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;

revoke all on public.roles, public.permissions, public.role_permissions from anon, authenticated;
grant select on public.roles, public.permissions, public.role_permissions to authenticated;

create policy roles_read on public.roles for select to authenticated using (true);
create policy permissions_read on public.permissions for select to authenticated using (true);
create policy role_permissions_read on public.role_permissions for select to authenticated using (true);
