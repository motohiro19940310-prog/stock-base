-- A1c: 契約・課金のテーブル（追加のみ。Stripe連携はA5。ここでは器と初期データだけ）
-- 設計: §2.2 / §7

create table public.billing_accounts (
  salon_id uuid primary key references public.salons(id) on delete cascade,
  billing_mode text not null check (billing_mode in ('stripe', 'exempt')),
  stripe_customer_id text unique,
  billing_email text,
  exempt_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.plans (
  code text primary key,
  name text not null,
  interval text not null check (interval in ('month', 'year')),
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- 料金は変更できる構造。値上げ＝新しい行を追加して is_current を切り替える（既存契約は旧価格のまま）
create table public.plan_prices (
  id uuid primary key default gen_random_uuid(),
  plan_code text not null references public.plans(code),
  currency text not null default 'jpy',
  amount int not null check (amount > 0),
  tax_included boolean not null default true,
  stripe_price_id text unique,
  is_current boolean not null default true,
  valid_from timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index plan_prices_one_current_per_plan on public.plan_prices (plan_code) where is_current;

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  plan_price_id uuid not null references public.plan_prices(id),
  stripe_subscription_id text unique,
  status text not null check (status in ('incomplete', 'active', 'past_due', 'canceled', 'unpaid')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  ended_at timestamptz,
  past_due_since timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- サロンごとに「終了していない契約」は1件だけ
create unique index subscriptions_one_open_per_salon on public.subscriptions (salon_id) where ended_at is null;

-- カード番号等は保存しない。Stripe側の請求書URLのみ保持
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  stripe_invoice_id text unique,
  stripe_payment_intent_id text,
  amount int not null,
  currency text not null default 'jpy',
  status text not null check (status in ('paid', 'failed', 'open', 'refunded', 'void')),
  paid_at timestamptz,
  failure_code text,
  hosted_invoice_url text,
  created_at timestamptz not null default now()
);
create index payments_salon_created_idx on public.payments (salon_id, created_at desc);

-- Webhookの冪等性（同じイベントを2回受けても副作用は1回）と失敗の可視化
create table public.stripe_events (
  event_id text primary key,
  type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  status text not null default 'received' check (status in ('received', 'processed', 'failed')),
  error text
);

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now()
);

create trigger billing_accounts_updated_at before update on public.billing_accounts
  for each row execute function public.update_updated_at_column();
create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.update_updated_at_column();
create trigger app_settings_updated_at before update on public.app_settings
  for each row execute function public.update_updated_at_column();

-- 全てRLS有効・ポリシーなし＝service roleのみ。メンバー向けの閲覧ポリシーはA5で追加する
alter table public.billing_accounts enable row level security;
alter table public.plans enable row level security;
alter table public.plan_prices enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.stripe_events enable row level security;
alter table public.app_settings enable row level security;
revoke all on public.billing_accounts, public.plans, public.plan_prices, public.subscriptions,
  public.payments, public.stripe_events, public.app_settings from anon, authenticated;

-- ---- 初期データ ----
-- 既存サロン（Shiney）は課金対象外（運用検証サロン）
insert into public.billing_accounts (salon_id, billing_mode, exempt_reason)
select id, 'exempt', '運用検証サロン（課金対象外）' from public.salons;

insert into public.plans (code, name, interval, sort_order) values
  ('monthly', '月額プラン', 'month', 1),
  ('annual',  '年間プラン', 'year',  2);

-- 税込。stripe_price_id はA5でStripeのPrice作成後に設定
insert into public.plan_prices (plan_code, amount) values
  ('monthly', 4980),
  ('annual', 49800);

insert into public.app_settings (key, value, description) values
  ('billing.grace_days',          '7',  '決済失敗から利用制限までの猶予日数'),
  ('login.max_attempts',          '5',  'ログイン失敗の許容回数（window内）'),
  ('login.window_minutes',        '10', 'ログイン失敗を数える時間幅（分）'),
  ('login.lock_minutes',          '10', 'ロック時間（分）'),
  ('credential_link.ttl_hours',   '72', '登録・再設定リンクの有効時間（時間）');
