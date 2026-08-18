import { useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Loader2 } from 'lucide-react';

export const ProtectedLayout = () => {
    const { isAuthenticated, isLoading, user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        if (!isLoading) {
            if (!isAuthenticated) {
                navigate('/login', { replace: true, state: { from: location.pathname } });
            } else if (user) {
                 // Logic: If user has no company (assuming checking for falsy or empty string if types lie, strictly it's a string)
                 // If the user meant "create company feature", maybe checking if company_id is valid?
                 // For now, I'll trust the user requirement that checking company is needed.
                 // If company_id is a UUID, checking if it exists is enough.
                 // NOTE: If the backend assigns a default company or null, we check here.
                 // A companyless user is routed to the onboarding wizard at /register
                 // (see router.tsx — /register is public and outside this layout, so
                 // this pathname check only guards against a redirect loop if the
                 // effect were ever to re-run while this layout is still mounted).

                 const hasCompany = user.company_id && user.company_id !== '00000000-0000-0000-0000-000000000000'; // Defensive check

                 if (!hasCompany && location.pathname !== '/register') {
                     navigate('/register', { replace: true });
                 } else if (hasCompany && location.pathname === '/register') {
                     // If they have a company, don't let them stay on the wizard route.
                     navigate('/dashboard', { replace: true });
                 }
            }
        }
    }, [isAuthenticated, isLoading, navigate, user, location.pathname]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (!isAuthenticated) return null;

    return <Outlet />;
};
