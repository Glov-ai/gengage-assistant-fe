/**
 * Block-by-block HTML typewriter effect.
 *
 * Parses sanitised HTML into top-level blocks and reveals them one at a time
 * with a configurable stagger delay. Respects prefers-reduced-motion.
 */

export interface TypewriterOptions {
  container: HTMLElement;
  html: string;
  /** Delay in ms between block reveals (default: 30). */
  delayMs?: number;
  /** Called after each block is revealed — useful for scroll tracking. */
  onTick?: () => void;
  /** Called when all blocks have been revealed. */
  onComplete?: () => void;
}

export interface TypewriterHandle {
  /** Skip animation and show all content immediately. */
  complete(): void;
  /** Cancel animation, leave content as-is. */
  cancel(): void;
  readonly isRunning: boolean;
}

const BLOCK_ELEMENTS = new Set([
  'P',
  'DIV',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'LI',
  'UL',
  'OL',
  'BLOCKQUOTE',
  'PRE',
  'TABLE',
  'SECTION',
  'HR',
  'FIGURE',
  'FIGCAPTION',
  'DL',
  'DT',
  'DD',
]);

/**
 * Split parsed DOM children into logical blocks for reveal animation.
 * Block-level elements each become their own block.
 * Adjacent inline/text nodes are grouped together.
 */
function splitIntoBlocks(nodes: NodeList): Node[][] {
  const blocks: Node[][] = [];
  let currentInline: Node[] = [];

  for (const node of nodes) {
    if (node.nodeType === Node.ELEMENT_NODE && BLOCK_ELEMENTS.has((node as Element).tagName)) {
      // Flush any pending inline group
      if (currentInline.length > 0) {
        blocks.push(currentInline);
        currentInline = [];
      }
      blocks.push([node]);
    } else {
      currentInline.push(node);
    }
  }

  if (currentInline.length > 0) {
    blocks.push(currentInline);
  }

  return blocks;
}

function containsTable(nodes: Node[][]): boolean {
  for (const block of nodes) {
    for (const node of block) {
      if (
        node.nodeType === Node.ELEMENT_NODE &&
        ((node as Element).tagName === 'TABLE' || (node as Element).querySelector?.('table'))
      ) {
        return true;
      }
    }
  }
  return false;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function typewriteHtml(options: TypewriterOptions): TypewriterHandle {
  const { container, html, delayMs = 30, onTick, onComplete } = options;

  // Parse HTML into DOM nodes
  const template = document.createElement('template');
  template.innerHTML = html;
  const blocks = splitIntoBlocks(template.content.childNodes);

  // Skip animation for: reduced motion, single block, contains table, empty
  if (prefersReducedMotion() || blocks.length <= 1 || containsTable(blocks)) {
    container.innerHTML = html;
    onComplete?.();
    return { complete() {}, cancel() {}, isRunning: false };
  }

  // Clear container and start reveal
  container.innerHTML = '';
  let currentIndex = 0;
  let timerId: ReturnType<typeof setTimeout> | null = null;
  let running = true;

  function revealNext(): void {
    if (!running || currentIndex >= blocks.length) {
      running = false;
      onComplete?.();
      return;
    }

    const block = blocks[currentIndex]!;
    const wrapper = document.createElement('span');
    wrapper.className = 'gengage-chat-typewriter-block';
    for (const node of block) {
      wrapper.appendChild(node.cloneNode(true));
    }
    container.appendChild(wrapper);

    currentIndex++;
    onTick?.();

    if (currentIndex < blocks.length) {
      timerId = setTimeout(revealNext, delayMs);
    } else {
      running = false;
      onComplete?.();
    }
  }

  // Start the first reveal immediately
  revealNext();

  return {
    complete() {
      if (!running) return;
      if (timerId !== null) clearTimeout(timerId);
      running = false;
      container.innerHTML = html;
      onComplete?.();
    },
    cancel() {
      if (timerId !== null) clearTimeout(timerId);
      running = false;
    },
    get isRunning() {
      return running;
    },
  };
}
