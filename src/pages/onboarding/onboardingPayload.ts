/**
 * Onboarding wizard domain logic: mapping `/v1/onboarding/` error responses
 * back onto form fields, and building the exact request payload.
 *
 * Typed against hand-written interfaces matching the design's verified
 * payload shape (`design.md`'s "Exact `/v1/onboarding/` payload" section).
 *
 * Reconciliation against generated types (tasks.md 3.5, done in Phase 4):
 * `src/client/types.gen.ts`'s `V1OnboardingCreateData` types `body` as
 * `never` — `schema.yml`'s `/v1/onboarding/` POST operation has NO
 * `requestBody` section at all (verified by reading `schema.yml` directly),
 * only a bodyless `responses: { '200': { description: 'No response body' } }`.
 * This is a backend/`drf-spectacular` documentation gap, not a divergence in
 * these hand-written interfaces: the payload shape below was independently
 * verified against the backend's actual `OnboardingSerializer`, not against
 * `schema.yml`. There is nothing generated to reconcile these interfaces
 * against, so they are kept AS-IS. Consequence for Phase 5: calling
 * `v1OnboardingCreate`/`v1OnboardingCreateMutation` with a real `body` will
 * fail type-checking until the backend's OpenAPI schema documents a request
 * body for this operation — out of scope for this frontend change (never
 * hand-edit `src/client/**` or `schema.yml`).
 */

import { normalizeRif } from '../../lib/rif';

/**
 * The default wizard step for an error section this mapper doesn't
 * recognize. Falls to the review step (4) rather than being silently
 * dropped, since review renders every field and is always reachable.
 */
const DEFAULT_STEP = 4;

const STEP_BY_SECTION: Record<string, number> = {
  company: 1,
  branches: 2,
  employees: 3,
  owner: 1,
};

export type SetFieldError = (name: string, error: { message: string }) => void;

export interface MappedOnboardingErrors {
  /** Applies every mapped error via the caller's `setError` (e.g. RHF's). */
  setErrors: (setError: SetFieldError) => void;
  /** The lowest wizard step carrying an error, so the wizard can jump there. */
  lowestStep: number;
}

interface MappedErrorEntry {
  path: string;
  message: string;
  step: number;
}

/**
 * `/v1/onboarding/` returns error bodies in one of four shapes depending on
 * where validation failed:
 *  - DRF's own field validation: a POSITIONAL ARRAY (`employees: [{}, {...}]`).
 *  - The endpoint's `validate()`/`create()`: an OBJECT keyed by a
 *    STRINGIFIED index (`employees: {"1": {...}}`).
 *  - A flat OBJECT keyed by field name (`company: {"rif": "..."}`).
 *  - A BARE STRING for a form-level error with no single field
 *    (`branches: "Duplicate branch name..."`).
 * This function normalizes all four into one flat list of field paths.
 */
export function mapOnboardingErrors(body: unknown): MappedOnboardingErrors {
  const entries: MappedErrorEntry[] = [];
  const push = (path: string, message: string, step: number): void => {
    entries.push({ path, message, step });
  };

  if (body && typeof body === 'object') {
    for (const [section, value] of Object.entries(body as Record<string, unknown>)) {
      const step = STEP_BY_SECTION[section] ?? DEFAULT_STEP;
      collectSectionErrors(section, value, step, push);
    }
  }

  const lowestStep =
    entries.length > 0 ? Math.min(...entries.map((entry) => entry.step)) : DEFAULT_STEP;

  return {
    lowestStep,
    setErrors(setError) {
      for (const entry of entries) {
        setError(entry.path, { message: entry.message });
      }
    },
  };
}

