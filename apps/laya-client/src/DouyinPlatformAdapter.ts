import type {
  LifecycleHandlers,
  LoginResult,
  PlatformAdapter,
  RewardedAdResult,
  ShareResult,
  StoragePort,
} from '@lzs/platform';

const SHARE_IMAGE = 'share.png';
const AD_SHOW_TIMEOUT_MS = 15_000;
const AD_PLAY_TIMEOUT_MS = 120_000;

function getApi(): TTNamespace {
  if (typeof tt === 'undefined') {
    throw new Error('L3_PLATFORM_UNAVAILABLE');
  }
  return tt;
}

export class DouyinPlatformAdapter implements PlatformAdapter {
  public readonly storage: StoragePort;
  private readonly api: TTNamespace;
  private readonly ad: TTRewardedVideoAd;

  public constructor(adUnitId: string) {
    this.api = getApi();
    this.ad = this.api.createRewardedVideoAd({ adUnitId });
    this.ad.onError((error) => console.error('[L3_AD_ERROR]', error.errCode ?? 'unknown'));
    this.storage = {
      get: (key) => Promise.resolve(this.readString(key)),
      set: (key, value) => {
        this.api.setStorageSync(key, value);
        return Promise.resolve();
      },
      delete: (key) => {
        this.api.removeStorageSync(key);
        return Promise.resolve();
      },
    };
  }

  public login(): Promise<LoginResult> {
    return new Promise((resolve, reject) => {
      this.api.login({
        success: (response) => resolve({ userId: 'douyin', sessionToken: response.code }),
        fail: () => reject(new Error('L3_LOGIN_FAILED')),
      });
    });
  }

  public showRewardedAd(placementId: string): Promise<RewardedAdResult> {
    return new Promise((resolve, reject) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;

      const finish = (action: () => void): void => {
        if (settled) {
          return;
        }
        settled = true;
        if (timer !== undefined) {
          clearTimeout(timer);
        }
        this.ad.offClose(onClose);
        action();
      };
      const startTimer = (ms: number, message: string): void => {
        if (timer !== undefined) {
          clearTimeout(timer);
        }
        timer = setTimeout(() => finish(() => reject(new Error(message))), ms);
      };
      const onClose = (result: TTAdCloseResult): void => {
        if (result.isEnded === true) {
          finish(() => resolve({ placementId, completed: true }));
        } else {
          finish(() => reject(new Error('L3_AD_CANCELLED')));
        }
      };

      // 先注册回调再 show，避免用户快速关闭时错过 onClose。
      startTimer(AD_SHOW_TIMEOUT_MS, 'L3_AD_TIMEOUT');
      this.ad.onClose(onClose);
      this.ad
        .load()
        .catch(() => undefined)
        .then(() => this.ad.show())
        .then(() => {
          // 展示成功后进入播放阶段，避免 30 秒以上广告被启动超时误杀。
          if (!settled) {
            startTimer(AD_PLAY_TIMEOUT_MS, 'L3_AD_PLAY_TIMEOUT');
          }
        })
        .catch((error: { errCode?: number }) => {
          finish(() => reject(new Error(`L3_AD_FAILED:${error.errCode ?? 'unknown'}`)));
        });
    });
  }

  public share(content: string): Promise<ShareResult> {
    return new Promise((resolve, reject) => {
      this.api.shareAppMessage({
        title: content,
        imageUrl: SHARE_IMAGE,
        success: () => resolve({ shared: true }),
        fail: () => reject(new Error('L3_SHARE_FAILED')),
      });
    });
  }

  public subscribeLifecycle(handlers: LifecycleHandlers): () => void {
    this.api.onHide(handlers.onHide);
    this.api.onShow(handlers.onShow);
    return () => {
      this.api.offHide(handlers.onHide);
      this.api.offShow(handlers.onShow);
    };
  }

  private readString(key: string): string | null {
    const value = this.api.getStorageSync(key);
    return typeof value === 'string' ? value : null;
  }
}
