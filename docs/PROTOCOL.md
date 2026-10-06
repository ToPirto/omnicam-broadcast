# Signaling Protocol

All WebSocket messages follow this JSON structure:

```json
{
  "v": 1,
  "type": "MESSAGE_TYPE",
  "id": "uuid-v4",
  "ts": 1696636800000,
  "seq": 42,
  "from": "cam-abc123",
  "to": "server|viewer-xyz",
  "payload": {}
}
```

## Message Types
- `auth`: Client attempting to pair (one-time token) or rejoin (session token).
- `auth_ok`: Server confirming authentication.
- `auth_fail`: Authentication rejected.
- `offer`: WebRTC SDP Offer.
- `answer`: WebRTC SDP Answer.
- `ice`: WebRTC ICE candidate.
- `tally`: Server updating tally state for the camera.
- `telemetry`: Client sending health/status metrics.
- `control`: Dashboard -> Camera hardware command (zoom, torch, etc.).
- `control_ack` / `control_nack`: Camera responding to command.
- `ping` / `pong`: Keepalive.
- `cam_join` / `cam_leave`: Server announcing camera state changes to viewers/dashboard.
