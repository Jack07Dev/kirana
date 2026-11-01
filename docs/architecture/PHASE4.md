# Phase 4 — Customer shopping UX

## App changes

- **Home map** (iOS/Android): store pins + your location; tap pin → store.
- **Location fallback**: GPS → default saved address → last cached coordinates.
- **No GPS**: Profile → **Add address** → **Use current location** (or move to pin) → save → home refreshes.
- **Cart persistence**: cart survives app restarts (`AsyncStorage`).

## Verify

1. Customer login → home shows map (device) or list (web).
2. Deny GPS, add address with location → nearby stores load from address.
3. Add items → kill app → reopen → cart still has items.

## Next phase

Phase 5 — delivery partner app, order status history, delivery assignment. See `docs/architecture/PHASE5.md`.
