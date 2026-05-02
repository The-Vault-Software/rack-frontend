import { createBrowserRouter, Navigate } from 'react-router-dom';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
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
                        path: '/',
                        element: <Navigate to="/dashboard" replace />
                    }
                ]
            }
        ]
    }
]);
