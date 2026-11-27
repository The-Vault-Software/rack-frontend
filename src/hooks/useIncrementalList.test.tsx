import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { useIncrementalList } from './useIncrementalList'

// jsdom has no IntersectionObserver: capture the callbacks to fire them by hand.
let observers: { cb: IntersectionObserverCallback; disconnected: boolean }[] = []
class FakeObserver {
  entry: { cb: IntersectionObserverCallback; disconnected: boolean }
  constructor(cb: IntersectionObserverCallback) { this.entry = { cb, disconnected: false }; observers.push(this.entry) }
  observe() {}
  disconnect() { this.entry.disconnected = true }
}

function reachSentinel() {
  const live = observers.filter((o) => !o.disconnected)
  act(() => live.forEach((o) => o.cb([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)))
}

function List({ items, search }: { items: number[]; search?: string }) {
  const { visibleItems, hasMore, sentinelRef } = useIncrementalList(items, 30, search)
  return (
    <div>
      <span data-testid="count">{visibleItems.length}</span>
      {hasMore && <div ref={sentinelRef} data-testid="sentinel" />}
    </div>
  )
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i)

describe('useIncrementalList', () => {
  beforeEach(() => { observers = []; vi.stubGlobal('IntersectionObserver', FakeObserver) })
  afterEach(() => vi.unstubAllGlobals())

  it('shows the first page and adds a page each time the end comes into view, until all are shown', () => {
    render(<List items={range(72)} />)
    expect(screen.getByTestId('count')).toHaveTextContent('30')

    reachSentinel()
    expect(screen.getByTestId('count')).toHaveTextContent('60')

    reachSentinel()
    expect(screen.getByTestId('count')).toHaveTextContent('72')
    expect(screen.queryByTestId('sentinel')).toBeNull()
  })

  it('does not cap search results (they used to stop at 50)', () => {
    render(<List items={range(60)} search="producto" />)
    reachSentinel()
    expect(screen.getByTestId('count')).toHaveTextContent('60')
  })

  it('goes back to the first page when the search changes', () => {
    const { rerender } = render(<List items={range(72)} search="" />)
    reachSentinel()
    expect(screen.getByTestId('count')).toHaveTextContent('60')

    rerender(<List items={range(72)} search="arroz" />)
    expect(screen.getByTestId('count')).toHaveTextContent('30')
  })

  it('shows short lists whole, with no sentinel', () => {
    render(<List items={range(12)} />)
    expect(screen.getByTestId('count')).toHaveTextContent('12')
    expect(screen.queryByTestId('sentinel')).toBeNull()
  })
})
