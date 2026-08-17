import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LicenseInactivePage from './LicenseInactivePage'

// The interceptor reaches this route via a hard `window.location.replace`
// navigation (no router state survives that), so the component never
// receives the 402 body. These two distinct `state.detail` values simulate
// "fed through the same rendering path" and prove the component does not
// even look at it — the strongest possible proof of "no detail-string
// branching in code".
function renderAt(detail: string) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/licencia-inactiva', state: { detail } }]}>
      <LicenseInactivePage />
    </MemoryRouter>,
  )
}

describe('LicenseInactivePage', () => {
  it('shows the neutral headline', () => {
    renderAt('Company license has expired.')

    expect(screen.getByText('Tu licencia no está activa')).toBeInTheDocument()
  })

  it('renders identical copy for an expired-flavored and a revoked-flavored 402 detail', () => {
    const expired = renderAt('Company license has expired.')
    const expiredText = expired.container.textContent
    expired.unmount()

    const revoked = renderAt('Company license has been revoked.')
    const revokedText = revoked.container.textContent

    expect(revokedText).toBe(expiredText)
  })

  it('provides exactly one affordance — a reachable mailto contact link — and no app navigation', () => {
    renderAt('Company license has expired.')

    const links = screen.getAllByRole('link')

    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', 'mailto:soporte@rack.app')
  })
})
