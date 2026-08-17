import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import {
  enterLicenseInactive,
  isLicenseInactive,
  resetLicenseGate,
  setLicenseRedirector,
} from './licenseGate'

describe('licenseGate', () => {
  beforeEach(() => {
    resetLicenseGate()
  })

  it('is not inactive before enterLicenseInactive is called', () => {
    expect(isLicenseInactive()).toBe(false)
  })

  it('latches inactive, clears the query cache, and calls the injected redirector exactly once', () => {
    const redirector = vi.fn()
    setLicenseRedirector(redirector)
    const queryClient = new QueryClient()
    const clearSpy = vi.spyOn(queryClient, 'clear')

    enterLicenseInactive(queryClient)

    expect(isLicenseInactive()).toBe(true)
    expect(clearSpy).toHaveBeenCalledOnce()
    expect(redirector).toHaveBeenCalledOnce()
  })

  it('is idempotent: N concurrent calls still call the redirector exactly once', () => {
    const redirector = vi.fn()
    setLicenseRedirector(redirector)
    const queryClient = new QueryClient()
    const clearSpy = vi.spyOn(queryClient, 'clear')

    enterLicenseInactive(queryClient)
    enterLicenseInactive(queryClient)
    enterLicenseInactive(queryClient)

    expect(redirector).toHaveBeenCalledOnce()
    expect(clearSpy).toHaveBeenCalledOnce()
  })

  it('resetLicenseGate resets state for test isolation', () => {
    setLicenseRedirector(vi.fn())
    enterLicenseInactive(new QueryClient())
    expect(isLicenseInactive()).toBe(true)

    resetLicenseGate()

    expect(isLicenseInactive()).toBe(false)
  })
})
