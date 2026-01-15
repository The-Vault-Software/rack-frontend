import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { router } from './router';
import { AuthProvider } from './context/AuthProvider';
import { BranchProvider } from './context/BranchProvider';
import { client } from './client/client.gen';
import { refreshCreate } from './client/sdk.gen';

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

// Add CSRF token interceptor for Django
client.interceptors.request.use((request) => {
    const cookieValue = document.cookie
        .split('; ')
        .find((row) => row.startsWith('csrftoken='))
        ?.split('=')[1];

    if (cookieValue) {
        request.headers.set('X-CSRFToken', cookieValue);
    }
    return request;
});

// Add response interceptor for token refresh
client.interceptors.response.use(async (response, request, options) => {
    if (response.status === 401 && !request.url.endsWith('/v1/refresh/')) {
        try {
            // Attempt to refresh the token
            await refreshCreate({
                body: { refresh: '' }, // Assuming HttpOnly cookies are used, but schema requires string
                throwOnError: true,
            });

            // If refresh successful, retry original request
            const newRequest = new Request(request.url, {
                ...options,
                headers: options.headers as HeadersInit,
                body: (options.serializedBody ?? options.body) as BodyInit,
            });
            return await (options.fetch ?? fetch)(newRequest);
        } catch {
            // If refresh fails, redirect to login only if not already there
            if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
                window.location.href = '/login';
            }
            return response;
        }
    }
    return response;
});


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
