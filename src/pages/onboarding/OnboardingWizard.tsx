import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { v1OnboardingCreateMutation } from '../../client/@tanstack/react-query.gen'
import type { OnboardingRequestWritable } from '../../client/types.gen'
import { Button } from '../../components/ui/Button'
import { CompanyStep, type CompanyStepValues } from './steps/CompanyStep'
import { BranchesStep, type BranchesStepValues } from './steps/BranchesStep'
import { EmployeesStep, type EmployeesStepValues } from './steps/EmployeesStep'
import { ReviewStep } from './steps/ReviewStep'
import { buildOnboardingPayload, mapOnboardingErrors } from './onboardingPayload'

/**
 * The wizard shell (design.md D-C / Requirement "Four-Step Wizard").
 *
 * DEVIATION FROM design.md, flagged not silently made: D-C describes one
 * `useForm` over a merged schema, advancing via `trigger([...stepFields])`.
 * Phase 4 built `CompanyStep`/`BranchesStep` SELF-CONTAINED (own `useForm`,
 * own schema, `onNext(values)` callback) so each step is independently
 * testable without this shell existing. Phase 5 continues that pattern
 * (accumulate-per-step) rather than refactoring those already-tested
 * components onto `FormProvider`/`useFormContext()`: it keeps Phase 4's
 * test suite untouched (zero regression risk) and satisfies "backward
 * navigation preserves in-memory data" for free — going back simply
 * re-renders the previous step with `defaultValues` sourced from this
 * shell's own accumulated state, no `trigger()` gating needed since each
 * step already self-validates via its own `zodResolver` before calling
 * `onNext`.
 *
 * No `localStorage`/`sessionStorage` write anywhere (Requirement: "No
 * Client-Side Wizard Persistence") — state lives only in this component's
 * `useState`, so a refresh restarts at step 1 with nothing recoverable.
 */
type WizardStep = 1 | 2 | 3 | 4

interface SubmitErrorEntry {
  path: string
  message: string
}

export default function OnboardingWizard() {
  const navigate = useNavigate()
  const [step, setStep] = useState<WizardStep>(1)
  const [company, setCompany] = useState<CompanyStepValues | null>(null)
  const [branches, setBranches] = useState<BranchesStepValues['branches'] | null>(null)
  const [employeesState, setEmployeesState] = useState<EmployeesStepValues | null>(null)
  const [submitErrors, setSubmitErrors] = useState<SubmitErrorEntry[]>([])

  const submitMutation = useMutation({ ...v1OnboardingCreateMutation() })

  const handleCompanyNext = (values: CompanyStepValues) => {
    setCompany(values)
    setStep(2)
  }

  const handleBranchesNext = (values: BranchesStepValues) => {
    setBranches(values.branches)
    setStep(3)
  }

  const handleEmployeesNext = (values: EmployeesStepValues) => {
    setEmployeesState(values)
    setStep(4)
  }

  const handleSubmit = async () => {
    if (!company || !branches || !employeesState) return

    setSubmitErrors([])
    const payload = buildOnboardingPayload({
      company,
      branches,
      owner: employeesState.owner,
      employees: employeesState.employees,
    })

    try {
      // Narrow cast: `buildOnboardingPayload`'s hand-written return type
      // (Phase 2) allows `company.rif: string | null` since `normalizeRif`
      // is a general-purpose function; the generated `OnboardingCompanyRequest.rif`
      // (Phase 3 regeneration) is non-nullable. In practice `rif` is never
      // null here — `CompanyStep`'s own Zod schema already rejects an empty
      // RIF before `company` state can be set (design.md D-F: required-ness
      // lives in the wizard's schema, not in the shared validator/payload
      // builder). Widening `OnboardingPayload.company.rif` itself would
      // misrepresent that function's general-purpose contract, so the
      // narrow assertion is scoped to this one call site instead.
      await submitMutation.mutateAsync({ body: payload as OnboardingRequestWritable })
      toast.success('Registro completado. Ahora puedes iniciar sesión.')
      navigate('/login')
    } catch (error) {
      const mapped = mapOnboardingErrors(error)
      const entries: SubmitErrorEntry[] = []
      mapped.setErrors((path, { message }) => {
        entries.push({ path, message })
      })
      setSubmitErrors(entries)
      setStep(Math.min(mapped.lowestStep, 4) as WizardStep)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <h2 className="text-center text-3xl font-extrabold text-gray-900">Registra tu Empresa</h2>
        <p className="mt-2 text-center text-sm text-gray-600">Paso {step} de 4</p>

        {submitErrors.length > 0 && (
          <div
            role="alert"
            className="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700"
          >
            <p>No se pudo completar el registro. Revisa los datos e intenta de nuevo.</p>
            <ul className="mt-1 list-disc pl-5">
              {submitErrors.map((entry) => (
                <li key={entry.path}>{entry.message}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 rounded-lg bg-white p-6 shadow sm:p-8">
          {step === 1 && <CompanyStep defaultValues={company ?? undefined} onNext={handleCompanyNext} />}

          {step === 2 && (
            <div className="space-y-4">
              <BranchesStep
                defaultValues={branches ? { branches } : undefined}
                onNext={handleBranchesNext}
              />
              <Button type="button" variant="outline" onClick={() => setStep(1)}>
                Atrás
              </Button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <EmployeesStep
                branches={branches ?? []}
                defaultValues={employeesState ?? undefined}
                onNext={handleEmployeesNext}
              />
              <Button type="button" variant="outline" onClick={() => setStep(2)}>
                Atrás
              </Button>
            </div>
          )}

          {step === 4 && company && branches && employeesState && (
            <ReviewStep
              company={company}
              branches={branches}
              owner={employeesState.owner}
              employees={employeesState.employees}
              onSubmit={handleSubmit}
              onBack={() => setStep(3)}
              isSubmitting={submitMutation.isPending}
            />
          )}
        </div>
      </div>
    </div>
  )
}
