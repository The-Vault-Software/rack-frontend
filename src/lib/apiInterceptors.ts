import type { QueryClient } from '@tanstack/react-query';
import type { Client } from '../client/client';
import { v1RefreshCreate } from '../client/sdk.gen';
import { enterLicenseInactive, isLicenseInactive } from './licenseGate';

// Extracted out of App.tsx module scope: these interceptors used to run at
// import time, mutating a global singleton client. registerInterceptors()
// makes them attachable to any client instance, which is what makes them
// testable against a fake fetch.
export function registerInterceptors(client: Client, queryClient: QueryClient): void {
  client.interceptors.request.use((request) => {
    const cookieValue = document.cookie
      .split('; ')
      .find((row) => row.startsWith('csrftoken='))
      ?.split('=')[1];

    if (cookieValue) {
      request.headers.set('X-CSRFToken', cookieValue);
    }
    return request;
  });

  client.interceptors.response.use(async (response, request, options) => {
    // A 402 (inactive licence) is terminal, not a token-expiry condition.
    // It gets its own early-return branch above the 401 branch — widening
    // the 401 gate to include 402 would route it into refresh-and-retry,
    // which is the exact defect this branch exists to fix.
    if (response.status === 402) {
      enterLicenseInactive(queryClient);
      return response;
    }

    if (response.status === 401 && !request.url.endsWith('/v1/refresh/')) {
      try {
        // Attempt to refresh the token
        await v1RefreshCreate({
          client,
          body: { refresh: '' }, // Assuming HttpOnly cookies are used, but schema requires string
          throwOnError: true,
        });

        // If refresh successful, retry original request
        const newRequest = new Request(request.url, {
          ...options,
          headers: options.headers as HeadersInit,
          body: (options.serializedBody ?? options.body) as BodyInit,
        });
        return await (options.fetch ?? fetch)(newRequest);
      } catch {
        // A 402 raised during the refresh call itself already latched
        // above (interceptors run before throwOnError's throw). An
        // inactive licence is terminal — do not bounce to /login.
        if (isLicenseInactive()) {
          return response;
        }

        // If refresh fails, redirect to login only if not already there
        if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
          window.location.href = '/login';
        }
        return response;
      }
    }
    return response;
  });
}
