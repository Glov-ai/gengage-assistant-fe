/**
 * Otokoç AI Voice Launcher
 *
 * Floating voice assistant launcher for the otokoccomtr demo.
 * Adapted from robot-engine-lean/voiceAssistantLauncher.ts — simplified to core
 * session flow (no OTP/SMS handoff, no UA sniffing).
 *
 * UI is injected as a fixed-position element on document.body.
 * CSS comes from the <style> block in index.html.
 */

import { Conversation } from '@elevenlabs/client';

type VoicePanelState = 'idle' | 'connecting' | 'speaking' | 'listening' | 'error';

const STATE_LABELS: Record<VoicePanelState, { badge: string; copy: string }> = {
  idle: { badge: 'Hazır', copy: 'Konuşmaya başlayabilirsiniz.' },
  connecting: { badge: 'Bağlanıyor', copy: 'Sesli asistan hazırlanıyor.' },
  speaking: { badge: 'Yanıtlıyor', copy: 'Asistan konuşuyor.' },
  listening: { badge: 'Sizi Dinliyor', copy: 'Mikrofon açık. Konuşabilirsiniz.' },
  error: { badge: 'Hata', copy: 'Bağlantı kurulamadı. Tekrar deneyin.' },
};

function isMobile(): boolean {
  return window.innerWidth < 768;
}

