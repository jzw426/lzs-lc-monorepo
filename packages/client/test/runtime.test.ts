import {
  GameSimulation,
  type GameEvent,
  type GameSnapshot,
  type SimulationConfig,
} from '@lzs/core';
import { MockPlatformAdapter } from '@lzs/platform';
import { describe, expect, it } from 'vitest';
import { assertLayaAirVersion, ClientRuntime, LAYA_AIR_VERSION } from '../src/index.js';
import type { BattleView } from '../src/runtime.js';

const config: SimulationConfig = {
  seed: 1,
  initialGrain: 100,
  barracksCapacity: 5,
  recruitCost: 10,
  deck: ['刀'],
  versions: {
    gameVersion: '0.1.0-m1',
    contentVersion: 'content-m1.0',
    rulesVersion: 'rules-m1.0',
    configHash: 'fnv1a32:00000000',
  },
};

class TestView implements BattleView {
  public snapshots: GameSnapshot[] = [];
  public events: GameEvent[][] = [];
  public shouldThrow = false;

  public render(snapshot: GameSnapshot): void {
    if (this.shouldThrow) {
      throw new Error('render failed');
    }
    this.snapshots.push(snapshot);
  }

  public present(events: readonly GameEvent[]): void {
    this.events.push([...events]);
  }
}

function createRuntime(view: TestView, onViewError?: (error: unknown) => void): ClientRuntime {
  return new ClientRuntime({
    simulation: new GameSimulation(config),
    view,
    platform: new MockPlatformAdapter(),
    ...(onViewError ? { onViewError } : {}),
  });
}

describe('ClientRuntime', () => {
  it('向视图提供独立快照并转发事件', () => {
    const view = new TestView();
    const runtime = createRuntime(view);
    const result = runtime.advanceTick([{ type: 'recruit', tick: 0, sequence: 0, commandId: 'a' }]);
    expect(view.snapshots).toHaveLength(1);
    expect(view.events[0]).toEqual(result.events);
    (view.snapshots[0]!.state as { grain: number }).grain = 0;
    expect(runtime.advanceTick().snapshot.state.grain).toBe(90);
  });

  it('表现异常不重置核心，也不阻断后续tick', () => {
    const view = new TestView();
    const errors: unknown[] = [];
    const runtime = createRuntime(view, (error) => errors.push(error));
    view.shouldThrow = true;
    expect(runtime.advanceTick().snapshot.state.tick).toBe(1);
    expect(errors).toHaveLength(1);
    expect(runtime.advanceTick().snapshot.state.tick).toBe(2);
  });

  it('未注册错误回调时仍保持核心可运行', () => {
    const view = new TestView();
    view.shouldThrow = true;
    const runtime = createRuntime(view);
    expect(() => runtime.advanceTick()).not.toThrow();
  });

  it('锁定LayaAir IDE引擎版本', () => {
    expect(() => assertLayaAirVersion(LAYA_AIR_VERSION)).not.toThrow();
    expect(() => assertLayaAirVersion('3.2.0')).toThrow('版本不一致');
  });
});
