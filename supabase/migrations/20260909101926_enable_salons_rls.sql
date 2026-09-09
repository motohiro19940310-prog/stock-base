-- salonsテーブルのRLSは「テスト用」に無効化されたまま本番運用されていた。
-- 既存のSELECT/INSERTポリシー（サロン参照・サロン作成）はRLS無効中も定義済みだが機能していなかった。
-- app/admin/page.tsx はこの直前にservice roleクライアントへ切替済みのため、
-- 全サロン横断の閲覧・更新はRLSをバイパスして継続動作する。
alter table public.salons enable row level security;
