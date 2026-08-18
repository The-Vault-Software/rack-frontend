import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { createClient, createConfig } from '../client/client'
import { registerInterceptors } from './apiInterceptors'
import { isLicenseInactive, resetLicenseGate, setLicenseRedirector } from './licenseGate'

function freshClient() {
  return createClient(createConfig({ baseUrl: 'http://localhost' }))
}

function mockLocation(pathname: string) {
  const hrefSetter = vi.fn()
  const location = {
    pathname,
    set href(value: string) {
      hrefSetter(value)
    },
  }
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: location,
  })
  return { hrefSetter }
}

const originalLocation = window.location

afterEach(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: originalLocation,
  })
})

describe('registerInterceptors — 401 regression (current contract, must not change)', () => {
  beforeEach(() => {
    resetLicenseGate()
    setLicenseRedirector(() => {})
    mockLocation('/dashboard')
  })

  it('refreshes the token and retries the original request on a 401', async () => {
    const client = freshClient()
    const queryClient = new QueryClient()
    registerInterceptors(client, queryClient)

    const fetchMock = vi.fn()
    fetchMock.mockImplementationOnce(
      async () => new Response(JSON.stringify({ detail: 'unauthorized' }), { status: 401 }),
    )
    fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify({}), { status: 200 }))
    fetchMock.mockImplementationOnce(
      async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    )
    client.setConfig({ fetch: fetchMock })

    const result = await client.get<{ ok: boolean }>({ url: '/v1/protected/' })

    expect(result.response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('redirects to /login when refresh fails and the user is not already on /login or /register', async () => {
    const client = freshClient()
    const queryClient = new QueryClient()
    registerInterceptors(client, queryClient)
    const { hrefSetter } = mockLocation('/dashboard')

    const fetchMock = vi.fn()
    fetchMock.mockImplementationOnce(
      async () => new Response(JSON.stringify({ detail: 'unauthorized' }), { status: 401 }),
    )
    fetchMock.mockImplementationOnce(
      async () => new Response(JSON.stringify({ detail: 'refresh failed' }), { status: 401 }),
    )
    client.setConfig({ fetch: fetchMock })

    await client.get({ url: '/v1/protected/' })

    expect(hrefSetter).toHaveBeenCalledTimes(1)
    expect(hrefSetter).toHaveBeenCalledWith('/login')
  })

  it('does not redirect when refresh fails while already on /login', async () => {
    const client = freshClient()
    const queryClient = new QueryClient()
    registerInterceptors(client, queryClient)
    const { hrefSetter } = mockLocation('/login')

    const fetchMock = vi.fn()
    fetchMock.mockImplementationOnce(
      async () => new Response(JSON.stringify({ detail: 'unauthorized' }), { status: 401 }),
    )
    fetchMock.mockImplementationOnce(
      async () => new Response(JSON.stringify({ detail: 'refresh failed' }), { status: 401 }),
    )
    client.setConfig({ fetch: fetchMock })

    await client.get({ url: '/v1/protected/' })

    expect(hrefSetter).not.toHaveBeenCalled()
  })
})

describe('registerInterceptors — 402 licence handling', () => {
  beforeEach(() => {
    resetLicenseGate()
    setLicenseRedirector(() => {})
    mockLocation('/dashboard')
  })

  it('latches on a 402 from any request and never calls the refresh endpoint', async () => {
    const client = freshClient()
    const queryClient = new QueryClient()
    registerInterceptors(client, queryClient)

    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ detail: 'Company license has expired.' }), { status: 402 }),
    )
    client.setConfig({ fetch: fetchMock })

    await client.get({ url: '/v1/products/' })

    expect(isLicenseInactive()).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('routes a 402 received during refresh to the licence path without retrying or redirecting to /login', async () => {
    const client = freshClient()
    const queryClient = new QueryClient()
    registerInterceptors(client, queryClient)
    const { hrefSetter } = mockLocation('/dashboard')

    const fetchMock = vi.fn()
    fetchMock.mockImplementationOnce(
      async () => new Response(JSON.stringify({ detail: 'unauthorized' }), { status: 401 }),
    )
    fetchMock.mockImplementationOnce(
      async () => new Response(JSON.stringify({ detail: 'Company license has expired.' }), { status: 402 }),
    )
    client.setConfig({ fetch: fetchMock })

    await client.get({ url: '/v1/protected/' })

    expect(isLicenseInactive()).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(hrefSetter).not.toHaveBeenCalled()
  })
})
