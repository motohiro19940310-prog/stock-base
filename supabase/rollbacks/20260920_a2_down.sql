-- A2 ロールバック: 登録リンクの表示名列を削除（未使用リンクの名前は失われるだけ。登録済みユーザーのprofilesには影響しない）
alter table public.credential_links drop column if exists display_name;
