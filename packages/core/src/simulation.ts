import { hashState } from './hash.js';
import { Xoshiro128StarStar } from './random.js';
import { evaluateRecruitment } from './recruitment.js';
import type {
  GameCommand,
  GameEvent,
  GameSnapshot,
  Replay,
  ReplayResult,
  SimulationConfig,
  SimulationState,
  UnitKind,
} from './types.js';

interface MutableSimulationState {
  tick: number;
  grain: number;
  barracks: (UnitKind | null)[];
  successfulRecruits: number;
  rejectedRecruits: number;
  nextEventSequence: number;
  processedCommandIds: Set<string>;
  random: Xoshiro128StarStar;
}

function assertSafeNonNegativeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name}必须是非负安全整数`);
  }
}

function validateConfig(config: SimulationConfig): void {
  assertSafeNonNegativeInteger(config.seed, 'seed');
  if (config.seed > 0xffffffff) {
    throw new RangeError('seed必须是uint32');
  }
  assertSafeNonNegativeInteger(config.initialGrain, 'initialGrain');
  assertSafeNonNegativeInteger(config.barracksCapacity, 'barracksCapacity');
  assertSafeNonNegativeInteger(config.recruitCost, 'recruitCost');
  if (config.barracksCapacity === 0 || config.barracksCapacity > 100) {
    throw new RangeError('barracksCapacity必须在1到100之间');
  }
  if (config.deck.length === 0) {
    throw new RangeError('deck不得为空');
  }
  for (const [name, value] of Object.entries(config.versions)) {
    if (value.length === 0) {
      throw new TypeError(`${name}不得为空`);
    }
  }
}

function cloneState(state: MutableSimulationState): SimulationState {
  return {
    tick: state.tick,
    grain: state.grain,
    barracks: [...state.barracks],
    successfulRecruits: state.successfulRecruits,
    rejectedRecruits: state.rejectedRecruits,
    nextEventSequence: state.nextEventSequence,
    processedCommandIds: [...state.processedCommandIds].sort(),
    random: state.random.getState(),
  };
}

function compareCommands(left: GameCommand, right: GameCommand): number {
  if (left.sequence !== right.sequence) {
    return left.sequence - right.sequence;
  }
  return left.commandId < right.commandId ? -1 : left.commandId > right.commandId ? 1 : 0;
}

export class ReplayMismatchError extends Error {
  public constructor(
    public readonly expected: string,
    public readonly actual: string,
  ) {
    super(`回放hash不一致：expected=${expected} actual=${actual}`);
    this.name = 'ReplayMismatchError';
  }
}

export class GameSimulation {
  private readonly config: SimulationConfig;
  private readonly state: MutableSimulationState;

  public constructor(config: SimulationConfig) {
    validateConfig(config);
    this.config = {
      ...config,
      deck: [...config.deck],
      versions: { ...config.versions },
    };
    this.state = {
      tick: 0,
      grain: config.initialGrain,
      barracks: Array<UnitKind | null>(config.barracksCapacity).fill(null),
      successfulRecruits: 0,
      rejectedRecruits: 0,
      nextEventSequence: 0,
      processedCommandIds: new Set<string>(),
      random: new Xoshiro128StarStar(config.seed),
    };
  }

  public static fromSnapshot(snapshot: GameSnapshot): GameSimulation {
    validateConfig(snapshot.config);
    const simulation = new GameSimulation(snapshot.config);
    const state = snapshot.state;
    assertSafeNonNegativeInteger(state.tick, 'state.tick');
    assertSafeNonNegativeInteger(state.grain, 'state.grain');
    assertSafeNonNegativeInteger(state.successfulRecruits, 'state.successfulRecruits');
    assertSafeNonNegativeInteger(state.rejectedRecruits, 'state.rejectedRecruits');
    assertSafeNonNegativeInteger(state.nextEventSequence, 'state.nextEventSequence');
    if (state.barracks.length !== snapshot.config.barracksCapacity) {
      throw new RangeError('快照兵营容量与配置不一致');
    }
    if (new Set(state.processedCommandIds).size !== state.processedCommandIds.length) {
      throw new RangeError('快照包含重复commandId');
    }
    simulation.state.tick = state.tick;
    simulation.state.grain = state.grain;
    simulation.state.barracks = [...state.barracks];
    simulation.state.successfulRecruits = state.successfulRecruits;
    simulation.state.rejectedRecruits = state.rejectedRecruits;
    simulation.state.nextEventSequence = state.nextEventSequence;
    simulation.state.processedCommandIds = new Set(state.processedCommandIds);
    simulation.state.random = Xoshiro128StarStar.fromState(state.random);
    return simulation;
  }

  public executeTick(commands: readonly GameCommand[] = []): readonly GameEvent[] {
    const events: GameEvent[] = [];
    const orderedCommands = [...commands].sort(compareCommands);
    for (const command of orderedCommands) {
      this.validateCommand(command);
      events.push(this.applyCommand(command));
    }
    this.state.tick += 1;
    return events;
  }

  public getSnapshot(): GameSnapshot {
    return {
      config: {
        ...this.config,
        deck: [...this.config.deck],
        versions: { ...this.config.versions },
      },
      state: cloneState(this.state),
    };
  }

  public getStateHash(): string {
    return hashState(this.getSnapshot());
  }

  private validateCommand(command: GameCommand): void {
    if (command.type !== 'recruit') {
      throw new TypeError('未知命令类型');
    }
    if (command.tick !== this.state.tick) {
      throw new RangeError(`命令tick=${command.tick}与当前tick=${this.state.tick}不一致`);
    }
    assertSafeNonNegativeInteger(command.sequence, 'command.sequence');
    if (command.commandId.length === 0) {
      throw new TypeError('commandId不得为空');
    }
  }

  private applyCommand(command: GameCommand): GameEvent {
    const eventBase = {
      tick: this.state.tick,
      sequence: this.state.nextEventSequence,
      commandId: command.commandId,
    };
    this.state.nextEventSequence += 1;

    if (this.state.processedCommandIds.has(command.commandId)) {
      this.state.rejectedRecruits += 1;
      return {
        ...eventBase,
        type: 'command_rejected',
        reason: 'DUPLICATE_COMMAND',
        remainingGrain: this.state.grain,
      };
    }
    this.state.processedCommandIds.add(command.commandId);

    const result = evaluateRecruitment(cloneState(this.state), this.config, this.state.random);
    if (!result.ok) {
      this.state.rejectedRecruits += 1;
      return {
        ...eventBase,
        type: 'command_rejected',
        reason: result.reason,
        remainingGrain: this.state.grain,
      };
    }

    this.state.grain -= result.cost;
    this.state.barracks[result.slot] = result.unit;
    this.state.successfulRecruits += 1;
    return {
      ...eventBase,
      type: 'recruited',
      slot: result.slot,
      unit: result.unit,
      remainingGrain: this.state.grain,
    };
  }
}

export function runReplay(replay: Replay): ReplayResult {
  assertSafeNonNegativeInteger(replay.totalTicks, 'totalTicks');
  const simulation = new GameSimulation(replay.config);
  const events: GameEvent[] = [];
  const commandsByTick = new Map<number, GameCommand[]>();
  for (const command of replay.commands) {
    assertSafeNonNegativeInteger(command.tick, 'command.tick');
    if (command.tick >= replay.totalTicks) {
      throw new RangeError('存在超出totalTicks范围的命令');
    }
    const commands = commandsByTick.get(command.tick) ?? [];
    commands.push(command);
    commandsByTick.set(command.tick, commands);
  }

  for (let tick = 0; tick < replay.totalTicks; tick += 1) {
    events.push(...simulation.executeTick(commandsByTick.get(tick) ?? []));
  }
  const stateHash = simulation.getStateHash();
  if (replay.expectedHash !== null && replay.expectedHash !== stateHash) {
    throw new ReplayMismatchError(replay.expectedHash, stateHash);
  }
  return { snapshot: simulation.getSnapshot(), stateHash, events };
}
