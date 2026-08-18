import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

/**
 * Decides where an authenticated user lands when they arrive at `/`.
 *
 * A superuser goes to the cross-tenant licence administration panel;
 * everyone else goes to their company dashboard.
 *
 * Renders nothing until `isLoading` settles, for the same reason
 * `SuperUserLayout` does: evaluating `is_superuser` while the user-info
 * query is still in flight reads `undefined` on a legitimate superuser and
 * sends them to the dashboard instead — a bug that only ever shows up for
 * the people the redirect exists to serve.
 *
 * This is the single place that answers "where does this user start", so
 * `LoginPage` navigates here rather than naming a destination itself.
 * Authorization is still `is_superuser` and still enforced by `IsSuperUser`
 * on the API; this only chooses a landing page.
 */
export const HomeRedirect = () => {
    const { user, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return <Navigate to={user?.is_superuser ? '/admin/licenses' : '/dashboard'} replace />;
};
