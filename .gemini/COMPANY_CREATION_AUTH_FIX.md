# Fix: Company Creation Authentication Issue

## Problem

When attempting to create a company during registration, the request was being intercepted by the auth middleware and returning:

```json
{
  "detail": "Authentication credentials were not provided."
}
```

This was happening even though the backend allows unauthenticated company creation during the registration flow.

## Root Cause

The issue was in `src/App.tsx` where we have a response interceptor (lines 44-69) that:

1. Catches all 401 responses
2. Attempts to refresh the token
3. If refresh fails, redirects to login

When creating a company without authentication, the backend was returning a 401, and the interceptor was catching it before we could handle the response properly.

## Solution

Changed the company creation during registration to use a **direct `fetch` call** instead of going through the mutation/client that has the auth interceptors attached.

### Changes Made in `RegisterPage.tsx`

**Before:**

```tsx
const company = await createCompanyMutation.mutateAsync({
  body: {
    name: data.companyName,
    email: data.companyEmail,
    max_branches: 1,
    license_date: licenseDate.toISOString().split("T")[0],
  },
});
```

**After:**

```tsx
const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";

const companyResponse = await fetch(`${baseUrl}/v1/company/`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  credentials: "include",
  body: JSON.stringify({
    name: data.companyName,
    email: data.companyEmail,
    max_branches: 1,
    license_date: licenseDate.toISOString().split("T")[0],
  }),
});

if (!companyResponse.ok) {
  const errorData = await companyResponse.json();
  throw new Error(errorData.detail || "Error al crear la empresa");
}

const company = await companyResponse.json();
```

### Additional Changes

- Removed `companyCreateMutation` import and usage since we're using direct fetch
- Updated `isPending` calculation to remove `createCompanyMutation.isPending`

## Benefits of This Approach

1. **Bypasses Auth Interceptors**: Direct fetch doesn't go through the client's request/response interceptors
2. **Still Includes Credentials**: We still send `credentials: 'include'` for cookie-based auth if needed
3. **Proper Error Handling**: We can catch and handle errors specific to company creation
4. **Clean Separation**: Registration flow is independent of authenticated API calls

## Registration Flow (Final)

1. **Create Company** (unauthenticated, direct fetch)

   - POST to `/v1/company/`
   - Returns company object with `id`

2. **Register User** (unauthenticated, through mutation)

   - POST to `/v1/register/`
   - Uses the real `company_id` from step 1

3. **Login User** (through mutation)

   - POST to `/v1/login/`
   - Establishes authenticated session

4. **Navigate to Setup Branch**
   - User creates first branch
   - Completes onboarding

## Alternative Solutions Considered

1. **Modify the interceptor to skip company creation endpoint**

   - More complex
   - Would need to maintain a whitelist of unauthenticated endpoints

2. **Backend changes to allow placeholder company_id**

   - Requires backend modification
   - Creates orphaned users if company creation fails

3. **Combined registration endpoint**
   - Would require new backend endpoint
   - More atomic but less flexible

## Testing Checklist

- [x] Build succeeds without TypeScript errors
- [ ] Company creation works without authentication
- [ ] User registration with real company_id succeeds
- [ ] Login after registration works
- [ ] Full registration flow completes successfully
- [ ] Error handling shows appropriate messages
- [ ] Honeypot still works correctly

## Notes

- The direct fetch approach is only used during registration
- All other API calls continue to use the generated SDK with auth interceptors
- This maintains consistency while solving the specific registration flow issue
