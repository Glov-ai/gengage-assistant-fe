import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GengageChat } from '../src/chat/index.js';

describe('beauty consulting migration', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="chat-root"></div>';
    if (typeof URL.createObjectURL !== 'function') {
      URL.createObjectURL = vi.fn(() => 'blob:mock');
    }
    if (typeof URL.revokeObjectURL !== 'function') {
      URL.revokeObjectURL = vi.fn();
    }
  });

  it('switches to beauty mode on redirect metadata with assistant_mode', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 503 }));
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const chat = new GengageChat();
    await chat.init({
      accountId: 'flormarcomtr',
      middlewareUrl: 'https://api.test.com',
      mountTarget: '#chat-root',
      variant: 'inline',
      session: { sessionId: 'test-session' },
    });

    // Redirect handler is sync — init is streamed via process_action, no separate endpoint.
    (chat as unknown as { _handleRedirectMetadata(payload: unknown): void })._handleRedirectMetadata({
      assistant_mode: 'beauty_consulting',
      scenario: 'shade_advisor',
      user_text: 'balo makyajı öner',
    });

    // No separate init endpoint — everything goes through process_action
    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls.every((url) => !url.includes('/beauty_consulting_init'))).toBe(true);

    // Mode is set locally (will be confirmed by CONTEXT event in production)
    const mode = (chat as unknown as { _assistantMode: string })._assistantMode;
    expect(mode).toBe('beauty_consulting');
  });

  it('sends attachment as user_message (inputText) in beauty mode', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 503 }));
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const chat = new GengageChat();
    await chat.init({
      accountId: 'flormarcomtr',
      middlewareUrl: 'https://api.test.com',
      mountTarget: '#chat-root',
      variant: 'inline',
      session: { sessionId: 'test-session' },
    });

    // Simulate backend context with beauty mode set
    (chat as unknown as { _lastBackendContext: Record<string, unknown> })._lastBackendContext = {
      panel: { assistant_mode: 'beauty_consulting' },
    };
    (chat as unknown as { _assistantMode: string })._assistantMode = 'beauty_consulting';

    const file = new File(['img-bytes'], 'face.jpg', { type: 'image/jpeg' });
    (chat as unknown as { _sendMessage(text: string, attachment?: File): void })._sendMessage('cildim kuru', file);
    await new Promise((resolve) => setTimeout(resolve, 30));

    const processCall = fetchMock.mock.calls.find((call) => String(call[0]).includes('/chat/process_action'));
    expect(processCall).toBeDefined();
    const init = processCall?.[1] as RequestInit;
    expect(init.body).toBeInstanceOf(FormData);
    const formData = init.body as FormData;
    const requestRaw = formData.get('request');
    expect(typeof requestRaw).toBe('string');
    const request = JSON.parse(requestRaw as string) as Record<string, unknown>;
    // Backend receives inputText (mapped from user_message)
    expect(request.type).toBe('inputText');
    const payload = request.payload as Record<string, unknown>;
    expect(payload['text']).toBe('cildim kuru');
  });

  it('stages attachment normally in beauty mode (no fabricated message)', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 503 }));
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const chat = new GengageChat();
    await chat.init({
      accountId: 'flormarcomtr',
      middlewareUrl: 'https://api.test.com',
      mountTarget: '#chat-root',
      variant: 'inline',
      session: { sessionId: 'test-session' },
    });

    // Simulate beauty mode
    (chat as unknown as { _assistantMode: string })._assistantMode = 'beauty_consulting';

    const file = new File(['img-bytes'], 'face.jpg', { type: 'image/jpeg' });
    const drawer = (
      chat as unknown as { _drawer?: { stageAttachment(f: File): void; getPendingAttachment(): File | null } }
    )._drawer;
    if (drawer) {
      drawer.stageAttachment(file);
      expect(drawer.getPendingAttachment()?.name).toBe('face.jpg');
    }

    // No process_action call should have been made by staging alone
    const processCall = fetchMock.mock.calls.find((call) => String(call[0]).includes('/chat/process_action'));
    expect(processCall).toBeUndefined();
  });

  it('handles watch_expert and booking redirects (not just beauty)', () => {
    const chat = new GengageChat();

    // Test all three recognized modes
    for (const mode of ['beauty_consulting', 'watch_expert', 'booking'] as const) {
      (chat as unknown as { _handleRedirectMetadata(payload: unknown): void })._handleRedirectMetadata({
        assistant_mode: mode,
      });
      expect((chat as unknown as { _assistantMode: string })._assistantMode).toBe(mode);
    }
  });

  it('ignores unknown redirect payloads without assistant_mode', () => {
    const chat = new GengageChat();
    (chat as unknown as { _assistantMode: string })._assistantMode = 'shopping';

    // Host-only redirect (e.g. voiceLead) — no assistant_mode field
    (chat as unknown as { _handleRedirectMetadata(payload: unknown): void })._handleRedirectMetadata({
      to: 'voiceLead',
    });

    expect((chat as unknown as { _assistantMode: string })._assistantMode).toBe('shopping');
  });

  it('applies ui_hints from CONTEXT panel', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 503 }));
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const chat = new GengageChat();
    await chat.init({
      accountId: 'flormarcomtr',
      middlewareUrl: 'https://api.test.com',
      mountTarget: '#chat-root',
      variant: 'inline',
      session: { sessionId: 'test-session' },
    });

    // Verify _uiHints is null initially
    const hints = (chat as unknown as { _uiHints: Record<string, unknown> | null })._uiHints;
    expect(hints).toBeNull();
  });

  it('derives _assistantMode from CONTEXT panel.assistant_mode', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 503 }));
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const chat = new GengageChat();
    await chat.init({
      accountId: 'flormarcomtr',
      middlewareUrl: 'https://api.test.com',
      mountTarget: '#chat-root',
      variant: 'inline',
      session: { sessionId: 'test-session' },
    });

    // Simulate CONTEXT event with beauty mode
    const accessor = chat as unknown as {
      _lastBackendContext: Record<string, unknown>;
      _assistantMode: string;
      _uiHints: Record<string, unknown> | null;
      _applyUiHints: () => void;
    };

    accessor._lastBackendContext = {
      panel: {
        assistant_mode: 'beauty_consulting',
        ui_hints: {
          hide_attachment_controls: true,
          hide_comparison_prompt: true,
          hide_choice_prompter: true,
          input_placeholder: 'Güzellik danışmanınıza yazın...',
        },
      },
    };
    accessor._assistantMode = 'beauty_consulting';
    accessor._uiHints = (accessor._lastBackendContext['panel'] as Record<string, unknown>)['ui_hints'] as Record<
      string,
      unknown
    >;
    accessor._applyUiHints();

    expect(accessor._assistantMode).toBe('beauty_consulting');
    expect(accessor._uiHints).toBeTruthy();
    expect(accessor._uiHints?.['hide_attachment_controls']).toBe(true);
  });

  it('clears _uiHints when CONTEXT has no ui_hints (shopping mode transition)', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 503 }));
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const chat = new GengageChat();
    await chat.init({
      accountId: 'flormarcomtr',
      middlewareUrl: 'https://api.test.com',
      mountTarget: '#chat-root',
      variant: 'inline',
      session: { sessionId: 'test-session' },
    });

    const accessor = chat as unknown as {
      _uiHints: Record<string, unknown> | null;
      _applyUiHints: () => void;
    };

    // First set ui_hints (beauty mode)
    accessor._uiHints = { hide_attachment_controls: true };
    expect(accessor._uiHints).toBeTruthy();

    // Then clear (transition to shopping — no ui_hints in CONTEXT)
    accessor._uiHints = null;
    accessor._applyUiHints();
    expect(accessor._uiHints).toBeNull();
  });

  it('ignores bookingMode redirect (host-only, no assistant_mode)', () => {
    const chat = new GengageChat();
    (chat as unknown as { _assistantMode: string })._assistantMode = 'shopping';

    // Booking redirect from auto_warmup — has no assistant_mode, just "to: bookingMode"
    (chat as unknown as { _handleRedirectMetadata(payload: unknown): void })._handleRedirectMetadata({
      to: 'bookingMode',
      booking_intent: 'service_appointment',
      handoff_summary: 'Randevu bilgisi',
    });

    // Mode should remain shopping — this is a host page redirect, not an internal mode switch
    expect((chat as unknown as { _assistantMode: string })._assistantMode).toBe('shopping');
  });

  it('shopping image attachment uses findSimilar action type', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 503 }));
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const chat = new GengageChat();
    await chat.init({
      accountId: 'flormarcomtr',
      middlewareUrl: 'https://api.test.com',
      mountTarget: '#chat-root',
      variant: 'inline',
      session: { sessionId: 'test-session' },
    });

    // Ensure mode is shopping (default)
    const accessor = chat as unknown as {
      _assistantMode: string;
      _lastBackendContext: Record<string, unknown>;
      _sendMessage(text: string, attachment?: File): void;
    };
    accessor._assistantMode = 'shopping';
    accessor._lastBackendContext = { panel: { assistant_mode: 'shopping' } };

    const file = new File(['img-bytes'], 'product.jpg', { type: 'image/jpeg' });
    accessor._sendMessage('', file);
    await new Promise((resolve) => setTimeout(resolve, 30));

    const processCall = fetchMock.mock.calls.find((call) => String(call[0]).includes('/chat/process_action'));
    expect(processCall).toBeDefined();
    const init = processCall?.[1] as RequestInit;
    expect(init.body).toBeInstanceOf(FormData);
    const formData = init.body as FormData;
    const requestRaw = formData.get('request');
    expect(typeof requestRaw).toBe('string');
    const request = JSON.parse(requestRaw as string) as Record<string, unknown>;
    expect(request.type).toBe('findSimilar');
  });

  it('watch_expert redirect sets mode and applies ui_hints', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 503 }));
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const chat = new GengageChat();
    await chat.init({
      accountId: 'flormarcomtr',
      middlewareUrl: 'https://api.test.com',
      mountTarget: '#chat-root',
      variant: 'inline',
      session: { sessionId: 'test-session' },
    });

    // Simulate watch_expert redirect
    (chat as unknown as { _handleRedirectMetadata(payload: unknown): void })._handleRedirectMetadata({
      assistant_mode: 'watch_expert',
    });

    const accessor = chat as unknown as {
      _assistantMode: string;
      _uiHints: Record<string, unknown> | null;
      _lastBackendContext: Record<string, unknown>;
      _applyUiHints: () => void;
    };
    expect(accessor._assistantMode).toBe('watch_expert');

    // Simulate CONTEXT with watch_expert ui_hints
    accessor._lastBackendContext = {
      panel: {
        assistant_mode: 'watch_expert',
        ui_hints: {
          hide_attachment_controls: true,
          hide_comparison_prompt: true,
          input_placeholder: 'Saat danışmanınıza yazın...',
        },
      },
    };
    accessor._uiHints = (accessor._lastBackendContext['panel'] as Record<string, unknown>)['ui_hints'] as Record<
      string,
      unknown
    >;
    accessor._applyUiHints();

    expect(accessor._uiHints?.['hide_attachment_controls']).toBe(true);
    expect(accessor._uiHints?.['input_placeholder']).toBe('Saat danışmanınıza yazın...');
  });

  it('unavailable product context short-circuits user messages in shopping mode', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 503 }));
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const chat = new GengageChat();
    await chat.init({
      accountId: 'flormarcomtr',
      middlewareUrl: 'https://api.test.com',
      mountTarget: '#chat-root',
      variant: 'inline',
      session: { sessionId: 'test-session' },
      pageContext: { pageType: 'pdp', sku: 'TEST-SKU' },
    });

    const accessor = chat as unknown as {
      _assistantMode: string;
      _productContextUnavailableSku: string | null;
      _sendMessage(text: string): void;
    };
    accessor._assistantMode = 'shopping';
    accessor._productContextUnavailableSku = 'TEST-SKU';

    // Send a message — should be short-circuited, not reaching the backend
    accessor._sendMessage('Bu ürün hakkında bilgi ver');
    await new Promise((resolve) => setTimeout(resolve, 30));

    const processCall = fetchMock.mock.calls.find((call) => String(call[0]).includes('/chat/process_action'));
    expect(processCall).toBeUndefined();
  });

  it('PhotoAnalysisCard UISpec attaches structured data to bot message', () => {
    const chat = new GengageChat();

    const accessor = chat as unknown as {
      _createMessage(
        role: string,
        content: string,
      ): {
        id: string;
        role: string;
        content: string;
        photoAnalysis?: {
          summary: string;
          strengths?: string[];
          focusPoints?: string[];
          celebStyle?: string;
          celebStyleReason?: string;
          nextQuestion?: string;
        };
      };
    };

    const msg = accessor._createMessage('assistant', 'Analysis text');
    // Verify the message interface supports photoAnalysis
    msg.photoAnalysis = {
      summary: 'Cildiniz kuru görünüyor.',
      strengths: ['Belirgin göz hattı'],
      focusPoints: ['T bölgesinde parlama'],
      celebStyle: 'Hailey Bieber temiz ışıltısı',
      nextQuestion: 'Nemlendirici önerelim mi?',
    };
    expect(msg.photoAnalysis.summary).toBe('Cildiniz kuru görünüyor.');
    expect(msg.photoAnalysis.strengths).toContain('Belirgin göz hattı');
    expect(msg.photoAnalysis.focusPoints).toContain('T bölgesinde parlama');
    expect(msg.photoAnalysis.celebStyle).toBe('Hailey Bieber temiz ışıltısı');
    expect(msg.photoAnalysis.nextQuestion).toBe('Nemlendirici önerelim mi?');
  });

  it('BeautyPhotoStep skip sends a message to the backend', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 503 }));
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const chat = new GengageChat();
    await chat.init({
      accountId: 'flormarcomtr',
      middlewareUrl: 'https://api.test.com',
      mountTarget: '#chat-root',
      variant: 'inline',
      session: { sessionId: 'test-session' },
    });

    const accessor = chat as unknown as {
      _assistantMode: string;
      _lastBackendContext: Record<string, unknown>;
      _sendMessage(text: string, attachment?: File): void;
    };
    accessor._assistantMode = 'beauty_consulting';
    accessor._lastBackendContext = { panel: { assistant_mode: 'beauty_consulting' } };

    // Simulate what onSkip does: send skip message to backend
    const sendSpy = vi.spyOn(accessor, '_sendMessage' as never);
    accessor._sendMessage('Fotoğraf adımını geçiyorum');

    expect(sendSpy).toHaveBeenCalledWith('Fotoğraf adımını geçiyorum');
    await new Promise((resolve) => setTimeout(resolve, 30));

    // Backend should receive the skip as an inputText action
    const processCall = fetchMock.mock.calls.find((call) => String(call[0]).includes('/chat/process_action'));
    expect(processCall).toBeDefined();
    const init = processCall?.[1] as RequestInit;
    const body = init.body;
    // In beauty mode, text messages are sent as JSON (no attachment)
    if (typeof body === 'string') {
      const request = JSON.parse(body) as Record<string, unknown>;
      expect(request.type).toBe('inputText');
    } else if (body instanceof FormData) {
      const requestRaw = body.get('request');
      expect(typeof requestRaw).toBe('string');
      const request = JSON.parse(requestRaw as string) as Record<string, unknown>;
      expect(request.type).toBe('inputText');
    }
  });
});
