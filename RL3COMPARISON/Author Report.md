# UI comparison: Astra vs Gemini 3.8 Flash

I compared both implementations against the original task prompt, the supplied screenshots in ReferenceEvidence/, and the same mocked dive data. Both runs started from commit 9f2d1af. Astra's implementation is represented by commit d4eb1ca on branch rl3Astra; Gemini's implementation is the final DiveStatsScreen.tsx recorded in GEMINI/GEMINISESSION.json.

I rendered both implementations with the same fixed date (23 September 2026), timezone (Europe/Madrid),  six base dives, and viewport sizes of 1440, 768, 390, and 320 pixels. The paired screenshots are in the ASTRA/ and GEMINI/ folders. The most relevant comparisons are ASTRA/Foto02-desktop-chart.png versus GEMINI/Foto02-desktop-chart.png, ASTRA/Foto03-mobile-chart.png versus GEMINI/Foto03-mobile-chart.png, and ASTRA/Foto11-narrow-chart.png versus GEMINI/Foto11-narrow-chart.png.

## Preference record

### 1. Understanding the UI request and screenshots — Tie

Both models correctly identified the requested defects. Gemini explicitly traced the chart problem to webChart height 170 with overflow hidden, the fixed webSummaryGrid width, the negative highlight-card margins, the country-row width of 760 pixels, and the incomplete date predicates. Astra identified the same visible causes before implementing the fix: clipped chart labels, fixed web widths, negative highlight margins, month matching without a year, and rolling rather than calendar-year filtering.

Both also recognised additional concerns beyond the five screenshots. Gemini added empty-location handling, minutes in the total, country flags, and accessibility roles. Astra added an explicit request-error state, refresh-on-focus, calendar-date utilities, accessible chart labels, and regression tests. Those differences affect implementation quality, but both models understood the original request and the affected components.

### 2. Layout, alignment, and spacing — Astra better

Astra produces a responsive layout at every tested size. At 1440 pixels all six chart bars use the available chart width (ASTRA/Foto02-desktop-chart.png); at 320 pixels all six remain visible in two rows (ASTRA/Foto11-narrow-chart.png). The highlight cards have separate, non-overlapping rectangles in ASTRA/Foto04-mobile-highlights.png, and the country tracks end inside the card in ASTRA/Foto05-narrow-countries.png.

Gemini removes the original overlap and country overflow, so its cards are also individually visible. However, its chart is intrinsically wider than the 320-pixel viewport: GEMINI/browser-results.json records clientWidth 223, scrollWidth 348, and overflowX scroll at 320 pixels. GEMINI/Foto11-narrow-chart.png therefore shows only the first four columns. The bars can be recovered by horizontal scrolling (GEMINI/Foto12-narrow-chart-after-scroll.png), but the chart does not scale or reflow to the viewport, which is the defect the prompt specifically called out.

Gemini's desktop chart also occupies only the central portion of the large panel (GEMINI/Foto02-desktop-chart.png), while Astra distributes the columns across the panel. Astra therefore handles the requested sizing, spacing, and reflow more completely.

### 3. Typography and visual hierarchy — Astra better

Astra keeps the duration value above each bar and a full date below it, with enough space for both at desktop and mobile (ASTRA/Foto02-desktop-chart.png and ASTRA/Foto03-mobile-chart.png). Long locations remain readable across multiple lines in ASTRA/Foto09-long-labels.png, and the country name remains visible in ASTRA/Foto05-narrow-countries.png.

Gemini improves the chart labels compared with the supplied broken reference, but uses compact labels such as 40m and 15 Aug, and the long-location state truncates with an ellipsis (GEMINI/Foto09-long-labels.png). The country name is also clipped to a single line in that state. The hierarchy is generally coherent in both implementations, but Astra preserves more of the content requested by the logbook screen.

### 4. Colors and component styling — Tie

Both implementations retain the existing light background, white panels, blue primary values, teal chart bars, rounded cards, and pale blue borders. Their highlight cards are visually consistent with the surrounding app in ASTRA/Foto04-mobile-highlights.png and GEMINI/Foto04-mobile-highlights.png. Gemini adds country flags and Astra changes some small text to the darker blue, but neither introduces a visual treatment that breaks the app's design system. The difference is a reasonable styling choice rather than a clear win.

### 5. Images, icons, and visual assets — Not applicable

The task did not request a new image or icon asset. The visible navigation icon comes from the existing navigation header, and the core requested UI consists of cards, bars, labels, and filters. Gemini's country flags are an unsolicited enhancement; they do not resolve one of the five defects. This dimension does not decide the comparison.

### 6. Responsive and adaptive behavior — Astra better

Astra was checked at 1440, 768, 390, and 320 pixels. Its summary cards wrap, its highlights stack cleanly, chart labels stay in the panel, and no tested element extends beyond its container (ASTRA/Foto01-desktop-overview.png, ASTRA/Foto03-mobile-chart.png, ASTRA/Foto04-mobile-highlights.png, and ASTRA/Foto11-narrow-chart.png). With eight dives, it still keeps the chart content readable and contained (ASTRA/Foto13-eight-dives.png).

