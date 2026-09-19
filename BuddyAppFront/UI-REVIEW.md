UI review against f73f983
=========================

Implemented
-----------
- MyDives uses one virtualized SectionList and one card renderer for both grouping modes. Removed negative margins that clipped borders and shadows.
- Shared 1050px maximum content width and 20px gutters across list, creation and detail screens. Content shrinks to fit narrow viewports; native browser zoom is retained. There was no explicit zoom suppression in the original source or generated viewport tag.
- Creation fields have consistent borders, spacing and minimum heights. Date fields use four columns on wide screens and two on narrow screens or with enlarged native fonts. Web styles apply directly to the select; Android retains its native picker with a dialog. The form scrolls and supports keyboard avoidance.
- Preserved the existing blue/teal palette, increased muted text contrast, added accessible control names and larger touch targets.
- Added logbook loading, empty and retry states; limited favorite-buddy request concurrency to four and ignored obsolete calculations. This still makes one buddy request per dive; a backend aggregate endpoint would remove that cost.
- Removed hidden sample values from new dives, exposed optional notes, validated calendar dates and positive integer measurements, prevented repeated submissions and made save failures visible on web.
- Detail notes no longer extend beyond other cards. Removed the nested buddy list and added load failure feedback. Profile/detail reload when their route IDs change; opening your own profile clears the previous buddy ID.

Verification
------------
- TypeScript: `node node_modules/typescript/bin/tsc --noEmit`.
- Web, Android and iOS JavaScript bundles: `node node_modules/expo/bin/cli export --platform all`.
- Headless Edge smoke test: `node scripts/check-ui.cjs` after exporting. Requires Node 24, free local ports 8089/9333, and Edge at the default Windows location (or set UI_BROWSER to a Chromium executable). Requests to the API are intercepted with fixtures; no real dives are written.
- Browser assertions cover identical card dimensions after grouping changes, control bounds at 1440/720/360/320px, minimum control heights, native page magnification at 200%, required fields, rejection of 29 February 2023 and acceptance of 29 February 2024, and successful submission. Screenshots are written under `.expo/ui-check/`.
- Reviewed desktop and narrow-screen screenshots. Native bundles passed, but Android/iOS device rendering, keyboard behavior, and screen-reader operation still need device testing. Page magnification and narrow-viewport reflow were checked separately; browser toolbar zoom was not automated.

Additional findings
-------------------
- `src/api/api.ts` hardcodes localhost:3000. On a physical Android phone this addresses the phone, not the development PC; configure a reachable backend address for device testing/deployment.
- Login includes demo credentials and a web-relative logo URL. It also navigates to MyDives without resetting the login route, so Back can return to Login.
- Profile and detail requests do not cancel on route changes; unusually slow responses can still race. Several invitation/profile feedback timers are not cleared on unmount.
- Teal buttons elsewhere in the app still deserve a full contrast audit. This change preserves their palette rather than attempting an app-wide redesign.
