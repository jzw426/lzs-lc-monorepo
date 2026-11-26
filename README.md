# 鲁智深与林冲（LZS）

竖屏小游戏 Monorepo，当前处于 **M1-L3 客户端验收阶段**。客户端基于 LayaAir 3.3.0，核心逻辑以确定性快照与黄金回放为基线，平台能力面向抖音小游戏适配。

> L3 仅覆盖工程、场景、平台能力与性能验收；战斗、合成、八邻接拼字、突破与终局玩法尚未实现。

## 项目描述

本仓库用于沉淀 M1 阶段的客户端工程、确定性核心逻辑、平台适配层与验收工具。目标是让场景可独立启动、快照可复现、平台失败路径不伪造成功，并通过统一门禁保证每次提交可验证。

## 功能范围（L3）

- 确定性核心循环：固定步长、事件序列、状态哈希。
- LayaAir 场景：`Main.ls` 场景树、生命周期订阅、按钮交互、安全区适配。
- 平台适配：登录、激励广告、分享、存储、前后台生命周期（代码就绪，真机待验收）。
- 质量门禁：格式、Lint、类型检查、单测、覆盖率、构建、内容校验、黄金回放。
- 验收工具：抖音构建产物校验、CI 多平台配置示例。

## 技术栈

| 类别   | 选型                                         |
| ------ | -------------------------------------------- |
| 语言   | TypeScript 5.9                               |
| 运行时 | Node.js 22.20.0、pnpm 11.6.0                 |
| 测试   | Vitest 3、fast-check                         |
| 质量   | ESLint 9、Prettier 3                         |
| 客户端 | LayaAir IDE 3.3.0                            |
| CI     | GitHub Actions（GitLab/Jenkins 示例见 docs） |

## 环境要求

- Node.js `>=22.20.0 <23`（见 `.nvmrc`）
- pnpm `11.6.0`（见 `packageManager`）
- LayaAir IDE `3.3.0`（仅客户端构建/预览需要）

## 快速开始

```bash
corepack enable
corepack prepare pnpm@11.6.0 --activate
pnpm install --frozen-lockfile
pnpm run build
pnpm run test
```

完整门禁：

```bash
pnpm run ci
```

## 常用命令

| 命令                        | 作用                               |
| --------------------------- | ---------------------------------- |
| `pnpm run build`            | 构建全部工作区包                   |
| `pnpm run typecheck`        | 构建后执行类型检查                 |
| `pnpm run lint`             | ESLint 全仓检查                    |
| `pnpm run format`           | Prettier 写入格式化                |
| `pnpm run format:check`     | Prettier 只读校验                  |
| `pnpm run test`             | 构建后运行全部单测                 |
| `pnpm run test:coverage`    | 核心包覆盖率                       |
| `pnpm run validate:content` | 内容配置校验                       |
| `pnpm run validate:build`   | 抖音构建产物校验（需先构建客户端） |
| `pnpm run replay:golden`    | 黄金回放校验                       |
| `pnpm run ci`               | 串行执行全部门禁                   |

## 目录结构

```text
apps/laya-client     LayaAir 3.3.0 客户端工程（场景、脚本、构建校验）
packages/core        确定性核心逻辑与快照
packages/client      客户端领域逻辑
packages/platform    平台抽象与抖音适配
packages/content     内容配置与校验
packages/server      服务端骨架
packages/tools       校验、回放与 CLI 工具
docs/                验收计划、台账、执行手册、CI 示例
evidence/            本机预览与验收证据
```

## 持续集成

[ci.yml](.github/workflows/ci.yml) 定义四个 Job：

1. `quality`：格式、Lint、类型检查。
2. `test`：单元测试与覆盖率，上传覆盖率制品。
3. `build`：构建、内容校验、黄金回放，上传构建产物与元数据。
4. `notify`：失败时写 Step Summary，可选 Webhook 告警。

触发条件：`main`/`release/**` 推送、`v*` 标签、指向 `main`/`release/**` 的 PR、手动触发。云端首次运行记录待 E-02 补齐。

## 贡献指南

1. 从 `main` 创建分支：`feature/<任务号>-<简述>`，如 `feature/r-03-laya-scene`。
2. 提交信息关联任务标识，例如 `R-03 修复三档分辨率裁切`。
3. 提交前本地执行 `pnpm run ci`，确保格式、Lint、类型、测试、构建、回放全部通过。
4. PR 描述需包含：变更内容、验证方式、风险与回滚点。
5. 不提交构建产物、依赖目录、本地配置与密钥；相关规则见 `.gitignore`。
6. 涉及验收结论的改动需同步更新 `docs/` 台账与 `evidence/` 证据。

## 许可证

本项目使用 [MIT License](LICENSE)。

## 相关文档

- [L3 客户端真机验收执行计划](docs/L3客户端真机验收执行计划.md)
- [L3 关闭清单与 R-03 复审任务台账](docs/L3关闭清单与R-03复审任务台账-v1.0.md)
- [L3 后续工作执行手册](docs/L3后续工作执行手册-v1.0.md)
- [CI 持续集成配置示例集](docs/CI持续集成配置示例集-v1.0.md)
- [R-03 LayaAir 场景方案评审报告](docs/R-03-LayaAir场景方案评审报告.md)
