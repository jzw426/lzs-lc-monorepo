import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  GameSimulation,
  ReplayMismatchError,
  runReplay,
  type GameCommand,
  type GameSnapshot,
  type Replay,
  type SimulationConfig,
} from '../src/index.js';

function createConfig(overrides: Partial<SimulationConfig> = {}): SimulationConfig {
  return {
    seed: 20260304,
    initialGrain: 100,
    barracksCapacity: 5,
    recruitCost: 10,
    deck: ['刀', '枪', '骑', '弓'],
    versions: {
      gameVersion: '0.1.0-m1',
      contentVersion: 'content-m1.0',
      rulesVersion: 'rules-m1.0',
      configHash: 'fnv1a32:00000000',
    },
    ...overrides,
  };
}

function recruit(tick: number, sequence: number, commandId: string): GameCommand {
  return { type: 'recruit', tick, sequence, commandId };
}

function copySnapshot(snapshot: GameSnapshot): GameSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as GameSnapshot;
}

describe('GameSimulation', () => {
  it('规范排序使命令提交顺序不影响最终状态', () => {
    const commands = [recruit(0, 2, 'c'), recruit(0, 1, 'b'), recruit(0, 1, 'a')];
    const first = new GameSimulation(createConfig());
    const second = new GameSimulation(createConfig());
    const firstEvents = first.executeTick(commands);
    const secondEvents = second.executeTick([...commands].reverse());
    expect(firstEvents.map((event) => event.commandId)).toEqual(['a', 'b', 'c']);
    expect(second.getStateHash()).toBe(first.getStateHash());
    expect(secondEvents).toEqual(firstEvents);
  });

  it('满兵营不扣费、不消耗随机数', () => {
    const simulation = new GameSimulation(createConfig({ barracksCapacity: 1 }));
    expect(simulation.executeTick([recruit(0, 0, 'first')])[0]?.type).toBe('recruited');
    const before = simulation.getSnapshot();
    const event = simulation.executeTick([recruit(1, 0, 'full')])[0];
    expect(event).toMatchObject({ type: 'command_rejected', reason: 'BARRACKS_FULL' });
    const after = simulation.getSnapshot();
    expect(after.state.grain).toBe(before.state.grain);
    expect(after.state.random).toEqual(before.state.random);
  });

  it('费用不足不扣费、不消耗随机数', () => {
    const simulation = new GameSimulation(createConfig({ initialGrain: 0 }));
    const before = simulation.getSnapshot();
    expect(simulation.executeTick([recruit(0, 0, 'poor')])[0]).toMatchObject({
      type: 'command_rejected',
      reason: 'INSUFFICIENT_GRAIN',
      remainingGrain: 0,
    });
    expect(simulation.getSnapshot().state.random).toEqual(before.state.random);
  });

  it('重复命令只拒绝重复项，不重复扣费', () => {
    const simulation = new GameSimulation(createConfig());
    simulation.executeTick([recruit(0, 0, 'same')]);
    const before = simulation.getSnapshot();
    expect(simulation.executeTick([recruit(1, 0, 'same')])[0]).toMatchObject({
      type: 'command_rejected',
      reason: 'DUPLICATE_COMMAND',
    });
    expect(simulation.getSnapshot().state.grain).toBe(before.state.grain);
    expect(simulation.getSnapshot().state.random).toEqual(before.state.random);
  });

  it('快照恢复后继续执行与连续执行一致', () => {
    const continuous = new GameSimulation(createConfig());
    continuous.executeTick([recruit(0, 0, 'a')]);
    continuous.executeTick([recruit(1, 0, 'b')]);

    const interrupted = new GameSimulation(createConfig());
    interrupted.executeTick([recruit(0, 0, 'a')]);
    const restored = GameSimulation.fromSnapshot(copySnapshot(interrupted.getSnapshot()));
    restored.executeTick([recruit(1, 0, 'b')]);
    expect(restored.getStateHash()).toBe(continuous.getStateHash());
  });

  it('无命令tick仍按固定步长推进', () => {
    const simulation = new GameSimulation(createConfig());
    expect(simulation.executeTick()).toEqual([]);
    expect(simulation.getSnapshot().state.tick).toBe(1);
  });

  it('拒绝tick、序号、ID或类型非法的命令', () => {
    const simulation = new GameSimulation(createConfig());
    expect(() => simulation.executeTick([recruit(1, 0, 'future')])).toThrow(RangeError);
    expect(() => simulation.executeTick([recruit(0, -1, 'sequence')])).toThrow(RangeError);
    expect(() => simulation.executeTick([recruit(0, 0, '')])).toThrow(TypeError);
    expect(() =>
      simulation.executeTick([{ ...recruit(0, 0, 'unknown'), type: 'other' } as GameCommand]),
    ).toThrow('未知命令类型');
  });
});

