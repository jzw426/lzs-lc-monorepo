interface TTAdCloseResult {
  readonly isEnded?: boolean;
}

interface TTAdError {
  readonly errCode?: number;
  readonly errMsg?: string;
}

interface TTRewardedVideoAd {
  onClose(callback: (result: TTAdCloseResult) => void): void;
  offClose(callback: (result: TTAdCloseResult) => void): void;
  onError(callback: (error: TTAdError) => void): void;
  load(): Promise<void>;
  show(): Promise<void>;
}

interface TTSystemInfo {
  readonly safeArea?: { readonly top: number };
  readonly screenHeight?: number;
}

interface TTNamespace {
  getSystemInfoSync(): TTSystemInfo;
  createRewardedVideoAd(options: { adUnitId: string }): TTRewardedVideoAd;
  login(options: {
    success: (response: { code: string }) => void;
    fail: (error: unknown) => void;
  }): void;
  shareAppMessage(options: {
    title?: string;
    imageUrl?: string;
    success?: () => void;
    fail?: (error: unknown) => void;
  }): void;
  getStorageSync(key: string): unknown;
  setStorageSync(key: string, value: unknown): void;
  removeStorageSync(key: string): void;
  onHide(callback: () => void): void;
  onShow(callback: () => void): void;
  offHide(callback: () => void): void;
  offShow(callback: () => void): void;
}

declare const tt: TTNamespace | undefined;