Gemini's summary and highlight cards do reflow correctly, which is a meaningful improvement over the original screenshots. The duration chart remains a horizontally scrollable fixed-width strip, however. Its hidden scrollbar and no visible scroll affordance make the additional columns easy to miss on narrow screens (GEMINI/Foto11-narrow-chart.png and GEMINI/Foto12-narrow-chart-after-scroll.png). Astra meets the requested responsive behavior more directly.

### 7. UI interactions and state behavior — Astra better

Both implementations make the three period controls interactive and both return zero dives for August 2026 with the fixed test data (ASTRA/Foto06-last-month-empty.png and GEMINI/Foto06-last-month-empty.png). Both return the three dives from calendar year 2025 for Last year (ASTRA/Foto07-last-year.png and GEMINI/Foto07-last-year.png).

Astra also handles the failed /dives/my request with a clear error message and a working Retry control (ASTRA/Foto08-request-error.png; the browser result records retry true and recovered true). Gemini turns the same failed request into an apparently empty logbook: GEMINI/browser-results.json shows zero cards, No dives in this period, and no Retry control. Astra gives the user an actionable state instead of silently presenting incorrect statistics.

### 8. Accessibility and usability — Astra better

Astra adds semantic headings, accessible labels for each chart bar, live regions for loading and period changes, touch targets with a 44-pixel minimum height, and accessible country rows. Its keyboard focus is visible in ASTRA/Foto10-keyboard-focus.png, and the browser accessibility tree exposes headings and focusable period controls.

Gemini also adds headings and radio roles and its keyboard focus is visible in GEMINI/Foto10-keyboard-focus.png. The chart bars and country rows do not receive equivalent meaningful labels, and the long-label screenshot shows content truncated for sighted keyboard and screen-reader users (GEMINI/Foto09-long-labels.png). Astra provides the more useful interaction-level labels and preserves more text. Both implementations should still improve the selected-state semantics for the period controls, but Astra is stronger overall.

### 9. UI fix completeness and regression avoidance — Astra better

Astra addresses all five reported defects and adds focused behavior that protects the screen in real use: it refreshes when the screen regains focus, distinguishes a request failure from an empty logbook, formats total time as hours and minutes, handles invalid dates, avoids mutating the source dive array, and extracts the statistics work into src/utils/diveStats.ts. Its regression checks cover January rollover, leap day, timezone changes, a 10,000-dive dataset, empty states, and the __proto__ country key (BuddyAppFront/scripts/test-dive-stats.cjs in the Astra commit).

Gemini fixes the five visible baseline issues and passes TypeScript and an Expo web export, but it keeps the chart as a fixed-width horizontal strip and does not add a request-error path or focus refresh. Its implementation also performs several full-array sorts for each render and still truncates long content. Astra addresses the causes across states and data sizes instead of fixing only the supplied screenshot.

### 10. Rendered verification and visual evidence — Astra better

Astra's transcript contains rendered browser verification at 1440, 768, 390, and 320 pixels, date-boundary checks, a 10,000-dive calculation check, error/retry checks, and screenshots of the resulting states. Those claims are directly represented by the paired files in ASTRA/ and ASTRA/browser-results.json.

Gemini's transcript records TypeScript checking and a successful Expo web export, but it does not contain a browser run that checks the rendered result at the relevant viewports. The fresh paired captures show the remaining chart behavior: GEMINI/Foto02-desktop-chart.png leaves most of the panel unused and GEMINI/Foto11-narrow-chart.png hides part of the chart until it is manually scrolled. Astra provides stronger rendered evidence and a closer check against the supplied screenshots.

## Author Notes

The decisive difference is the duration chart. Gemini replaced clipping with horizontal scrolling, but it kept a minimum-width chart that does not adapt to the viewport. That leaves the user looking at a partial chart on narrow screens and an unnecessarily small chart on a wide screen. Astra reflows the chart and keeps labels visible.

Gemini did successfully remove the highlight overlap, fix the country-bar overflow, fix the calendar filtering, and add useful country flags. Those improvements are visible in GEMINI/Foto04-mobile-highlights.png, GEMINI/Foto05-narrow-countries.png, GEMINI/Foto06-last-month-empty.png, and GEMINI/Foto07-last-year.png. Astra's advantage comes from completing those fixes while also handling responsive chart layout, error recovery, long labels, focus refresh, and rendered verification.

## Overall UI comparison

Astra has a significant, verifiable advantage for this task. The central requirement was to repair a broken statistics layout across desktop and narrow screens. Astra makes the duration chart readable and contained at all tested widths, while Gemini leaves the chart dependent on an undisclosed horizontal scroll and visibly partial in the narrow capture. Astra also preserves long content and gives a recoverable error state; Gemini silently represents a failed request as an empty logbook.

Gemini is not a failure: its cards, filters, highlights, country bars, and calendar predicates are materially better than the original screen. The remaining chart behavior is still a central defect, though, so Astra is the stronger implementation for the requested UI outcome.
