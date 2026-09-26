# Daily Expense Manager Uganda — GitHub Pages FIXED

This ZIP is the GitHub Pages version. It contains one static browser application.

## Upload correctly
Extract this ZIP first. Upload the **files inside the extracted folder** directly into the ROOT of your GitHub repository.

You should see these files immediately in the repository:
- index.html
- login.html
- app.js
- style.css
- manifest.json
- service-worker.js
- assets/
- supabase/

Do not upload the ZIP itself.
Do not put these files inside another folder.

## GitHub Pages
Repository → Settings → Pages → Deploy from a branch → main → / (root) → Save.

## What was fixed
- Removed duplicate logout buttons. There is one visible logout control in the top bar.
- Sidebar Account button no longer signs the user out.
- Removed duplicate Settings/Mobile logout controls.
- Fixed sidebar branding so “Daily Expense Manager” does not wrap into broken text.
- Increased sidebar width and added responsive header rules.
- Added cache-busting to CSS/JS so GitHub does not keep serving an old version.
- Uses repository-relative navigation for GitHub Pages.
- Supabase session is the source of authentication.
- Dashboard no longer waits forever for every cloud query.
- Added a clear error if the Supabase browser library fails to load.


## Google OAuth setup

The login page now uses `supabaseClient.js` and `supabase.auth.signInWithOAuth({ provider: "google" })`.

In Supabase Dashboard, enable **Authentication → Providers → Google** and enter the Google OAuth Client ID/Secret.

Also add your exact GitHub Pages URL under **Authentication → URL Configuration → Redirect URLs**, for example:

`https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/index.html`

The button itself is already wired in this ZIP.


## Google OAuth
The login page imports `supabaseClient.js` and uses Supabase Google OAuth. Enable Google under Supabase Authentication → Providers and add the GitHub Pages callback URL to Authentication → URL Configuration → Redirect URLs.
