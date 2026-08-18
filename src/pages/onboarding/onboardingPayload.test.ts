import { describe, it, expect, vi } from 'vitest';
import {
  mapOnboardingErrors,
  buildOnboardingPayload,
  reindexEmployeesAfterBranchRemoval,
  type OnboardingFormValues,
} from './onboardingPayload';

describe('mapOnboardingErrors', () => {
  it('maps the DRF positional-array shape to the field path and step 3', () => {
    const body = { employees: [{}, { email: ['Enter a valid email address.'] }] };

    const { setErrors, lowestStep } = mapOnboardingErrors(body);
    const setError = vi.fn();
    setErrors(setError);

    expect(setError).toHaveBeenCalledWith('employees.1.email', {
      message: 'Enter a valid email address.',
    });
    expect(lowestStep).toBe(3);
  });

  it('maps the stringified-index object shape to the field path and step 3', () => {
    const body = { employees: { '1': { branch_index: 'Branch index out of range.' } } };

    const { setErrors, lowestStep } = mapOnboardingErrors(body);
    const setError = vi.fn();
    setErrors(setError);

    expect(setError).toHaveBeenCalledWith('employees.1.branch_index', {
      message: 'Branch index out of range.',
    });
    expect(lowestStep).toBe(3);
  });

  it('maps the keyed-object company shape to the field path and step 1', () => {
    const body = { company: { rif: 'This rif is already in use.' } };

    const { setErrors, lowestStep } = mapOnboardingErrors(body);
    const setError = vi.fn();
    setErrors(setError);

    expect(setError).toHaveBeenCalledWith('company.rif', {
      message: 'This rif is already in use.',
    });
    expect(lowestStep).toBe(1);
  });

  it('maps the bare-string branches shape to a form-level error on step 2', () => {
    const body = { branches: 'Duplicate branch name in this request.' };

    const { setErrors, lowestStep } = mapOnboardingErrors(body);
    const setError = vi.fn();
    setErrors(setError);

    expect(setError).toHaveBeenCalledWith('branches', {
      message: 'Duplicate branch name in this request.',
    });
    expect(lowestStep).toBe(2);
  });

  it('returns the lowest step when errors span multiple steps', () => {
    const body = {
      employees: [{}, { email: ['Enter a valid email address.'] }],
      company: { rif: 'This rif is already in use.' },
    };

    const { lowestStep } = mapOnboardingErrors(body);

    expect(lowestStep).toBe(1);
  });
});

function buildFormValues(
  overrides: Partial<OnboardingFormValues> = {},
): OnboardingFormValues {
  return {
    company: {
      name: 'Panadería Central',
      email: 'panaderia@example.com',
      rif: 'j-00123072-6',
      fiscal_state: 'Miranda',
      fiscal_city: 'Los Teques',
      fiscal_municipality: 'Guaicaipuro',
      fiscal_street: 'Av. Bermúdez',
    },
    branches: [{ name: 'Sucursal 1' }, { name: 'Sucursal 2' }],
    owner: {
      email: 'owner@example.com',
      password: 'S3cret!!',
      first_name: 'Ana',
      last_name: 'Pérez',
      username: 'ana',
    },
    employees: [
      {
        email: 'emp0@example.com',
        password: 'S3cret!!',
        first_name: 'Luis',
        last_name: 'Gómez',
        username: 'luis',
        branch_index: 0,
      },
      {
        email: 'emp1@example.com',
        password: 'S3cret!!',
        first_name: 'Marta',
        last_name: 'Díaz',
        username: 'marta',
        branch_index: 1,
      },
    ],
    ...overrides,
  };
}

describe('buildOnboardingPayload', () => {
  it('reflects each employee\'s branch_index by array position at build time', () => {
    const payload = buildOnboardingPayload(buildFormValues());

    expect(payload.employees[0].branch_index).toBe(0);
    expect(payload.employees[1].branch_index).toBe(1);
  });

  it('normalizes company.rif to its trimmed, upper-cased form', () => {
    const payload = buildOnboardingPayload(buildFormValues());

    expect(payload.company.rif).toBe('J-00123072-6');
  });

  it('carries branches, owner, and all employee fields through unchanged', () => {
    const formValues = buildFormValues();
    const payload = buildOnboardingPayload(formValues);

    expect(payload.branches).toEqual(formValues.branches);
    expect(payload.owner).toEqual(formValues.owner);
    expect(payload.employees[0].email).toBe('emp0@example.com');
  });
});

describe('reindexEmployeesAfterBranchRemoval', () => {
  it('re-indexes an employee pointing past the removed branch down by one', () => {
    const employees = [{ id: 'a', branch_index: 1 }];

    const result = reindexEmployeesAfterBranchRemoval(employees, 0, 1);

    expect(result[0].branch_index).toBe(0);
  });

  it('clamps an employee pointing at the removed branch to the last remaining index', () => {
    const employees = [{ id: 'a', branch_index: 1 }];

    const result = reindexEmployeesAfterBranchRemoval(employees, 1, 1);

    expect(result[0].branch_index).toBe(0);
  });

  it('leaves an employee pointing before the removed branch untouched', () => {
    const employees = [{ id: 'a', branch_index: 0 }];

    const result = reindexEmployeesAfterBranchRemoval(employees, 1, 1);

    expect(result[0].branch_index).toBe(0);
  });

  it('never leaves a dangling branch_index across a mixed set of employees', () => {
    const employees = [
      { id: 'kept-before', branch_index: 0 },
      { id: 'removed-target', branch_index: 0 },
      { id: 'shifts-down', branch_index: 1 },
    ];

    const result = reindexEmployeesAfterBranchRemoval(employees, 0, 1);

    expect(result.map((e) => e.branch_index)).toEqual([0, 0, 0]);
    expect(result.every((e) => e.branch_index < 1)).toBe(true);
  });
});