describe('配置与快照边界', () => {
  it.each([
    createConfig({ seed: -1 }),
    createConfig({ seed: 0x1_0000_0000 }),
    createConfig({ initialGrain: -1 }),
    createConfig({ barracksCapacity: 0 }),
    createConfig({ barracksCapacity: 101 }),
    createConfig({ recruitCost: -1 }),
    createConfig({ deck: [] }),
  ])('拒绝非法配置 %#', (config) => {
    expect(() => new GameSimulation(config)).toThrow(RangeError);
  });

  it('拒绝空版本字段', () => {
    const config = createConfig();
    const invalid = {
      ...config,
      versions: { ...config.versions, gameVersion: '' },
    };
    expect(() => new GameSimulation(invalid)).toThrow(TypeError);
  });

  it('拒绝损坏的快照', () => {
    const source = new GameSimulation(createConfig());
    const invalidBarracks = copySnapshot(source.getSnapshot());
    (invalidBarracks.state as { barracks: unknown[] }).barracks = [];
    expect(() => GameSimulation.fromSnapshot(invalidBarracks)).toThrow('兵营容量');

    const invalidIds = copySnapshot(source.getSnapshot());
    (invalidIds.state as { processedCommandIds: string[] }).processedCommandIds = ['a', 'a'];
    expect(() => GameSimulation.fromSnapshot(invalidIds)).toThrow('重复commandId');

    const invalidTick = copySnapshot(source.getSnapshot());
    (invalidTick.state as { tick: number }).tick = -1;
    expect(() => GameSimulation.fromSnapshot(invalidTick)).toThrow(RangeError);
  });
});

describe('回放', () => {
  it('支持性质测试：任意种子与命令流均可重复', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 0xffffffff }),
        fc.integer({ min: 0, max: 8 }),
        (seed, commandCount) => {
          const config = createConfig({ seed });
          const commands = Array.from({ length: commandCount }, (_, index) =>
            recruit(index, 0, `command-${index}`),
          );
          const replay: Replay = { config, totalTicks: 10, commands, expectedHash: null };
          expect(runReplay(replay).stateHash).toBe(runReplay(replay).stateHash);
        },
      ),
      { numRuns: 50 },
    );
  });

  it('可校验黄金hash并明确报告篡改分歧', () => {
    const replay: Replay = {
      config: createConfig(),
      totalTicks: 2,
      commands: [recruit(0, 0, 'a')],
      expectedHash: null,
    };
    const result = runReplay(replay);
    expect(runReplay({ ...replay, expectedHash: result.stateHash }).stateHash).toBe(
      result.stateHash,
    );
    expect(() => runReplay({ ...replay, expectedHash: 'fnv1a32:deadbeef' })).toThrow(
      ReplayMismatchError,
    );
  });

  it('拒绝非法总tick数', () => {
    expect(() =>
      runReplay({ config: createConfig(), totalTicks: -1, commands: [], expectedHash: null }),
    ).toThrow(RangeError);
  });
});
