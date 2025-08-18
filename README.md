# Template for Next.js App Router

This template is a starting point for a Next.js project:
* mobile-first development
* pnpm as the package manager
* postcss for styling

## Get Started

```bash
# Install dependencies
pnpm install

# Start the development server
pnpm start

# Build the application for production
pnpm buil
```

## DevDependencies





## Project Structure

This project follows a standard Next.js App Router structure with some added conventions for organizing code and assets.

- **`public/`**: Contains all static assets that are served directly.
  - `favicon/`: Favicon assets for different platforms.
  - `images/`: Global images used throughout the application.
  - `sprites/`: SVG sprites.

- **`src/`**: The main application source code resides here.
  - **`app/`**: Core of the Next.js App Router. This is where pages, layouts, and routes are defined.
    - `layout.tsx`: The root layout for the entire application.
    - `page.tsx`: The main entry page for the application.
  - **`assets/`**: Global static assets that are part of the build process.
    - `fonts/`: Font files for the application.
    - `styles/`: Global stylesheets, organized by concern (base, layouts, themes, etc.).
  - **`components/`**: Shared React components used across the application.
  - **`lib/`**: Contains library code, helper functions, and service integrations.
    - `fonts.ts`: A module for managing and loading the application's fonts.
  - **`utils/`**: General-purpose utility functions.

- **Configuration Files**:
  - `next.config.ts`: Configuration for Next.js.
  - `postcss.config.js`: Configuration for PostCSS.
  - `tsconfig.json`: TypeScript configuration for the project.
  - `package.json`: Defines project metadata, dependencies, and scripts.

## CLI Commands

The following table summarizes the available CLI commands in this project:

| Command          | Description                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| `pnpm build`       | Builds the application for production. It also disables Next.js telemetry before the build process.       |
| `pnpm build:start` | Starts the production server. This command should be run after a successful build.                      |
| `pnpm lint`        | Runs the Next.js linter to check for code quality and potential errors.                                 |
| `pnpm repack`      | Deletes the `.next` directory, `node_modules`, and lockfiles, and then reinstalls all dependencies.     |
| `pnpm start`       | Starts the development server with Turbopack for a faster and more efficient development experience.      |
| `pnpm noTel`       | A utility script to disable Next.js telemetry. It is used internally by the `build` script.               |
