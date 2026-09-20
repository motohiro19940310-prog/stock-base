-- A1d: 監査ログ・運営者・ログイン試行・申込・登録リンク（追加のみ）
-- 設計: §2.2 / §8 / §9 / §10 / §18

-- 監査ログ: 追記専用。サロン削除後も残すため salon_id には外部キーを張らない
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  salon_id uuid,
  actor_type text not null check (actor_type in ('salon_user', 'super_admin', 'system', 'stripe', 'anonymous')),
  actor_user_id uuid,
  actor_label text,
  action text not null,
  target_type text,
  target_id text,
  detail jsonb not null default '{}'::jsonb,
  ip text
);
create index audit_logs_salon_time_idx on public.audit_logs (salon_id, occurred_at desc);
create index audit_logs_action_idx on public.audit_logs (action, occurred_at desc);

create or replace function public.audit_logs_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_logs is append-only';
end;
$$;
create trigger audit_logs_no_update_delete
  before update or delete on public.audit_logs
  for each row execute function public.audit_logs_immutable();
create trigger audit_logs_no_truncate
  before truncate on public.audit_logs
  for each statement execute function public.audit_logs_immutable();

-- 運営者（Super Admin）。サロンのメンバーとは別枠
create table public.super_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);

-- ログインのブルートフォース対策
create table public.login_attempts (
  id uuid primary key default gen_random_uuid(),
  salon_code text,
  login_id text,
  ip text,
  success boolean not null,
  created_at timestamptz not null default now()
);
create index login_attempts_user_idx on public.login_attempts (salon_code, login_id, created_at desc);
create index login_attempts_ip_idx on public.login_attempts (ip, created_at desc);

-- 新規サロン申込の途中状態（決済完了までサロン・ユーザーは作らない）
create table public.signup_requests (
  id uuid primary key default gen_random_uuid(),
  contact_email text not null,
  salon_name text not null,
  plan_code text not null references public.plans(code),
  token_hash text unique,
  checkout_session_id text unique,
  status text not null default 'pending' check (status in ('pending', 'paid', 'provisioned', 'expired', 'failed')),
  salon_id uuid references public.salons(id) on delete set null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger signup_requests_updated_at before update on public.signup_requests
  for each row execute function public.update_updated_at_column();

-- 1回限りの登録・再設定リンク（仮パスワードの代替）。トークンはハッシュのみ保存
create table public.credential_links (
  id uuid primary key default gen_random_uuid(),
  purpose text not null check (purpose in ('setup', 'reset')),
  salon_id uuid not null references public.salons(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  role_code text references public.roles(code),
  token_hash text not null unique,
  created_by uuid references public.profiles(id) on delete set null,
  created_by_type text not null default 'salon_user' check (created_by_type in ('salon_user', 'super_admin', 'system')),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  check ((purpose = 'reset' and profile_id is not null) or (purpose = 'setup' and role_code is not null))
);
create index credential_links_salon_idx on public.credential_links (salon_id, created_at desc);

-- 全てRLS有効・ポリシーなし＝service roleのみ（audit_logsの閲覧ポリシーはA1eで追加）
alter table public.audit_logs enable row level security;
alter table public.super_admins enable row level security;
alter table public.login_attempts enable row level security;
alter table public.signup_requests enable row level security;
alter table public.credential_links enable row level security;
revoke all on public.audit_logs, public.super_admins, public.login_attempts,
  public.signup_requests, public.credential_links from anon, authenticated;
