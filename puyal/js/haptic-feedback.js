// ============================================================================
// PUYAL — Haptic Feedback Service (Web Vibration API)
// Triggers distinct tactile vibration patterns on mobile devices whenever an
// emergency incident is actively being reported or live SOS is streaming.
// ============================================================================
(function (global) {
  'use strict';

  const PATTERNS = Object.freeze({
    // Immediate SOS trigger confirmation: rapid double-tap + sustained hold
    SOS_TRIGGER: [180, 70, 180, 70, 320],
    // Active incident submission / voice emergency report in progress
    REPORTING_ACTIVE: [120, 60, 220],
    // Incident report confirmed / queued offline for dispatch
    REPORT_CONFIRMED: [90, 50, 90, 50, 180],
    // Live SOS video/audio telemetry stream locked (Morse SOS cadence)
    STREAMING_START: [100, 60, 100, 60, 100, 120, 240, 80, 240],
    // Periodic tactile heartbeat while emergency reporting/streaming remains active
    STREAMING_HEARTBEAT: [140, 80, 140],
    // Stop / cancel any in-flight vibration immediately
    STOP: 0
  });

  const STREAM_HEARTBEAT_INTERVAL_MS = 4000;
  const activeEmergencyStates = new Set(); // 'reporting' | 'streaming'
  let heartbeatTimer = null;
  let lastPattern = null;
  let lastTriggeredAt = 0;

  function isVibrationSupported() {
    return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  }

  function isMobileDevice() {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(ua)) {
      return true;
    }
    if (typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 0) {
      return true;
    }
    if (typeof window !== 'undefined') {
      if (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches) {
        return true;
      }
      if (typeof window.innerWidth === 'number' && window.innerWidth <= 900) {
        return true;
      }
    }
    return false;
  }

  function vibrate(pattern) {
    if (!isVibrationSupported()) return false;
    try {
      const ok = navigator.vibrate(pattern);
      if (pattern !== 0) {
        lastPattern = Array.isArray(pattern) ? pattern.slice() : pattern;
        lastTriggeredAt = Date.now();
      }
      return Boolean(ok);
    } catch (e) {
      return false;
    }
  }

  function stopVibration() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    if (isVibrationSupported()) {
      try {
        navigator.vibrate(PATTERNS.STOP);
      } catch (e) {}
    }
  }

  function isEmergencyActive() {
    const globalSosStreaming = typeof global.sosActiveFlag !== 'undefined' && Boolean(global.sosActiveFlag);
    return activeEmergencyStates.size > 0 || globalSosStreaming;
  }

  function ensureActiveHeartbeat() {
    if (heartbeatTimer || !isEmergencyActive()) return;
    heartbeatTimer = setInterval(() => {
      if (!isEmergencyActive()) {
        stopVibration();
        return;
      }
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }
      vibrate(PATTERNS.STREAMING_HEARTBEAT);
    }, STREAM_HEARTBEAT_INTERVAL_MS);
  }

  function updateSosOverlayHapticIndicator(active) {
    if (typeof document === 'undefined') return;
    const el = document.getElementById('sos-haptic-indicator');
    if (!el) return;
    const supported = isVibrationSupported();
    const mobile = isMobileDevice();
    if (!supported) {
      el.textContent = 'Vibration API unavailable';
      el.dataset.hapticState = 'unsupported';
      return;
    }
    if (active) {
      el.textContent = mobile ? '📳 Haptic Pulse Active (Mobile)' : '📳 Haptic Pulse Active';
      el.dataset.hapticState = 'active';
    } else {
      el.textContent = '📳 Haptic Standby';
      el.dataset.hapticState = 'idle';
    }
  }

  function onSosButtonClick() {
    // Must fire synchronously inside the user-click gesture for mobile Chrome sticky activation
    activeEmergencyStates.add('streaming');
    const fired = vibrate(PATTERNS.SOS_TRIGGER);
    ensureActiveHeartbeat();
    updateSosOverlayHapticIndicator(true);
    return fired;
  }

  function startStreaming() {
    activeEmergencyStates.add('streaming');
    const now = Date.now();
    // Avoid overwriting initial SOS_TRIGGER burst within the first 900ms
    const fired = (now - lastTriggeredAt > 900) ? vibrate(PATTERNS.STREAMING_START) : true;
    ensureActiveHeartbeat();
    updateSosOverlayHapticIndicator(true);
    return fired;
  }

  function stopStreaming() {
    activeEmergencyStates.delete('streaming');
    updateSosOverlayHapticIndicator(false);
    if (!isEmergencyActive()) {
      stopVibration();
    }
  }

  function beginIncidentReporting() {
    activeEmergencyStates.add('reporting');
    const fired = vibrate(PATTERNS.REPORTING_ACTIVE);
    ensureActiveHeartbeat();
    return fired;
  }

  function endIncidentReporting(confirmed = true) {
    activeEmergencyStates.delete('reporting');
    if (confirmed) {
      vibrate(PATTERNS.REPORT_CONFIRMED);
    }
    if (!isEmergencyActive() && heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  function attachSosButtonListener(buttonEl, onTrigger) {
    if (!buttonEl || typeof buttonEl.addEventListener !== 'function') return null;

    // Avoid duplicate binding on the same element
    if (buttonEl._puyalSosHapticHandler) {
      buttonEl.removeEventListener('click', buttonEl._puyalSosHapticHandler);
    }

    const handleActivation = (event) => {
      onSosButtonClick();
      if (typeof onTrigger === 'function') {
        onTrigger(event);
      }
    };

    const handleKeydown = (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleActivation(event);
      }
    };

    buttonEl._puyalSosHapticHandler = handleActivation;
    buttonEl._puyalSosKeyHandler = handleKeydown;
    buttonEl.addEventListener('click', handleActivation);
    buttonEl.addEventListener('keydown', handleKeydown);

    return () => {
      buttonEl.removeEventListener('click', handleActivation);
      buttonEl.removeEventListener('keydown', handleKeydown);
      delete buttonEl._puyalSosHapticHandler;
      delete buttonEl._puyalSosKeyHandler;
    };
  }

  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && isEmergencyActive()) {
        vibrate(PATTERNS.STREAMING_HEARTBEAT);
      }
    });
  }

  if (typeof global.addEventListener === 'function') {
    global.addEventListener('beforeunload', () => {
      stopVibration();
    });
  }

  global.PuyalHaptics = {
    PATTERNS,
    isVibrationSupported,
    isMobileDevice,
    isEmergencyActive,
    vibrate,
    stop: stopVibration,
    onSosButtonClick,
    startStreaming,
    stopStreaming,
    beginIncidentReporting,
    endIncidentReporting,
    attachSosButtonListener,
    getState: () => ({
      supported: isVibrationSupported(),
      isMobile: isMobileDevice(),
      activeStates: Array.from(activeEmergencyStates),
      heartbeatRunning: Boolean(heartbeatTimer),
      lastPattern,
      lastTriggeredAt
    })
  };
})(typeof window !== 'undefined' ? window : globalThis);
