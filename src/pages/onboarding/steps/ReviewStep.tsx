import { Button } from '../../../components/ui/Button'
import type {
  OnboardingBranchFormValues,
  OnboardingCompanyFormValues,
  OnboardingEmployeeFormValues,
  OnboardingOwnerFormValues,
} from '../onboardingPayload'

/**
 * Step 4 of the onboarding wizard: read-only rendering of everything
 * entered in steps 1-3, exactly as entered — no transformation, no
 * dropped field (Requirement: "Review Step Shows Entered Data Before
 * Submit"). This component owns no form state; the shell passes down its
 * accumulated values and reads nothing back.
 */
interface ReviewStepProps {
  company: OnboardingCompanyFormValues
  branches: OnboardingBranchFormValues[]
  owner: OnboardingOwnerFormValues
  employees: OnboardingEmployeeFormValues[]
  onSubmit: () => void
  onBack: () => void
  isSubmitting?: boolean
}

/** One label/value pair — the only repeated shape in this read-only view. */
function Row({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <>
      <dt className="text-gray-500">{label}</dt>
      <dd>{value}</dd>
    </>
  )
}

export function ReviewStep({
  company,
  branches,
  owner,
  employees,
  onSubmit,
  onBack,
  isSubmitting,
}: ReviewStepProps) {
  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-sm font-semibold text-gray-700">Empresa</h3>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <Row label="Nombre" value={company.name} />
          <Row label="Email" value={company.email} />
          <Row label="RIF" value={company.rif ?? undefined} />
          <Row label="Estado" value={company.fiscal_state} />
          <Row label="Ciudad" value={company.fiscal_city} />
          <Row label="Municipio" value={company.fiscal_municipality} />
          <Row label="Calle" value={company.fiscal_street} />
          <Row label="Código Postal" value={company.fiscal_postal_code} />
        </dl>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-gray-700">Sucursales</h3>
        {branches.map((branch, index) => (
          <dl key={index} className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <Row label={`Sucursal ${index + 1}`} value={branch.name} />
            <Row label="Dirección" value={branch.address} />
          </dl>
        ))}
      </section>

      <section>
        <h3 className="text-sm font-semibold text-gray-700">Propietario</h3>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <Row label="Nombre" value={`${owner.first_name} ${owner.last_name}`} />
          <Row label="Usuario" value={owner.username} />
          <Row label="Email" value={owner.email} />
        </dl>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-gray-700">Empleados</h3>
        {employees.map((employee, index) => (
          <dl key={index} className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <Row label="Nombre" value={`${employee.first_name} ${employee.last_name}`} />
            <Row label="Usuario" value={employee.username} />
            <Row label="Email" value={employee.email} />
            <Row
              label="Sucursal"
              value={`Sucursal ${employee.branch_index + 1} - ${branches[employee.branch_index]?.name ?? ''}`}
            />
          </dl>
        ))}
      </section>

      <div className="flex justify-between gap-4">
        <Button type="button" variant="outline" onClick={onBack} disabled={isSubmitting}>
          Atrás
        </Button>
        <Button type="button" onClick={onSubmit} disabled={isSubmitting}>
          Confirmar y Enviar
        </Button>
      </div>
    </div>
  )
}
