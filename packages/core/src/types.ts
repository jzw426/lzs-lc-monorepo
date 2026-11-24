export const TICK_RATE = 30;

export type UnitKind = '刀' | '枪' | '骑' | '弓';

export interface VersionStamp {
  readonly gameVersion: string;
  readonly contentVersion: string;
  readonly rulesVersion: string;
  readonly configHash: string;
}

export interface SimulationConfig {
  readonly seed: number;
  readonly initialGrain: number;
  readonly barracksCapacity: number;
  readonly recruitCost: number;
  readonly deck: readonly UnitKind[];
  readonly versions: VersionStamp;
}

export interface RandomState {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
}

export interface SimulationState {
  readonly tick: number;
  readonly grain: number;
  readonly barracks: readonly (UnitKind | null)[];
  readonly successfulRecruits: number;
  readonly rejectedRecruits: number;
  readonly nextEventSequence: number;
  readonly processedCommandIds: readonly string[];
  readonly random: RandomState;
}

export interface GameSnapshot {
  readonly config: SimulationConfig;
  readonly state: SimulationState;
}

export interface RecruitCommand {
  readonly type: 'recruit';
  readonly tick: number;
  readonly sequence: number;
  readonly commandId: string;
}

export type GameCommand = RecruitCommand;

export interface GameEventBase {
  readonly tick: number;
  readonly sequence: number;
  readonly commandId: string;
}

export interface RecruitedEvent extends GameEventBase {
  readonly type: 'recruited';
  readonly slot: number;
  readonly unit: UnitKind;
  readonly remainingGrain: number;
}

export type CommandRejectionReason = 'BARRACKS_FULL' | 'INSUFFICIENT_GRAIN' | 'DUPLICATE_COMMAND';

export interface CommandRejectedEvent extends GameEventBase {
  readonly type: 'command_rejected';
  readonly reason: CommandRejectionReason;
  readonly remainingGrain: number;
}

export type GameEvent = RecruitedEvent | CommandRejectedEvent;

export interface Replay {
  readonly config: SimulationConfig;
  readonly totalTicks: number;
  readonly commands: readonly GameCommand[];
  readonly expectedHash: string | null;
}

export interface ReplayResult {
  readonly snapshot: GameSnapshot;
  readonly stateHash: string;
  readonly events: readonly GameEvent[];
}
