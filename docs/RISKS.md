# Browser Capabilities & Limitations

## Mobile Browsers (Android vs iOS)

| Feature | Android Chrome | iOS Safari | Workaround/Note |
|---------|----------------|------------|-----------------|
| Camera Access | ✅ Yes | ✅ Yes | Requires HTTPS |
| Screen Wake Lock | ✅ Yes | ✅ iOS 16.4+ (Standalone PWA fixed in 18.4) | Must re-acquire on `visibilitychange`. |
| Torch / Zoom | ✅ Yes | ❌ No | iOS doesn't support manual controls. |
| Codec Preferences | ✅ Yes | ✅ Yes | Will prioritize H.264 for OBS decoding. |
| MediaRecorder | ⚠️ High Risk | ⚠️ High Risk | Dual encoding causes severe thermal throttling in 3-5m. Record in OBS instead. |
| Adaptive Bitrate | ✅ Yes | ⚠️ Partial | Modifying parameters works, BWE dictates reality. |
| Device Temp | ❌ Impossible | ❌ Impossible | We use `getStats().qualityLimitationReason === 'cpu'` as a heat risk proxy. |
| Battery API | ✅ Yes | ❌ No | Useful for low-battery alerts on Android. |
