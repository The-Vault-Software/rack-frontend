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
                        path: '/accounts',
                        element: <AccountsPage />
                    },
                    {
                        path: '/settings',
                        element: <SettingsPage />
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
