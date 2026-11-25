import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';

export interface BuildArtifactOptions {
  readonly dir: string;
  readonly expectedAppId?: string;
  readonly shaFile?: string;
}

export interface ArtifactCheck {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
}

export interface BuildArtifactReport {
  readonly status: 'ok' | 'failed';
  readonly dir: string;
  readonly checks: ArtifactCheck[];
}

const SHARE_WIDTH = 500;
const SHARE_HEIGHT = 400;
const SHARE_MAX_BYTES = 200 * 1024;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const SHA256_LINE = /^[0-9a-f]{64}\s{2}\S+/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readJson(path: string): unknown {
  if (!existsSync(path)) {
    throw new Error('文件不存在');
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as unknown;
  } catch {
    throw new Error('JSON 解析失败');
  }
}

function check(name: string, run: () => string): ArtifactCheck {
  try {
    return { name, ok: true, detail: run() };
  } catch (error) {
    return { name, ok: false, detail: error instanceof Error ? error.message : '校验失败' };
  }
}

function checkGameJson(dir: string): ArtifactCheck {
  return check('game.json', () => {
    const game = readJson(join(dir, 'game.json'));
    if (!isRecord(game)) {
      throw new Error('根节点不是对象');
    }
    if (game.deviceOrientation !== 'portrait') {
      throw new Error(
        `deviceOrientation=${JSON.stringify(game.deviceOrientation)}，应为 "portrait"`,
      );
    }
    return 'deviceOrientation=portrait';
  });
}

function checkProjectConfig(dir: string, expectedAppId: string | undefined): ArtifactCheck {
  return check('project.config.json', () => {
    const config = readJson(join(dir, 'project.config.json'));
    if (!isRecord(config)) {
      throw new Error('根节点不是对象');
    }
    const appid = config.appid;
    if (typeof appid !== 'string' || appid.trim() === '') {
      throw new Error('appid 缺失');
    }
    if (expectedAppId !== undefined && appid !== expectedAppId) {
      throw new Error(`appid=${appid} 与期望 ${expectedAppId} 不一致`);
    }
    return `appid=${appid}`;
  });
}

function checkEntryJs(dir: string): ArtifactCheck {
  return check('入口 JS', () => {
    const candidates = readdirSync(dir).filter((name) => name.endsWith('.js'));
    const entry = candidates.find((name) => statSync(join(dir, name)).size > 0);
    if (entry === undefined) {
      throw new Error('包根缺少非空 .js');
    }
    return entry;
  });
}

function checkSharePng(dir: string): ArtifactCheck {
  return check('share.png', () => {
    const path = join(dir, 'share.png');
    if (!existsSync(path)) {
      throw new Error('文件不存在');
    }
    const buffer = readFileSync(path);
    if (buffer.length > SHARE_MAX_BYTES) {
      throw new Error(`${buffer.length} 字节，超过 200KB`);
    }
    const signatureOk = PNG_SIGNATURE.every((byte, index) => buffer[index] === byte);
    if (!signatureOk || buffer.length < 24) {
      throw new Error('不是有效 PNG');
    }
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    if (width !== SHARE_WIDTH || height !== SHARE_HEIGHT) {
      throw new Error(`${width}×${height}，应为 ${SHARE_WIDTH}×${SHARE_HEIGHT}`);
    }
    return `${width}×${height}，${buffer.length} 字节`;
  });
}

function checkShaFile(dir: string, shaFile: string): ArtifactCheck {
  return check('douyin-sha256.txt', () => {
    if (!existsSync(shaFile)) {
      throw new Error(`文件不存在：${shaFile}`);
    }
    const lines = readFileSync(shaFile, 'utf8')
      .split(/\r?\n/)
      .filter((line) => line.trim() !== '');
    if (lines.length === 0) {
      throw new Error('文件为空');
    }
    if (!lines.some((line) => SHA256_LINE.test(line))) {
      throw new Error('无有效 SHA256 行');
    }
    return `${lines.length} 行`;
  });
}

export function validateBuildArtifacts(options: BuildArtifactOptions): BuildArtifactReport {
  const { dir } = options;
  const shaFile = options.shaFile ?? join(dirname(dir), 'douyin-sha256.txt');
  const checks = existsSync(dir)
    ? [
        checkGameJson(dir),
        checkProjectConfig(dir, options.expectedAppId),
        checkEntryJs(dir),
        checkSharePng(dir),
        checkShaFile(dir, shaFile),
      ]
    : [{ name: '包目录', ok: false, detail: `目录不存在：${dir}` }];
  return {
    status: checks.every((item) => item.ok) ? 'ok' : 'failed',
    dir,
    checks,
  };
}
