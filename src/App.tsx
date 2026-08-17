import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { router } from './router';
import { AuthProvider } from './context/AuthProvider';
import { BranchProvider } from './context/BranchProvider';
import { client } from './client/client.gen';
import { registerInterceptors } from './lib/apiInterceptors';

// Initialize the QueryClient
const queryClient = new QueryClient();

// Configure the API client
if (import.meta.env.VITE_API_URL) {
    client.setConfig({
        baseUrl: import.meta.env.VITE_API_URL,
    });
} else {
    client.setConfig({
        baseUrl: 'http://localhost:8000',
    });
}

// Global fetch configuration for cookies (HttpOnly authentication)
client.setConfig({
    credentials: 'include',
});

// CSRF request interceptor and 401/402 response interceptors live in
// src/lib/apiInterceptors.ts so they can be registered against a fake
// fetch in a test, instead of running once at module import here.
registerInterceptors(client, queryClient);

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BranchProvider>
          <Toaster position="top-right" richColors />
          <RouterProvider router={router} />
        </BranchProvider>
      </AuthProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

export default App;
