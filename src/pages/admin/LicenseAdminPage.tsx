import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Search, ShieldOff, ShieldCheck, CalendarPlus } from 'lucide-react';
import {
    v1AdminCompaniesListOptions,
    v1AdminCompaniesLicenseExtendCreateMutation,
    v1AdminCompaniesLicenseRevokeCreateMutation,
    v1AdminCompaniesLicenseRestoreCreateMutation,
} from '../../client/@tanstack/react-query.gen';
import type { AdminCompanyLicense, ReasonEnum } from '../../client';

const STATUSES = ['', 'ACTIVE', 'EXPIRED', 'REVOKED'] as const;

/** '' means "no filter"; the rest must stay assignable to the generated query type. */
type StatusFilter = (typeof STATUSES)[number];

const REVOCATION_REASONS: { value: ReasonEnum; label: string }[] = [
    { value: 'NON_PAYMENT', label: 'Non-payment' },
    { value: 'FRAUD', label: 'Fraud' },
    { value: 'CUSTOMER_REQUEST', label: 'Customer request' },
    { value: 'OTHER', label: 'Other' },
];

const STATUS_STYLES: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-800',
    EXPIRED: 'bg-amber-100 text-amber-800',
    REVOKED: 'bg-red-100 text-red-800',
};

/**
 * The API returns 409 when a licence is already revoked, or not revoked at all.
 * Surfacing that as a plain failure would tell the operator their action broke;
 * it did not, and nothing was changed — including any reason another operator
 * recorded earlier.
 */
function describeError(error: unknown, conflictMessage: string): string {
    const status = (error as { status?: number; response?: { status?: number } })?.status
        ?? (error as { response?: { status?: number } })?.response?.status;
    if (status === 409) return conflictMessage;
    if (status === 403) return 'You do not have permission for this action.';
    return 'The action could not be completed. Please try again.';
}

