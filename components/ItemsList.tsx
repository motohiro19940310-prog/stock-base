'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Item = {
  id: string
  name: string
  category: string | null
  unit: string
  quantity: number
  alert_threshold: number
  is_pinned: boolean
}

const DELETE_WIDTH = 80

function SwipeItem({
  item,
  isDragging,
  isDragOver,
  onDragHandleStart,
  onPinToggle,
  onDelete,
}: {
  item: Item
  isDragging: boolean
  isDragOver: boolean
  onDragHandleStart: (e: React.TouchEvent | React.MouseEvent) => void
  onPinToggle: () => void
  onDelete: () => void
}) {
  const router = useRouter()
  const [offsetX, setOffsetX] = useState(0)
  const [deleting, setDeleting] = useState(false)
  const startX = useRef(0)
  const startY = useRef(0)
  const swiping = useRef(false)

  const isLow = item.quantity <= item.alert_threshold
  const isSwiped = offsetX <= -(DELETE_WIDTH - 5)

  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX
    startY.current = e.touches[0].clientY
    swiping.current = false
  }

  function onTouchMove(e: React.TouchEvent) {
    const dx = e.touches[0].clientX - startX.current
    const dy = e.touches[0].clientY - startY.current
    if (!swiping.current && Math.abs(dy) > Math.abs(dx)) return
    swiping.current = true
    if (dx > 0) { setOffsetX(0); return }
    setOffsetX(Math.max(dx, -DELETE_WIDTH))
  }

  function onTouchEnd() {
    snap(offsetX)
    swiping.current = false
  }

  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    startX.current = e.clientX
    swiping.current = false
    let latest = offsetX

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX.current
      if (!swiping.current && Math.abs(dx) > 8) swiping.current = true
      if (!swiping.current) return
      const next = Math.max(Math.min(dx, 0), -DELETE_WIDTH)
      latest = next
      setOffsetX(next)
    }
    const onUp = () => {
      snap(latest)
      setTimeout(() => { swiping.current = false }, 50)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  function snap(v: number) {
    setOffsetX(v < -(DELETE_WIDTH / 2) ? -DELETE_WIDTH : 0)
  }

  async function handleDelete() {
    setDeleting(true)
    const supabase = createClient()
    await supabase.from('items').delete().eq('id', item.id)
    onDelete()
  }

  return (
    <div
      className={`relative rounded-xl overflow-hidden transition-opacity duration-150 ${
        isDragging ? 'opacity-30' : 'opacity-100'
      } ${isDragOver ? 'ring-2 ring-emerald-500 ring-offset-2 ring-offset-zinc-950' : ''}`}
    >
      {/* 削除ボタン */}
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="absolute right-0 top-0 bottom-0 w-20 bg-red-500 flex items-center justify-center active:bg-red-600 z-0"
      >
        <span className="text-white text-xs font-bold">{deleting ? '...' : '削除'}</span>
      </button>

      {/* カード */}
      <div
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: swiping.current ? 'none' : 'transform 0.2s ease',
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        className="flex items-center bg-zinc-900 border border-zinc-800/60 relative z-10 select-none rounded-xl"
      >
        {/* ドラッグハンドル */}
        <div
          onTouchStart={onDragHandleStart}
          onMouseDown={(e) => { e.stopPropagation(); onDragHandleStart(e) }}
          className="flex items-center justify-center w-10 self-stretch text-zinc-600 cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
        >
          <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
            <circle cx="3" cy="2" r="1.5" /><circle cx="7" cy="2" r="1.5" />
            <circle cx="3" cy="7" r="1.5" /><circle cx="7" cy="7" r="1.5" />
            <circle cx="3" cy="12" r="1.5" /><circle cx="7" cy="12" r="1.5" />
          </svg>
        </div>

        <Link
          href={`/items/${item.id}`}
          onClick={(e) => { if (isSwiped || swiping.current) { e.preventDefault(); setOffsetX(0) } }}
          className="flex flex-1 items-center justify-between px-3 py-4 active:bg-zinc-800 min-w-0 rounded-r-xl"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {isLow && (
                <span className="text-xs bg-red-500/15 text-red-400 px-2 py-0.5 rounded-full flex-shrink-0 font-medium">残少</span>
              )}
              <p className="font-medium text-white truncate text-sm">{item.name}</p>
            </div>
            <p className="text-xs text-zinc-500 mt-1">{item.category ?? '未分類'}</p>
          </div>
          <div className="flex items-center gap-2 ml-3 flex-shrink-0">
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onPinToggle() }}
              className={`text-lg leading-none transition-colors ${item.is_pinned ? 'text-amber-400' : 'text-zinc-700 active:text-amber-400'}`}
            >
              ★
            </button>
            <div className="text-right">
              <p className={`font-bold text-xl ${isLow ? 'text-red-400' : 'text-white'}`}>{item.quantity}</p>
              <p className="text-xs text-zinc-600">{item.unit}</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  )
}