export function createVoiceLauncher(middlewareUrl: string): HTMLElement {
  // ── DOM ─────────────────────────────────────────────────────────────────
  const container = document.createElement('div');
  container.className = 'glov-voice-chat-container';
  container.innerHTML = `
    <div class="glov-voice-chat-container-inner">
      <button class="glov-voice-chat-call-button" id="glov-call-agent-btn" type="button">
        <span class="glov-voice-chat-btn-avatar-wrap">
          <img class="glov-voice-chat-btn-avatar"
            src="https://configs.glov.ai/remoteConfig/voice-assistant.jpg" alt="" />
          <span class="glov-voice-chat-btn-live-dot"></span>
        </span>
        <svg class="glov-voice-chat-btn-phone-icon" xmlns="http://www.w3.org/2000/svg"
          width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1
            5.19 11a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72
            12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27
            a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
        </svg>
        <span class="glov-voice-chat-call-label">Uzmanla Görüş</span>
      </button>
    </div>

    <div class="glov-voice-chat-panel" data-state="idle" style="display:none">
      <div class="glov-voice-chat-panel-hit-layer" aria-hidden="true"></div>
      <div class="glov-voice-chat-panel-content">

        <div class="glov-voice-chat-panel-header">
          <div class="glov-voice-chat-panel-kicker">Otokoç AI Canlı Ses</div>
          <div class="glov-voice-chat-panel-actions">
            <button class="glov-voice-chat-icon-button" id="glov-voice-chat-close-icon"
              type="button" aria-label="Sesli görüşmeyi kapat">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
                viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
              </svg>
            </button>
          </div>
        </div>

        <div class="glov-voice-chat-hero">
          <div class="glov-voice-chat-orb-shell">
            <div class="glov-voice-chat-orb-container">
              <div class="glov-voice-chat-status-row">
                <div class="glov-voice-chat-status-badge" id="glov-voice-chat-status-badge">Bağlanıyor</div>
                <div class="glov-voice-chat-status-copy" id="glov-voice-chat-status-copy">
                  Sesli asistan hazırlanıyor.
                </div>
              </div>
              <div class="orb"></div>
              <div class="glov-voice-chat-title">Otokoç Sesli Asistan</div>
              <div class="glov-voice-chat-live-copy" id="glov-voice-chat-live-copy">
                Konuşmaya başlayabilirsiniz.
              </div>
              <canvas id="glov-audio-waveform" class="glov-audio-waveform"
                width="220" height="44"></canvas>
            </div>
          </div>
        </div>

        <div class="glov-voice-chat-security-notice">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round" class="glov-security-icon" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          <p>Kalite ve güvenlik için konuşma kayıt altına alınır.</p>
        </div>

        <div class="glov-voice-chat-panel-controls">
          <button class="glov-voice-chat-panel-button glov-voice-chat-panel-button-primary"
            id="glov-voice-chat-end-btn" type="button">
            Görüşmeyi Bitir
          </button>
        </div>

      </div>
    </div>
  `;

  // ── Refs ────────────────────────────────────────────────────────────────
  const callButton = container.querySelector('#glov-call-agent-btn') as HTMLButtonElement;
  const callLabel = container.querySelector('.glov-voice-chat-call-label') as HTMLElement;
  const panel = container.querySelector('.glov-voice-chat-panel') as HTMLElement;
  const innerBar = container.querySelector('.glov-voice-chat-container-inner') as HTMLElement;
  const closeBtn = container.querySelector('#glov-voice-chat-close-icon') as HTMLButtonElement;
  const endBtn = container.querySelector('#glov-voice-chat-end-btn') as HTMLButtonElement;
  const statusBadge = container.querySelector('#glov-voice-chat-status-badge') as HTMLElement;
  const statusCopy = container.querySelector('#glov-voice-chat-status-copy') as HTMLElement;

  // ── State ───────────────────────────────────────────────────────────────
  let conversation: Conversation | null = null;
  let sessionAttemptId = 0;
  let cachedAgentId: string | null = null;
  let audioCtx: AudioContext | null = null;
  let analyserNode: AnalyserNode | null = null;
  let waveFrameId: number | null = null;

  // ── UI helpers ──────────────────────────────────────────────────────────
  function setPanelState(state: VoicePanelState) {
    const { badge, copy } = STATE_LABELS[state];
    statusBadge.textContent = badge;
    statusCopy.textContent = copy;
    panel.setAttribute('data-state', state);
  }

  function hideInnerBar() {
    innerBar.style.opacity = '0';
    innerBar.style.pointerEvents = 'none';
    innerBar.style.visibility = 'hidden';
    innerBar.style.transform = 'scale(0.98)';
  }

  function showInnerBar() {
    innerBar.style.opacity = '1';
    innerBar.style.pointerEvents = 'auto';
    innerBar.style.visibility = 'visible';
    innerBar.style.transform = 'scale(1)';
  }

  async function openPanel() {
    container.classList.add('glov-voice-chat-panel-open');
    if (!isMobile()) container.classList.add('glov-voice-chat-expanded');
    hideInnerBar();

    if (isMobile()) {
      panel.classList.add('glov-voice-chat-fullscreen');
      document.body.appendChild(panel);
      document.documentElement.classList.add('glov-voice-fullscreen-open');
    }

    panel.style.display = 'block';
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        panel.classList.add('active');
        resolve();
      });
    });
  }

  function closePanel() {
    container.classList.remove('glov-voice-chat-panel-open', 'glov-voice-chat-expanded');
    showInnerBar();

    if (panel.classList.contains('glov-voice-chat-fullscreen')) {
      panel.classList.remove('glov-voice-chat-fullscreen');
      container.appendChild(panel);
      document.documentElement.classList.remove('glov-voice-fullscreen-open');
    }

    panel.classList.remove('active');
    panel.style.display = 'none';
    setPanelState('idle');
  }

  // ── Waveform ────────────────────────────────────────────────────────────
  function stopWaveform() {
    if (waveFrameId !== null) {
      cancelAnimationFrame(waveFrameId);
      waveFrameId = null;
    }
    if (analyserNode) {
      analyserNode.disconnect();
      analyserNode = null;
    }
    if (audioCtx) {
      audioCtx.close().catch(() => {});
      audioCtx = null;
    }
  }

  async function startMicWaveform() {
    if (audioCtx) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioCtx = new AudioContext();
      analyserNode = audioCtx.createAnalyser();
      analyserNode.fftSize = 256;
      audioCtx.createMediaStreamSource(stream).connect(analyserNode);

      const canvas = container.querySelector('#glov-audio-waveform') as HTMLCanvasElement | null;
      if (!canvas) return;
      const ctx2d = canvas.getContext('2d');
      if (!ctx2d) return;

      const buf = new Uint8Array(analyserNode.frequencyBinCount);
      const draw = () => {
        waveFrameId = requestAnimationFrame(draw);
        analyserNode!.getByteTimeDomainData(buf);
        ctx2d.clearRect(0, 0, canvas.width, canvas.height);
        ctx2d.beginPath();
        ctx2d.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx2d.lineWidth = 2;
        const step = canvas.width / buf.length;
        let x = 0;
        for (let i = 0; i < buf.length; i++) {
          const y = (buf[i]! / 128) * (canvas.height / 2);
          i === 0 ? ctx2d.moveTo(x, y) : ctx2d.lineTo(x, y);
          x += step;
        }
        ctx2d.stroke();
      };
      draw();
    } catch {
      // Microphone already acquired or permission denied — ignore
    }
  }

  // ── Backend helpers ─────────────────────────────────────────────────────
  async function getSignedUrl(): Promise<string> {
    if (!cachedAgentId) {
      const r = await fetch(`${middlewareUrl}/agents/id`);
      if (!r.ok) throw new Error(`Agent ID fetch failed: ${r.status}`);
      const data = (await r.json()) as { agent_id: string };
      cachedAgentId = data.agent_id;
    }

    const r = await fetch(
      `${middlewareUrl}/agents/conversations/token?agent_id=${encodeURIComponent(cachedAgentId)}`
    );
    if (!r.ok) throw new Error(`Token fetch failed: ${r.status}`);
    const data = (await r.json()) as { token: string };
    return data.token;
  }

  // ── Session ─────────────────────────────────────────────────────────────
  async function startSession() {
    const attemptId = ++sessionAttemptId;
    setPanelState('connecting');
    await openPanel();
    if (attemptId !== sessionAttemptId) return;

    try {
      const signedUrl = await getSignedUrl();
      if (attemptId !== sessionAttemptId) return;

      const next = await Conversation.startSession({
        signedUrl,
        onConnect: () => {
          if (attemptId !== sessionAttemptId) return;
          setPanelState('connecting');
        },
        onDisconnect: () => {
          if (attemptId !== sessionAttemptId) return;
          stopWaveform();
          closePanel();
          conversation = null;
        },
        onError: (err: unknown) => {
          if (attemptId !== sessionAttemptId) return;
          console.error('[voice]', err);
          setPanelState('error');
        },
        onModeChange: (mode: { mode: 'speaking' | 'listening' }) => {
          if (attemptId !== sessionAttemptId) return;
          if (mode.mode === 'listening') {
            setPanelState('listening');
            void startMicWaveform();
          } else {
            setPanelState('speaking');
          }
        },
      } as Parameters<typeof Conversation.startSession>[0]);

      if (attemptId !== sessionAttemptId) {
        void next.endSession().catch(() => {});
        return;
      }
      conversation = next;
    } catch (err) {
      if (attemptId !== sessionAttemptId) return;
      console.error('[voice] session start failed:', err);
      setPanelState('error');
    }
  }

  async function endSession() {
    const active = conversation;
    sessionAttemptId++;
    conversation = null;
    stopWaveform();
    closePanel();
    if (active) {
      await active.endSession().catch((err: unknown) => console.error('[voice] end error:', err));
    }
  }

  // ── Layout sync ─────────────────────────────────────────────────────────
  function syncLayout() {
    const desktop = !isMobile();
    container.classList.toggle('glov-voice-chat-desktop-launcher', desktop);
    callLabel.textContent = desktop ? "Uzman'a Sor" : 'Uzmanla Görüş';
  }

  // ── Event bindings ──────────────────────────────────────────────────────
  let lastPress = 0;
  function bindPress(el: HTMLElement, handler: () => Promise<void> | void) {
    const run = (e: Event) => {
      const now = Date.now();
      if (now - lastPress < 250) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      lastPress = now;
      e.preventDefault();
      e.stopPropagation();
      void handler();
    };
    el.addEventListener('pointerup', run);
    el.addEventListener('click', run);
  }

  bindPress(callButton, startSession);
  bindPress(closeBtn, endSession);
  bindPress(endBtn, endSession);

  setPanelState('idle');
  syncLayout();
  window.addEventListener('resize', syncLayout);

  return container;
}
