import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { loadBaselineBundle } from '@lzs/content/node';
import { runReplay } from '@lzs/core';
import { validateBuildArtifacts } from './build-artifacts.js';
import { loadReplay, simulate, verifyReplay } from './operations.js';

function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function main(argv: string[]): void {
  const [command, ...args] = argv;
  if (command === 'validate-content') {
    const bundle = loadBaselineBundle();
    writeJson({
      status: 'ok',
      contentVersion: bundle.contentVersion,
      rulesVersion: bundle.rulesVersion,
      configHash: bundle.configHash,
      units: bundle.units.length,
    });
    return;
  }
  if (command === 'replay') {
    const { values, positionals } = parseArgs({
      args,
      allowPositionals: true,
      options: { verify: { type: 'boolean', default: false } },
    });
    const path = positionals[0];
    if (!path) {
      throw new TypeError('replay需要JSON文件路径');
    }
    const result = values.verify
      ? verifyReplay(resolve(path))
      : runReplay(loadReplay(resolve(path)));
    writeJson({
      status: 'ok',
      stateHash: result.stateHash,
      tick: result.snapshot.state.tick,
      events: result.events.length,
    });
    return;
  }
  if (command === 'simulate') {
    const { values } = parseArgs({
      args,
      options: {
        seed: { type: 'string', default: '1' },
        ticks: { type: 'string', default: '30' },
        recruits: { type: 'string', default: '5' },
      },
    });
    const result = simulate(Number(values.seed), Number(values.ticks), Number(values.recruits));
    writeJson({
      status: 'ok',
      stateHash: result.stateHash,
      tick: result.snapshot.state.tick,
      successfulRecruits: result.snapshot.state.successfulRecruits,
      rejectedRecruits: result.snapshot.state.rejectedRecruits,
      events: result.events.length,
    });
    return;
  }
  if (command === 'validate-build') {
    const { values, positionals } = parseArgs({
      args,
      allowPositionals: true,
      options: {
        appid: { type: 'string' },
        sha: { type: 'string' },
      },
    });
    const dir = resolve(positionals[0] ?? 'apps/laya-client/dist/douyin');
    const options = {
      dir,
      ...(values.appid === undefined ? {} : { expectedAppId: values.appid }),
      ...(values.sha === undefined ? {} : { shaFile: resolve(values.sha) }),
    };
    const report = validateBuildArtifacts(options);
    writeJson(report);
    if (report.status !== 'ok') {
      process.exitCode = 1;
    }
    return;
  }
  throw new TypeError('命令仅支持validate-content、replay、simulate、validate-build');
}

try {
  main(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : '工具执行失败'}\n`);
  process.exitCode = 1;
}
