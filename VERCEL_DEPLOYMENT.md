# Deploying Turborepo Monorepo to Vercel

Since you are using a monorepo with **Turborepo**, the deployment process on Vercel is slightly different but very powerful. Instead of deploying the entire repo as one site, you will create **3 separate Vercel Projects**, each connected to the same GitHub repository but pointing to a different folder.

This ensures that:
1.  **Guest Portal** deploys to `posh-guest.vercel.app` (example)
2.  **Partner Dashboard** deploys to `posh-partner.vercel.app`
3.  **Admin Console** deploys to `posh-admin.vercel.app`

---

## Step 1: Push Changes to GitHub
Ensure your recent changes (including `turbo.json` and the `package.json` updates) are pushed to your remote repository.

```bash
git add .
git commit -m "chore: setup turborepo for deployment"
git push
# If on a branch, push that branch
```

## Step 2: Create Projects in Vercel

Repeat the following process **3 times**, once for each app (`guest-portal`, `partner-dashboard`, `admin-console`).

1.  Log in to your **Vercel Dashboard**.
2.  Click **"Add New..."** -> **"Project"**.
3.  Import your git repository: **`posh-india`** (or whatever it's named).
4.  **Configure Project**:
    *   **Project Name**: e.g., `posh-partner-dashboard`
    *   **Framework Preset**: **Next.js** (Leave as default)
    *   **Root Directory**: Click "Edit" and select the specific app folder:
        *   For Guest Portal: `apps/guest-portal`
        *   For Partner Dashboard: `apps/partner-dashboard`
        *   For Admin Console: `apps/admin-console`
    *   **Environment Variables**: Copy your `.env.local` contents into the "Environment Variables" section.
        *   *Tip: You might need to add `NEXT_PUBLIC_` variables here.*
    *   **Build Command**: Enable the "Override" toggle and enter: `cd ../.. && npx turbo build --filter=[app-name-in-package-json]`
        *   *Wait! Vercel's default behavior is simpler:*
        *   **Standard Method**: Just leave the Build Command as default (`next build`). Vercel runs this *inside* the Root Directory. Since `apps/partner-dashboard/package.json` is standard, this works perfectly. Vercel automatically detects it's a monorepo and installs root dependencies.
        *   **Recommended**: Leave **Build Command** and **Install Command** as DEFAULT.
5.  Click **Deploy**.

## Step 3: Optimization settings (Optional)

To save build minutes, you can use the "Ignored Build Step" feature.

1.  Go to **Settings** -> **Git**.
2.  Scroll to **Ignored Build Step**.
3.  In the "Command" field, enter:
    ```bash
    ../../scripts/vercel-ignore-build-step.sh @c1rcle/partner-dashboard
    ```
    *(Replace `@c1rcle/partner-dashboard` with the package name of the app you are configuring).*

    *Note: The path is `../../` because the command runs from the "Root Directory" project setting (e.g., `apps/partner-dashboard`), so we need to go up two levels to find the script.*

## Deployment Checklist
- [ ] Pushed `turbo.json` and `package-lock.json` to GitHub.
- [ ] Created 3 Vercel Projects.
- [ ] Set specific "Root Directory" for each project.
- [ ] Added Environment Variables for each project.
