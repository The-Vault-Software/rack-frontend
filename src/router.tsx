import { createBrowserRouter, Navigate } from 'react-router-dom';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import LicenseInactivePage from './pages/license/LicenseInactivePage';
import DashboardPage from './pages/dashboard/DashboardPage';
import CreateCompanyPage from './pages/company/CreateCompanyPage';
import SetupBranchPage from './pages/auth/SetupBranchPage';
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

export const router = createBrowserRouter([
    {
        path: '/login',
        element: <LoginPage />
    },
    {
        path: '/register',
        element: <RegisterPage />
    },
    {
        // Public — reached via a hard `window.location.replace` navigation
        // from the response interceptor's 402 latch, before any session
        // exists. Deliberately outside ProtectedLayout.
        path: '/licencia-inactiva',
        element: <LicenseInactivePage />
    },
    {
        element: <ProtectedLayout />,
        children: [
            {
                path: '/create-company',
                element: <CreateCompanyPage />
            },
            {
                path: '/setup-branch',
                element: <SetupBranchPage />
            },
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
]);
