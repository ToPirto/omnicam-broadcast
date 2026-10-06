# Testing Plan

## Unit Tests
- Testing protocol envelope and validation.
- Camera registry behavior (add, remove, limit enforcement).
- LAN IP detection correctness.

## Integration Tests
- Signaling WebSocket routes SDP correctly.
- Fake camera integration tests for WebRTC connection flows.

## Manual Tests (Checklist)
- [ ] Connect with Android.
- [ ] Connect with iPhone.
- [ ] Validate OLED blackout mode.
- [ ] Verify Tally lights respond to OBS scene changes.
- [ ] Ensure auto-reconnect handles simulated drops.
