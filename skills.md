# AI Agent Operational Manual & Skills Matrix

## 1. Definition and Purpose

**What is this file?**
This `skills.md` serves as the authoritative operational manual and "Cognitive Map" for any AI agent interacting with the `rack-frontend` repository. It defines the agent's authorized capabilities, technical boundaries, and required contextual understanding.

**Why does it exist?**
To ensure consistency, safety, and high-quality contributions, this document explicitly outlines the frameworks, patterns, and domain logic that the agent must adhere to. It acts as a set of instructions to align the agent's output with the existing architectural standards and business goals of the project.

---

## 2. Project Analysis Requirements

### Technical Proficiency

The agent must possess deep expertise in the following "Hard Skills" stack, utilizing the specific versions and patterns found in the codebase.

| Category             | Technology                         | Usage & Patterns                                                                                                                                          |
| :------------------- | :--------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Core Framework**   | **React 19** + **TypeScript**      | Build modern, functional components using Hooks. Strict type safety is mandatory.                                                                         |
| **Build Tool**       | **Vite**                           | Fast HMR dev server. Use `npm run dev` for local execution.                                                                                               |
| **Styling**          | **Tailwind CSS v4**                | Use utility classes for all styling. Avoid custom CSS files unless absolutely necessary. Use `clsx` and `tailwind-merge` for class manipulation.          |
| **State Management** | **TanStack Query (v5)**            | **Primary** method for server state. Use `useQuery` / `useMutation` for all API interactions. Manage loading/error states gracefully.                     |
| **Routing**          | **React Router v7**                | specialized routing logic defined in `src/router.tsx`.                                                                                                    |
| **Forms**            | **React Hook Form** + **Zod**      | Use `useForm` with `@hookform/resolvers/zod` for all form handling and validation.                                                                        |
| **API Layer**        | **OpenAPI / Hey API**              | **CRITICAL**: The API client is generated (`@hey-api/client-fetch`). Do NOT manually edit files in `src/client`. Use the generated hooks/service methods. |
| **UI Components**    | **Headless UI** + **Lucide React** | Use Headless UI for accessible interactive components (Dialogs, Menus) and Lucide for icons.                                                              |
| **Animation**        | **Framer Motion**                  | Use for UI transitions, micro-interactions, and complex animations.                                                                                       |

### Domain Expertise

The agent must demonstrate "Contextual Intelligence" in the following domain:

**Project Scope**: **Pos System (SaaS)**.
This is a specialized POS system specifically tailored for the retail sector ("Rack"). It is a SaaS application that allows users to manage their retail business in Venezuela. We use the Venezuelan Bolívar as the currency and also USD, this is because the Venezuelan Bolívar is not stable and the exchange rate is not fixed. You may need to use the exchange rate to convert between currencies.

**Key Business Contexts**:

- **Inventory Management**: High-performance handling of products, stock levels, SKUs, and costs.
- **Sales & CRM**: Managing customer contacts, sales pipelines, account balances, and debt tracking.
- **Multi-Tenancy**: The interactions often happen within the context of a "Company" or "Branch".
- **UI Priorities**: The UI should be modern, responsive, and accessible. The UI should be designed to be used on a desktop, but also on a mobile device. This implies that the UI should be designed one for the desktop and one for the mobile device, with no multi-device support. We have hooks to detect the device type and use the appropriate UI.

### Architectural Awareness

The project follows a **Feature-Based Modular Architecture**.

- **Structure**: `src/pages/{feature}` is the primary organizational unit (e.g., `src/pages/inventory`, `src/pages/sales`).
- **Separation of Concerns**:
  - **Pages**: Route handlers and high-level layout.
  - **Components**: Reusable, presentational UI blocks (`src/components`).
  - **Hooks**: Encapsulated business logic and state.
  - **Client**: Generated API bindings (`src/client`).
- **Data Flow**: Server State (TanStack Query) -> React Context/Props -> UI Components. Avoid global client-side state managers (Redux/Zustand) unless the pattern already exists for a specific feature.

### Tooling & Integration

The agent must use the following tools for development and integration:

- **Linting**: ESLint (Flat Config) with TypeScript rules. Ensure zero lint errors on output.
- **API Generation**: `npm run generate-api` (uses `openapi-ts`). If the `schema.yml` changes, this script MUST be run to update the client.
- **Charts**: Recharts for analytics and data visualization.

---

## 3. Formatting Guidelines & Guardrails

### Constraints & Guardrails

⚠️ **Critical Restrictions - The agent MUST NOT:**

1.  **Modify Generated API Code**: Never edit files inside `src/client/*`. If API changes are needed, assume they must come from `schema.yml` generation or backend updates.
2.  **Bypass Type Safety**: Usage of `any` is strictly prohibited. Define proper interfaces or use inferred types from Zod/OpenAPI.
3.  **Introduce New Styling Libraries**: Do not install styled-components, emotion, or Bootstrap. Stick strictly to Tailwind CSS.
4.  **Mutate State Directly**: Always use React state setters or React Query mutation helpers.

### Code Style & Formatting

- **File Naming**: PascalCase for Components (`InventoryPage.tsx`), camelCase for hooks/utils (`useDebounce.ts`).
- **Component Structure**:
  1.  Imports (External -> Internal -> Styles)
  2.  Types/Interfaces
  3.  Component Definition
  4.  Hooks/State
  5.  Effects
  6.  Render
- **Comments**: Add TSDoc comments for complex logic or business rules.

**Example Task Execution Protocol**:
When asked to "Add a feature":

1.  Check `schema.yml` and `src/client` to see if the API supports it.
2.  Create/Update the Zod schema for validation.
3.  Create the React Component using Tailwind for styling.
4.  Integrate `useMutation` or `useQuery`.
5.  Ensure it matches the "Premium Design" aesthetic (Shadows, Rounded corners, Transitions).
