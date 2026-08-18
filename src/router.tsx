import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import LoginPage from './pages/auth/LoginPage';
import OnboardingWizard from './pages/onboarding/OnboardingWizard';
import LicenseInactivePage from './pages/license/LicenseInactivePage';
import DashboardPage from './pages/dashboard/DashboardPage';
import { ProtectedLayout } from './components/layouts/ProtectedLayout';
import InventoryPage from './pages/inventory/InventoryPage';
import DashboardLayout from './layouts/DashboardLayout';
import ContactsPage from './pages/contacts/ContactsPage';
import AccountsPage from './pages/accounts/AccountsPage';
import SettingsPage from './pages/settings/SettingsPage';
import SalesPage from './pages/sales/SalesPage';
import CustomerSalesPage from './pages/contacts/CustomerSalesPage';
import ProviderAccountsPage from './pages/contacts/ProviderAccountsPage';
import AnalyticsPage from './pages/analytics/AnalyticsPage';
import PrintSalePage from './pages/print/PrintSalePage';
import PrintAccountPage from './pages/print/PrintAccountPage';
import InventoryAdjustmentsPage from './pages/inventory-adjustments/InventoryAdjustmentsPage';
import { SuperUserLayout } from './components/layouts/SuperUserLayout';
import LicenseAdminPage from './pages/admin/LicenseAdminPage';

export const routes: RouteObject[] = [
    {
        path: '/login',
        element: <LoginPage />
    },
    {
        path: '/register',
        element: <OnboardingWizard />
    },
    {
        // Public — reached via a hard `window.location.replace` navigation
        // from the response interceptor's 402 latch, before any session
        // exists. Deliberately outside ProtectedLayout.
        path: '/licencia-inactiva',
        element: <LicenseInactivePage />
    },
    {
        // A user reaching either legacy signup route is, by definition, a
        // companyless user — exactly the case `ProtectedLayout` gates on and
        // redirects away from. Keeping these redirects OUTSIDE
        // ProtectedLayout (unconditional, not gated on auth state) is what
        // makes them reachable for the people who need them; nesting them
        // inside the layout would make the redirect unreachable for a
        // companyless authed user, since ProtectedLayout would just bounce
        // them right back to /register anyway.
        path: '/create-company',
        element: <Navigate to="/register" replace />
    },
    {
        path: '/setup-branch',
        element: <Navigate to="/register" replace />
    },
    {
        element: <ProtectedLayout />,
        children: [
            {
                path: '/print/sale/:id',
                element: <PrintSalePage />
            },
            {
                path: '/print/account/:id',
                element: <PrintAccountPage />
            },
            {
                element: <DashboardLayout />,
                children: [
                    {
                         path: '/dashboard',
                         element: <DashboardPage />
                    },
                    {
                        // Cross-tenant admin surface. SuperUserLayout is a
                        // convenience gate; IsSuperUser on the API is what
                        // actually protects the data.
                        element: <SuperUserLayout />,
                        children: [
                            {
                                path: '/admin/licenses',
                                element: <LicenseAdminPage />
                            },
                        ]
                    },
                    {
                        path: '/inventory',
                        element: <InventoryPage />
                    },
                    {
                        path: '/sales',
                        element: <SalesPage />
                    },
                    {
                        path: '/contacts',
                        element: <ContactsPage />
                    },
                    {
                        path: '/customers',
                        element: <ContactsPage />
                    },
                    {
                        path: '/providers',
                        element: <ContactsPage />
                    },
                    {
                        path: '/contacts/customers/:id/sales',
                        element: <CustomerSalesPage />
                    },
                    {
                        path: '/contacts/providers/:id/accounts',
                        element: <ProviderAccountsPage />
                    },
                    {
                        path: '/accounts',
                        element: <AccountsPage />
                    },
                    {
                        path: '/settings',
                        element: <SettingsPage />
                    },
                    {
                        path: '/analytics',
                        element: <AnalyticsPage />
                    },
                    {
                        path: '/adjustments',
                        element: <InventoryAdjustmentsPage />
                    },
                    {
                        path: '/',
                        element: <Navigate to="/dashboard" replace />
                    }
                ]
            }
        ]
    }
];

export const router = createBrowserRouter(routes);
