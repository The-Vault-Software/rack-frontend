import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'

// Vitest globals are disabled, so Testing Library's automatic cleanup
// does not register itself. Unmount rendered trees between tests.
afterEach(() => {
  cleanup()
})

// The default 1000ms `findBy*`/`waitFor` polling timeout is tight enough
// to flake under CPU contention when the full suite runs with file
// parallelism (`npm test`, no isolation flag) — observed directly: the
// same async wizard tests pass 100% of the time in isolation or with
// `--no-file-parallelism`, and intermittently time out only when all 12
// test files race for CPU together. Widening the timeout, not the
// assertions, fixes the flake at its actual cause.
configure({ asyncUtilTimeout: 5000 })