export default function ItemsList({ items: initialItems, onMutate }: { items: Item[]; onMutate?: () => void }) {
  const router = useRouter()
  const refresh = () => { if (onMutate) onMutate(); else router.refresh() }
  const [items, setItems] = useState(initialItems)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
  const draggingRef = useRef<number | null>(null)
  const dragOverRef = useRef<number | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const categories = Array.from(new Set(items.map((i) => i.category).filter(Boolean))) as string[]
  const filtered = activeCategory ? items.filter((i) => i.category === activeCategory) : items

  const pinned = filtered.filter((i) => i.is_pinned)
  const regular = filtered.filter((i) => !i.is_pinned)

  async function handlePinToggle(itemId: string) {
    const supabase = createClient()
    const item = items.find((i) => i.id === itemId)
    if (!item) return
    const next = !item.is_pinned
    setItems((prev) => prev.map((i) => i.id === itemId ? { ...i, is_pinned: next } : i))
    await supabase.from('items').update({ is_pinned: next }).eq('id', itemId)
    refresh()
  }

  function getTargetIndex(clientY: number): number {
    if (!listRef.current) return 0
    const children = Array.from(listRef.current.children) as HTMLElement[]
    for (let i = 0; i < children.length; i++) {
      const rect = children[i].getBoundingClientRect()
      if (clientY < rect.top + rect.height / 2) return i
    }
    return children.length - 1
  }

  function onDragHandleStart(itemIndex: number, e: React.TouchEvent | React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    draggingRef.current = itemIndex
    dragOverRef.current = itemIndex
    setDraggingIdx(itemIndex)
    setDragOverIdx(itemIndex)

    const getClientY = (ev: TouchEvent | MouseEvent) =>
      'touches' in ev ? ev.touches[0].clientY : ev.clientY

    const onMove = (ev: TouchEvent | MouseEvent) => {
      ev.preventDefault()
      const idx = getTargetIndex(getClientY(ev))
      dragOverRef.current = idx
      setDragOverIdx(idx)
    }

    const onEnd = async () => {
      const from = draggingRef.current
      const to = dragOverRef.current

      if (from !== null && to !== null && from !== to) {
        const newItems = [...items]
        const [moved] = newItems.splice(from, 1)
        newItems.splice(to, 0, moved)
        setItems(newItems)

        const supabase = createClient()
        await Promise.all(
          newItems.map((item, idx) =>
            supabase.from('items').update({ sort_order: idx }).eq('id', item.id)
          )
        )
        refresh()
      }

      draggingRef.current = null
      dragOverRef.current = null
      setDraggingIdx(null)
      setDragOverIdx(null)

      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onEnd)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onEnd)
    }

    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('touchend', onEnd, { once: true })
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onEnd, { once: true })
  }

  const renderItem = (item: Item) => {
    const index = items.indexOf(item)
    return (
      <SwipeItem
        key={item.id}
        item={item}
        isDragging={draggingIdx === index}
        isDragOver={dragOverIdx === index && draggingIdx !== index}
        onDragHandleStart={(e) => onDragHandleStart(index, e)}
        onPinToggle={() => handlePinToggle(item.id)}
        onDelete={refresh}
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* カテゴリフィルター */}
      {categories.length > 0 && (
        <div>
          <p className="text-xs text-zinc-500 mb-2">カテゴリ</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveCategory(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                activeCategory === null
                  ? 'bg-emerald-500 text-white'
                  : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
              }`}
            >
              すべて
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                  activeCategory === cat
                    ? 'bg-emerald-500 text-white'
                    : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {pinned.length > 0 && (
        <div>
          <p className="text-xs text-amber-400/70 uppercase tracking-widest mb-2">固定</p>
          <div className="space-y-2">
            {pinned.map(renderItem)}
          </div>
        </div>
      )}

      {regular.length > 0 && (
        <div>
          {pinned.length > 0 && (
            <p className="text-xs text-zinc-600 uppercase tracking-widest mb-2">その他</p>
          )}
          <div ref={listRef} className="space-y-2">
            {regular.map(renderItem)}
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <p className="text-center text-zinc-600 text-sm py-8">該当なし</p>
      )}
    </div>
  )
}
