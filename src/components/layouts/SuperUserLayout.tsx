import { Outlet, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

/**
 * Gate for the cross-tenant admin surface.
 *
 * Renders nothing until `isLoading` settles. Evaluating `is_superuser` while
 * the user-info query is still in flight reads `undefined` on a legitimate
 * superuser, which would bounce them to the dashboard on every page refresh —
 * the classic role-guard bug, and one that only shows up for the people the
 * page exists for.
 *
 * This mirrors the backend: authorization is `is_superuser`, never `role`.
 * `role` is scoped within a company and every pre-existing user was backfilled
 * to OWNER, so it confers nothing here. The guard below is convenience only —
 * `IsSuperUser` on the API is what actually protects the data.
 */
export const SuperUserLayout = () => {
    const { user, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (!user?.is_superuser) {
        return <Navigate to="/dashboard" replace />;
    }

    return <Outlet />;
};
