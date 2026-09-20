-- A2: 登録リンクに「お名前（表示名）」を持たせる。発行する管理者が漢字フルネームを入れ、本人の登録画面に反映する（追加のみ）
alter table public.credential_links
  add column display_name text check (display_name is null or char_length(display_name) between 1 and 50);
