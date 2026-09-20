-- A1b: salons / profiles への列追加（追加のみ。既存の列・行は変更しない）
-- 設計: §2.1 / §5

-- ---- サロンID ----
create or replace function public.generate_salon_code()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- 0/O/1/I を除外
  code text;
  i int;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.salons where salon_code = code);
  end loop;
  return code;
end;
$$;
revoke execute on function public.generate_salon_code() from public, anon, authenticated;

alter table public.salons
  add column salon_code text,
  add column access_status text not null default 'active' check (access_status in ('active', 'suspended')),
  add column suspended_at timestamptz;

-- Shiney（既存の唯一のサロン）のサロンIDは手動指定
update public.salons set salon_code = 'SHINEY' where id = '2ba66e00-f672-4d2b-8036-6c48d5cc17c3';
-- 他に行があれば自動発行（現状は0件の想定）
update public.salons set salon_code = public.generate_salon_code() where salon_code is null;

alter table public.salons alter column salon_code set not null;
alter table public.salons add constraint salons_salon_code_format check (salon_code ~ '^[A-Z0-9]{4,12}$');
create unique index salons_salon_code_key on public.salons (salon_code);

-- 新規サロン（create_salon RPC等）にも自動でサロンIDを付ける。大文字に正規化。
create or replace function public.salons_assign_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.salon_code is null then
    new.salon_code := public.generate_salon_code();
  else
    new.salon_code := upper(new.salon_code);
  end if;
  return new;
end;
$$;
revoke execute on function public.salons_assign_code() from public, anon, authenticated;

create trigger salons_assign_code
  before insert on public.salons
  for each row execute function public.salons_assign_code();

-- 旧ポリシー「サロン作成」(認証済みなら誰でも直接INSERT可)は、create_salon() RPCがあるため不要。
-- 残すと任意のサロンID・状態でサロンを直接作られるため削除する（アプリのコードに直接INSERTはない）。
drop policy if exists "サロン作成" on public.salons;
revoke insert on public.salons from anon, authenticated;

-- ---- profiles ----
alter table public.profiles
  add column login_id text,
  add column password_changed_at timestamptz,
  add column last_login_at timestamptz,
  add column last_login_method text check (last_login_method in ('salon_id', 'legacy_email')),
  add column deactivated_at timestamptz,
  add column deactivated_by uuid references public.profiles(id) on delete set null;

-- ユーザーIDは小文字で保存（入力は小文字に正規化して照合する）
alter table public.profiles
  add constraint profiles_login_id_format check (login_id is null or login_id ~ '^[a-z0-9._-]{3,32}$');
create unique index profiles_salon_login_id_key on public.profiles (salon_id, login_id) where login_id is not null;

-- 実メールなどの個人情報は、同じサロンのメンバーが読めるprofilesには置かず別テーブルにする（ポリシーなし＝service roleのみ）
create table public.profile_private (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  legacy_email text,
  contact_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profile_private enable row level security;
revoke all on public.profile_private from anon, authenticated;
create trigger profile_private_updated_at
  before update on public.profile_private
  for each row execute function public.update_updated_at_column();
