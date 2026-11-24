import { describe, expect, it } from 'vitest';
import { MockPlatformAdapter, PlatformUnavailableError } from '../src/index.js';

describe('MockPlatformAdapter', () => {
  it('提供可清理的本地存储与登录会话', async () => {
    const platform = new MockPlatformAdapter();
    expect(await platform.storage.get('snapshot')).toBeNull();
    await platform.storage.set('snapshot', '{}');
    expect(await platform.storage.get('snapshot')).toBe('{}');
    await platform.storage.delete('snapshot');
    expect(await platform.storage.get('snapshot')).toBeNull();
    expect(await platform.login()).toEqual({
      userId: 'mock-user-1',
      sessionToken: 'mock-session-1',
    });
  });

  it('未声明能力明确失败，不伪造成功', async () => {
    const platform = new MockPlatformAdapter({ capabilities: [] });
    await expect(platform.login()).rejects.toBeInstanceOf(PlatformUnavailableError);
    await expect(platform.showRewardedAd('revive')).rejects.toThrow('rewardedAd');
    await expect(platform.share('内容')).rejects.toThrow('share');
    await expect(platform.storage.get('key')).rejects.toThrow('storage');
    expect(() =>
      platform.subscribeLifecycle({ onHide: () => undefined, onShow: () => undefined }),
    ).toThrow('lifecycle');
  });

  it('校验广告位与分享内容', async () => {
    const platform = new MockPlatformAdapter();
    await expect(platform.showRewardedAd('')).rejects.toThrow(TypeError);
    await expect(platform.showRewardedAd('revive')).resolves.toEqual({
      placementId: 'revive',
      completed: true,
    });
    await expect(platform.share('')).rejects.toThrow(TypeError);
    await expect(platform.share('救援林冲')).resolves.toEqual({ shared: true });
  });

  it('生命周期订阅可退订', () => {
    const platform = new MockPlatformAdapter();
    let hides = 0;
    let shows = 0;
    const unsubscribe = platform.subscribeLifecycle({
      onHide: () => {
        hides += 1;
      },
      onShow: () => {
        shows += 1;
      },
    });
    platform.simulateLifecycle('hide');
    platform.simulateLifecycle('show');
    unsubscribe();
    platform.simulateLifecycle('hide');
    expect({ hides, shows }).toEqual({ hides: 1, shows: 1 });
    expect(() => platform.simulateLifecycle('show')).not.toThrow();
  });
});
