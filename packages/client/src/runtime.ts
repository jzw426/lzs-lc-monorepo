import type { GameCommand, GameEvent, GameSimulation, GameSnapshot } from '@lzs/core';
import type { PlatformAdapter } from '@lzs/platform';

/** View只能读取快照与事件，不得取得核心可变对象。 */
export interface BattleView {
  render(snapshot: GameSnapshot): void;
  present(events: readonly GameEvent[]): void;
}

export interface ClientRuntimeOptions {
  readonly simulation: GameSimulation;
  readonly view: BattleView;
  readonly platform: PlatformAdapter;
  readonly onViewError?: (error: unknown) => void;
}

export interface ClientTickResult {
  readonly snapshot: GameSnapshot;
  readonly events: readonly GameEvent[];
}

export class ClientRuntime {
  private readonly simulation: GameSimulation;
  private readonly view: BattleView;
  private readonly onViewError: ((error: unknown) => void) | undefined;

  public readonly platform: PlatformAdapter;

  public constructor(options: ClientRuntimeOptions) {
    this.simulation = options.simulation;
    this.view = options.view;
    this.platform = options.platform;
    this.onViewError = options.onViewError;
  }

  public advanceTick(commands: readonly GameCommand[] = []): ClientTickResult {
    const events = this.simulation.executeTick(commands);
    const snapshot = this.simulation.getSnapshot();
    try {
      this.view.render(snapshot);
      this.view.present(events);
    } catch (error) {
      this.onViewError?.(error);
    }
    return { snapshot, events };
  }
}
