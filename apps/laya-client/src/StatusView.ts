import type { BattleView } from '@lzs/client';
import type { GameEvent, GameSnapshot } from '@lzs/core';

const REFRESH_INTERVAL_TICKS = 5;

export class StatusView implements BattleView {
  public failNextRender = false;
  private snapshot?: GameSnapshot;
  private hint = '';

  public constructor(
    private readonly label: Laya.Text,
    private readonly debugLog: boolean,
  ) {}

  public render(snapshot: GameSnapshot): void {
    this.snapshot = snapshot;
    if (this.failNextRender) {
      this.failNextRender = false;
      throw new Error('L3_INJECTED_VIEW_ERROR');
    }
    const tick = snapshot.state.tick;
    if (tick > 1 && tick % REFRESH_INTERVAL_TICKS !== 0) {
      return;
    }
    this.flush();
  }

  public present(events: readonly GameEvent[]): void {
    if (this.debugLog && events.length > 0) {
      console.log('[L3_EVENTS]', JSON.stringify(events));
    }
  }

  public setHint(text: string): void {
    this.hint = text;
    this.flush();
  }

  private flush(): void {
    const snapshot = this.snapshot;
    if (snapshot === undefined) {
      return;
    }
    const state = snapshot.state;
    const barracks = state.barracks.map((unit) => unit ?? '空').join(' | ');
    this.label.text =
      `tick=${state.tick}  粮草=${state.grain}\n` +
      `兵营=${barracks}\n` +
      `征兵成功=${state.successfulRecruits}  拒绝=${state.rejectedRecruits}\n` +
      `配置=${snapshot.config.versions.configHash}\n` +
      `动作=${this.hint.length > 0 ? this.hint : '无'}`;
  }
}
