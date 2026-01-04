# 🌌 THE C1RCLE Monorepo Navigation Guide

Welcome to the unified codebase for **THE C1RCLE**. This repository is structured as a high-performance monorepo, designed for speed, consistency, and clear separation of concerns.

## 🏗️ Project Architecture

The repository is organized into `apps` (deployable services) and `packages` (shared logic).

### 📱 Applications (`/apps`)

- **`guest-portal`** ([Port 3000](http://localhost:3000))
  - **Purpose**: The public face of THE C1RCLE. Used by members for discovery, booking, social interaction, and profile management.
  - **Tech**: Next.js (App Router), Framer Motion (Cinematic UI), Firebase Client.

- **`partner-dashboard`** ([Port 3001](http://localhost:3001))
  - **Purpose**: The operations hub for Hosts, Clubs, and Promoters. Used for event creation, guestlist management, and analytics.
  - **Tech**: Next.js, Firebase Admin (Elevated ops), Lucide.

- **`admin-console`** ([Port 3002](http://localhost:3002))
  - **Purpose**: The platform's internal "Mission Control". Used for moderation, platform-wide stats, and access control.
  - **Security**: Hardened session persistence, mandatory RBAC (7 tiers), 5-minute idle timeout, and immutable audit logging.
  - **Tech**: Next.js, Admin Guard (Hardened security).

### 📦 Shared Packages (`/packages`)


- **`core`** (`@c1rcle/core`)
  - **Purpose**: The "Kernel" of the platform.
  - **Key Files**:
    - `client.js`: Unified Firebase Client initialization.
    - `admin.js`: Unified Firebase Admin SDK initialization.
  - **Usage**: Every app imports from `@c1rcle/core` to ensure they are talking to the same database with identical configurations.

---

## 🚀 Development Workflow

### Starting the Engines

You can start each environment individually from the root:

| Service | Command | Port |
| :--- | :--- | :--- |
| **Guest Portal** | `npm run dev:guest` | 3000 |
| **Partner Dashboard** | `npm run dev:partner` | 3001 |
| **Admin Console** | `npm run dev:admin` | 3002 |

### Installing Dependencies
Always run `npm install` at the **root** of the repository. Do not run it inside individual app folders unless specifically necessary for isolation testing.

---

## 🛠️ Key Terminology

- **Guest**: A platform member (user).
- **Partner**: A business entity (Host, Club, or Promoter).
- **Console**: Administrative interface (for internal staff).
- **Portal**: Public-facing interface (for guests).
- **Core**: The shared source of truth (Firebase, models, shared libs).

---

## 🛡️ Security & Environment

- **`.env.local`**: Each app maintains its own local environment file. Ensure these are consistent across `guest-portal` and `admin-console` for shared authentication behavior.
- **Rules**: `firestore.rules` and `storage.rules` are located at the root. Use these as the authoritative rulesets for deployment.

---

## 🗺️ Quick Navigation Tips

1. **Where do I add a new Firebase function?**
   - Add the logic in `packages/core` if it's shared, or in the specific app's `lib/server` if it's unique.
2. **How do I change the look of the Guest Portal?**
   - Head to `apps/guest-portal/app/globals.css` for the design tokens.
3. **How do I verify a Host?**
   - Log in to the `admin-console` and navigate to the Moderation section.

---

*THE C1RCLE - Built for the extraordinary.*
