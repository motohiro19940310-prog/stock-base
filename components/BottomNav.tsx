'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/dashboard', label: 'ホーム', icon: '⬡' },
  { href: '/items', label: '在庫', icon: '◫' },
  { href: '/logs', label: '履歴', icon: '≡' },
  { href: '/settings', label: '設定', icon: '◎' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-zinc-950/90 backdrop-blur-xl border-t border-zinc-800/60 flex">
      {navItems.map((item) => {
        const isActive = pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 flex flex-col items-center py-3 pb-4 text-xs font-medium transition-colors ${
              isActive ? 'text-emerald-400' : 'text-zinc-600'
            }`}
          >
            <span className={`text-lg mb-0.5 font-mono ${isActive ? 'text-emerald-400' : 'text-zinc-600'}`}>
              {item.icon}
            </span>
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
