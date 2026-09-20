-- ロールバック: create_salon / accept_invitation を、以前の状態（全員が実行可）に戻す
grant execute on function public.create_salon(text) to public, anon, authenticated;
grant execute on function public.accept_invitation(text, text) to public, anon, authenticated;
