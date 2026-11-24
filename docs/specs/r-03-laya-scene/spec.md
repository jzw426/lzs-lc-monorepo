# R-03 LayaAir 工程与 Main 场景规格（B-01 / B-03）

## 1. 目标

在 `apps/laya-client` 内建立可被 LayaAir IDE 3.3.0 直接打开、编译、预览的正式工程，用场景文件承载全部 UI 节点，并把已有 `GameScene` 脚本挂到场景上，完成 B-01（工程）、B-03（场景）与 B-05 的本地启动与黄金哈希验证。

## 2. 范围与非目标

范围内：

- 生成 LayaAir 3 工程文件（`.laya`、`assets/`、`settings/`、工程 `tsconfig.json`）。
- 编写 `assets/Main.ls` 场景树（背景、状态文本、操作栏、三个按钮）。
- 用官方引擎类型替换临时声明 `src/types/laya-env.d.ts`。
- 本地 IDE 预览验证启动日志、黄金哈希、生命周期暂停、视图异常隔离。
- 同步计划与台账中 `.scene` 的错误表述。

非目标：

- 不新增玩法逻辑，不改 `packages/*` 契约。
- 不创建代码 UI（禁止 `Laya.init`、`stage.addChild`、运行时 `new Laya.Text`）。
- 不做真机、广告、性能与云端 CI（C/D/E 类任务）。

## 3. 关键决策

| 决策         | 结论                                       | 理由                                                                |
| ------------ | ------------------------------------------ | ------------------------------------------------------------------- |
| 场景扩展名   | `.ls`                                      | LayaAir 3 实际格式，计划中的 `Main.scene` 为笔误                    |
| 工程生成方式 | 复制 IDE 模板 `2D-emptyProject` 骨架后覆写 | 保证 `settings`、`.laya` 与 IDE 版本一致                            |
| 场景编写方式 | 直接编写场景 JSON + `.meta`                | 可版本化、可评审，避免手工拖拽不可复现                              |
| 脚本挂载点   | 子节点 `GameRoot` 的 `_$comp`              | 规避 Scene 根节点是否支持组件的版本差异，`this.owner` 语义不变      |
| 按钮节点类型 | `Text`（带 `bgColor`、宽高）               | Text 自带文字包围盒，点击命中稳定；纯 Sprite 无纹理时命中区可能为 0 |
| 背景实现     | `Box` + `bgColor`                          | 无需图片资源；若 IDE 校验不通过则移除该属性并在场景说明中记录       |
| 类型来源     | IDE 生成的 `engine/**/*.d.ts`              | 评审要求使用官方类型，替换临时 shim                                 |

## 4. 固定标识

| 标识       | 值                                           |
| ---------- | -------------------------------------------- |
| 场景 UUID  | `8f2a4c1e-3b7d-4a96-9c5e-1d2f3a4b5c60`       |
| 脚本 UUID  | `3c9e7b21-5d4a-4f18-a7c3-9b6e2d8f1a40`       |
| 启动场景   | `res://8f2a4c1e-3b7d-4a96-9c5e-1d2f3a4b5c60` |
| 设计分辨率 | 750 × 1334                                   |
| 黄金哈希   | `fnv1a32:92852f6a`                           |

## 5. 文件清单

新增：

| 文件                                            | 内容要点                                                                             |
| ----------------------------------------------- | ------------------------------------------------------------------------------------ |
| `apps/laya-client/laya-client.laya`             | `{"version":"3.3.0"}`                                                                |
| `apps/laya-client/assets/Main.ls`               | 第 6 节场景树                                                                        |
| `apps/laya-client/assets/Main.ls.meta`          | `{"uuid":"8f2a4c1e-3b7d-4a96-9c5e-1d2f3a4b5c60"}`                                    |
| `apps/laya-client/src/GameScene.ts.meta`        | `{"uuid":"3c9e7b21-5d4a-4f18-a7c3-9b6e2d8f1a40"}`                                    |
| `apps/laya-client/settings/BuildSettings.json`  | `{"name":"laya-client","startupScene":"res://8f2a4c1e-3b7d-4a96-9c5e-1d2f3a4b5c60"}` |
| `apps/laya-client/settings/PlayerSettings.json` | 复制模板字段，仅保留 IDE 必需项                                                      |
| `apps/laya-client/settings/EditorSettings.json` | 复制模板                                                                             |
| `apps/laya-client/.gitignore`                   | 忽略 `library/`、`temp/`、`build/`、`release/`                                       |
| `apps/laya-client/engine/`                      | 首次 IDE 打开后由 IDE 生成，纳入类型引用                                             |

修改：

| 文件                                        | 变更                                                                                   |
| ------------------------------------------- | -------------------------------------------------------------------------------------- |
| `apps/laya-client/tsconfig.json`            | `include` 改为 `["src/**/*.ts","assets/**/*.ts","engine/**/*.d.ts"]`，保留现有严格选项 |
| `.prettierignore`                           | 追加 `apps/laya-client/engine`                                                         |
| `eslint.config.mjs`                         | 追加忽略 `apps/laya-client/engine/**`                                                  |
| `docs/L3客户端真机验收执行计划.md`          | `.scene` 全部改为 `.ls`，版本升为 v1.3                                                 |
| `docs/L3关闭清单与R-03复审任务台账-v1.0.md` | §12 记录 B-01/B-03 完成与验证证据                                                      |

