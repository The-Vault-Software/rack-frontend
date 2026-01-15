import { createBrowserRouter, Navigate } from 'react-router-dom';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import CreateCompanyPage from './pages/company/CreateCompanyPage';
import { ProtectedLayout } from './components/layouts/ProtectedLayout';
import InventoryPage from './pages/inventory/InventoryPage';
import DashboardLayout from './layouts/DashboardLayout';
import CustomersPage from './pages/customers/CustomersPage';
import ProvidersPage from './pages/providers/ProvidersPage';
import AccountsPage from './pages/accounts/AccountsPage';
import BranchSettingsPage from './pages/settings/BranchSettingsPage';
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
                        path: '/customers',
                        element: <CustomersPage />
                    },
                    {
                        path: '/providers',
                        element: <ProvidersPage />
                    },
                    {
                        path: '/accounts',
                        element: <AccountsPage />
                    },
                    {
                        path: '/settings/branches',
                        element: <BranchSettingsPage />
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
