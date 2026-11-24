import { ClientRuntime, assertLayaAirVersion } from '@lzs/client';
import {
  GameSimulation,
  runReplay,
  type GameCommand,
  type GameSnapshot,
  type Replay,
  type SimulationConfig,
} from '@lzs/core';
import { MockPlatformAdapter, type PlatformAdapter, type RewardedAdResult } from '@lzs/platform';
import { DouyinPlatformAdapter } from './DouyinPlatformAdapter';
import { StatusView } from './StatusView';

const { regClass } = Laya;

const STEP_MS = 1000 / 30;
const MAX_DELTA_MS = 100;
const MAX_ACCUMULATOR_MS = 200;
const DESIGN_TOP_MARGIN = 40;
const AD_PLACEMENT_ID = '替换为广告位ID';
const SHARE_TEXT = '鲁智深与林冲 L3 验收';
const DEBUG_LOG = false;

const CONFIG: SimulationConfig = {
  seed: 20260304,
  initialGrain: 100,
  barracksCapacity: 5,
  recruitCost: 10,
  deck: ['刀', '枪', '骑', '弓'],
  versions: {
    gameVersion: '0.1.0-m1',
    contentVersion: 'content-m1.0',
    rulesVersion: 'rules-m1.0',
    configHash: 'fnv1a32:e7ae79c0',
  },
};

const GOLDEN_REPLAY: Replay = {
  config: CONFIG,
  totalTicks: 8,
  commands: [0, 1, 2, 3, 4, 5].map((tick) => ({
    type: 'recruit' as const,
    tick,
    sequence: 0,
    commandId: tick === 5 ? 'golden-full' : `golden-${tick}`,
  })),
  expectedHash: 'fnv1a32:92852f6a',
};

@regClass()
export class GameScene extends Laya.Script {
  private runtime: ClientRuntime | null = null;
  private platform: PlatformAdapter | null = null;
  private view: StatusView | null = null;
  private lastSnapshot: GameSnapshot | null = null;
  private engineVersion = '';
  private ready = false;
  private paused = false;
  private accumulator = 0;
  private rewardCount = 0;
  private unsubscribe: (() => void) | null = null;
  private readonly boundButtons: { node: Laya.Sprite; handler: () => void }[] = [];

  public onAwake(): void {
    try {
      this.bootstrap();
    } catch (error) {
      console.error('[L3_BOOT_FAILED]', error);
      throw error;
    }
  }

  public onUpdate(): void {
    const runtime = this.runtime;
    if (!this.ready || this.paused || runtime === null) {
      return;
    }
    const delta = Math.min(Laya.timer.delta, MAX_DELTA_MS);
    this.accumulator = Math.min(this.accumulator + delta, MAX_ACCUMULATOR_MS);
    while (this.accumulator >= STEP_MS) {
      this.accumulator -= STEP_MS;
      this.lastSnapshot = runtime.advanceTick().snapshot;
    }
  }

  public onDestroy(): void {
    this.ready = false;
    if (this.unsubscribe !== null) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    for (const { node, handler } of this.boundButtons) {
      node.off(Laya.Event.CLICK, this, handler);
    }
    this.boundButtons.length = 0;
    delete (globalThis as { __L3__?: unknown }).__L3__;
  }

  private bootstrap(): void {
    this.engineVersion = this.readEngineVersion();

    const uiRoot = this.requireNode<Laya.Sprite>(this.owner, 'UIRoot');
    const statusText = this.requireNode<Laya.Text>(uiRoot, 'StatusText');
    const actionBar = this.requireNode<Laya.Sprite>(uiRoot, 'ActionBar');
    this.applySafeArea(uiRoot);

    const platform = this.createPlatform();
    const view = new StatusView(statusText, DEBUG_LOG);
    this.platform = platform;
    this.view = view;
    this.runtime = new ClientRuntime({
      simulation: new GameSimulation(CONFIG),
      view,
      platform,
      onViewError: (error) => console.error('[L3_VIEW_ERROR]', error),
    });

    this.lastSnapshot = this.runtime.advanceTick().snapshot;
    this.unsubscribe = platform.subscribeLifecycle({
      onHide: () => {
        this.paused = true;
        this.accumulator = 0;
      },
      onShow: () => {
        this.paused = false;
        this.accumulator = 0;
      },
    });

    this.bindButton(this.requireNode<Laya.Sprite>(actionBar, 'LoginButton'), '登录', () =>
      this.requirePlatform().login(),
    );
    this.bindButton(this.requireNode<Laya.Sprite>(actionBar, 'AdButton'), '广告', () =>
      this.showAd(),
    );
    this.bindButton(this.requireNode<Laya.Sprite>(actionBar, 'ShareButton'), '分享', () =>
      this.requirePlatform().share(SHARE_TEXT),
    );

    this.exposeTestApi();
    this.ready = true;
    console.log(
      '[L3_BOOT_OK]',
      JSON.stringify({ version: this.engineVersion, configHash: CONFIG.versions.configHash }),
    );
  }

