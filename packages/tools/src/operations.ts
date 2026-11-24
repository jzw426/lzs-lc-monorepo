import { readFileSync } from 'node:fs';
import { loadBaselineBundle } from '@lzs/content/node';
import type { ContentBundle } from '@lzs/content';
import {
  runReplay,
  TICK_RATE,
  type GameCommand,
  type Replay,
  type ReplayResult,
  type SimulationConfig,
} from '@lzs/core';

export function createBaselineConfig(
  bundle: ContentBundle,
  seed: number,
  gameVersion = '0.1.0-m1',
): SimulationConfig {
  if (bundle.tickRate !== TICK_RATE) {
    throw new Error('内容与核心tickRate不一致');
  }
  return {
    seed,
    initialGrain: bundle.economy.initialGrain,
    barracksCapacity: bundle.economy.barracksCapacity,
    recruitCost: bundle.economy.recruitCost,
    deck: bundle.units.map((unit) => unit.name),
    versions: {
      gameVersion,
      contentVersion: bundle.contentVersion,
      rulesVersion: bundle.rulesVersion,
      configHash: bundle.configHash,
    },
  };
}

export function simulate(seed: number, totalTicks: number, recruitCount: number): ReplayResult {
  const config = createBaselineConfig(loadBaselineBundle(), seed);
  const commands: GameCommand[] = Array.from({ length: recruitCount }, (_, index) => ({
    type: 'recruit',
    tick: index,
    sequence: 0,
    commandId: `simulate-${index}`,
  }));
  return runReplay({ config, totalTicks, commands, expectedHash: null });
}

export function loadReplay(path: string): Replay {
  return JSON.parse(readFileSync(path, 'utf8')) as Replay;
}

export function verifyReplay(path: string): ReplayResult {
  const replay = loadReplay(path);
  if (replay.expectedHash === null) {
    throw new Error('黄金回放必须包含expectedHash');
  }
  return runReplay(replay);
}