export default function LicenseAdminPage() {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState<StatusFilter>('');
    const [page, setPage] = useState(1);
    const [revoking, setRevoking] = useState<AdminCompanyLicense | null>(null);

    const listQuery = v1AdminCompaniesListOptions({
        query: {
            page,
            ...(search ? { search } : {}),
            ...(status ? { status } : {}),
        },
    });

    const { data, isLoading, isFetching } = useQuery(listQuery);

    const invalidate = () =>
        queryClient.invalidateQueries({ queryKey: ['v1AdminCompaniesList'] });

    const onSettled = (verb: string, conflictMessage: string) => ({
        onSuccess: () => {
            toast.success(verb);
            invalidate();
        },
        onError: (error: unknown) => toast.error(describeError(error, conflictMessage)),
    });

    const extend = useMutation({
        ...v1AdminCompaniesLicenseExtendCreateMutation(),
        ...onSettled('Licence extended', 'That licence could not be extended.'),
    });

    const revoke = useMutation({
        ...v1AdminCompaniesLicenseRevokeCreateMutation(),
        ...onSettled(
            'Licence revoked',
            'That licence is already revoked. Nothing was changed, and the reason recorded earlier is intact.',
        ),
    });

    const restore = useMutation({
        ...v1AdminCompaniesLicenseRestoreCreateMutation(),
        ...onSettled(
            'Licence restored',
            'That licence is not revoked, so there is nothing to restore.',
        ),
    });

    const busy = extend.isPending || revoke.isPending || restore.isPending;
    const companies = data?.results ?? [];
    const total = data?.count ?? 0;

    return (
        <div className="p-6 space-y-6">
            <header>
                <h1 className="text-2xl font-semibold text-gray-900">Licences</h1>
                <p className="text-sm text-gray-500">
                    Every registered company. Extending always leaves a licence active, even
                    one that lapsed long ago. Restoring clears a revocation and nothing else —
                    a company whose date has also passed stays expired until you extend it.
                </p>
            </header>

            <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-64">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                    <input
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(1);
                        }}
                        placeholder="Search by name or RIF"
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                </div>
                <select
                    value={status}
                    onChange={(e) => {
                        setStatus(e.target.value as StatusFilter);
                        setPage(1);
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                    {STATUSES.map((s) => (
                        <option key={s} value={s}>
                            {s === '' ? 'All states' : s}
                        </option>
                    ))}
                </select>
            </div>

            <div className="border border-gray-200 rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left text-gray-600">
                        <tr>
                            <th className="px-4 py-3 font-medium">Company</th>
                            <th className="px-4 py-3 font-medium">RIF</th>
                            <th className="px-4 py-3 font-medium">Expires</th>
                            <th className="px-4 py-3 font-medium">State</th>
                            <th className="px-4 py-3 font-medium text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {isLoading && (
                            <tr>
                                <td colSpan={5} className="px-4 py-10 text-center">
                                    <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
                                </td>
                            </tr>
                        )}
                        {!isLoading && companies.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                                    No companies match this filter.
                                </td>
                            </tr>
                        )}
                        {companies.map((company) => (
                            <tr key={company.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3">
                                    <div className="font-medium text-gray-900">{company.name}</div>
                                    <div className="text-xs text-gray-500">{company.email}</div>
                                </td>
                                <td className="px-4 py-3 text-gray-600">{company.rif ?? '—'}</td>
                                <td className="px-4 py-3 text-gray-600">{company.license_date}</td>
                                <td className="px-4 py-3">
                                    <span
                                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                                            STATUS_STYLES[company.status] ?? 'bg-gray-100 text-gray-700'
                                        }`}
                                    >
                                        {company.status}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex justify-end gap-2">
                                        <button
                                            disabled={busy}
                                            onClick={() =>
                                                extend.mutate({
                                                    path: { company_id: company.id },
                                                    body: { days: 30 },
                                                })
                                            }
                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50"
                                        >
                                            <CalendarPlus className="w-3.5 h-3.5" />
                                            Extend 30d
                                        </button>
                                        {company.status === 'REVOKED' ? (
                                            <button
                                                disabled={busy}
                                                onClick={() =>
                                                    restore.mutate({ path: { company_id: company.id } })
                                                }
                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border border-green-300 text-green-700 rounded-md hover:bg-green-50 disabled:opacity-50"
                                            >
                                                <ShieldCheck className="w-3.5 h-3.5" />
                                                Restore
                                            </button>
                                        ) : (
                                            <button
                                                disabled={busy}
                                                onClick={() => setRevoking(company)}
                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border border-red-300 text-red-700 rounded-md hover:bg-red-50 disabled:opacity-50"
                                            >
                                                <ShieldOff className="w-3.5 h-3.5" />
                                                Revoke
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="flex items-center justify-between text-sm text-gray-600">
                <span>
                    {total} {total === 1 ? 'company' : 'companies'}
                    {isFetching && !isLoading && ' · updating…'}
                </span>
                <div className="flex gap-2">
                    <button
                        disabled={!data?.previous}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className="px-3 py-1.5 border border-gray-300 rounded-md disabled:opacity-40"
                    >
                        Previous
                    </button>
                    <button
                        disabled={!data?.next}
                        onClick={() => setPage((p) => p + 1)}
                        className="px-3 py-1.5 border border-gray-300 rounded-md disabled:opacity-40"
                    >
                        Next
                    </button>
                </div>
            </div>

            {revoking && (
                <RevokeDialog
                    company={revoking}
                    pending={revoke.isPending}
                    onCancel={() => setRevoking(null)}
                    onConfirm={(reason, note) => {
                        revoke.mutate(
                            {
                                path: { company_id: revoking.id },
                                body: { reason, note: note || null },
                            },
                            { onSettled: () => setRevoking(null) },
                        );
                    }}
                />
            )}
        </div>
    );
}

function RevokeDialog({
    company,
    pending,
    onCancel,
    onConfirm,
}: {
    company: AdminCompanyLicense;
    pending: boolean;
    onCancel: () => void;
    onConfirm: (reason: ReasonEnum, note: string) => void;
}) {
    const [reason, setReason] = useState<ReasonEnum>('NON_PAYMENT');
    const [note, setNote] = useState('');

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                        Revoke {company.name}
                    </h2>
                    <p className="text-sm text-gray-500">
                        Their users keep working until their session expires, up to 15 minutes.
                    </p>
                </div>

                {/* Reason is a fixed set rather than free text so revocations can be
                    counted, not merely read one at a time. The note carries the specifics. */}
                <label className="block text-sm">
                    <span className="text-gray-700">Reason</span>
                    <select
                        value={reason}
                        onChange={(e) => setReason(e.target.value as ReasonEnum)}
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                        {REVOCATION_REASONS.map((r) => (
                            <option key={r.value} value={r.value}>
                                {r.label}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="block text-sm">
                    <span className="text-gray-700">Note (optional)</span>
                    <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={3}
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                </label>

                <div className="flex justify-end gap-2">
                    <button
                        onClick={onCancel}
                        disabled={pending}
                        className="px-4 py-2 text-sm border border-gray-300 rounded-lg"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onConfirm(reason, note)}
                        disabled={pending}
                        className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg disabled:opacity-50"
                    >
                        {pending ? 'Revoking…' : 'Revoke licence'}
                    </button>
                </div>
            </div>
        </div>
    );
}