  private readEngineVersion(): string {
    const version = Laya.version;
    if (version.length === 0) {
      throw new Error('L3_ENGINE_VERSION_UNKNOWN');
    }
    assertLayaAirVersion(version);
    return version;
  }

  private requireNode<T extends Laya.Node>(root: Laya.Node, name: string): T {
    const node = root.getChildByName(name) as T | null;
    if (node === null) {
      throw new Error(`L3_SCENE_NODE_MISSING:${name}`);
    }
    return node;
  }

  private requirePlatform(): PlatformAdapter {
    if (this.platform === null) {
      throw new Error('L3_RUNTIME_NOT_READY');
    }
    return this.platform;
  }

  private requireRuntime(): ClientRuntime {
    if (this.runtime === null) {
      throw new Error('L3_RUNTIME_NOT_READY');
    }
    return this.runtime;
  }

  private applySafeArea(uiRoot: Laya.Sprite): void {
    if (typeof tt === 'undefined') {
      return;
    }
    const info = tt.getSystemInfoSync();
    const safeTop = info.safeArea?.top ?? 0;
    const screenHeight = info.screenHeight ?? 0;
    if (safeTop <= 0 || screenHeight <= 0) {
      return;
    }
    const designSafeTop = (safeTop * Laya.stage.height) / screenHeight;
    uiRoot.y = Math.max(0, designSafeTop - DESIGN_TOP_MARGIN);
  }

  private createPlatform(): PlatformAdapter {
    return typeof tt === 'undefined'
      ? new MockPlatformAdapter()
      : new DouyinPlatformAdapter(AD_PLACEMENT_ID);
  }

  private async showAd(): Promise<RewardedAdResult> {
    const result = await this.requirePlatform().showRewardedAd(AD_PLACEMENT_ID);
    this.rewardCount += 1;
    console.log('[L3_REWARD_COUNT]', this.rewardCount);
    return result;
  }

  private bindButton(node: Laya.Sprite, name: string, action: () => unknown): void {
    const handler = (): void => {
      this.runAction(name, action);
    };
    node.mouseEnabled = true;
    node.on(Laya.Event.CLICK, this, handler);
    this.boundButtons.push({ node, handler });
  }

  private runAction(name: string, action: () => unknown): void {
    this.view?.setHint(`${name}执行中`);
    Promise.resolve()
      .then(() => action())
      .then(() => {
        console.log(`[L3_ACTION_OK] ${name}`);
        this.view?.setHint(`${name}成功`);
      })
      .catch((error: unknown) => {
        console.error(`[L3_ACTION_FAILED] ${name}`, error);
        const message = error instanceof Error ? error.message : String(error);
        this.view?.setHint(`${name}失败：${message}`);
      });
  }

  private exposeTestApi(): void {
    const api = {
      version: () => this.engineVersion,
      hash: () => runReplay(GOLDEN_REPLAY).stateHash,
      replay: () => runReplay(GOLDEN_REPLAY),
      breakView: () => {
        if (this.view !== null) {
          this.view.failNextRender = true;
        }
      },
      recruit: () => {
        const tick = this.lastSnapshot?.state.tick ?? 0;
        const command: GameCommand = {
          type: 'recruit',
          tick,
          sequence: 0,
          commandId: `l3-${tick}`,
        };
        const result = this.requireRuntime().advanceTick([command]);
        this.lastSnapshot = result.snapshot;
        return result;
      },
      login: () => this.requirePlatform().login(),
      ad: () => this.showAd(),
      rewardCount: () => this.rewardCount,
      share: () => this.requirePlatform().share(SHARE_TEXT),
      storageSet: (key: string, value: string) => this.requirePlatform().storage.set(key, value),
      storageGet: (key: string) => this.requirePlatform().storage.get(key),
      storageDelete: (key: string) => this.requirePlatform().storage.delete(key),
    };
    (globalThis as unknown as { __L3__: typeof api }).__L3__ = api;
  }
}
