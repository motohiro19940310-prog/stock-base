type Person = { full_name: string | null; display_name: string | null }

// stock_logs.user_id(操作者)の表示名。古い履歴(user_id未記録)はnull。
export function operatorName(p: Person | Person[] | null | undefined): string | null {
  const person = Array.isArray(p) ? p[0] : p
  return person?.full_name ?? person?.display_name ?? null
}
