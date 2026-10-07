# OmniCam Testing Guide

This guide outlines the critical manual tests to ensure OmniCam stability in a production environment.

## 1. 30-Minute Soak Test
- **Goal**: Verify long-term stability and thermal performance.
- **Steps**:
  1. Connect a phone (Sender) to the Server.
  2. Add the camera to OBS.
  3. Leave the stream running for 30 minutes.
  4. Use the "Layar hitam hemat baterai" (Powersave) feature to turn the screen black.
- **Expected**: Bitrate stays stable, video does not freeze, battery drain is minimized, and phone temperature remains within acceptable limits.

## 2. Wi-Fi Drop Test
- **Goal**: Verify connection resilience.
- **Steps**:
  1. While streaming to OBS, turn off the phone's Wi-Fi.
  2. Wait 10 seconds.
  3. Turn the Wi-Fi back on.
- **Expected**: The phone UI should show disconnected, then automatically reconnect. The video in OBS should resume without requiring a new QR code scan or reloading the OBS browser source.

## 3. Screen Off Test
- **Goal**: Verify background operation and wake locks.
- **Steps**:
  1. While streaming, put the phone screen to sleep (press power button) or switch to another app for 5-10 seconds.
  2. Wake the phone / return to the app.
- **Expected**: The Wake Lock is re-acquired, and the connection re-establishes or continues cleanly.

## 4. OBS Restart Test
- **Goal**: Verify OBS WebSocket and Tally resilience.
- **Steps**:
  1. While streaming, completely close OBS.
  2. Re-open OBS.
- **Expected**: The dashboard should reconnect to the OBS WebSocket automatically. Tally lights on the phone should update correctly when the camera is placed into Program or Preview in the restarted OBS instance.

## 5. Audio with Earphone Test
- **Goal**: Verify audio routing and echo cancellation.
- **Steps**:
  1. Connect an earphone to the phone.
  2. Speak into the microphone.
- **Expected**: The audio should reach the OBS Audio Mixer cleanly. The phone UI should show the real-time audio meter moving. Pressing "Mute" on the phone should immediately silence the audio in OBS and show a red mute indicator on the phone.