function collectSectionErrors(
  section: string,
  value: unknown,
  step: number,
  push: (path: string, message: string, step: number) => void,
): void {
  // Bare-string shape: a form-level error for the whole section.
  if (typeof value === 'string') {
    push(section, value, step);
    return;
  }

  // DRF positional-array shape: array index IS the item position.
  if (Array.isArray(value)) {
    value.forEach((itemErrors, index) => {
      collectFieldErrors(`${section}.${index}`, itemErrors, step, push);
    });
    return;
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (isStringifiedIndexObject(record)) {
      // Endpoint validate()/create() shape: object keyed by stringified index.
      for (const [index, itemErrors] of Object.entries(record)) {
        collectFieldErrors(`${section}.${index}`, itemErrors, step, push);
      }
    } else {
      // Flat field -> message object (e.g. company.rif).
      collectFieldErrors(section, record, step, push);
    }
  }
}

function collectFieldErrors(
  pathPrefix: string,
  value: unknown,
  step: number,
  push: (path: string, message: string, step: number) => void,
): void {
  if (!value || typeof value !== 'object') return;

  for (const [field, fieldValue] of Object.entries(value as Record<string, unknown>)) {
    const message = extractMessage(fieldValue);
    if (message) push(`${pathPrefix}.${field}`, message, step);
  }
}

function isStringifiedIndexObject(record: Record<string, unknown>): boolean {
  const keys = Object.keys(record);
  return keys.length > 0 && keys.every((key) => /^\d+$/.test(key));
}

/** DRF wraps messages in an array of strings; the endpoint sends a bare string. */
function extractMessage(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return null;
}

// ---------------------------------------------------------------------------
// Payload construction
// ---------------------------------------------------------------------------

export interface OnboardingCompanyFormValues {
  name: string;
  email: string;
  rif: string | null;
  fiscal_state: string;
  fiscal_city: string;
  fiscal_municipality: string;
  fiscal_street: string;
  fiscal_postal_code?: string;
}

export interface OnboardingBranchFormValues {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
}

export interface OnboardingOwnerFormValues {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  username: string;
}

export interface OnboardingEmployeeFormValues extends OnboardingOwnerFormValues {
  /** Array position of the branch this employee belongs to — not a persisted id. */
  branch_index: number;
}

export interface OnboardingFormValues {
  company: OnboardingCompanyFormValues;
  branches: OnboardingBranchFormValues[];
  owner: OnboardingOwnerFormValues;
  employees: OnboardingEmployeeFormValues[];
}

export interface OnboardingPayload {
  company: OnboardingCompanyFormValues;
  branches: OnboardingBranchFormValues[];
  owner: OnboardingOwnerFormValues;
  employees: OnboardingEmployeeFormValues[];
}

/**
 * Builds the exact `/v1/onboarding/` request body from the wizard's form
 * state. Normalizes `company.rif` so a lowercase `j-...` entry never
 * diverges from the value the server stores.
 */
export function buildOnboardingPayload(formValues: OnboardingFormValues): OnboardingPayload {
  return {
    company: {
      ...formValues.company,
      rif: normalizeRif(formValues.company.rif),
    },
    branches: formValues.branches.map((branch) => ({ ...branch })),
    owner: { ...formValues.owner },
    employees: formValues.employees.map((employee) => ({ ...employee })),
  };
}

/**
 * Recomputes `branch_index` for every employee after the branch at
 * `removedIndex` is deleted from the branches array. Employees pointing
 * strictly past the removed position shift down by one; employees pointing
 * AT the removed position are clamped to the last remaining valid index so
 * no employee is left referencing a branch that no longer exists.
 */
export function reindexEmployeesAfterBranchRemoval<T extends { branch_index: number }>(
  employees: T[],
  removedIndex: number,
  remainingBranchCount: number,
): T[] {
  const maxValidIndex = Math.max(0, remainingBranchCount - 1);

  return employees.map((employee) => {
    if (employee.branch_index === removedIndex) {
      return { ...employee, branch_index: Math.min(removedIndex, maxValidIndex) };
    }
    if (employee.branch_index > removedIndex) {
      return { ...employee, branch_index: Math.min(employee.branch_index - 1, maxValidIndex) };
    }
    return employee;
  });
}
