import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: './schema.yml', 
  output: './src/client',        // Donde se guardará el código generado
  plugins: [
    '@hey-api/typescript',       // Genera las interfaces de TS
    '@hey-api/sdk',              
    {
      name: '@hey-api/schemas',  // Genera esquemas JSON (útil para validación)
    },
    {
      name: 'zod',               // ¡Genera los esquemas de Zod!
      requests: true,
      responses: true,
    },
    {
      name: '@tanstack/react-query', // ¡Genera los hooks para TanStack Query!
      queryOptions: true,
    },
  ],
});