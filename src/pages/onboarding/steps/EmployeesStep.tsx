import { useForm, useFieldArray, type UseFormRegister } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import type { OnboardingBranchFormValues } from '../onboardingPayload'

/**
 * Step 3 of the onboarding wizard. Two sections:
 *  - The account owner's credentials. The design's payload attaches the
 *    owner to EVERY branch server-side and carries no `branch_index`
 *    (design.md D-C), so it has no branch selector here. No dedicated
 *    "owner" step exists in the spec's four named steps (company,
 *    branches, employees, review) — collecting it here, alongside the
 *    employees who DO need branch binding, is this phase's own decision;
 *    see the apply-phase report for the reasoning.
 *  - At least one additional employee, each bound to a branch by ARRAY
 *    POSITION via a `<select>` whose value is the index into the SAME
 *    submission's `branches`, never a persisted id (design.md D-C).
 */
const ownerSchema = z.object({
  email: z.string().min(1, 'Email del propietario requerido').email('Email del propietario inválido'),
  password: z.string().min(8, 'La contraseña del propietario debe tener al menos 8 caracteres'),
  first_name: z.string().min(1, 'Nombre del propietario requerido'),
  last_name: z.string().min(1, 'Apellido del propietario requerido'),
  username: z.string().min(3, 'Usuario del propietario debe tener al menos 3 caracteres'),
})

const employeeSchema = z.object({
  email: z.string().min(1, 'Email requerido').email('Email inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  first_name: z.string().min(1, 'Nombre requerido'),
  last_name: z.string().min(1, 'Apellido requerido'),
  username: z.string().min(3, 'Usuario debe tener al menos 3 caracteres'),
  branch_index: z.number({ invalid_type_error: 'Selecciona una sucursal' }),
})

/**
 * `branchCount` is a prop, not a constant, because the valid index range
 * depends on how many branches were entered in step 2 — the exact same
 * bound the backend's OnboardingSerializer enforces at submit time.
 */
// Exported for direct unit testing of the branch-index bound, same pattern
// as `cn()` in components/ui/{Input,Button}.tsx.
// eslint-disable-next-line react-refresh/only-export-components
export function buildEmployeesStepSchema(branchCount: number) {
  return z.object({
    owner: ownerSchema,
    employees: z
      .array(employeeSchema)
      .min(1, 'Se requiere al menos un empleado')
      .superRefine((employees, ctx) => {
        employees.forEach((employee, index) => {
          if (employee.branch_index < 0 || employee.branch_index >= branchCount) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'Sucursal inválida',
              path: [index, 'branch_index'],
            })
          }
        })
      }),
  })
}

export type EmployeesStepValues = z.infer<ReturnType<typeof buildEmployeesStepSchema>>

const EMPTY_OWNER = { email: '', password: '', first_name: '', last_name: '', username: '' }
const EMPTY_EMPLOYEE = { ...EMPTY_OWNER, branch_index: 0 }

/** Label + input + error paragraph, the one repeated shape in this form. */
function Field({
  id,
  label,
  error,
  children,
}: {
  id: string
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  )
}

/** The five credential fields shared by the owner and every employee row. */
function CredentialFields({
  idPrefix,
  labelSuffix,
  registerPath,
  register,
  errors,
}: {
  idPrefix: string
  labelSuffix: string
  registerPath: 'owner' | `employees.${number}`
  register: UseFormRegister<EmployeesStepValues>
  errors?: Partial<Record<'email' | 'password' | 'first_name' | 'last_name' | 'username', { message?: string }>>
}) {
  return (
    <>
      <Field id={`${idPrefix}-email`} label={`Email ${labelSuffix}`} error={errors?.email?.message}>
        <Input id={`${idPrefix}-email`} type="email" {...register(`${registerPath}.email`)} />
      </Field>
      <Field
        id={`${idPrefix}-password`}
        label={`Contraseña ${labelSuffix}`}
        error={errors?.password?.message}
      >
        <Input id={`${idPrefix}-password`} type="password" {...register(`${registerPath}.password`)} />
      </Field>
      <Field
        id={`${idPrefix}-first-name`}
        label={`Nombre ${labelSuffix}`}
        error={errors?.first_name?.message}
      >
        <Input id={`${idPrefix}-first-name`} {...register(`${registerPath}.first_name`)} />
      </Field>
      <Field
        id={`${idPrefix}-last-name`}
        label={`Apellido ${labelSuffix}`}
        error={errors?.last_name?.message}
      >
        <Input id={`${idPrefix}-last-name`} {...register(`${registerPath}.last_name`)} />
      </Field>
      <Field
        id={`${idPrefix}-username`}
        label={`Usuario ${labelSuffix}`}
        error={errors?.username?.message}
      >
        <Input id={`${idPrefix}-username`} {...register(`${registerPath}.username`)} />
      </Field>
    </>
  )
}

interface EmployeesStepProps {
  branches: OnboardingBranchFormValues[]
  defaultValues?: Partial<EmployeesStepValues>
  onNext: (values: EmployeesStepValues) => void
}

export function EmployeesStep({ branches, defaultValues, onNext }: EmployeesStepProps) {
  const schema = buildEmployeesStepSchema(branches.length)
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<EmployeesStepValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      owner: { ...EMPTY_OWNER, ...defaultValues?.owner },
      employees: defaultValues?.employees ?? [{ ...EMPTY_EMPLOYEE }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'employees' })

  const employeesArrayError =
    errors.employees?.root?.message ??
    (typeof errors.employees?.message === 'string' ? errors.employees.message : undefined)

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-6" noValidate>
      <fieldset className="space-y-2 rounded-md border border-gray-200 p-4">
        <legend className="text-sm font-semibold text-gray-700">Cuenta del Propietario</legend>
        <CredentialFields
          idPrefix="owner"
          labelSuffix="del Propietario"
          registerPath="owner"
          register={register}
          errors={errors.owner}
        />
      </fieldset>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">Empleados</h3>
        {fields.map((field, index) => (
          <div key={field.id} className="space-y-2 rounded-md border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-700">Empleado {index + 1}</h4>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => remove(index)}
                aria-label={`Eliminar empleado ${index + 1}`}
              >
                Eliminar
              </Button>
            </div>

            <CredentialFields
              idPrefix={`employee-${index}`}
              labelSuffix={`del Empleado ${index + 1}`}
              registerPath={`employees.${index}`}
              register={register}
              errors={errors.employees?.[index]}
            />

            <Field
              id={`employee-branch-${index}`}
              label={`Sucursal del Empleado ${index + 1}`}
              error={errors.employees?.[index]?.branch_index?.message}
            >
              <select
                id={`employee-branch-${index}`}
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                {...register(`employees.${index}.branch_index`, { valueAsNumber: true })}
              >
                {branches.map((branch, branchIndex) => (
                  <option key={branchIndex} value={branchIndex}>
                    {`Sucursal ${branchIndex + 1} - ${branch.name}`}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        ))}

        {employeesArrayError && <p className="text-sm text-red-600">{employeesArrayError}</p>}

        <Button type="button" variant="outline" onClick={() => append({ ...EMPTY_EMPLOYEE })}>
          Agregar Empleado
        </Button>
      </div>

      <div className="flex justify-end">
        <Button type="submit">Siguiente</Button>
      </div>
    </form>
  )
}
