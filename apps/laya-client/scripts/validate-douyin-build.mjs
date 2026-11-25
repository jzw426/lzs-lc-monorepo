#!/usr/bin/env node
/**
 * 抖音小游戏构建产物校验脚本（零依赖，Node.js 18+）
 *
 * 用法：
 *   node apps/laya-client/scripts/validate-douyin-build.mjs [构建目录] [选项]
 *
 * 选项：
 *   --appid <id>      期望的 AppID，与 project.config.json 中的 appid 比对
 *   --config <file>   自定义规则 JSON，与内置默认规则深度合并
 *   --json            以 JSON 输出完整结果，便于 CI 解析
 *   --help            显示帮助
 *
 * 环境变量：
 *   DOUYIN_BUILD_DIR  未传位置参数时使用的构建目录
 *   DOUYIN_APPID      未传 --appid 时使用的期望 AppID
 *
 * 退出码：
 *   0  校验通过
 *   1  校验失败（目录/文件/配置/资源不符合规则）
 *   2  参数或规则配置错误
 *
 * 规则配置示例（--config）：
 * {
 *   "requiredDirs": ["pages", "utils", "components"],
 *   "requiredFiles": ["game.json", "project.config.json", "share.png"],
 *   "failOnEmptyFiles": true,
 *   "projectConfig": {
 *     "requiredKeys": ["appid", "projectname", "compileType", "miniprogramRoot"],
 *     "expectedCompileType": "miniprogram",
 *     "expectedAppId": "ttc..."
 *   },
 *   "gameJson": { "enabled": true, "orientation": "portrait" },
 *   "entryJs": { "enabled": true },
 *   "sharePng": { "enabled": true, "width": 500, "height": 400, "maxBytes": 204800 }
 * }
 *
 * 注意：pages/utils/components 是“小程序”的目录结构；LayaAir 构建的“小游戏”
 * 默认不包含这些目录，因此内置规则 requiredDirs 为空。若需校验小程序结构，
 * 通过 --config 显式启用，并把 expectedCompileType 设为 miniprogram。
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const DEFAULT_DIR = join(REPO_ROOT, 'apps/laya-client/dist/douyin');

const DEFAULT_RULES = {
  requiredDirs: [],
  requiredFiles: ['game.json', 'project.config.json', 'share.png'],
  forbiddenEntries: ['node_modules', '.git'],
  failOnEmptyFiles: true,
  projectConfig: {
    requiredKeys: ['appid'],
    recommendedKeys: ['projectname', 'compileType'],
    expectedCompileType: 'game',
    expectedAppId: undefined,
  },
  gameJson: { enabled: true, orientation: 'portrait' },
  entryJs: { enabled: true },
  sharePng: { enabled: true, width: 500, height: 400, maxBytes: 200 * 1024 },
  shaFile: { enabled: false, path: null },
};

const results = [];
const pass = (name, detail = '') => results.push({ name, level: 'pass', detail });
const warn = (name, detail = '') => results.push({ name, level: 'warn', detail });
const fail = (name, detail = '') => results.push({ name, level: 'fail', detail });

function printHelp() {
  process.stdout.write(
    [
      '抖音小游戏构建产物校验（零依赖）',
      '',
      '用法: node apps/laya-client/scripts/validate-douyin-build.mjs [构建目录] [--appid <id>] [--config <file>] [--json]',
      '',
      '默认目录: apps/laya-client/dist/douyin',
      '校验维度: 目录存在性、必需文件非空、空文件扫描、配置合法性、资源规格',
      '小程序结构: 通过 --config 设置 requiredDirs 与 projectConfig.expectedCompileType',
      '退出码: 0 通过 / 1 校验失败 / 2 参数或规则错误',
    ].join('\n') + '\n',
  );
}

function parseArgs(argv) {
  const options = { dir: undefined, appId: undefined, config: undefined, json: false };
  const positionals = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--appid' || arg === '--config') {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) {
        throw new Error(`${arg} 缺少参数值`);
      }
      i += 1;
      if (arg === '--appid') {
        options.appId = value;
      } else {
        options.config = value;
      }
    } else if (arg.startsWith('--')) {
      throw new Error(`未知参数：${arg}`);
    } else {
      positionals.push(arg);
    }
  }
  if (positionals.length > 1) {
    throw new Error(`只允许一个构建目录参数，实际收到 ${positionals.length} 个`);
  }
  options.dir = positionals[0];
  return options;
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepMerge(base, extra) {
  const merged = { ...base };
  for (const [key, value] of Object.entries(extra)) {
    merged[key] =
      isPlainObject(value) && isPlainObject(base[key]) ? deepMerge(base[key], value) : value;
  }
  return merged;
}

function readJson(path) {
  if (!existsSync(path)) {
    throw new Error('文件不存在');
  }
  const text = readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`JSON 语法错误：${error instanceof Error ? error.message : String(error)}`);
  }
}

function isFile(path) {
  return existsSync(path) && statSync(path).isFile();
}

function isDir(path) {
  return existsSync(path) && statSync(path).isDirectory();
}

function checkDirectory(dir) {
  if (!existsSync(dir)) {
    fail('构建目录', `不存在：${dir}`);
    return false;
  }
  if (!isDir(dir)) {
    fail('构建目录', `不是目录：${dir}`);
    return false;
  }
  pass('构建目录', dir);
  const entries = readdirSync(dir);
  if (entries.length === 0) {
    fail('目录内容', '目录为空，构建可能未完成');
  } else {
    pass('目录内容', `顶层 ${entries.length} 项：${entries.join(', ')}`);
  }
  return true;
}

function checkRequiredDirs(dir, rules) {
  for (const name of rules.requiredDirs) {
    if (isDir(join(dir, name))) {
      pass(`必需目录 ${name}`);
    } else {
      fail(`必需目录 ${name}`, '缺失');
    }
  }
}

function checkRequiredFiles(dir, rules) {
  for (const name of rules.requiredFiles) {
    const path = join(dir, name);
    if (!isFile(path)) {
      fail(`必需文件 ${name}`, '缺失');
      continue;
    }
    const size = statSync(path).size;
    if (size === 0) {
      fail(`必需文件 ${name}`, '文件为空（0 字节）');
    } else {
      pass(`必需文件 ${name}`, `${size} 字节`);
    }
  }
}

function collectEmptyFiles(dir, limit = 20) {
  const empties = [];
  const walk = (current) => {
    if (empties.length >= limit) {
      return;
    }
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules') {
          walk(path);
        }
      } else if (entry.isFile() && statSync(path).size === 0) {
        empties.push(path);
        if (empties.length >= limit) {
          return;
        }
      }
    }
  };
  walk(dir);
  return empties;
}

function checkEmptyFiles(dir, rules) {
  if (!rules.failOnEmptyFiles) {
    return;
  }
  const empties = collectEmptyFiles(dir);
  if (empties.length === 0) {
    pass('空文件检查', '未发现 0 字节文件');
  } else {
    fail('空文件检查', `发现 ${empties.length} 个 0 字节文件：${empties.join(', ')}`);
  }
}

function checkForbiddenEntries(dir, rules) {
  for (const name of rules.forbiddenEntries) {
    if (existsSync(join(dir, name))) {
      warn(`禁止项 ${name}`, '不应出现在构建产物中');
    }
  }
}

function checkProjectConfig(dir, rules, expectedAppId) {
  const path = join(dir, 'project.config.json');
  if (!isFile(path)) {
    fail('project.config.json', '文件缺失，跳过配置检查');
    return;
  }
  let config;
  try {
    config = readJson(path);
  } catch (error) {
    fail('project.config.json', error.message);
    return;
  }
  if (!isPlainObject(config)) {
    fail('project.config.json', '根节点必须是 JSON 对象');
    return;
  }
  pass('project.config.json', 'JSON 语法合法');

  for (const key of rules.projectConfig.requiredKeys) {
    const value = config[key];
    if (typeof value === 'string' && value.trim() !== '') {
      pass(`配置项 ${key}`, key === 'appid' ? `appid=${value}` : '已填写');
    } else {
      fail(`配置项 ${key}`, '必填项缺失或为空');
    }
  }

  for (const key of rules.projectConfig.recommendedKeys) {
    if (config[key] === undefined || config[key] === '') {
      warn(`配置项 ${key}`, '建议填写，不影响运行');
    }
  }

  const appid = typeof config.appid === 'string' ? config.appid.trim() : '';
  if (appid !== '' && !/^tt[a-z0-9]+$/i.test(appid)) {
    warn('appid 格式', `appid=${appid} 不以 tt 开头，请确认是否为抖音小游戏 AppID`);
  }
  if (expectedAppId !== undefined && appid !== expectedAppId) {
    fail('appid 一致性', `project.config.json 中为 ${appid || '空'}，期望 ${expectedAppId}`);
  } else if (expectedAppId !== undefined) {
    pass('appid 一致性', appid);
  }

  const expectedCompileType = rules.projectConfig.expectedCompileType;
  if (expectedCompileType !== undefined) {
    if (config.compileType === undefined) {
      if (!rules.projectConfig.requiredKeys.includes('compileType')) {
        warn('compileType', `未声明，建议填写 ${expectedCompileType}`);
      }
    } else if (config.compileType !== expectedCompileType) {
      fail('compileType', `当前为 ${config.compileType}，应为 ${expectedCompileType}`);
    } else {
      pass('compileType', expectedCompileType);
    }
  }
  if (config.miniprogramRoot !== undefined && !['', '.', './'].includes(config.miniprogramRoot)) {
    warn('miniprogramRoot', `当前为 ${config.miniprogramRoot}，请确认资源根目录`);
  }
}

function checkGameJson(dir, rules) {
  if (!rules.gameJson.enabled) {
    return;
  }
  const path = join(dir, 'game.json');
  if (!isFile(path)) {
    fail('game.json', '文件缺失');
    return;
  }
  let game;
  try {
    game = readJson(path);
  } catch (error) {
    fail('game.json', error.message);
    return;
  }
  if (!isPlainObject(game)) {
    fail('game.json', '根节点必须是 JSON 对象');
    return;
  }
  pass('game.json', 'JSON 语法合法');
  if (game.deviceOrientation === rules.gameJson.orientation) {
    pass('屏幕方向', `deviceOrientation=${game.deviceOrientation}`);
  } else {
    fail(
      '屏幕方向',
      `deviceOrientation=${JSON.stringify(game.deviceOrientation)}，应为 "${rules.gameJson.orientation}"`,
    );
  }
}

function checkEntryJs(dir, rules) {
  if (!rules.entryJs.enabled) {
    return;
  }
  const candidates = readdirSync(dir).filter(
    (name) => name.endsWith('.js') && isFile(join(dir, name)) && statSync(join(dir, name)).size > 0,
  );
  if (candidates.length === 0) {
    fail('入口 JS', '包根缺少非空 .js 文件');
  } else {
    pass('入口 JS', candidates.join(', '));
  }
}

function checkSharePng(dir, rules) {
  if (!rules.sharePng.enabled) {
    return;
  }
  const path = join(dir, 'share.png');
  if (!isFile(path)) {
    fail('share.png', '文件缺失');
    return;
  }
  const buffer = readFileSync(path);
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buffer.length < 24 || !signature.every((byte, index) => buffer[index] === byte)) {
    fail('share.png', '不是有效 PNG');
    return;
  }
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const issues = [];
  if (width !== rules.sharePng.width || height !== rules.sharePng.height) {
    issues.push(`尺寸 ${width}×${height}，应为 ${rules.sharePng.width}×${rules.sharePng.height}`);
  }
  if (buffer.length > rules.sharePng.maxBytes) {
    issues.push(`${buffer.length} 字节，超过 ${Math.round(rules.sharePng.maxBytes / 1024)}KB`);
  }
  if (issues.length > 0) {
    fail('share.png', issues.join('；'));
  } else {
    pass('share.png', `${width}×${height}，${buffer.length} 字节`);
  }
}

function checkShaFile(dir, rules) {
  if (!rules.shaFile.enabled) {
    return;
  }
  const path = rules.shaFile.path
    ? resolve(rules.shaFile.path)
    : join(dirname(dir), 'douyin-sha256.txt');
  if (!isFile(path)) {
    fail('douyin-sha256.txt', `文件不存在：${path}`);
    return;
  }
  const lines = readFileSync(path, 'utf8')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '');
  const valid = lines.filter((line) => /^[0-9a-f]{64}\s{2}\S+/i.test(line));
  if (lines.length === 0) {
    fail('douyin-sha256.txt', '文件为空');
  } else if (valid.length === 0) {
    fail('douyin-sha256.txt', '没有合法的 SHA256 行');
  } else {
    pass('douyin-sha256.txt', `${lines.length} 行`);
  }
}

function printReport(dir, options) {
  const failed = results.filter((item) => item.level === 'fail');
  const warned = results.filter((item) => item.level === 'warn');
  const passed = results.filter((item) => item.level === 'pass');

  if (options.json) {
    process.stdout.write(
      JSON.stringify(
        {
          status: failed.length === 0 ? 'ok' : 'failed',
          dir,
          summary: { passed: passed.length, failed: failed.length, warned: warned.length },
          checks: results,
        },
        null,
        2,
      ) + '\n',
    );
    return failed.length === 0;
  }

  process.stdout.write(`构建产物校验：${dir}\n\n`);
  for (const item of results) {
    const tag = item.level === 'pass' ? '[PASS]' : item.level === 'warn' ? '[WARN]' : '[FAIL]';
    process.stdout.write(`${tag} ${item.name}${item.detail ? `：${item.detail}` : ''}\n`);
  }
  process.stdout.write(
    `\n结果：通过 ${passed.length} 项，失败 ${failed.length} 项，警告 ${warned.length} 项\n`,
  );
  if (failed.length === 0) {
    process.stdout.write('校验通过\n');
  } else {
    process.stdout.write('校验失败，缺失或错误项：\n');
    for (const item of failed) {
      process.stdout.write(`  - ${item.name}${item.detail ? `：${item.detail}` : ''}\n`);
    }
  }
  return failed.length === 0;
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`参数错误：${error.message}\n`);
    process.exitCode = 2;
    return;
  }
  if (options.help) {
    printHelp();
    return;
  }

  let rules = DEFAULT_RULES;
  if (options.config !== undefined) {
    const configPath = isAbsolute(options.config)
      ? options.config
      : resolve(process.cwd(), options.config);
    try {
      const custom = readJson(configPath);
      if (!isPlainObject(custom)) {
        throw new Error('规则文件根节点必须是 JSON 对象');
      }
      rules = deepMerge(DEFAULT_RULES, custom);
    } catch (error) {
      process.stderr.write(`规则配置错误：${error.message}\n`);
      process.exitCode = 2;
      return;
    }
  }

  const dirInput = options.dir ?? process.env.DOUYIN_BUILD_DIR ?? DEFAULT_DIR;
  const dir = isAbsolute(dirInput) ? dirInput : resolve(process.cwd(), dirInput);
  const expectedAppId =
    options.appId ?? process.env.DOUYIN_APPID ?? rules.projectConfig.expectedAppId ?? undefined;

  if (!checkDirectory(dir)) {
    printReport(dir, options);
    process.exitCode = 1;
    return;
  }
  checkRequiredDirs(dir, rules);
  checkRequiredFiles(dir, rules);
  checkEmptyFiles(dir, rules);
  checkForbiddenEntries(dir, rules);
  checkProjectConfig(dir, rules, expectedAppId);
  checkGameJson(dir, rules);
  checkEntryJs(dir, rules);
  checkSharePng(dir, rules);
  checkShaFile(dir, rules);

  const ok = printReport(dir, options);
  process.exitCode = ok ? 0 : 1;
}

main();
