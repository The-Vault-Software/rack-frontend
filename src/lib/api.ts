import { client } from '../client/client.gen';

client.setConfig({
  baseUrl: import.meta.env.VITE_API_URL,
});

client.interceptors.request.use((request) => {
  const token = localStorage.getItem('token');
  if (token) {
    request.headers.set('Authorization', `Bearer ${token}`);
  }
  return request;
});

export { client };