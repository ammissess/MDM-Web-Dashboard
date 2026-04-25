# MDM Web Dashboard Final — Change Summary

## Main changes

- Redesigned `MDM Operations Dashboard` into an operations-style monitoring page.
- Added EN/VI language toggle with localStorage persistence.
- Improved background auto-refresh so interval refreshes do not overlap and do not blank existing data.
- Redesigned current linked profile on device detail:
  - profile identity
  - core policy
  - security hardening
  - allowedApps count/compact view
  - desired/applied/policy/wakeup/poll/ack summary
- Separated backend status actions from device command delivery in Quick Actions.
- Added direct buttons for valid commands:
  - `lock_screen`
  - `refresh_config`
  - `sync_config`
- Improved command timeline:
  - newest-first
  - scrollable
  - status badges
  - payload/output collapsed
  - leaseToken/ack/failure details visible but compact
- Improved map/location handling:
  - valid location renders Mapbox static map when token exists
  - no data shows polished empty state
  - `0,0` shows invalid/fallback warning
  - missing Mapbox token no longer breaks UI
- Improved profile detail page layout and allowedApps rendering.
- Improved profile edit messaging after update/allowedApps save.

## Files changed/added

- `src/App.tsx`
- `src/i18n.tsx`
- `src/hooks/useAutoRefresh.ts`
- `src/pages/dashboard/index.tsx`
- `src/pages/devices/show.tsx`
- `src/pages/devices/components/QuickActionsCard.tsx`
- `src/pages/devices/components/CommandTimeline.tsx`
- `src/pages/devices/components/DeviceLocationMap.tsx`
- `src/pages/devices/components/DeviceLocationStaticMap.tsx`
- `src/pages/profiles/show.tsx`
- `src/pages/profiles/edit.tsx`
- `src/pages/profiles/components/AllowedAppsEditor.tsx`
- `src/styles.css`
- `docs/CONTRACT_AUDIT.md`
- `docs/FINAL_CHANGELOG.md`

## Run commands

```bash
npm install
npm run build
npm run smoke
```

Set `VITE_MAPBOX_TOKEN` only if you want the static map preview. Coordinates still render without the token.

## Known runtime limitations

- Android instant update is not claimed by UI. It depends on FCM/wakeup, poll, command lease/ack, policy apply, and policy-state report.
- DO/kiosk/policy behavior still requires a real device-owner runtime target for full proof.
- Location depends on Android reporting valid coordinates to backend.
