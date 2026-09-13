-- Update1 Stage1: マルチテナントSaaS化の準備となる追加のみのスキーマ変更。
-- 既存の行・列は一切削除・変更しない。全カラムがnullable or デフォルト値ありで、
-- 既存クエリ・既存データに影響しない。

-- profiles: role列は既に存在（default 'staff'）。値の妥当性を保証するCHECKのみ追加。
-- 実データ確認済み: role in ('owner','staff') のみ、制約追加で既存行は弾かれない。
alter table public.profiles
  add constraint profiles_role_check check (role in ('owner', 'admin', 'staff'));

-- profiles: 退職者無効化のためのstatus列（今回のUpdate1の本題）。
alter table public.profiles
  add column status text not null default 'active' check (status in ('active', 'inactive'));

-- salons: サブスク課金状態の追跡用。既存のplan列（trial/free/paid）はUpdate1では残す
-- （app/admin/page.tsxが引き続き参照するため。Update2で整理予定）。
alter table public.salons
  add column subscription_status text not null default 'trial'
    check (subscription_status in ('trial', 'active', 'past_due', 'canceled')),
  add column stripe_customer_id text,
  add column stripe_subscription_id text,
  add column billing_interval text check (billing_interval in ('monthly', 'yearly')),
  add column current_period_end timestamptz,
  add column trial_ends_at timestamptz;

-- invitations: 招待者・有効期限・付与ロールを追加。
alter table public.invitations
  add column invited_by uuid references public.profiles(id),
  add column expires_at timestamptz,
  add column role text default 'staff' check (role in ('admin', 'staff'));

-- 既発行・未使用の招待リンクを突然無効化しないよう、30日の猶予でバックフィル。
update public.invitations
  set expires_at = now() + interval '30 days'
  where expires_at is null and used_at is null;
