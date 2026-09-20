-- 誰でも（ログイン済み・未ログインを問わず）新規サロンを作れた create_salon() と、旧招待リンクの受諾 accept_invitation() を、
-- サーバー（service_role）専用にする。新規サロンは、契約フロー(A6)ができるまで作らない。
-- 権限を外すだけで、関数・データは変更しない。
revoke execute on function public.create_salon(text) from public, anon, authenticated;
revoke execute on function public.accept_invitation(text, text) from public, anon, authenticated;
grant execute on function public.create_salon(text) to service_role;
grant execute on function public.accept_invitation(text, text) to service_role;
