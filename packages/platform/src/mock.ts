import type {
  LifecycleHandlers,
  LoginResult,
  PlatformAdapter,
  PlatformCapability,
  RewardedAdResult,
  ShareResult,
  StoragePort,
} from './ports.js';

const ALL_CAPABILITIES: readonly PlatformCapability[] = [
  'login',
  'rewardedAd',
  'share',
  'storage',
  'lifecycle',
];

export interface MockPlatformOptions {
  readonly capabilities?: readonly PlatformCapability[];
}

export class PlatformUnavailableError extends Error {
  public constructor(public readonly capability: PlatformCapability) {
    super(`当前Mock未启用平台能力：${capability}`);
    this.name = 'PlatformUnavailableError';
  }
}

class MockStorage implements StoragePort {
  private readonly values = new Map<string, string>();

  public constructor(private readonly assertAvailable: () => void) {}

  public async get(key: string): Promise<string | null> {
    this.assertAvailable();
    return this.values.get(key) ?? null;
  }

  public async set(key: string, value: string): Promise<void> {
    this.assertAvailable();
    this.values.set(key, value);
  }

  public async delete(key: string): Promise<void> {
    this.assertAvailable();
    this.values.delete(key);
  }
}

/** 仅用于local/test；未声明的能力必须失败，不得伪造平台成功回调。 */
export class MockPlatformAdapter implements PlatformAdapter {
  public readonly storage: StoragePort;
  private readonly capabilities: ReadonlySet<PlatformCapability>;
  private readonly lifecycleHandlers = new Set<LifecycleHandlers>();
  private loginSequence = 0;

  public constructor(options: MockPlatformOptions = {}) {
    this.capabilities = new Set(options.capabilities ?? ALL_CAPABILITIES);
    this.storage = new MockStorage(() => this.assertCapability('storage'));
  }

  public async login(): Promise<LoginResult> {
    this.assertCapability('login');
    this.loginSequence += 1;
    return {
      userId: `mock-user-${this.loginSequence}`,
      sessionToken: `mock-session-${this.loginSequence}`,
    };
  }

  public async showRewardedAd(placementId: string): Promise<RewardedAdResult> {
    this.assertCapability('rewardedAd');
    if (placementId.length === 0) {
      throw new TypeError('placementId不得为空');
    }
    return { placementId, completed: true };
  }

  public async share(content: string): Promise<ShareResult> {
    this.assertCapability('share');
    if (content.length === 0) {
      throw new TypeError('分享内容不得为空');
    }
    return { shared: true };
  }

  public subscribeLifecycle(handlers: LifecycleHandlers): () => void {
    this.assertCapability('lifecycle');
    this.lifecycleHandlers.add(handlers);
    return () => this.lifecycleHandlers.delete(handlers);
  }

  public simulateLifecycle(event: 'hide' | 'show'): void {
    this.assertCapability('lifecycle');
    for (const handlers of this.lifecycleHandlers) {
      if (event === 'hide') {
        handlers.onHide();
      } else {
        handlers.onShow();
      }
    }
  }

  private assertCapability(capability: PlatformCapability): void {
    if (!this.capabilities.has(capability)) {
      throw new PlatformUnavailableError(capability);
    }
  }
}
