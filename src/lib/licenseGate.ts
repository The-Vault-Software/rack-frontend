import type { QueryClient } from '@tanstack/react-query';

// The single place that knows an inactive licence is terminal. Idempotent:
// only the first caller clears the cache and navigates, so N in-flight
// requests that all resolve to a 402 produce exactly one navigation.

export type LicenseRedirector = () => void;

function defaultRedirect(): void {
  window.location.replace('/licencia-inactiva');
}

let inactive = false;
let redirect: LicenseRedirector = defaultRedirect;

export function isLicenseInactive(): boolean {
  return inactive;
}

export function setLicenseRedirector(fn: LicenseRedirector): void {
  redirect = fn;
}

export function enterLicenseInactive(queryClient: QueryClient): void {
  if (inactive) {
    return;
  }
  inactive = true;
  queryClient.clear();
  redirect();
}

// Test-only isolation hook — resets the module singleton between tests.
export function resetLicenseGate(): void {
  inactive = false;
  redirect = defaultRedirect;
}
