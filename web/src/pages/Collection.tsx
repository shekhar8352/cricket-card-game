import { useDeferredValue, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { PlayerCard } from '../components/card/PlayerCard'
import { CardDetail } from '../components/card/CardDetail'
import { Button } from '../components/ui/button'
import { Choice, EmptyState, PageHeader, controlClass } from '../components/ui/chrome'
import { ROLE_LABEL } from '../lib/labels'
import { cn } from '../lib/cn'
import type { PlayerCard as Card, Role, Rarity } from '../types/engine'

export function CollectionPage() {
  const q = useQuery({ queryKey: ['cards'], queryFn: api.cards })
  const [role, setRole] = useState<Role | ''>('')
  const [rarity, setRarity] = useState<Rarity | ''>('')
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [sort, setSort] = useState<'overall' | 'level' | 'newest'>('overall')
  const [sel, setSel] = useState<Card | null>(null)

  const list = useMemo(() => {
    let items = [...(q.data ?? [])]
    if (role) items = items.filter((c) => c.role === role)
    if (rarity) items = items.filter((c) => c.rarity === rarity)
    const query = deferredSearch.trim().toLowerCase()
    if (query) items = items.filter((c) => c.name.toLowerCase().includes(query) || c.country.toLowerCase().includes(query))
    items.sort((a, b) => {
      if (sort === 'overall') return b.overall - a.overall
      if (sort === 'level') return b.level - a.level
      return (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
    })
    const groups = new Map<string, { card: Card; n: number }>()
    for (const c of items) {
      const k = `${c.playerId}-${c.rarity}-${c.level}`
      const g = groups.get(k)
      if (g) g.n++
      else groups.set(k, { card: c, n: 1 })
    }
    return [...groups.values()]
  }, [q.data, role, rarity, deferredSearch, sort])

  const filtersOn = !!(role || rarity || search)

  return (
    <div>
      <PageHeader title="Collection" lede="Tap a card to see ratings and send that player to training." />
      <div className="space-y-3 mb-5">
        <div>
          <label htmlFor="card-search" className="font-medium">Search</label>
          <input id="card-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or country" className={cn(controlClass, 'w-full max-w-sm mt-1')} />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Role">
          <Choice pressed={role === ''} onClick={() => setRole('')}>All roles</Choice>
          {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
            <Choice key={r} pressed={role === r} onClick={() => setRole(r)}>{ROLE_LABEL[r]}</Choice>
          ))}
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Rarity">
          <Choice pressed={rarity === ''} onClick={() => setRarity('')}>All rarities</Choice>
          {(['Bronze', 'Silver', 'Gold', 'Legend'] as Rarity[]).map((r) => (
            <Choice key={r} pressed={rarity === r} onClick={() => setRarity(r)}>{r}</Choice>
          ))}
        </div>
        <div>
          <label htmlFor="card-sort" className="font-medium">Sort</label>
          <select id="card-sort" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className={cn(controlClass, 'mt-1 cursor-pointer')}>
            <option value="overall">Overall rating</option>
            <option value="level">Level</option>
            <option value="newest">Newest</option>
          </select>
        </div>
      </div>
      <p className="text-muted mb-3">{q.isPending ? 'Loading cards…' : `${list.length} card${list.length === 1 ? '' : 's'}`}</p>
      {!q.isPending && list.length === 0 ? (
        <EmptyState
          title={filtersOn ? 'No cards match' : 'Your collection is empty'}
          body={filtersOn ? 'Clear the filters to see every player you own.' : 'Play a match to earn more cards.'}
          action={filtersOn ? <Button variant="outline" onClick={() => { setRole(''); setRarity(''); setSearch('') }}>Clear filters</Button> : undefined}
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {list.map(({ card, n }) => (
            <div key={card.id} className="relative">
              <PlayerCard card={card} className="w-full max-w-none" onClick={() => setSel(card)} />
              {n > 1 && <span className="absolute top-2 right-2 bg-fg text-bg text-xs font-semibold px-2 py-0.5 rounded-full">×{n}</span>}
            </div>
          ))}
        </div>
      )}
      <CardDetail card={sel} open={!!sel} onOpenChange={(o) => !o && setSel(null)} />
    </div>
  )
}
