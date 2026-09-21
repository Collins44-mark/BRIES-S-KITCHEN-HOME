# Brand assets

Place your business logo and profile images here.

## Files

| File | Used for | Notes |
|------|----------|--------|
| `logo.svg` | Default brand mark (sidebar, login, settings) | Replace with your SVG logo |
| `logo.png` | Preferred brand mark if present | Drop a PNG here to override the SVG |
| `avatar.png` | Optional default user avatar | Used when a user has no custom photo |

## How to replace the logo

1. Export your logo as **PNG** (recommended 256×256 or 512×512, transparent background) or **SVG**.
2. Save it as:
   - `apps/web/public/brand/logo.png` **or**
   - `apps/web/public/brand/logo.svg`
3. Refresh the app. The UI loads `logo.png` first, then falls back to `logo.svg`.

## Paths in the app

- Logo URL: `/brand/logo.png` or `/brand/logo.svg`
- Avatar URL: `/brand/avatar.png`
