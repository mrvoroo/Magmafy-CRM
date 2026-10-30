# Decisions

Short records of choices made while building, and why.

1. **Frontend only; the backend lives elsewhere.** The Apps Script gateway, sheet tabs and endpoints are built in a separate track. This repo codes against the contract in the build spec (sections 2, 4.7 and 8), which `src/api/schemas.ts` captures and `src/api/mock/server.ts` implements.
2. **Inline i18n `t('ar','en')` instead of JSON message files.** Both strings sit at the call site, so nothing goes missing silently and the Arabic copy reads naturally in review. Sheet values (stage names, statuses) are stored in Arabic and translated for display via `i18n/values.ts`.
3. **Global CSS with tokens instead of CSS Modules.** The kit's components (notched cards, pills, chips, schedule bar) are shared everywhere. One stylesheet plus `data-theme` tokens keeps dark/light and RTL/LTR consistent with logical properties.
4. **In-app mock API instead of MSW.** `VITE_MOCK=1` swaps the transport for an in-browser implementation of every function, persisted to localStorage. It needs no service worker and makes demo builds that open from a plain folder.
5. **Incremental rendering instead of full virtualization.** Lists render in pages ("show more") and the heavy pages are lazy-loaded. Team-scale data (hundreds to low thousands of leads) does not need a virtual scroller.
6. **Gold highlight `#feda75` instead of the kit's lime.** It comes from the magmafy-pro palette, so the highlighted card stays on-brand.
7. **3D is progressive but always the real volcano.** three.js loads lazily at idle. On slow devices the particle count is cut (down to a quarter) and the animation keeps running. Reduced motion freezes one frame. Only «off» or no WebGL draw the same particles once on a 2D canvas. There is no SVG substitute.
8. **All times are Riyadh (UTC+3)** regardless of device timezone, matching the sheet.
9. **Session token in localStorage, short-lived, server-validated.** The OTP flow (`crmRequestCode` → `crmVerifyCode`) is used, with no passwords. The token is revoked by `crmLogout` and expires server-side.
