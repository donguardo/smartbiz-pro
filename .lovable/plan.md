# Install status and reusable install access

## What will change
- Detect when MVP BizManager.ai is already running as an installed app.
- Show a clear “Installed” state in the install window and remove its install action.
- Keep browser installation guidance available when direct installation is unavailable.
- Add an “Install app” entry to the public top navigation and the signed-in navigation so users can reopen the window after dismissing it.
- Add English and Tagalog wording for the new status and navigation entry in both the editable translation source and backend translations.

## Technical details
- Use the browser’s standalone display state and `appinstalled` event as the installed signal.
- Use a shared browser event to open the existing install window from any navigation entry.
- Keep manifest-only installation behavior; no offline cache or service worker will be added.
- Verify dismissed, manually reopened, and installed states on desktop and mobile.
