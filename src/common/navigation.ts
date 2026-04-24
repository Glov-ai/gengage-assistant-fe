import { isSafeUrl } from './safe-html.js';

export type NavigationRequestDetail = {
  url: string;
  newTab?: boolean;
};

export function navigateToUrl(url: string, newTab?: boolean): boolean {
  if (typeof window === 'undefined') return false;
  if (!isSafeUrl(url)) return false;

  const detail: NavigationRequestDetail = newTab === undefined ? { url } : { url, newTab };
  const event = new CustomEvent<NavigationRequestDetail>('gengage:navigate', {
    detail,
    cancelable: true,
  });
  if (!window.dispatchEvent(event)) return false;

  if (newTab) {
    window.open(url, '_blank', 'noopener,noreferrer');
  } else {
    window.location.href = url;
  }
  return true;
}
