import type { Xoshiro128StarStar } from './random.js';
import type { SimulationConfig, SimulationState, UnitKind } from './types.js';

export type RecruitmentResult =
  | {
      readonly ok: true;
      readonly slot: number;
      readonly unit: UnitKind;
      readonly cost: number;
    }
  | {
      readonly ok: false;
      readonly reason: 'BARRACKS_FULL' | 'INSUFFICIENT_GRAIN';
    };

/** 校验顺序固定：容量→费用→一次随机抽样；失败路径不得写状态。 */
export function evaluateRecruitment(
  state: SimulationState,
  config: SimulationConfig,
  random: Xoshiro128StarStar,
): RecruitmentResult {
  const slot = state.barracks.indexOf(null);
  if (slot < 0) {
    return { ok: false, reason: 'BARRACKS_FULL' };
  }
  if (state.grain < config.recruitCost) {
    return { ok: false, reason: 'INSUFFICIENT_GRAIN' };
  }
  const unit = config.deck[random.nextInt(config.deck.length)] as UnitKind;
  return { ok: true, slot, unit, cost: config.recruitCost };
}
