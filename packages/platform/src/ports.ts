export interface LoginResult {
  readonly userId: string;
  readonly sessionToken: string;
}

export interface RewardedAdResult {
  readonly placementId: string;
  readonly completed: true;
}

export interface ShareResult {
  readonly shared: true;
}

export interface StoragePort {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface LifecycleHandlers {
  readonly onHide: () => void;
  readonly onShow: () => void;
}

export interface PlatformAdapter {
  readonly storage: StoragePort;
  login(): Promise<LoginResult>;
  showRewardedAd(placementId: string): Promise<RewardedAdResult>;
  share(content: string): Promise<ShareResult>;
  subscribeLifecycle(handlers: LifecycleHandlers): () => void;
}

export type PlatformCapability = 'login' | 'rewardedAd' | 'share' | 'storage' | 'lifecycle';
