# Design spec — Strava connect / settings

> Owned by `@designer`. Status: **ready for implementation once PR #53 is
> merged into this branch** — scoped against issue #20, FR12 and FR15 in
> `docs/planning/web-v1-requirements.md`, and NFR3 (token encryption/
> isolation, purge-on-disconnect timing). This is a new spec — no prior draft
> existed for this screen.
>
> **Dependencies — where the things named here are defined.** This PR (#55)
> touches only this file and `docs/design/training-calendar.md`; it does
> **not** modify `docs/design/ui-toolkit.md`. The **Tempo** color/type tokens,
> the completion-status decision (green/amber/red/neutral hexes and verified
> contrast ratios), and `plan-setup-flow.md` live on **PR #53** and arrive in
> this tree when `main` is merged into this branch after #53 lands. Pointers
> below to "`ui-toolkit.md`" mean #53's version of that file. The toolkit rows
> this spec needs (`StatusBadge` connection value set, `AlertDialog`, amber
> `Alert` variant, Lucide glyphs) are listed once, in
> `training-calendar.md` §10, to be added after #53 is in.

---

## 1. What this screen is

The settings surface where a runner connects their Strava account so
activities sync automatically into the training calendar (FR13), and where
they can disconnect it again (FR15). Reached from the calendar's settings icon
(`docs/design/training-calendar.md` §4.1's `[⚙]`) and from the calendar's two
connection banners: **not connected** (`training-calendar.md` §4.1b) and
**reconnect needed** (`training-calendar.md` §4.1c — drawn there, copy shared
with §5.4 below).

**In scope:** the connection lifecycle — not-connected, connecting, connected
(with last-synced time), auth-expired, error — plus disconnect with its
confirmation and purge-behavior copy (FR15).

**Explicitly out of scope:**
- Any other settings (notifications etc. — still open per
  `training-calendar.md` §8; units and week start are settled — miles,
  Monday — and need no setting). This spec is the Strava connection card
  only; for v1 it may be the entire Settings screen.
- Displaying the runner's Strava name/profile anywhere — deferred to the
  "Sign in with Strava" fast-follow (FR27) (see §7).
- The OAuth consent screen itself (Strava's UI) and the token-exchange/
  webhook backend work (NFR2/NFR3, swe + deploy-engineer) — but see §3's
  "Connect — constraints for implementation" for the shape this UI requires.
- Backfill progress beyond the lightweight banner in `training-calendar.md`
  §3's backfill note.

---

## 2. Look and feel — references

A third-party **account-connection settings card**, a pattern well
established outside running apps, so the closest references are
integration-settings pages, plus one in-category example.

| App / tool | What it does well | Borrow | Skip |
|---|---|---|---|
| **Linear — Settings → Integrations** | Each integration is one card: icon, name, one-line description, one clear action. Connected state shows *just enough*. | One-card-per-integration shape; restraint on the connected state: name, status, last-relevant-fact (last synced), one action. | The list-of-integrations chrome — we have exactly one. |
| **Notion — Settings → Connections** | Connect is a single button that starts OAuth immediately — no "are you sure" before the redirect. Disconnect **does** confirm in-app. | The asymmetry: connecting needs no in-app confirmation (the consent screen is one); disconnecting does. | Showing the connected account's name/avatar — FR27's deferral rules it out for MVP (§7). |
| **TrainingPeaks — device/partner connections page** | States a partner's **last sync time** plainly — the most useful fact once connected. | Last-synced-time as the headline fact (FR12). | Per-device granularity / multi-partner lists. |
| **Strava itself — Settings → My Apps** | Plainly states what a connected app can do and gives a one-tap revoke with a clear "this app will no longer be able to..." warning. | The specific "here's what stops happening" warning copy for the disconnect confirmation, adapted to FR15's actual behavior. | Strava's broader dense account-settings chrome. |

### Direction (one paragraph)

**One card, one job**: show whether Strava is connected and, if so, when it
last synced; if not, one button starts it. Borrowing Linear's restraint and
Notion's asymmetric confirmation (OAuth's consent screen is the "are you
sure" for connecting; an in-app `AlertDialog` is the "are you sure" for
disconnecting, because only disconnecting loses data), the card never shows
more than: connection status, last-synced time, one primary action, and —
only in error/expired states — a short explanation. Colors and type come from
Tempo (`ui-toolkit.md`, arriving with #53) — the same status-color
discipline as completion status, applied to *connection* lifecycle (§5.2).

### Principles

- One card, one primary action per state — never two competing CTAs.
- Connecting needs no in-app confirmation; disconnecting does (FR15).
- The disconnect confirmation states **exactly** what happens — sync stops,
  raw activity data is purged, already-applied completions persist.
- No Strava profile data (name, avatar) rendered anywhere in this MVP scope
  (§7).
- Never rely on color alone for connection status — icon + text label every
  time.

---

## 3. User flow

### Entry points

- Calendar top bar `[⚙]` → Settings, Strava card visible.
- Calendar "not connected" banner (`training-calendar.md` §4.1b) → same
  destination, `Connect Strava` pre-focused.
- Calendar "reconnect needed" banner (`training-calendar.md` §4.1c) → same
  destination, `Reconnect Strava` pre-focused.

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
        ┌────┴────┐                             + live-region confirmation
        ▼         ▼
    connected   error
```

### Connect — constraints for implementation (swe / tech-lead)

The UI is a client of an API that native iOS/Android will reuse, so:

- **Authorization-code exchange happens server-side**, on an endpoint under
  `/api/v1/…`. The web app never sees the access/refresh tokens. Use PKCE
  where Strava's OAuth supports it (swe to confirm against Strava's docs);
  otherwise the standard `state` parameter + server-held client secret.
  Exact endpoint shape is an engineering call.
- **Not a cookie-only SPA session.** The grant must be completable by a
  native client (`ASWebAuthenticationSession` on iOS, Custom Tabs on
  Android) against the same `/api/v1` endpoints. The web app is just one
  client of it.
- **No User-Agent sniffing** to pick a flow. One flow, parameterised by the
  client's redirect target.
- On web, "Browser navigates to Strava" (step 2 below) is a full-page
  navigation to the authorization URL the API provides, returning to the
  Settings route with a result the UI turns into the connected or error
  state.

### Flow — connect

1. Runner taps **Connect Strava** (not-connected) or **Reconnect Strava**
   (auth-expired — same action, different label, §5.4).
2. Browser navigates to Strava's OAuth consent screen (external). Runner
   approves or denies scopes there.
3. Strava redirects back with an authorization code (or a denial). The
   **API** exchanges it (see constraints above). While in flight:
   **connecting** state (§4.2) — brief, no spinner, skeleton mirrors the
   connected-card layout.
4. Success → **connected**, last-synced reads "Just connected" until the
   first webhook-driven sync updates it (FR13). A mid-cycle join or plan
   switch triggers the calendar's backfill banner separately
   (`training-calendar.md` §3); this card doesn't duplicate it.
5. Failure (exchange fails, or consent denied on Strava's screen) →
   **error** (§4.5); **Try again** restarts from step 1.

### Flow — disconnect (FR15)

1. Runner taps **Disconnect** (connected or auth-expired).
2. `AlertDialog` opens in-app (the one confirmation on this screen) stating
   plainly: sync stops immediately, stored raw Strava activity data is
   deleted, workouts already confirmed as complete **stay** complete (FR15).
3. **Cancel** → dialog closes, nothing changes.
4. **Disconnect** (destructive confirm) → token revoked server-side, raw
   activity data purge triggered (NFR3: within 24h — the screen doesn't
   block on it being instant, §5.4), card returns to **not-connected**, and
   an `aria-live="polite"` region announces "Strava disconnected. Your synced
   activity data will be deleted." **No toast** — inline live region only,
   the convention on all three screens.

### Flow — auth expired (token revoked/expired outside the app)

1. A background sync fails because Strava's token is no longer valid.
2. The next time the runner opens the calendar, the **reconnect-needed
   banner** (`training-calendar.md` §4.1c) shows; on this card the state is
   **auth expired**. It is distinct from "not connected": a runner surprised
   by an expired token needs to know something changed.
3. Runner taps **Reconnect** (banner) → this screen with `Reconnect Strava`
   focused, or **Reconnect Strava** directly on the card → same flow as
   connect.

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
spinner.

### 4.3 Connected

```
│ ┌───────────────────────────────┐   │
│ │ Strava                         │   │
│ │ ✓ Connected                    │   │  status chip: green, check-circle-2
│ │ Last synced 12 minutes ago     │   │  visible relative time; absolute timestamp in
│ │  (Fri, Mar 13, 2026, 6:58 AM)  │   │  VISUALLY-HIDDEN text right after it (not `title`)
│ │                                 │   │
│ │  ┌───────────────────────────┐ │   │
│ │  │        Disconnect         │ │   │  secondary/outline button — NOT destructive-
│ │  └───────────────────────────┘ │   │  styled until the confirm dialog
│ └───────────────────────────────┘   │
```

(The parenthesised absolute timestamp in the wireframe is visually hidden in
the real UI — drawn here so it is not forgotten. Implement as a `<time
datetime="…">` with the relative text visible and the absolute value in a
`.sr-only` span.) "Just connected" (first sync hasn't landed) uses the same
layout.

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
│ └───────────────────────────────┘   │  runner fully disconnect instead
```

The calendar-side surface for this state is drawn in
`training-calendar.md` §4.1c.

### 4.5 Error (exchange failed, or consent denied)

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

### 4.6 Disconnect confirmation (`AlertDialog`, over connected or auth-expired)

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
  (`max-w-2xl` centered; arrives with #53).
- Status chip directly under the card title, same position and register as
  the day-detail sheet's status chip (`training-calendar.md` §4.2) — the
  same *kind* of element (icon + label + color), different meaning (§5.2).
- Exactly one primary button per state; full width on mobile, inline-width on
  tablet/desktop.
- Destructive (red) framing is reserved for the **confirmation dialog's
  Disconnect button only**; the card's own "Disconnect" trigger stays a
  neutral/outline `Button`.

### 5.2 Connection-status vocabulary vs. completion-status vocabulary

This card's chip (Not connected / Connecting / Connected / Reconnect needed /
Error) is **visually built from the same Tempo tokens** as the calendar's
completion-status chip — green good, amber needs attention, red failure,
grey inactive — but it is **not** the same four-value enum, and the two never
appear on the same screen.

| Connection state | Icon | Label | Color token (Tempo) |
|---|---|---|---|
| Not connected | `link-2-off` | "Not connected" | `text/secondary` (neutral) |
| Connecting | *(skeleton, no icon)* | "Connecting to Strava" (SR-only) | — |
| Connected | `check-circle-2` | "Connected" | `green-700`/`green-500` (same hex as Achieved) |
| Auth expired | `alert-triangle` | "Reconnect needed" | `amber-700`/`amber-500` (same hex as Partial) |
| Error | `alert-triangle` | (in an `Alert`, not a chip — §4.5) | `destructive/text` (same as Missed) |

Reusing the exact hexes keeps the palette to the same four semantic hues
defined once in `ui-toolkit.md` (#53).

### 5.3 Component mapping

| Element | shadcn/ui primitive | Notes |
|---|---|---|
| Card | `Card` / `CardHeader` / `CardContent` | Same as every other screen. |
| Connect / Reconnect button | `Button` (primary) | `external-link` icon (Lucide). |
| Disconnect button (on the card) | `Button` (outline, **not** destructive) | §5.1. |
| Status chip | `Badge` (custom color per §5.2) | Same `StatusBadge` module as the calendar, different value set. |
| Disconnect confirmation | `AlertDialog` | **New adoption**; toolkit row in `training-calendar.md` §10. Cancel default-focused; Disconnect = destructive `Button` variant inside. |
| Error message | `Alert` (destructive) | Reused pattern. |
| Connecting state | `Skeleton` | Mirrors the connected-card layout. |
| "Last synced" | `<time>` + visually-hidden span (`sr-only`) | Not a `title` attribute (§6). |
| Live-region confirmation | inline `aria-live="polite"` | Same call as the other two screens; **no toast**. |
| Icons | Lucide: `link-2-off`, `check-circle-2`, `alert-triangle`, `external-link` | Consistent with the toolkit list in `training-calendar.md` §10. |

### 5.4 Copy

| Context | Text |
|---|---|
| Page/section title | `Settings` (h1) — card title `Strava` (h2) |
| Not-connected status | `Not connected` |
| Not-connected description | `Connect Strava to automatically match your logged activities to your training plan.` |
| Connect button | `Connect Strava` |
| Connecting (SR-only) | `Connecting to Strava` |
| Connected status | `Connected` |
| Last synced, relative (visible) | `Last synced 12 minutes ago` |
| Last synced, absolute (visually hidden, follows the visible text) | `, Friday, March 13, 2026 at 6:58 AM` |
| Last synced, never yet | `Just connected` |
| Disconnect button (on card) | `Disconnect` |
| Auth-expired status | `Reconnect needed` |
| Auth-expired description | `Strava access expired. Your activities have stopped syncing.` |
| Reconnect button | `Reconnect Strava` |
| Error alert | `Couldn't connect to Strava. Try again.` |
| Error retry button | `Try again` |
| Disconnect dialog title | `Disconnect Strava?` |
| Disconnect dialog body | `This stops future syncing and permanently deletes your stored Strava activity data. Workouts you've already confirmed as complete will stay marked complete.` (verbatim — FR15's actual behavior) |
| Disconnect dialog Cancel | `Cancel` |
| Disconnect dialog confirm | `Disconnect` |
| Live region — disconnected | `Strava disconnected. Your synced activity data will be deleted.` |
| Live region — connected | `Strava connected.` |
| Calendar not-connected banner (defined in `training-calendar.md` §4.1b) | `Connect Strava to see your completed workouts here automatically.` + `Connect` |
| Calendar reconnect-needed banner (defined in `training-calendar.md` §4.1c) | `Your Strava connection needs to be renewed to keep syncing activities.` + `Reconnect` |

Tone: plain, second person, no exclamation marks, no "Oops!" framing.

### 5.5 Responsive behavior

| Breakpoint | Layout |
|---|---|
| **Mobile < 640px** | Single column, full-width `Card` and primary button. `AlertDialog` as bottom-anchored sheet-style dialog (shadcn default) or centered modal. |
| **Tablet 640–1024px** | Same single-column card, `max-w-2xl` centered, inline-width buttons. |
| **Desktop ≥ 1024px** | Same, centered, `max-w-2xl`. No multi-column layout. |

No layout depends on hover.

---

## 6. Accessibility

Target: WCAG 2.2 AA (NFR5 requires 2.1 AA; 2.2 is a deliberate tightening).

### Keyboard path & focus order

1. Page `<h1>` "Settings" (not focusable).
2. Strava card: title, status chip, description (not focusable).
3. Primary button (Connect / Reconnect / Try again) — whichever the state
   shows. When arriving from a calendar banner, this button receives focus.
4. Disconnect button (connected / auth-expired only).

### Disconnect confirmation

- `AlertDialog` traps focus; opens with focus on **Cancel**.
- `role="alertdialog"`, `aria-labelledby` → title, `aria-describedby` → body,
  so the purge sentence is read in full before either button.
- Esc = Cancel. Scrim click = Cancel.
- On confirm, focus returns to the Strava card (now not-connected) and the
  live region announces the result.

### Semantics / roles / labels

- Status chip: icon `aria-hidden="true"`; the label text is announced.
- **"Last synced":** the visible relative text is the primary content; the
  **absolute timestamp is visually-hidden text** (`sr-only`) in the same
  `<time>` element — **not** a `title` attribute, which is hover-only and
  invisible to touch and most assistive tech. (Sighted touch users see only
  the relative time; that is acceptable for v1 — the absolute value is
  reference detail, not needed to judge "is it working".)
- Connect/Reconnect: accessible name is its text; the `external-link` icon is
  `aria-hidden="true"` (it is a full-page navigation, not a new tab).

### Contrast

- Connected/expired chip text: reuses the completion-status hexes verified in
  `ui-toolkit.md` (#53) — no new contrast risk.
- Error `Alert`: `destructive/text`, same as every other destructive alert.
- "Last synced" text: `text/secondary`, ≥ 4.5:1.
- Focus ring: visible, ≥ 3:1, never suppressed, including in the
  `AlertDialog`.

### Touch targets

- Primary button, Disconnect button, both `AlertDialog` buttons: ≥ 44×44 CSS
  px.

### Motion

- `prefers-reduced-motion`: `AlertDialog` open/close is an instant show/hide.

---

## 7. Data asked of the user

Per CLAUDE.md's privacy/data-minimization principle:

| Field / grant | Why it's collected | PII? |
|---|---|---|
| Strava OAuth access + refresh token | FR12/FR13 — required to sync on the runner's behalf. Granted via redirect, never typed; a secret credential. | PII-adjacent secret — isolated table, encrypted at rest (NFR3), held server-side only; a separate deferred ADR covers the encryption/secrets approach when Strava-sync implementation starts (noted in `web-v1-requirements.md`). |
| Strava `provider_athlete_id` | Maps incoming webhook deliveries to the right runner. | Opaque-ish, provider-assigned; never a join key into `activities` (per `web-v1-requirements.md`). |
| Synced activity data (type, start time, distance, moving/elapsed time, optional avg HR) | The sync payload FR13 exists to fetch. | Analytics-safe, keyed by opaque `activity_id`; no GPS/polyline/lat-lng/gear/calories. |

**Not collected or displayed by this screen:** Strava display name, avatar, or
any profile field. `web-v1-requirements.md` defers that to the "Sign in with
Strava" fast-follow (FR27). The connected state (§4.3) shows "Connected" and a
sync timestamp — **never** "Connected as [name]" — even though the OAuth grant
could technically return it. Don't render it just because it's available.

---

## 8. New vs. reused patterns

| Pattern | Reused from | New? | Why |
|---|---|---|---|
| Card layout, skeleton loading, error-with-retry | `HomePage.tsx` / `plan-setup-flow.md` / `training-calendar.md` | Reused | House patterns. |
| Status chip (icon + label + color) | completion-status system (`ui-toolkit.md`, #53) | New use, same tokens | Same four hues for a different vocabulary (§5.2). |
| `AlertDialog` for a destructive confirmation | — | New | First adoption of the primitive. The asymmetric "connect needs no in-app confirm, disconnect does" call is the reusable house convention for future connections (e.g. FR26 Google Calendar sync). |
| External-OAuth "Connect" button pattern | — | New | First external-provider flow; its connecting/error/expired handling is the template FR26/FR27 should follow. |
| Calendar connection banners (not connected / reconnect needed) | `Alert` | New use | Both drawn in `training-calendar.md` §4.1b/§4.1c; this doc only links to them. |

---

## 9. Validate with users

- **"Reconnect needed" vs. "Not connected" distinction.** Confirm runners
  notice and understand the difference — if it reads the same, collapse into
  a single "not connected, here's why" treatment.
- **Disconnect confirmation copy (§4.6).** Confirm the purge sentence is read
  and understood; watch for accidental disconnects.
- **"Last synced" trust signal.** Confirm the relative-time readout is what
  runners check to answer "is this working"; if they look for more detail,
  that's a scope signal for a later revision.
