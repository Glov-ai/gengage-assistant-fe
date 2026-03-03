/**
 * Extended Mode Manager — production lock-count system for panel extension.
 *
 * Controls whether the host page PDP area should be maximized or minimized
 * based on a combination of conditions: lock count, user visibility preference,
 * favorites mode, panel content type, and chat visibility.
 */

export type PanelContentType =
  | 'comparisonTable'
  | 'groupList'
  | 'productDetails'
  | 'productDetailsSimilars'
  | 'productList';

/**
 * Base content types that always trigger panel extension.
 * `productDetails` is only added when `productDetailsInPanel` is true
 * (i.e. demo websites). Regular accounts show product details inline in ChatPane.
 */
const BASE_PANEL_CONTENT_TYPES: readonly PanelContentType[] = [
  'comparisonTable',
  'groupList',
  'productDetailsSimilars',
  'productList',
];

export interface ExtendedModeManagerOptions {
  onChange: (extended: boolean) => void;
  /** Whether `productDetails` should trigger panel extension (default: false, true for demo sites). */
  productDetailsInPanel?: boolean;
}

export class ExtendedModeManager {
  private _lockCount = 1; // starts locked
  private _hiddenByUser = false;
  private _lastPanelContentType: PanelContentType | null = null;
  private _chatShown = false;
  private _isFavoritesMode = false;
  private _lastExtended = false;
  private _onChange: (extended: boolean) => void;
  private _panelContentTypes: ReadonlySet<string>;

  constructor(options: ExtendedModeManagerOptions) {
    this._onChange = options.onChange;

    const types = new Set<string>(BASE_PANEL_CONTENT_TYPES);
    if (options.productDetailsInPanel) {
      types.add('productDetails');
    }
    this._panelContentTypes = types;
  }

  get isExtended(): boolean {
    return (
      this._lockCount === 0 &&
      !this._hiddenByUser &&
      !this._isFavoritesMode &&
      this._lastPanelContentType !== null &&
      this._panelContentTypes.has(this._lastPanelContentType) &&
      this._chatShown
    );
  }

  unlock(): void {
    if (this._lockCount > 0) {
      this._lockCount--;
    }
    this._checkStateChange();
  }

  lock(): void {
    this._lockCount++;
    this._checkStateChange();
  }

  setHiddenByUser(hidden: boolean): void {
    this._hiddenByUser = hidden;
    this._checkStateChange();
  }

  setChatShown(shown: boolean): void {
    this._chatShown = shown;
    this._checkStateChange();
  }

  setFavoritesMode(fav: boolean): void {
    this._isFavoritesMode = fav;
    this._checkStateChange();
  }

  setPanelContentType(type: PanelContentType | null): void {
    this._lastPanelContentType = type;
    this._checkStateChange();
  }

  private _checkStateChange(): void {
    const current = this.isExtended;
    if (current !== this._lastExtended) {
      this._lastExtended = current;
      this._onChange(current);
    }
  }
}
