import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Vitest globals are disabled, so Testing Library's automatic cleanup
// does not register itself. Unmount rendered trees between tests.
afterEach(() => {
  cleanup()
})
