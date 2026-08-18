import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { isValidRif, normalizeRif } from '../../../lib/rif'

/**
 * Step 1 of the onboarding wizard: company identity and structured fiscal
 * address. Required-ness for `rif` lives HERE, not in `isValidRif` — the
 * validator treats `null` as always valid because `Company.rif` stays
 * nullable on the backend (design.md D-F). This step composes both
 * `normalizeRif`/`isValidRif` refinements to enforce presence locally.
 */
const companyStepSchema = z.object({
  name: z.string().min(1, 'Nombre de la empresa requerido'),
  email: z.string().min(1, 'Email corporativo requerido').email('Email corporativo inválido'),
  rif: z
    .string()
    .refine((value) => normalizeRif(value) !== null, 'RIF requerido')
    .refine((value) => isValidRif(normalizeRif(value)), 'RIF inválido'),
  fiscal_state: z.string().min(1, 'Estado requerido'),
  fiscal_city: z.string().min(1, 'Ciudad requerida'),
  fiscal_municipality: z.string().min(1, 'Municipio requerido'),
  fiscal_street: z.string().min(1, 'Calle requerida'),
  fiscal_postal_code: z.string().optional(),
})

export type CompanyStepValues = z.infer<typeof companyStepSchema>

const EMPTY_DEFAULTS: CompanyStepValues = {
  name: '',
  email: '',
  rif: '',
  fiscal_state: '',
  fiscal_city: '',
  fiscal_municipality: '',
  fiscal_street: '',
  fiscal_postal_code: '',
}

interface CompanyStepProps {
  defaultValues?: Partial<CompanyStepValues>
  onNext: (values: CompanyStepValues) => void
}

export function CompanyStep({ defaultValues, onNext }: CompanyStepProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CompanyStepValues>({
    resolver: zodResolver(companyStepSchema),
    defaultValues: { ...EMPTY_DEFAULTS, ...defaultValues },
  })

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-4" noValidate>
      <div>
        <label htmlFor="company-name" className="block text-sm font-medium text-gray-700">
          Nombre de la Empresa
        </label>
        <Input id="company-name" {...register('name')} placeholder="Acme Corp" />
        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
      </div>

      <div>
        <label htmlFor="company-email" className="block text-sm font-medium text-gray-700">
          Email Corporativo
        </label>
        <Input
          id="company-email"
          type="email"
          {...register('email')}
          placeholder="contacto@acme.com"
        />
        {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
      </div>

      <div>
        <label htmlFor="company-rif" className="block text-sm font-medium text-gray-700">
          RIF
        </label>
        <Input id="company-rif" {...register('rif')} placeholder="J-00123072-6" />
        {errors.rif && <p className="mt-1 text-sm text-red-600">{errors.rif.message}</p>}
      </div>

      <div>
        <label htmlFor="fiscal-state" className="block text-sm font-medium text-gray-700">
          Estado
        </label>
        <Input id="fiscal-state" {...register('fiscal_state')} />
        {errors.fiscal_state && (
          <p className="mt-1 text-sm text-red-600">{errors.fiscal_state.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="fiscal-city" className="block text-sm font-medium text-gray-700">
          Ciudad
        </label>
        <Input id="fiscal-city" {...register('fiscal_city')} />
        {errors.fiscal_city && (
          <p className="mt-1 text-sm text-red-600">{errors.fiscal_city.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="fiscal-municipality" className="block text-sm font-medium text-gray-700">
          Municipio
        </label>
        <Input id="fiscal-municipality" {...register('fiscal_municipality')} />
        {errors.fiscal_municipality && (
          <p className="mt-1 text-sm text-red-600">{errors.fiscal_municipality.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="fiscal-street" className="block text-sm font-medium text-gray-700">
          Calle
        </label>
        <Input id="fiscal-street" {...register('fiscal_street')} />
        {errors.fiscal_street && (
          <p className="mt-1 text-sm text-red-600">{errors.fiscal_street.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="fiscal-postal-code" className="block text-sm font-medium text-gray-700">
          Código Postal
        </label>
        <Input id="fiscal-postal-code" {...register('fiscal_postal_code')} />
        <p className="mt-1 text-xs text-gray-400">Opcional</p>
      </div>

      <div className="flex justify-end">
        <Button type="submit">Siguiente</Button>
      </div>
    </form>
  )
}
