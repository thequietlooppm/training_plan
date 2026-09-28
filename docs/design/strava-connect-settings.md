# Design spec — Strava connect / settings

> Owned by `@designer`. Status: **ready for implementation** — scoped against
> issue #20, FR12 and FR15 in `docs/planning/web-v1-requirements.md`, and
> NFR3 (token encryption/isolation, purge-on-disconnect timing). Companion
> doc: `docs/design/ui-toolkit.md` (Tempo color/type system — this spec pulls
> its tokens from there, it doesn't define new ones). This is a new spec —
> no prior draft existed for this screen.

---

## 1. What this screen is

The settings surface where a runner connects their Strava account so
activities sync automatically into the training calendar (FR13), and where
they can disconnect it again (FR15). Reached from the calendar's settings
icon (`docs/design/training-calendar.md` §4.1's `[⚙]`) and from the
calendar's own "not connected" nudge banner (`training-calendar.md` §4.1b).

**In scope:** the connection lifecycle — not-connected, connecting,
connected (with last-synced time), auth-expired, error — plus disconnect
with its confirmation and purge-behavior copy (FR15).

**Explicitly out of scope:**
- Any other settings (units, week start, notifications — all still open
  questions per `training-calendar.md` §8). This spec is the Strava
  connection card only; for v1 it may be the entire content of the Settings
  screen, but the IA of a larger settings page isn't designed here.
- Displaying the runner's Strava name/profile anywhere — deferred to the
  "Sign in with Strava" fast-follow (FR27); MVP's "connect Strava" is
  sync-only and displays no Strava profile data at all (see §7).
- The actual OAuth screen itself (that's Strava's own UI, not ours) and the
  token-exchange/webhook backend work (NFR2/NFR3, swe + deploy-engineer).
- Backfill job progress detail beyond the lightweight banner already speced
  in `training-calendar.md` §3's backfill note — this screen doesn't add a
  second backfill-status surface.

---

## 2. Look and feel — references

A different job again: not a data-entry form (`plan-setup-flow.md`) and not
a longitudinal view (`training-calendar.md`) — this is a **third-party
account-connection settings card**, a pattern well established outside
running apps specifically, so the closest references are integration-
settings pages generally, plus one in-category example.

| App / tool | What it does well | Borrow | Skip |
|---|---|---|---|
| **Linear — Settings → Integrations** | Each integration is one card: icon, name, one-line description, and a single clear action (Connect / Connected + a small overflow for Disconnect). Connected state shows *just enough* — no dashboard, no nested config — before you'd ever need to click further. | The one-card-per-integration shape and the restraint on the connected state: name, status, last-relevant-fact (here: last synced), one clear action. Nothing else competes for attention. | Linear's settings page has many integrations in a list; we have exactly one (Strava), so skip any "list of integrations" chrome — this is a single card, not a list. |
| **Notion — Settings → Connections** | Connect is a single button that starts OAuth immediately — no intermediate "are you sure" screen before the redirect (the redirect *is* the confirmation, since the runner approves scopes on Strava's own consent screen). Disconnect, by contrast, **does** confirm in-app, because it's the destructive direction. | The asymmetry: connecting needs no in-app confirmation (OAuth's own consent screen already is one); disconnecting does, because it's the action that loses something (FR15's purge). | Notion's connection cards show the connected account's name/avatar — exactly what FR27's deferral rules out for MVP; skip that detail entirely here (§7). |
| **TrainingPeaks — device/partner connections page** | States a connected partner's **last sync time** plainly and prominently — the single most useful fact once you're connected ("is this actually working right now"), surfaced without digging into logs. | The last-synced-time-as-headline-fact pattern — directly what FR12 asks for in the connected state, and the thing a runner actually wants to know at a glance ("did today's run show up yet"). | TrainingPeaks' per-device granularity (multiple watches, multiple partners at once) — we have exactly one provider (Strava) in scope; no multi-provider list UI needed. |
| **Strava itself — Settings → My Apps** | Ironic but genuinely useful reference: Strava's own UI for managing *other* apps' access to *your* Strava account states plainly what a connected app can do and gives a one-tap revoke with a clear "this app will no longer be able to..." warning before you confirm. | The plain, specific "here's what stops happening" warning copy pattern for the disconnect confirmation — we adapt it to state FR15's actual behavior (sync stops, raw data is purged, already-applied completions persist) rather than a vague "are you sure?". | Strava's own settings page's broader chrome (it's a dense account-settings page with many unrelated sections) — not relevant, ours is a single focused card. |

### Direction (one paragraph)

This is **one card, one job**: show whether Strava is connected, and if so,
since when it last synced; if not, one button starts it. Borrowing Linear's
restraint (no dashboard, no nested config) and Notion's asymmetric
confirmation pattern (OAuth's own consent screen is the "are you sure" for
connecting; an in-app `AlertDialog` is the "are you sure" for disconnecting,
because only disconnecting loses data), the card never shows more than five
things at once: connection status, last-synced time, one primary action, and
— only in the error/expired states — a short explanation of what's wrong.
Colors and type come straight from Tempo (`ui-toolkit.md`) — the same warm
accent, the same status-color discipline used for completion status
(green/amber/red/neutral, applied here to *connection* lifecycle instead of
*workout* status, same underlying tokens, a distinct vocabulary, see §5.2)
— so this screen reads as the same product as the calendar and plan-setup
screens, not a bolted-on settings page.

### Principles

- One card, one primary action per state — never two competing CTAs.
- Connecting needs no in-app confirmation (the OAuth consent screen already
  is one); disconnecting does, because it's the direction that loses data
  (FR15).
- The disconnect confirmation states **exactly** what happens — sync stops,
  raw activity data is purged, already-applied completions persist — not a
  generic "are you sure?". No hidden consequences.
- No Strava profile data (name, avatar) rendered anywhere in this MVP scope
  — see §7.
- Never rely on color alone for connection status — same rule as
  completion status, paired with icon + text label every time.

---

## 3. User flow

### Entry points

- Calendar top bar `[⚙]` (`training-calendar.md` §4.1) → Settings screen,
  Strava card visible.
- Calendar's "not connected" nudge banner (`training-calendar.md` §4.1b) →
  same destination, `Connect` button pre-focused.

### States and transitions

```
                    ┌───────────────────────────────┐
  entry ───────────▶│  Strava connection card       │
                    │   ├─ not connected             │
                    │   ├─ connecting                │
                    │   ├─ connected (last synced)   │
                    │   ├─ auth expired               │
                    │   └─ error                      │
                    └───────────────────────────────┘
        tap Connect        │              │  tap Disconnect
        (not-connected     │              │  (connected/expired)
        or expired state)  │              │
             │             │              ▼
             ▼             │      ┌───────────────────┐
  external redirect        │      │ AlertDialog:       │
  to Strava OAuth           │      │ "Disconnect        │
  consent screen             │      │  Strava?" + purge  │
             │             │      │  copy, Cancel/     │
      approves / denies    │      │  Disconnect        │
             │             │      └───────────────────┘
             ▼             │           │           │
      returns to app  ─────┘      Cancel      Disconnect (confirm)
             │                      │               │
             ▼                      ▼               ▼
       connecting (brief,      card unchanged   token revoked,
       token exchange)                          raw data purged,
             │                                  card → not-connected
        ┌────┴────┐                             + confirmation toast
        ▼         ▼
    connected   error
```

### Flow — connect

1. Runner taps **Connect** (not-connected state) or **Reconnect**
   (auth-expired state — same action, different label, see §5.3).
2. Browser navigates to Strava's own OAuth consent screen (external, not
   designed here). Runner approves or denies scopes there.
3. Strava redirects back to the app with an auth code (or a denial). The app
   exchanges it server-side. While that's in flight: **connecting** state
   (§4.2) — brief, no spinner, skeleton mirrors the connected-card layout.
4. Success → **connected** state, last-synced time initially reads "Just
   connected" (no sync has run yet) until the first webhook-driven sync
   updates it (FR13). If this connection is a mid-cycle join or plan switch,
   the calendar's backfill banner appears separately (`training-calendar.md`
   §3) — this card doesn't duplicate that messaging.
5. Failure (token exchange fails, or the runner denied consent on Strava's
   screen) → **error** state (§4.5), with **Try again** re-starting from
   step 1.

### Flow — disconnect (FR15)

1. Runner taps **Disconnect** (connected or auth-expired state).
2. `AlertDialog` opens **in-app** (the one confirmation on this whole
   screen, per §2's asymmetry principle) stating plainly: sync stops
   immediately, stored raw Strava activity data is deleted, workouts already
   marked complete from past matches **stay** marked complete (FR15 — "
   already-applied completions persist by default").
3. **Cancel** → dialog closes, nothing changes.
4. **Disconnect** (destructive-styled confirm) → token is revoked
   server-side, raw activity data purge is triggered (NFR3: within 24h —
   this screen doesn't block on that being instant, see §5.3's copy), card
   returns to **not-connected**, and a `aria-live="polite"` confirmation
   announces "Strava disconnected. Your synced activity data will be
   deleted." No toast — same "inline is enough" convention as the other two
   screens.

### Flow — auth expired (token revoked/expired outside the app)

1. A background sync attempt fails because Strava's token is no longer
   valid (revoked on Strava's side, or expired without a working refresh).
2. Next time the runner views this card (or the calendar's not-connected-
   style banner, reworded for this case — see §5.3), it shows **auth
   expired**, not silently falling back to "not connected" — the distinction
   matters because a runner who revoked access on purpose should see a
   "not connected"-equivalent, but a runner surprised by an expired token
   needs to know *something* changed, not just that nothing's connected.
3. Runner taps **Reconnect** → same flow as "connect," above.

---

## 4. Wireframes

### 4.1 Not connected

```
┌─────────────────────────────────────┐
│ Settings                             │  h1
├─────────────────────────────────────┤
│ ┌───────────────────────────────┐   │
│ │ Strava                         │   │  h2 (card title)
│ │ Not connected                  │   │  status chip: neutral, link-2-off icon
│ │                                 │   │
│ │ Connect Strava to automatically│   │  one-line description
│ │ match your logged activities   │   │
│ │ to your training plan.         │   │
│ │                                 │   │
│ │  ┌───────────────────────────┐ │   │
│ │  │  Connect Strava      ↗   │ │   │  primary button, external-link icon
│ │  └───────────────────────────┘ │   │  signals it leaves the app
│ └───────────────────────────────┘   │
└─────────────────────────────────────┘
```

### 4.2 Connecting (brief, after returning from Strava's OAuth screen)

```
│ ┌───────────────────────────────┐   │
│ │ Strava                         │   │
│ │ ▓▓▓▓▓▓▓▓▓▓▓ (skeleton)          │   │  status chip skeleton
│ │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓         │   │  description-line skeleton
│ │ ▓▓▓▓▓▓▓▓▓▓▓                     │   │  button-shape skeleton
│ └───────────────────────────────┘   │
```
SR-only: `aria-busy="true"` on the card, polite "Connecting to Strava." No
spinner — same skeleton-mirrors-layout convention as every other loading
state in this app.

### 4.3 Connected

```
│ ┌───────────────────────────────┐   │
│ │ Strava                         │   │
│ │ ✓ Connected                    │   │  status chip: green, check-circle-2
│ │ Last synced 12 minutes ago     │   │  relative time; title attr = full timestamp
│ │                                 │   │
│ │  ┌───────────────────────────┐ │   │
│ │  │        Disconnect         │ │   │  secondary/outline button — NOT destructive-
│ │  └───────────────────────────┘ │   │  styled until the confirm dialog (§4's asymmetry)
│ └───────────────────────────────┘   │
```

"Just connected" (no relative-time yet) is the same layout, first sync
hasn't landed.

### 4.4 Auth expired

```
│ ┌───────────────────────────────┐   │
│ │ Strava                         │   │
│ │ ⚠ Reconnect needed             │   │  status chip: amber, alert-triangle
│ │ Strava access expired. Your    │   │  explanation
│ │ activities have stopped        │   │
│ │ syncing.                       │   │
│ │                                 │   │
│ │  ┌───────────────────────────┐ │   │
│ │  │   Reconnect Strava    ↗  │ │   │  primary button, same flow as Connect
│ │  └───────────────────────────┘ │   │
│ │           Disconnect          │ │   │  secondary text action — still lets the
│ └───────────────────────────────┘   │  runner fully disconnect instead of reconnecting
```

### 4.5 Error (token exchange failed, or denied consent on Strava's screen)

```
│ ┌───────────────────────────────┐   │
│ │ Strava                         │   │
│ │ ┌─────────────────────────┐   │   │
│ │ │ ⚠ Couldn't connect to   │   │   │  Alert, destructive variant
│ │ │   Strava. Try again.    │   │   │
│ │ └─────────────────────────┘   │   │
│ │  ┌───────────────────────────┐ │   │
│ │  │       Try again           │ │   │
│ │  └───────────────────────────┘ │   │
│ └───────────────────────────────┘   │
```

### 4.6 Disconnect confirmation (`AlertDialog`, over the connected or auth-expired state)

```
┌─────────────────────────────────────┐
│  Disconnect Strava?                  │  AlertDialog title
│                                      │
│  This stops future syncing and       │  body copy — states FR15's actual
│  permanently deletes your stored     │  behavior, not a generic warning
│  Strava activity data. Workouts      │
│  you've already confirmed as         │
│  complete will stay marked complete. │
│                                      │
│         ┌────────┐ ┌─────────────┐  │
│         │ Cancel │ │ Disconnect  │  │  Cancel = default focus;
│         └────────┘ └─────────────┘  │  Disconnect = destructive variant
└─────────────────────────────────────┘
```

---

## 5. Interface detail

### 5.1 Layout & spacing intent

- Single `Card`, same width/rhythm as `plan-setup-flow.md`'s form sections
  (`max-w-2xl` centered) — this is a settings page, not a dense dashboard,
  so it inherits the same calm, generous spacing as the rest of the app.
- Status chip sits directly under the card title, same position and
  register as the day-detail sheet's completion-status chip
  (`training-calendar.md` §4.2) — visually the same *kind* of element
  (icon + label + color) even though it means something different
  (connection lifecycle, not workout status). See §5.2 for why that's a
  deliberate, coherent reuse rather than two unrelated systems.
- Exactly one primary button per state, full width on mobile, inline-width
  on tablet/desktop (this card never needs to fill the viewport width the
  way a submit button on a long form does).
- The destructive framing (red) is reserved for the **confirmation dialog's
  Disconnect button only** — the card's own "Disconnect" trigger button
  stays a neutral/outline `Button`, not red, so the card itself doesn't read
  as alarming just because disconnect is *available*; the warning treatment
  belongs to the moment of actually confirming it (§2's asymmetry
  principle, and Strava's own "My Apps" precedent, §2's reference table).

### 5.2 Connection-status vocabulary vs. completion-status vocabulary — same tokens, different meaning

This card's status chip (Not connected / Connecting / Connected / Reconnect
needed / Error) is **visually built from the same Tempo tokens** as the
calendar's completion-status chip (`ui-toolkit.md`) — green for a good
state, amber for "needs attention," red for a failure, neutral grey for an
inactive/default state — but it is **not** the same four-value enum, and the
two are never shown side by side in a way that could be confused (they live
on entirely different screens). Mapping used here:

| Connection state | Icon | Label | Color token (Tempo) |
|---|---|---|---|
| Not connected | `link-2-off` | "Not connected" | `text/secondary` (neutral) |
| Connecting | *(skeleton, no icon)* | "Connecting to Strava" (SR-only) | — |
| Connected | `check-circle-2` | "Connected" | `green-700`/`green-500` (same hex as completion-status Achieved) |
| Auth expired | `alert-triangle` | "Reconnect needed" | `amber-700`/`amber-500` (same hex as completion-status Partial) |
| Error | `alert-triangle` | (in an `Alert`, not a chip — see §4.5) | `destructive/text` (same as completion-status Missed) |

Reusing the exact hexes (rather than inventing a parallel "connection
green"/"connection red") keeps the palette to the same four semantic hues
established once in `ui-toolkit.md`, applied consistently everywhere they're
needed — exactly the "one deliberate system, not per-screen patching" goal
of this whole design pass.

### 5.3 Component mapping

| Element | shadcn/ui primitive | Notes |
|---|---|---|
| Card | `Card` / `CardHeader` / `CardContent` | Same as every other screen. |
| Connect / Reconnect button | `Button` (primary) | `external-link` icon (Lucide) signals the OAuth redirect leaves the app. |
| Disconnect button (on the card) | `Button` (outline variant, **not** destructive) | See §5.1 for why it stays neutral until the confirm dialog. |
| Status chip | `Badge` (custom color per §5.2) | Same underlying component as the calendar's `StatusBadge` (`ui-toolkit.md`), different value set. |
| Disconnect confirmation | `AlertDialog` | **New adoption**, see `ui-toolkit.md`. Cancel = default-focused; Disconnect = destructive `Button` variant inside the dialog. |
| Error message | `Alert` (destructive variant) | Reused from `plan-setup-flow.md`/`training-calendar.md`'s existing pattern. |
| Connecting state | `Skeleton` | Mirrors the connected-card layout, same convention as every other loading state in this app. |
| Live-region confirmation (post-disconnect, post-connect) | inline `aria-live="polite"` | Same "inline is enough for v1" call as the other two screens. |
| Icons | Lucide: `link-2-off`, `check-circle-2`, `alert-triangle`, `external-link`, `clock` (implicit in "Last synced" — no dedicated clock glyph needed if the text is legible on its own; flagged as optional) | Consistent with `ui-toolkit.md`. |

### 5.4 Copy

| Context | Text |
|---|---|
| Page/section title | `Settings` (h1) — card title `Strava` (h2) |
| Not-connected status | `Not connected` |
| Not-connected description | `Connect Strava to automatically match your logged activities to your training plan.` |
| Connect button | `Connect Strava` |
| Connecting (SR-only) | `Connecting to Strava` |
| Connected status | `Connected` |
| Last synced, relative | `Last synced 12 minutes ago` (full timestamp in a `title` attribute, e.g. `Fri, Mar 7, 2026, 6:58 AM`) |
| Last synced, never yet | `Just connected` |
| Disconnect button (on card) | `Disconnect` |
| Auth-expired status | `Reconnect needed` |
| Auth-expired description | `Strava access expired. Your activities have stopped syncing.` |
| Reconnect button | `Reconnect Strava` |
| Error alert | `Couldn't connect to Strava. Try again.` |
| Error retry button | `Try again` |
| Disconnect dialog title | `Disconnect Strava?` |
| Disconnect dialog body | `This stops future syncing and permanently deletes your stored Strava activity data. Workouts you've already confirmed as complete will stay marked complete.` (verbatim — states FR15's actual behavior, not a generic warning) |
| Disconnect dialog Cancel | `Cancel` |
| Disconnect dialog confirm | `Disconnect` |
| Live region — disconnected | `Strava disconnected. Your synced activity data will be deleted.` |
| Live region — connected | `Strava connected.` |
| Not-connected banner (on the calendar, restated from `training-calendar.md` §4.1b) | `Connect Strava to see your completed workouts here automatically.` |
| Auth-expired banner (calendar-side equivalent, new — parallels the not-connected banner) | `Your Strava connection needs to be renewed to keep syncing activities.` + button `Reconnect` |

Tone: plain, second person, matches the house voice — no exclamation marks,
no "Oops!"/"Uh-oh" framing on the error state.

### 5.5 Responsive behavior

| Breakpoint | Layout |
|---|---|
| **Mobile < 640px** | Single column, full-width `Card`, full-width primary button. `AlertDialog` renders as a bottom-anchored sheet-style dialog (shadcn default mobile behavior) or centered modal — either is fine, no calendar-style side-panel needed since this is a single confirmation, not a detail view. |
| **Tablet 640–1024px** | Same single-column card, `max-w-2xl` centered, inline-width buttons instead of full-width. |
| **Desktop ≥ 1024px** | Same, centered, `max-w-2xl` — no multi-column layout; this is a one-card settings screen, a wide layout adds nothing. |

No layout depends on hover.

---

## 6. Accessibility

Target: WCAG 2.2 AA.

### Keyboard path & focus order

1. Page `<h1>` "Settings" (not focusable).
2. Strava card: title (not focusable), status chip (not focusable — a
   status indicator, not a control), description text (not focusable).
3. Primary button (Connect / Reconnect / Try again) — whichever the current
   state shows.
4. Disconnect button (connected / auth-expired states only).

### Disconnect confirmation

- `AlertDialog` traps focus; opens with focus on **Cancel** (the
  non-destructive default, standard `AlertDialog` convention — never default
  to the destructive action).
- `role="alertdialog"`, `aria-labelledby` → the title, `aria-describedby` →
  the body copy, so the purge-behavior sentence is read in full before
  either button is reachable.
- Esc = Cancel. Clicking the scrim = Cancel (no accidental disconnect from
  an outside click).
- On confirm, focus returns to the Strava card (now in its not-connected
  state) after the dialog closes, and the live region announces the result.

### Semantics / roles / labels

- Status chip: icon `aria-hidden="true"`, the label text is what's actually
  announced — never color-only, matching every other screen's rule.
- "Last synced" time: visible relative text (`12 minutes ago`) plus a
  `title` attribute with the full timestamp for a sighted mouse-hover user;
  for screen readers, the relative text itself is sufficient (no separate
  `aria-label` needed since the visible text is already a complete
  sentence-fragment, not an ambiguous icon).
- Connect/Reconnect button: `aria-label` isn't needed beyond the visible
  text, but note for implementation that the external-link icon should carry
  `aria-hidden="true"` — the button's accessible name is its text content,
  not "opens in a new context" boilerplate, since it's a full-page
  navigation (to Strava's OAuth screen and back), not a new tab.

### Contrast

- Connected/expired status chip text: reuses the completion-status hexes
  already verified in `ui-toolkit.md` (green ~5.0–7.9:1, amber ~5.0–8.3:1
  depending on mode) — no new contrast risk introduced by this screen.
- Error `Alert`: reuses `destructive/text` (~4.8:1 light / ~6.5:1 dark),
  same as every other destructive alert in the app.
- "Last synced" relative-time text: `text/secondary`, ≥4.5:1 (verified in
  `ui-toolkit.md`, ~7.6:1 light / ~7.1:1 dark) — it's informational, not
  decorative, so it doesn't get the lower-contrast `text/disabled` treatment.
- Focus ring: visible, ≥3:1, never suppressed, including inside the
  `AlertDialog`.

### Touch targets

- Primary button, Disconnect button, and both `AlertDialog` buttons: ≥44×44
  CSS px.

### Motion

- `prefers-reduced-motion`: `AlertDialog` open/close becomes an instant
  show/hide, not a fade/scale transition. No other motion on this screen.

---

## 7. Data asked of the user

Per CLAUDE.md's privacy/data-minimization principle:

| Field / grant | Why it's collected | PII? |
|---|---|---|
| Strava OAuth access + refresh token | FR12/FR13 — required to sync activities on the runner's behalf. Not directly entered by the runner (it's an OAuth grant via redirect), but it is a secret credential. | PII-adjacent secret — isolated table, encrypted at rest (NFR3); a separate, deferred ADR covers the exact encryption/secrets approach when Strava-sync implementation starts (already noted in `web-v1-requirements.md`). |
| Strava `provider_athlete_id` | Needed to map incoming webhook deliveries to the right runner. | Opaque-ish, provider-assigned; never used as a join key into the `activities` table (per `web-v1-requirements.md`'s "Data collected" section). |
| Synced activity data (type, start time, distance, moving/elapsed time, optional avg HR) | The actual sync payload FR13 exists to fetch. | Analytics-safe, keyed by opaque `activity_id`; no GPS/polyline/lat-lng/gear/calories collected (already scoped in `web-v1-requirements.md`). |

**Explicitly not collected or displayed by this screen:** Strava display
name, avatar, or any other profile field. `web-v1-requirements.md` is
explicit that a Strava display name is **deferred to the "Sign in with
Strava" fast-follow (FR27)** and not part of MVP — this spec holds that
line: the connected state (§4.3) shows a generic "Connected" status and a
sync timestamp, **never** "Connected as [name]" or any avatar/profile
element, even though Strava's OAuth grant this screen requests could
technically return that data. Don't render it just because it's available in
the response.

---

## 8. New vs. reused patterns

| Pattern | Reused from | New? | Why |
|---|---|---|---|
| Card-based section layout, skeleton loading, error-with-retry | `HomePage.tsx` / `plan-setup-flow.md` / `training-calendar.md` | Reused | Same house patterns. |
| Status chip (icon + label + color) | `ui-toolkit.md`'s completion-status system | New use, same underlying tokens/component | See §5.2 — deliberate reuse of the same four hues for a different vocabulary (connection lifecycle vs. workout status), not a fifth palette. |
| `AlertDialog` for a destructive confirmation | — | New | First adoption of this primitive in the repo — see `ui-toolkit.md`. The asymmetric "connect needs no in-app confirm, disconnect does" call (§2/§3) is the reusable house convention if a future screen has a similar external-connection lifecycle (e.g. FR26's Google Calendar sync). |
| External-OAuth-redirect "Connect" button pattern | — | New | First screen with an external-provider OAuth flow; the connecting/error/expired state handling here is the template FR26/FR27 (Google Calendar sync, Sign in with Strava) should follow when those are specced, rather than each reinventing its own connection-state vocabulary. |

---

## 9. Validate with users

- **"Reconnect needed" vs. "Not connected" distinction (§3's auth-expired
  flow).** Confirm runners actually notice and understand the difference —
  if it reads the same as "not connected" to most people, the extra state
  isn't earning its complexity and could collapse into a single "not
  connected, here's why" treatment.
- **Disconnect confirmation copy (§4.6).** Confirm the purge-behavior
  sentence is actually read and understood before confirming — this is the
  one place in the app where a real action (data deletion) is one confirm
  away; watch for anyone disconnecting by accident or being surprised by
  what "disconnect" actually does.
- **"Last synced" trust signal.** Confirm the relative-time readout is
  actually what runners check to answer "is this working" — if people go
  looking for more detail (e.g., "how many activities have synced total"),
  that's a scope signal for a future revision, not something to add here
  preemptively.
