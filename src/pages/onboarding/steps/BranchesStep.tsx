import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'

const MIN_BRANCHES = 1
const MAX_BRANCHES = 2

const branchSchema = z.object({
  name: z.string().min(1, 'Nombre de la sucursal requerido'),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
})

const branchesStepSchema = z.object({
  branches: z
    .array(branchSchema)
    .min(MIN_BRANCHES, 'Se requiere al menos una sucursal')
    .max(MAX_BRANCHES, 'Máximo 2 sucursales'),
})

export type BranchesStepValues = z.infer<typeof branchesStepSchema>

const EMPTY_BRANCH = { name: '', address: '', phone: '', email: '' }

interface BranchesStepProps {
  defaultValues?: Partial<BranchesStepValues>
  onNext: (values: BranchesStepValues) => void
}

export function BranchesStep({ defaultValues, onNext }: BranchesStepProps) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<BranchesStepValues>({
    resolver: zodResolver(branchesStepSchema),
    defaultValues: { branches: defaultValues?.branches ?? [{ ...EMPTY_BRANCH }] },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'branches' })

  const arrayLevelError =
    errors.branches?.root?.message ??
    (typeof errors.branches?.message === 'string' ? errors.branches.message : undefined)

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-4" noValidate>
      {fields.map((field, index) => (
        <div key={field.id} className="space-y-2 rounded-md border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">Sucursal {index + 1}</h3>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => remove(index)}
              aria-label={`Eliminar sucursal ${index + 1}`}
            >
              Eliminar
            </Button>
          </div>

          <div>
            <label
              htmlFor={`branch-name-${index}`}
              className="block text-sm font-medium text-gray-700"
            >
              {`Nombre de la Sucursal ${index + 1}`}
            </label>
            <Input id={`branch-name-${index}`} {...register(`branches.${index}.name`)} />
            {errors.branches?.[index]?.name && (
              <p className="mt-1 text-sm text-red-600">{errors.branches[index]?.name?.message}</p>
            )}
          </div>

          <div>
            <label
              htmlFor={`branch-address-${index}`}
              className="block text-sm font-medium text-gray-700"
            >
              {`Dirección de la Sucursal ${index + 1}`}
            </label>
            <Input id={`branch-address-${index}`} {...register(`branches.${index}.address`)} />
          </div>
        </div>
      ))}

      {arrayLevelError && <p className="text-sm text-red-600">{arrayLevelError}</p>}

      <Button
        type="button"
        variant="outline"
        onClick={() => append({ ...EMPTY_BRANCH })}
        disabled={fields.length >= MAX_BRANCHES}
      >
        Agregar Sucursal
      </Button>

      <div className="flex justify-end">
        <Button type="submit">Siguiente</Button>
      </div>
    </form>
  )
}
