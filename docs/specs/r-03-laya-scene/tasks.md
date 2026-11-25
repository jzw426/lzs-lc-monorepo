# R-03 B-01 / B-03 任务清单

依赖顺序：T1 → T2 → T3 → T4 → T5。T4 失败时回到 T2，不得跳过门禁提交。

## [x] T1 建立 LayaAir 工程骨架

- 交付：`laya-client.laya`、`settings/BuildSettings.json`、`settings/PlayerSettings.json`、`settings/EditorSettings.json`、`.gitignore`
- 来源：复制 `D:\LayaAirIDE\3.3.0\resources\template\project\2D-emptyProject`，覆写 `startupScene`
- 验收：目录结构与官方模板一致；`startupScene` 指向场景 UUID；无模板 `Main.ts` 残留
- 依赖：无

## [x] T2 编写 Main 场景与脚本挂载

- 交付：`assets/Main.ls`、`assets/Main.ls.meta`、`src/GameScene.ts.meta`
- 内容：按 spec 第 6 节节点树；`GameRoot._$comp` 引用脚本 UUID 与 `../src/GameScene.ts`
- 验收：节点名与 `GameScene.bootstrap()` 完全对应；无 UI 由代码创建
- 依赖：T1

## [x] T3 接入官方引擎类型

- 交付：更新后的 `tsconfig.json`；删除 `src/types/laya-env.d.ts`
- 步骤：IDE 生成 `engine/` 后，`include` 加入 `engine/**/*.d.ts`；确认 `Box.bgColor`、`Text.bgColor`、`Laya.version`、`Laya.timer.delta`、`getChildByName` 类型可用
- 验收：`pnpm --filter @lzs/laya-client typecheck` 通过；无临时 shim
- 依赖：T2

## [x] T4 IDE 预览与功能验证

- 交付：V1–V8 验证结果记录（写入台账 §12）
- 验收：`[L3_BOOT_OK]`、`fnv1a32:92852f6a`、三按钮动作、视图异常隔离、前后台暂停均符合 spec 第 8 节
- 依赖：T3
- 结果：V1–V6 通过。IDE 预览运行 `Main.ls`，控制台输出 `[L3_BOOT_OK] {"version":"3.3.0","configHash":"fnv1a32:e7ae79c0"}`；`__L3__.hash()` 返回 `fnv1a32:92852f6a`；场景树节点全部存在；三个按钮实际点击分别输出 `[L3_ACTION_OK] 登录/广告/分享`，广告回调 `[L3_REWARD_COUNT]`；`breakView()` 触发 `[L3_VIEW_ERROR]` 后 tick 继续推进。V7 前后台暂停依赖抖音宿主生命周期，留待 R-04 真机；V8 关闭残留由编辑器管理，未单独断言。

## [x] T5 文档同步与提交

- 交付：计划 v1.3（`.scene`→`.ls`）、台账 §12、`.prettierignore`、`eslint.config.mjs`
- 验收：`pnpm run lint`、`pnpm run format:check`、`pnpm test` 全绿；提交信息含 `R-03`
- 依赖：T4

## 全局门禁

```powershell
pnpm --filter @lzs/laya-client typecheck
pnpm run lint
pnpm run format:check
pnpm test
```