删除：

| 文件                                       | 条件                                           |
| ------------------------------------------ | ---------------------------------------------- |
| `apps/laya-client/src/types/laya-env.d.ts` | `engine/**/*.d.ts` 就位且 typecheck 通过后删除 |

## 6. 场景树

根 `Scene`：`name=Main`、`width=750`、`height=1334`、`left/right/top/bottom=0`。

| 节点          | 类型   | 位置/尺寸     | 关键属性                                                                              |
| ------------- | ------ | ------------- | ------------------------------------------------------------------------------------- |
| `Background`  | Box    | 0,0,750,1334  | `bgColor="#101014"`                                                                   |
| `GameRoot`    | Sprite | 0,0,750,1334  | `_$comp` = 脚本 UUID，`scriptPath="../src/GameScene.ts"`                              |
| `UIRoot`      | Sprite | 0,0,750,1334  | 挂在 `GameRoot` 下                                                                    |
| `StatusText`  | Text   | 40,80,670,300 | `fontSize=26`、`color="#f2f2f2"`、`leading=8`、`align="left"`、`valign="top"`、空文本 |
| `ActionBar`   | Sprite | 40,440,670,80 | 三个按钮的父节点                                                                      |
| `LoginButton` | Text   | 0,0,150,60    | `text="登录"`、居中、`bgColor="#2a2a33"`                                              |
| `AdButton`    | Text   | 180,0,150,60  | `text="广告"`、居中、`bgColor="#2a2a33"`                                              |
| `ShareButton` | Text   | 360,0,150,60  | `text="分享"`、居中、`bgColor="#2a2a33"`                                              |

约束：`GameScene.bootstrap()` 通过 `owner.getChildByName` 解析 `UIRoot → StatusText / ActionBar → LoginButton / AdButton / ShareButton`，节点名不得改动；不新增任何运行时代码创建的 UI。

## 7. 实施步骤

1. 复制 `D:\LayaAirIDE\3.3.0\resources\template\project\2D-emptyProject` 的 `.laya`、`settings/`、`tsconfig.json` 骨架到 `apps/laya-client`，删除模板 `src/Main.ts` 与 `assets/Scene.ls*`。
2. 按第 5、6 节写入工程文件、场景与 `.meta`，合并 `tsconfig.json`。
3. 用 IDE 打开工程，确认 `engine/` 生成、`Box.bgColor` 与 `Text.bgColor` 通过校验；若背景色不支持则移除 `Background.bgColor` 并记录。
4. 删除 `src/types/laya-env.d.ts`，确认官方类型下 `Laya.version`、`Laya.Script`、`getChildByName`、`Laya.timer.delta` 均通过类型检查。
5. 运行第 8 节全部门禁，提交。

## 8. 验证与验收

命令门禁（仓库根目录）：

```powershell
pnpm --filter @lzs/laya-client typecheck
pnpm run lint
pnpm run format:check
pnpm test
```

IDE 预览（Node 22.20.0）：

| 编号 | 操作                            | 期望                                                  |
| ---- | ------------------------------- | ----------------------------------------------------- |
| V1   | 打开工程并编译                  | 无编译错误，场景可预览                                |
| V2   | 启动预览                        | 控制台出现 `[L3_BOOT_OK]`，含 `fnv1a32:e7ae79c0`      |
| V3   | `__L3__.hash()`                 | 返回 `fnv1a32:92852f6a`                               |
| V4   | `__L3__.recruit()`              | 返回快照，状态文本在 5 tick 内刷新                    |
| V5   | 点击三个按钮                    | 分别出现 `[L3_ACTION_OK] 登录/广告/分享`（Mock 平台） |
| V6   | `__L3__.breakView()` 后触发渲染 | 出现 `[L3_VIEW_ERROR]`，游戏循环不中断                |
| V7   | 切换后台再回前台                | `onHide` 期间不推进 tick，回前台从当前 tick 继续      |
| V8   | 关闭预览                        | 无 `__L3__` 残留，无重复 CLICK 绑定                   |

通过标准：V1–V8 全通过，四条命令门禁全绿，工作区无未跟踪临时文件。

## 9. 风险与回退

| 风险                              | 应对                                                                |
| --------------------------------- | ------------------------------------------------------------------- |
| 场景 JSON 字段与 IDE 3.3.0 不一致 | 以 IDE 保存后的序列化结果为准回写；不接受“仅预览能跑”的未版本化改动 |
| `Text` 点击命中异常               | 回退为 `Box` + 子 `Text`，并为 `Box` 设置 `hitArea`                 |
| IDE 未生成 `engine/` 类型         | 保留 shim 并在台账标注阻塞，不删除 shim                             |
| Node 版本不符                     | IDE/CI 固定 22.20.0，本地 25.x 仅用于命令门禁                       |

回退：删除新增工程/场景文件并恢复 `tsconfig.json`，代码骨架（`c254044`）不受影响。

## 10. 审批

需用户确认第 3 节决策、第 5 节文件清单与第 6 节节点命名后进入执行。
