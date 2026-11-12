// ============================================================================
// RapidResponse AI Assistant & Voice Suite
// Integrates:
// 1. Multi-turn Chatbot (gemini-3.8-flash, gemini-3.1-flash-lite, gemini-4-carbon, gemini-4-argon)
// 2. Audio Transcription (gemini-3.5-transcribe)
// 3. Live Voice Conversations (gemini-3.8-live)
// ============================================================================

(function () {
  'use strict';

  // Determine current role based on page or session
  const isUserPage = window.location.pathname.includes('user');
  const appRole = isUserPage ? 'civilian' : 'admin';

  let chatHistory = [];
  let isRecordingForChat = false;
  let mediaRecorder = null;
  let audioChunks = [];
  let isLiveVoiceActive = false;

  // --------------------------------------------------------------------------
  // Audio Transcription Utility (gemini-3.5-transcribe)
  // --------------------------------------------------------------------------
  async function transcribeAudioBlob(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64Data = reader.result;
          const res = await fetch('/api/gemini/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioBase64: base64Data,
              mimeType: blob.type || 'audio/webm'
            })
          });
          const data = await res.json();
          if (data.success && data.text) {
            resolve(data.text);
          } else {
            resolve('Emergency assistance requested at location.');
          }
        } catch (e) {
          console.error('Transcription error:', e);
          reject(e);
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // --------------------------------------------------------------------------
  // Voice Recording Helper
  // --------------------------------------------------------------------------
  async function startRecording(onComplete, onStateChange) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Microphone access is not supported in this browser.');
      return null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks = [];
      const recorder = new MediaRecorder(stream);

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunks.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        // Stop audio tracks
        stream.getTracks().forEach(t => t.stop());
        if (onStateChange) onStateChange('transcribing');
        try {
          const text = await transcribeAudioBlob(audioBlob);
          if (onComplete) onComplete(text);
        } catch (err) {
          console.warn('Transcription failed:', err);
        } finally {
          if (onStateChange) onStateChange('idle');
        }
      };

      recorder.start();
      if (onStateChange) onStateChange('recording');
      return recorder;
    } catch (err) {
      console.error('Microphone error:', err);
      alert('Microphone permission was denied or not available.');
      return null;
    }
  }

  // Global helper for other pages (like report incident form)
  window.recordAndTranscribeWithGemini = function (targetInputId, statusIndicatorId) {
    const targetInput = document.getElementById(targetInputId);
    const statusEl = statusIndicatorId ? document.getElementById(statusIndicatorId) : null;

    if (window._activeFormRecorder && window._activeFormRecorder.state === 'recording') {
      window._activeFormRecorder.stop();
      window._activeFormRecorder = null;
      return;
    }

    startRecording(
      (text) => {
        if (targetInput) {
          targetInput.value = (targetInput.value ? targetInput.value + ' ' : '') + text;
          targetInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
      },
      (state) => {
        if (statusEl) {
          if (state === 'recording') {
            statusEl.innerHTML = '🔴 Listening... (Click to Finish & Transcribe)';
            statusEl.style.color = '#dc2626';
          } else if (state === 'transcribing') {
            statusEl.innerHTML = '✨ Transcribing with Gemini 3.5...';
            statusEl.style.color = '#0284c7';
          } else {
            statusEl.innerHTML = '🎙️ Transcribe Voice Report (Gemini 3.5)';
            statusEl.style.color = '';
          }
        }
      }
    ).then(rec => {
      window._activeFormRecorder = rec;
    });
  };

  // --------------------------------------------------------------------------
  // Build and Inject Assistant Floating UI
  // --------------------------------------------------------------------------
  function injectAssistantUI() {
    if (document.getElementById('gemini-assistant-root')) return;

    const root = document.createElement('div');
    root.id = 'gemini-assistant-root';
    root.innerHTML = `
      <!-- Floating Launch Button -->
      <button id="gemini-toggle-btn" class="gemini-floating-btn" title="Open RapidResponse AI Command Assistant">
        <span class="ai-sparkle">✨</span>
        <span class="ai-label">RapidResponse AI</span>
        <span class="ai-badge">${appRole === 'admin' ? 'Command' : 'Safety'}</span>
      </button>

      <!-- Slide-Out Chat & Voice Panel -->
      <div id="gemini-chat-panel" class="gemini-chat-drawer hidden">
        <div class="gemini-chat-header">
          <div class="header-left">
            <div class="gemini-logo-icon">🤖</div>
            <div>
              <div class="gemini-title">RapidResponse AI</div>
              <div class="gemini-sub">Gemini 3.8 / 4.0 &bull; Disaster Intelligence</div>
            </div>
          </div>
          <div class="header-right">
            <button id="btn-open-live-voice" class="btn-live-voice-chip" title="Launch Gemini 3.8 Live Voice Mode">
              🎙️ Live Voice
            </button>
            <button id="gemini-close-btn" class="gemini-close-btn" title="Close Panel">&times;</button>
          </div>
        </div>

        <!-- Model Selector Bar -->
        <div class="gemini-model-bar">
          <label for="gemini-model-select">AI MODEL:</label>
          <select id="gemini-model-select" class="gemini-model-select">
            <option value="gemini-3.8-flash" selected>Gemini 3.8 Flash (Recommended)</option>
            <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (High Speed)</option>
            <option value="gemini-4-argon">Gemini 4 Argon (Tactical Logistics)</option>
            <option value="gemini-4-carbon">Gemini 4 Carbon (Deep Reasoning)</option>
          </select>
        </div>

        <!-- Quick Suggested Chips -->
        <div class="gemini-quick-chips">
          ${appRole === 'admin' ? `
            <button class="ai-chip" onclick="window.sendGeminiQuickPrompt('Recommend grouped strike force dispatch for flood and structure collapse')">🚀 Grouped Dispatch</button>
            <button class="ai-chip" onclick="window.sendGeminiQuickPrompt('Evaluate resource conservation and fleet readiness status')">🌱 Conserve Fleet</button>
            <button class="ai-chip" onclick="window.sendGeminiQuickPrompt('Calculate evacuation corridor around active 2km perimeter')">⭕ 2km Perimeter Strategy</button>
          ` : `
            <button class="ai-chip" onclick="window.sendGeminiQuickPrompt('What are immediate survival steps if water is entering my home?')">🌊 Water Rising</button>
            <button class="ai-chip" onclick="window.sendGeminiQuickPrompt('How do I treat severe bleeding or burn injuries while waiting for ambulance?')">🩹 First Aid</button>
            <button class="ai-chip" onclick="window.sendGeminiQuickPrompt('Where is the nearest safe shelter and high ground evacuation zone?')">🏢 Safe Shelters</button>
          `}
        </div>

        <!-- Messages Thread -->
        <div id="gemini-messages-thread" class="gemini-messages-thread">
          <div class="ai-msg bot">
            <div class="msg-bubble">
              <strong>${appRole === 'admin' ? '🛡️ Commander Dispatch Assistant Active' : '🕊️ Emergency Safety Guide Active'}</strong>
              <p style="margin:4px 0 0 0;">
                ${appRole === 'admin'
                  ? 'I can optimize multi-unit team assignments, calculate casualty risk scores, and coordinate perimeter zones. How can I assist current operations?'
                  : 'I am here to guide you through any emergency with step-by-step survival protocols, first aid, and dispatch updates. What is your current situation?'}
              </p>
            </div>
            <span class="msg-time">Just now</span>
          </div>
        </div>

        <!-- Input Bar -->
        <div class="gemini-input-bar">
          <button id="btn-chat-mic" class="gemini-mic-btn" title="Speak to Transcribe (Gemini 3.5 Transcribe)">
            🎙️
          </button>
          <textarea id="gemini-chat-input" class="gemini-textarea" placeholder="${appRole === 'admin' ? 'Ask tactical question or dispatch advice...' : 'Type or speak your emergency question...'}" rows="1"></textarea>
          <button id="gemini-send-btn" class="gemini-send-btn" title="Send message">
            ➤
          </button>
        </div>
      </div>

      <!-- Live Voice Conversation Modal (Gemini 3.8 Live API) -->
      <div id="gemini-live-voice-modal" class="gemini-live-modal hidden">
        <div class="live-modal-content">
          <button id="btn-close-live-voice" class="live-close-btn">&times;</button>
          <div class="live-badge">GEMINI 3.8 LIVE API &bull; DUPLEX VOICE</div>
          <h2 class="live-title">Real-Time Voice Conversation</h2>
          <p class="live-desc">Hands-free emergency voice link. Speak naturally to receive instant audio safety guidance.</p>

          <!-- Animated Voice Wave Visualizer -->
          <div class="voice-visualizer-container">
            <div id="voice-pulse-ring" class="voice-pulse-ring"></div>
            <div class="voice-center-orb">
              <span id="voice-orb-icon">🎙️</span>
            </div>
          </div>

          <div id="live-voice-status" class="live-voice-status">Listening... Speak now</div>
          <div id="live-voice-transcript" class="live-voice-transcript">"Emergency assistant connected. What help do you need?"</div>

          <div class="live-controls">
            <button id="btn-toggle-live-mic" class="btn-live-action">
              <span id="live-mic-icon">🔴</span>
              <span id="live-mic-text">Stop Talking</span>
            </button>
          </div>
        </div>
      </div>
    `;

    // Inject styles
    const style = document.createElement('style');
    style.textContent = `
      .gemini-floating-btn {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 9999;
        display: flex;
        align-items: center;
        gap: 8px;
        background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
        color: #ffffff;
        border: 1.5px solid #38bdf8;
        border-radius: 9999px;
        padding: 12px 20px;
        font-family: inherit;
        font-size: 14px;
        font-weight: 800;
        cursor: pointer;
        box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.4), 0 0 15px rgba(56, 189, 248, 0.3);
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      }
      .gemini-floating-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 14px 28px -5px rgba(15, 23, 42, 0.5), 0 0 20px rgba(56, 189, 248, 0.5);
      }
      .ai-sparkle { font-size: 16px; }
      .ai-badge {
        background: #38bdf8;
        color: #0f172a;
        font-size: 10px;
        padding: 2px 7px;
        border-radius: 9999px;
        text-transform: uppercase;
        font-weight: 800;
      }
      .gemini-chat-drawer {
        position: fixed;
        bottom: 84px;
        right: 24px;
        width: 400px;
        max-width: calc(100vw - 32px);
        height: 560px;
        max-height: calc(100vh - 110px);
        background: #ffffff;
        border-radius: 16px;
        box-shadow: 0 20px 40px -10px rgba(15, 23, 42, 0.3), 0 0 0 1px rgba(15, 23, 42, 0.1);
        z-index: 9999;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        animation: geminiSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      }
      @keyframes geminiSlideUp {
        from { opacity: 0; transform: translateY(16px) scale(0.98); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      .gemini-chat-drawer.hidden { display: none !important; }
      .gemini-chat-header {
        background: #0f172a;
        color: #ffffff;
        padding: 14px 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid rgba(255,255,255,0.1);
      }
      .header-left { display: flex; align-items: center; gap: 10px; }
      .gemini-logo-icon {
        width: 34px; height: 34px; border-radius: 8px; background: rgba(56, 189, 248, 0.15);
        border: 1px solid #38bdf8; display: flex; align-items: center; justify-content: center; font-size: 18px;
      }
      .gemini-title { font-size: 15px; font-weight: 800; line-height: 1.2; }
      .gemini-sub { font-size: 10px; color: #94a3b8; }
      .header-right { display: flex; align-items: center; gap: 8px; }
      .btn-live-voice-chip {
        background: rgba(239, 68, 68, 0.2);
        color: #fca5a5;
        border: 1px solid #ef4444;
        font-size: 11px;
        font-weight: 700;
        padding: 5px 10px;
        border-radius: 9999px;
        cursor: pointer;
      }
      .btn-live-voice-chip:hover { background: #ef4444; color: #fff; }
      .gemini-close-btn {
        background: transparent; border: none; color: #94a3b8; font-size: 22px; cursor: pointer; padding: 0 4px;
      }
      .gemini-close-btn:hover { color: #fff; }
      .gemini-model-bar {
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
        padding: 8px 14px;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 11px;
        font-weight: 700;
        color: #475569;
      }
      .gemini-model-select {
        flex: 1;
        padding: 4px 8px;
        font-size: 11px;
        border-radius: 6px;
        border: 1px solid #cbd5e1;
        background: #fff;
        color: #0f172a;
        font-weight: 600;
        outline: none;
      }
      .gemini-quick-chips {
        padding: 8px 12px;
        display: flex;
        gap: 6px;
        overflow-x: auto;
        white-space: nowrap;
        background: #f1f5f9;
        border-bottom: 1px solid #e2e8f0;
      }
      .ai-chip {
        background: #ffffff;
        border: 1px solid #cbd5e1;
        border-radius: 9999px;
        padding: 4px 10px;
        font-size: 11px;
        font-weight: 600;
        color: #334155;
        cursor: pointer;
        flex-shrink: 0;
      }
      .ai-chip:hover { background: #e0f2fe; border-color: #38bdf8; color: #0369a1; }
      .gemini-messages-thread {
        flex: 1;
        padding: 14px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 12px;
        background: #f8fafc;
      }
      .ai-msg { display: flex; flex-direction: column; max-width: 86%; }
      .ai-msg.user { align-self: flex-end; align-items: flex-end; }
      .ai-msg.bot { align-self: flex-start; align-items: flex-start; }
      .msg-bubble {
        padding: 10px 14px;
        border-radius: 12px;
        font-size: 13px;
        line-height: 1.5;
        word-break: break-word;
      }
      .ai-msg.user .msg-bubble {
        background: #0284c7;
        color: #ffffff;
        border-bottom-right-radius: 2px;
      }
      .ai-msg.bot .msg-bubble {
        background: #ffffff;
        color: #0f172a;
        border: 1px solid #e2e8f0;
        border-bottom-left-radius: 2px;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05);
      }
      .msg-time { font-size: 10px; color: #94a3b8; margin-top: 3px; }
      .gemini-input-bar {
        padding: 10px 12px;
        background: #ffffff;
        border-top: 1px solid #e2e8f0;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .gemini-mic-btn {
        width: 36px; height: 36px; border-radius: 50%; border: 1px solid #cbd5e1;
        background: #f8fafc; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center;
      }
      .gemini-mic-btn:hover { background: #e2e8f0; }
      .gemini-mic-btn.recording { background: #fee2e2; border-color: #ef4444; animation: alertPulse 1.2s infinite; }
      .gemini-textarea {
        flex: 1;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        padding: 8px 10px;
        font-size: 13px;
        font-family: inherit;
        resize: none;
        outline: none;
        max-height: 80px;
      }
      .gemini-textarea:focus { border-color: #0284c7; }
      .gemini-send-btn {
        width: 36px; height: 36px; border-radius: 8px; border: none;
        background: #0284c7; color: #fff; font-size: 15px; cursor: pointer; display: flex; align-items: center; justify-content: center;
      }
      .gemini-send-btn:hover { background: #0369a1; }
      /* Live Voice Modal */
      .gemini-live-modal {
        position: fixed; inset: 0; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(8px);
        z-index: 100000; display: flex; align-items: center; justify-content: center; padding: 20px;
      }
      .gemini-live-modal.hidden { display: none !important; }
      .live-modal-content {
        background: #0f172a; border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 24px;
        width: 480px; max-width: 100%; padding: 36px 28px; text-align: center; color: #fff; position: relative;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
      }
      .live-close-btn {
        position: absolute; top: 16px; right: 18px; background: transparent; border: none;
        color: #94a3b8; font-size: 26px; cursor: pointer;
      }
      .live-badge {
        display: inline-block; background: rgba(56, 189, 248, 0.15); color: #38bdf8;
        border: 1px solid #38bdf8; font-size: 10px; font-weight: 800; padding: 3px 10px; border-radius: 9999px; margin-bottom: 12px;
      }
      .live-title { font-size: 22px; font-weight: 800; margin: 0 0 6px 0; }
      .live-desc { font-size: 13px; color: #94a3b8; margin: 0 0 28px 0; }
      .voice-visualizer-container {
        position: relative; width: 140px; height: 140px; margin: 0 auto 24px auto;
        display: flex; align-items: center; justify-content: center;
      }
      .voice-pulse-ring {
        position: absolute; inset: 0; border-radius: 50%; border: 3px solid #38bdf8;
        animation: livePulse 2s cubic-bezier(0.24, 0, 0.38, 1) infinite;
      }
      @keyframes livePulse {
        0% { transform: scale(0.8); opacity: 0.8; }
        50% { transform: scale(1.2); opacity: 0.3; }
        100% { transform: scale(0.8); opacity: 0.8; }
      }
      .voice-center-orb {
        width: 80px; height: 80px; border-radius: 50%; background: linear-gradient(135deg, #0284c7 0%, #38bdf8 100%);
        display: flex; align-items: center; justify-content: center; font-size: 32px; box-shadow: 0 0 30px rgba(56, 189, 248, 0.6);
      }
      .live-voice-status { font-size: 14px; font-weight: 700; color: #38bdf8; margin-bottom: 12px; }
      .live-voice-transcript {
        background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px; padding: 14px; font-size: 13px; color: #e2e8f0; min-height: 60px; margin-bottom: 24px; font-style: italic;
      }
      .btn-live-action {
        background: #ef4444; color: #fff; border: none; padding: 12px 24px; border-radius: 9999px;
        font-weight: 800; font-size: 14px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px;
      }
      .btn-live-action:hover { background: #dc2626; }
    `;

    document.head.appendChild(style);
    document.body.appendChild(root);

    // Event listeners
    const toggleBtn = document.getElementById('gemini-toggle-btn');
    const panel = document.getElementById('gemini-chat-panel');
    const closeBtn = document.getElementById('gemini-close-btn');
    const sendBtn = document.getElementById('gemini-send-btn');
    const inputEl = document.getElementById('gemini-chat-input');
    const micBtn = document.getElementById('btn-chat-mic');
    const liveVoiceBtn = document.getElementById('btn-open-live-voice');
    const liveModal = document.getElementById('gemini-live-voice-modal');
    const liveCloseBtn = document.getElementById('btn-close-live-voice');

    toggleBtn.addEventListener('click', () => {
      panel.classList.toggle('hidden');
      if (!panel.classList.contains('hidden')) inputEl.focus();
    });

    closeBtn.addEventListener('click', () => {
      panel.classList.add('hidden');
    });

    sendBtn.addEventListener('click', () => {
      sendChatMessage();
    });

    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage();
      }
    });

    // Chat microphone transcription (gemini-3.5-transcribe)
    let chatRecorder = null;
    micBtn.addEventListener('click', async () => {
      if (chatRecorder && chatRecorder.state === 'recording') {
        chatRecorder.stop();
        chatRecorder = null;
        return;
      }

      chatRecorder = await startRecording(
        (text) => {
          inputEl.value = (inputEl.value ? inputEl.value + ' ' : '') + text;
          inputEl.focus();
        },
        (state) => {
          if (state === 'recording') micBtn.classList.add('recording');
          else micBtn.classList.remove('recording');
        }
      );
    });

    // Live Voice Modal (gemini-3.8-live)
    liveVoiceBtn.addEventListener('click', () => {
      liveModal.classList.remove('hidden');
      startLiveVoiceSession();
    });

    liveCloseBtn.addEventListener('click', () => {
      liveModal.classList.add('hidden');
      stopLiveVoiceSession();
    });

    document.getElementById('btn-toggle-live-mic').addEventListener('click', () => {
      stopLiveVoiceSession();
      liveModal.classList.add('hidden');
    });

    window.sendGeminiQuickPrompt = function (text) {
      inputEl.value = text;
      sendChatMessage();
    };
  }

  // --------------------------------------------------------------------------
  // Send Chat Message
  // --------------------------------------------------------------------------
  async function sendChatMessage() {
    const inputEl = document.getElementById('gemini-chat-input');
    const thread = document.getElementById('gemini-messages-thread');
    const modelSelect = document.getElementById('gemini-model-select');

    const msg = (inputEl.value || '').trim();
    if (!msg) return;

    inputEl.value = '';

    // Append user message
    const userMsgEl = document.createElement('div');
    userMsgEl.className = 'ai-msg user';
    userMsgEl.innerHTML = `
      <div class="msg-bubble">${escapeHtml(msg)}</div>
      <span class="msg-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
    `;
    thread.appendChild(userMsgEl);
    thread.scrollTop = thread.scrollHeight;

    // Append bot placeholder
    const botMsgEl = document.createElement('div');
    botMsgEl.className = 'ai-msg bot';
    botMsgEl.innerHTML = `
      <div class="msg-bubble" style="opacity: 0.7;">Thinking...</div>
      <span class="msg-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
    `;
    thread.appendChild(botMsgEl);
    thread.scrollTop = thread.scrollHeight;

    const selectedModel = modelSelect ? modelSelect.value : 'gemini-3.8-flash';

    try {
      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          history: chatHistory,
          model: selectedModel,
          role: appRole
        })
      });

      const data = await res.json();
      const reply = data.reply || 'Emergency status logged.';

      botMsgEl.querySelector('.msg-bubble').innerHTML = formatMarkdown(reply);
      botMsgEl.querySelector('.msg-bubble').style.opacity = '1';

      // Update history
      chatHistory.push({ role: 'user', text: msg });
      chatHistory.push({ role: 'assistant', text: reply });

      thread.scrollTop = thread.scrollHeight;
    } catch (err) {
      console.error('Chat error:', err);
      botMsgEl.querySelector('.msg-bubble').innerHTML = '⚠️ Communication line unstable. Please try again.';
      botMsgEl.querySelector('.msg-bubble').style.opacity = '1';
    }
  }

  // --------------------------------------------------------------------------
  // Live Voice Session (gemini-3.8-live)
  // --------------------------------------------------------------------------
  let liveRecorder = null;

  async function startLiveVoiceSession() {
    isLiveVoiceActive = true;
    const statusEl = document.getElementById('live-voice-status');
    const transcriptEl = document.getElementById('live-voice-transcript');

    statusEl.innerText = 'Listening to your voice... Speak now';
    transcriptEl.innerText = '"I am listening. Describe your emergency or what instructions you need."';

    liveRecorder = await startRecording(
      async (spokenText) => {
        if (!isLiveVoiceActive) return;
        statusEl.innerText = '✨ Gemini 3.8 Live Thinking...';
        transcriptEl.innerText = `"${spokenText}"`;

        try {
          const res = await fetch('/api/gemini/live-voice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ speechText: spokenText, lang: 'en' })
          });
          const data = await res.json();
          const reply = data.speechReply || 'Help is mobilized. Stay on high ground.';

          transcriptEl.innerHTML = `<strong>You:</strong> "${spokenText}"<br><br><strong>Gemini 3.8 Live:</strong> "${reply}"`;
          statusEl.innerText = '🔊 Speaking response...';

          // Play synthesized audio using Web Speech API
          if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(reply);
            utterance.rate = 1.05;
            utterance.onend = () => {
              if (isLiveVoiceActive) {
                statusEl.innerText = 'Listening again...';
                startLiveVoiceSession();
              }
            };
            window.speechSynthesis.speak(utterance);
          } else {
            setTimeout(() => {
              if (isLiveVoiceActive) {
                statusEl.innerText = 'Listening again...';
                startLiveVoiceSession();
              }
            }, 3000);
          }
        } catch (e) {
          console.error('Live voice error:', e);
          statusEl.innerText = 'Listening again...';
        }
      },
      (state) => {
        if (state === 'recording') statusEl.innerText = '🔴 Listening...';
      }
    );
  }

  function stopLiveVoiceSession() {
    isLiveVoiceActive = false;
    if (liveRecorder && liveRecorder.state === 'recording') {
      liveRecorder.stop();
      liveRecorder = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatMarkdown(text) {
    let html = escapeHtml(text);
    // Bold
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // Bullet points
    html = html.replace(/^\s*[-*]\s+(.*)$/gm, '&bull; $1<br>');
    // Newlines
    html = html.replace(/\n/g, '<br>');
    return html;
  }

  // Initialize once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectAssistantUI);
  } else {
    injectAssistantUI();
  }
})();
