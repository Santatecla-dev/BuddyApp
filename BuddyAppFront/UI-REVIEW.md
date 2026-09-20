# Frontend UI review — 450ca98

Changes are local only. No backend files were changed.

## Fixed

- Invite buddy: removed the negative button margin; constrained and scrollable form; persistent accessible errors and success feedback; positive integer ID validation; duplicate request guard.
- Sign in and registration: shared responsive form layout (520px maximum), scroll access on short windows, labeled inputs, readable text and placeholders. The logo is bundled, including on case-sensitive hosts. Successful sign-in resets navigation so Back does not return to the sign-in form.
- Invitations: removed oversized cards, negative margins and disabled web scrolling. A virtualized SectionList renders vertical buddy groups. Groups use user IDs rather than names; accept/reject use green/red consistently. Added loading, empty, retry and mutation failure feedback, with pending actions disabled.
- Profile: removed white-on-white values and heavy clipped shadows, added a maximum content width, wrapping summary layout and labeled edit controls. Save has a pending state and persistent failure feedback.
- English UI across all eight screens, navigation titles, dates, validation and accessible labels. Country labels are English; existing country values sent to the API remain unchanged. User-entered names, sites and notes are preserved.
- Consistent blue primary actions and darker teal secondary actions for readable white text. Dive detail Leave has a larger labeled target; buddy names can wrap; partial load errors remain visible.

## Verification

Run from BuddyAppFront:

```powershell
node node_modules/typescript/bin/tsc --noEmit
node node_modules/expo/bin/cli export --platform web --output-dir .expo/ui-fixes-dist
node scripts/check-ui.cjs
```

The browser script uses Node 24 and headless Edge (override UI_BROWSER for another Chromium executable), with local ports 8089 and 9333. API responses are mocked; it does not write to the real backend.

Checks cover 1440/720/360/320px layouts, short windows down to 568×260, sign-in/registration scroll access, input contrast, invitation error spacing and success, 36 invitations in grouped mode, last-item reachability, accept/reject routing, profile editing, dive card grouping dimensions, required fields and leap-year validation. Screenshots are saved in .expo/ui-fixes-check/.

Browser page magnification is checked separately from narrow-screen reflow; browser toolbar zoom, screen-reader operation and native device keyboard behavior require manual testing.

## Remaining findings

- Favorite buddy still needs one request per dive (existing concurrency limit: four). Removing that cost needs a backend aggregate endpoint.
- API base URL is fixed to localhost:3000. Physical-device or hosted deployment needs a reachable configured address.
- Sign-in still includes the existing demo credentials; remove these before production.
- Profile/detail requests can race on rapid route changes with unusually slow responses. This review does not redesign their data fetching.
