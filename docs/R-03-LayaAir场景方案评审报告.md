# R-03 LayaAir 场景搭建方案评审报告

| 项目     | 内容                                   |
| -------- | -------------------------------------- |
| 文档编号 | LZS-R03-REV-001                        |
| 版本     | v1.0                                   |
| 评审日期 | 2026-11-24                             |
| 评审对象 | L3 客户端真机验收执行计划 v1.0 第 4 章 |
| 关联任务 | R-03 LayaAir 场景缺失                  |
| 评审结论 | **不确认（需修订后复审）**             |
| 问题统计 | P0 3 项、P1 6 项、P2 5 项              |

## 1 评审范围与方法

### 1.1 评审范围

1. L3 计划第 4 章：工程位置、LayaAir 项目创建、场景配置、入口代码、适配器、构建。
2. L3 计划第 5 章：抖音真机接入中与场景相关的节点、资源与生命周期。
3. 现有客户端与核心契约：
   - [runtime.ts](file:///e:/SmallGames/fkzyad/packages/client/src/runtime.ts#L1-L47)
   - [laya-air.ts](file:///e:/SmallGames/fkzyad/packages/client/src/laya-air.ts#L1-L7)
   - [types.ts](file:///e:/SmallGames/fkzyad/packages/core/src/types.ts#L12-L87)
   - [ports.ts](file:///e:/SmallGames/fkzyad/packages/platform/src/ports.ts#L1-L34)

### 1.2 评审方法

1. 对照 `ClientRuntime`、`GameSnapshot`、`PlatformAdapter` 的实际签名逐行核对计划代码。
2. 按 LayaAir 3.x 场景脚本、节点树、资源发布与生命周期惯例检查技术合理性。
3. 按“测试人员能否独立执行”做走查，识别空指针、重复节点、路径失效与清理缺失。
4. 检查类型检查、Lint、CI 是否覆盖 `apps/laya-client`。

### 1.3 评审限制

本次为静态评审，未在 LayaAir IDE 3.3.0 与抖音真机上实际运行。凡涉及运行时行为的结论，需在复审时以真实构建与真机证据确认。

## 2 结论摘要

### 2.1 完整性

| 维度       | 结论                                                       |
| ---------- | ---------------------------------------------------------- |
| 环境与工具 | 完整：设备矩阵、版本、网络、账号、工具部署均有步骤         |
| 用例与判定 | 完整：24 条用例、P0/P1/P2、量化阈值与证据要求齐全          |
| 场景实现   | **不完整**：场景树、资源配置、节点挂载、生命周期未形成闭环 |
| 构建与真机 | 基本完整：构建参数、导入、预览、调试步骤可执行             |

### 2.2 可行性

**按 v1.0 文本不可直接执行。** 入口代码把 `ClientRuntime.advanceTick()` 的返回值当作快照使用，会在征兵测试入口触发运行时错误；场景配置与入口代码同时创建 `StatusText`，会产生重复节点并绕过场景；生命周期没有接入，前后台用例无法成立。

### 2.3 技术合理性

方案混合了“场景驱动”和“代码驱动”两种模式：一边要求 `Main.scene` 中放置 `StatusText` 并设为启动场景，一边在入口代码中 `new Laya.Text()` 并 `Laya.stage.addChild`，还自行调用 `Laya.init`。这不是 LayaAir 3.x 的最佳实践，也不利于验证 R-03 的“场景实际存在”。

### 2.4 结论

**不确认。** 必须先修复 3 项 P0，再处理 6 项 P1，补充类型检查与场景树/资源清单，修订为 v1.1 后复审。P2 可登记为遗留项，但需在 L3 执行前有明确处置。

## 3 阻塞问题（P0）

### P0-1 `advanceTick` 返回值误用

**位置**：L3 计划 §4.6，`GameEntry.start`、`startLoop`、`recruit`。

**事实**：[runtime.ts](file:///e:/SmallGames/fkzyad/packages/client/src/runtime.ts#L36-L45) 的签名是：

```ts
public advanceTick(commands: readonly GameCommand[] = []): ClientTickResult
```

`ClientTickResult` 的结构是 `{ snapshot, events }`，不是 `GameSnapshot`。计划中的写法：

```ts
this.lastSnapshot = this.runtime.advanceTick();
const tick = this.lastSnapshot?.state.tick ?? 0;
```

会让 `lastSnapshot` 实际持有 `ClientTickResult`，`lastSnapshot.state` 为 `undefined`，`recruit()` 读取 `tick` 时得到 0，后续使用快照的代码也会出错。该问题同时会被 TypeScript 直接报错，但当前 `apps/laya-client` 未纳入类型检查，因此没有被发现。

**影响**：R03-04 征兵渲染、R04-12 30 分钟稳定性用例无法执行；控制台测试入口不可信。

**修改方向**：

```ts
const result = this.runtime.advanceTick();
this.lastSnapshot = result.snapshot;
```

`recruit()` 返回 `result`，不要返回 `lastSnapshot`。评审时已在 L3 计划文本中修正这三处调用，但仍必须补类型检查，防止回归。

### P0-2 场景与代码双重建节点、双初始化

**位置**：L3 计划 §4.5 与 §4.6。

**事实**：

1. §4.5 要求 `Main.scene` 中放置 `Text`，命名 `StatusText`，并把 `Main.scene` 设为启动场景。
2. §4.6 又在 `GameEntry.start()` 中 `new Laya.Text()`、`name = 'StatusText'`、`Laya.stage.addChild(statusText)`。
3. §4.6 还自行 `await Laya.init(750, 1334)`，而 IDE 启动场景时已经完成引擎初始化与场景加载。

**影响**：

- 场景中一个 `StatusText`，代码再创建一个，出现重复节点，层级与点击区域不可控。
- UI 直接挂到 `Laya.stage`，绕过 `Main.scene`，R-03 实际没有验证“场景节点挂载”。
- 场景重载后旧节点与监听残留，可能出现双份按钮、双份日志。
- 重复 `Laya.init` 可能重置舞台或与 IDE 启动流程冲突，具体表现取决于 3.3.0 版本，但属于明确风险。

**修改方向**：二选一，推荐场景驱动。

- `Main.scene` 作为唯一 UI 根，`StatusText` 与 `ActionBar` 都是场景节点。
- 入口改为 `GameScene extends Laya.Script`，挂到 `Main` 根节点。
- `onAwake` 中 `this.owner.getChildByName('StatusText')` 获取节点，不再 `new Laya.Text()`。
- 删除入口中的 `Laya.init` 与 `Laya.stage.addChild`，由 IDE 启动流程负责初始化和加载场景。
- 所有 UI 只在 `UIRoot` 下增删，禁止直接挂 `Laya.stage`。

### P0-3 生命周期未接入，delta 未限幅

**位置**：L3 计划 §4.6 `startLoop`；§4.7 适配器已实现 `subscribeLifecycle`，但入口未调用。

**事实**：

1. `GameEntry` 只启动 `Laya.timer.frameLoop`，没有调用 `platform.subscribeLifecycle`。
2. `accumulator += Laya.timer.delta` 没有上限；应用从后台恢复时 `delta` 可能很大，会在一帧内连续执行大量 tick。
3. 没有 `paused` 状态，后台期间是否推进完全依赖引擎计时器行为，不可控。

**影响**：R04-09 生命周期用例无法通过；R04-12 稳定性与性能数据会被恢复时的 tick 突发污染；确定性回放可能因 tick 批次不同而出现表现差异。

**修改方向**：

```ts
this.unsubscribe = this.platform.subscribeLifecycle({
  onHide: () => {
    this.paused = true;
    this.accumulator = 0;
  },
  onShow: () => {
    this.paused = false;
    this.accumulator = 0;
  },
});
```

`onUpdate` 或帧循环中：

```ts
if (this.paused) return;
const delta = Math.min(Laya.timer.delta, 100);
this.accumulator = Math.min(this.accumulator + delta, 200);
```

`onDestroy` 调用 `this.unsubscribe?.()`。复审时必须验证：后台 10 秒 tick 不增长；回前台无 tick 跳变；连续 10 次切换无重复回调。

## 4 高优先级问题（P1）

### P1-1 `share.png` 发布路径不可靠

**位置**：L3 计划 §4.7，`const SHARE_IMAGE = 'share.png'`；§4.9 构建步骤。

**问题**：LayaAir 的资源通常位于 `assets/`，构建后可能被复制、压缩、改名或加哈希。直接使用包根相对路径 `share.png`，不能保证文件位于 `dist/douyin/share.png`。分享图片缺失时，R04-05/06 会失败，且错误信息可能只显示“分享失败”，难以定位。

**修改方向**：

1. 源文件固定为 `apps/laya-client/assets/share.png`，规格 500×400、PNG、≤200KB。
2. 构建后显式复制：

```powershell
Copy-Item apps/laya-client/assets/share.png apps/laya-client/dist/douyin/share.png -Force
Test-Path apps/laya-client/dist/douyin/share.png
```

3. 在开发者工具“文件”面板确认包根存在 `share.png`。
4. 若平台不接受本地路径，改用已备案 HTTPS 地址，并把域名加入合法域名；两种方式都要在用例中记录。

### P1-2 文本每 tick 重绘、事件每 tick 打日志

**位置**：L3 计划 §4.6，`StatusView.render` 与 `present`。

**问题**：

1. `render` 每个 tick 都修改 `Text.text`，LayaAir 会触发文本重排与重绘，30Hz 下可能成为低端机的主要开销，导致性能阈值测的是“调试文本”而不是场景本身。
2. `present` 对每个事件 `console.log`，30 分钟 soak 会产生大量日志，影响 CPU、内存与帧率，且真机日志本身有开销。

**修改方向**：

1. 文本按 tick 取模刷新，例如 `if (snapshot.state.tick % 5 !== 0) return;`，即 6Hz。
2. 事件日志加 `DEBUG_LOG` 开关，性能构建默认关闭；调试包可开启，但性能数据以发布包为准。
3. 性能采样使用关闭日志与降低文本刷新后的发布构建，并在记录中注明构建类型。

### P1-3 交互节点缺少尺寸、视觉反馈与解绑

**位置**：L3 计划 §4.6 `createTestButtons`。

**问题**：

1. 按钮是 `Laya.Text`，直接挂在 `Laya.stage`，只有文字范围可点，点击区域小且没有背景反馈。
2. 没有设置明确的 `width/height`，不同分辨率下点击区域不稳定。
3. 点击监听没有在场景销毁时 `off`，场景重载会重复绑定。
4. 登录、广告、分享的错误只 `console.error`，没有统一的失败展示，测试人员难以判断是否已触发。

**修改方向**：

1. 在 `Main.scene` 放 `ActionBar` 容器，按钮作为其子节点，尺寸 150×60，背景用 `graphics.drawRect`，文字居中。
2. `mouseEnabled = true`，并设置 `size(150, 60)`，保证可点击区域。
3. 在 `onAwake` 绑定，在 `onDestroy` 对同一 handler 执行 `off`。
4. 统一 `runAction(name, action)`：成功输出 `[L3_ACTION_OK]`，失败输出 `[L3_ACTION_FAILED]`，并更新界面状态文本。

### P1-4 引擎版本读取时机与失败信息不明确

**位置**：L3 计划 §4.6 `const version = String(Laya.version ?? Laya.Config?.version ?? '')`。

**问题**：`Laya.version` 是否在 `Laya.init` 前可用取决于 3.3.0 的启动流程；若为空，`assertLayaAirVersion('')` 只会报“版本不一致”，无法区分“读不到版本”和“版本真的不对”。这会让测试人员误判为引擎版本错误。

**修改方向**：

1. 在 `GameScene.onAwake` 中读取版本，此时 IDE 已完成初始化。
2. 空值单独报错：`throw new Error('L3_ENGINE_VERSION_UNKNOWN')`。
3. 日志记录版本来源（`Laya.version`），不使用 IDE 安装版本替代运行时版本。
4. 复审时分别验证 3.3.0 通过与故意改错版本失败两条路径。

### P1-5 `apps/laya-client` 未纳入类型检查、Lint 与 CI

**位置**：L3 计划 §4.4；根工作区与 CI 配置。

**问题**：计划只把 `apps/*` 加入 pnpm workspace 并执行构建，没有把新应用纳入 `tsc --noEmit`、ESLint 或 CI。P0-1 正是 TypeScript 可以直接发现的错误，却因未纳入检查而进入方案文本。

**修改方向**：

1. 为 `apps/laya-client` 增加独立 `tsconfig.json`，继承 LayaAir 生成配置，开启 `strict`。
2. 增加 `typecheck` 脚本，例如 `tsc --noEmit -p apps/laya-client/tsconfig.json`。
3. 在根 CI 或 L3 构建门禁中执行该脚本；若 Laya 类型与根配置冲突，单独设置 job，不得跳过。
4. ESLint 增加 `apps/laya-client` 覆盖，允许 `Laya`/`tt` 全局，但禁止在业务代码中扩散 `any`；生成的 `libs/` 排除。

### P1-6 缺少场景销毁清理

**位置**：L3 计划 §4.6 全节。

**问题**：没有 `onDestroy`。`tt.onShow/onHide` 的取消函数、按钮监听、`globalThis.__L3__` 都没有清理。场景重载或退出后可能残留回调，导致重复推进、重复发奖或日志重复。

**修改方向**：

1. 保存 `subscribeLifecycle` 返回的取消函数，在 `onDestroy` 调用。
2. 保存按钮 handler 引用，在 `onDestroy` 逐一 `off`。
3. `delete (globalThis as { __L3__?: unknown }).__L3__`。
4. 复审做 10 次场景重载，确认无重复监听、无 tick 翻倍。

## 5 中低优先级问题（P2）

### P2-1 场景层级、Z 序与安全区未定义

计划只有一句“放置全屏背景与 Text”，没有节点树、父子关系、Z 序、锚点与安全区。建议使用固定层级：

```text
Main.scene (Scene2D, 750×1334)
├─ Background (Sprite, 0,0,750,1334)
├─ UIRoot (Sprite, 0,0,750,1334)
│  ├─ StatusText (Text, 40,80,670,300)
│  └─ ActionBar (Sprite, 40,440,670,80)
│     ├─ LoginButton (Sprite, 0,0,150,60)
│     │  └─ LoginLabel (Text)
│     ├─ AdButton (Sprite, 170,0,150,60)
│     │  └─ AdLabel (Text)
│     └─ ShareButton (Sprite, 340,0,150,60)
│        └─ ShareLabel (Text)
```

Z 序按子节点顺序：Background → UIRoot；ActionBar 内从左到右。刘海屏使用 `tt.getSystemInfoSync().safeArea` 计算顶部安全区，整体下移 UIRoot，不得依赖固定 80px。

### P2-2 `declare const Laya: any` 绕过引擎类型

计划用 `any` 覆盖 Laya 全局，失去 LayaAir 自带类型检查，容易写出错误的 API 调用。建议使用 IDE 生成的 `laya.d3.d.ts` 类型；只在 `douyin.d.ts` 中声明 `tt`，并把平台边界集中到适配器。若确实需要临时 `any`，限制在 `laya-env.d.ts`，不得在业务类中扩散。

### P2-3 资源加载与失败回退未定义

若使用背景图，需明确 `assets/resources/bg.png`、加载路径 `resources/bg.png`、加载失败回退纯色、加载中提示与超时。最小场景建议背景用 `graphics.drawRect` 绘制，减少资源路径风险；分享图仍按 P1-1 处理。

### P2-4 激励广告关闭竞态与错误归一

`showRewardedAd` 先 `await this.ad.show()`，再注册 `onClose`，存在用户快速关闭时错过回调的窗口。建议先注册 `onClose` 再 `show()`；统一错误码为 `L3_AD_CANCELLED`、`L3_AD_FAILED:<code>`、`L3_AD_TIMEOUT`；平台调用超过 15 秒未回调记失败。

### P2-5 构建产物校验不完整

除 `game.json` 与主包大小外，还应校验：`project.config.json` 的 AppID、`game.json` 的 `deviceOrientation`、`share.png` 是否在包根、入口 JS 是否存在、资源清单是否完整。建议把校验写成脚本，构建后自动执行并输出结果。

## 6 建议的目标方案

### 6.1 场景结构

采用场景驱动：`Main.scene` 是唯一 UI 根，`GameScene` 作为脚本挂在根节点。`StatusText`、`ActionBar` 与三个按钮均为场景节点，代码只负责查找、绑定和更新，不创建重复节点。

### 6.2 资源清单

| 资源      | 源路径                            | 发布路径                | 规格                 | 用途     | 校验方式                     |
| --------- | --------------------------------- | ----------------------- | -------------------- | -------- | ---------------------------- |
| share.png | `assets/share.png`                | `dist/douyin/share.png` | 500×400，PNG，≤200KB | 分享封面 | 文件存在 + 真机分享          |
| bg.png    | `assets/resources/bg.png`（可选） | `resources/bg.png`      | 750×1334             | 背景     | loader 成功；失败回退纯色    |
| 字体      | 系统字体                          | 无                      | 32px                 | 文本     | 不引入外部字体，避免路径问题 |

### 6.3 初始化顺序

1. IDE 启动：`Laya.init` → 加载 `Main.scene`。
2. `GameScene.onAwake`：版本校验 → 查找 `StatusText`/`ActionBar` → 创建平台适配器 → 创建 `ClientRuntime` → 首次 tick → 订阅生命周期 → 绑定按钮 → 暴露 `__L3__`。
3. `GameScene.onUpdate`：暂停则返回；delta 限幅；按 30Hz 推进。
4. `tt.onHide`：暂停并清空 accumulator；`tt.onShow`：恢复并清空 accumulator。
5. `GameScene.onDestroy`：取消生命周期订阅、解绑按钮、删除 `__L3__`。

### 6.4 关键代码骨架

```ts
const { regClass } = Laya;

@regClass()
export class GameScene extends Laya.Script {
  private runtime!: ClientRuntime;
  private platform!: PlatformAdapter;
  private view!: StatusView;
  private lastSnapshot?: GameSnapshot;
  private paused = false;
  private accumulator = 0;
  private unsubscribe?: () => void;

  public onAwake(): void {
    const version = String((Laya as any).version ?? '');
    if (!version) {
      throw new Error('L3_ENGINE_VERSION_UNKNOWN');
    }
    assertLayaAirVersion(version);

    const statusText = this.owner.getChildByName('StatusText') as Laya.Text | null;
    if (!statusText) {
      throw new Error('L3_SCENE_NODE_MISSING:StatusText');
    }

    this.platform = createPlatform();
    this.view = new StatusView(statusText);
    this.runtime = new ClientRuntime({
      simulation: new GameSimulation(CONFIG),
      view: this.view,
      platform: this.platform,
      onViewError: (error) => console.error('[L3_VIEW_ERROR]', error),
    });

    this.lastSnapshot = this.runtime.advanceTick().snapshot;
    this.unsubscribe = this.platform.subscribeLifecycle({
      onHide: () => {
        this.paused = true;
        this.accumulator = 0;
      },
      onShow: () => {
        this.paused = false;
        this.accumulator = 0;
      },
    });
  }

  public onUpdate(): void {
    if (this.paused) return;
    const delta = Math.min(Laya.timer.delta, 100);
    this.accumulator = Math.min(this.accumulator + delta, 200);
    while (this.accumulator >= 1000 / 30) {
      this.accumulator -= 1000 / 30;
      this.lastSnapshot = this.runtime.advanceTick().snapshot;
    }
  }

  public onDestroy(): void {
    this.unsubscribe?.();
  }
}
```

说明：

1. 不再调用 `Laya.init`，不再 `Laya.stage.addChild`。
2. `StatusText` 来自场景，节点缺失时 fail fast。
3. 生命周期订阅与 `paused` 保证前后台行为可控。
4. `advanceTick().snapshot` 与真实契约一致。
5. 生产实现应使用 LayaAir 类型，不用 `Laya: any`；此处仅为骨架示意。

### 6.5 交互节点规范

1. 按钮统一 150×60，父节点 `ActionBar`，`mouseEnabled=true`。
2. 按钮背景 `graphics.drawRect(0,0,150,60,'#2b3a4a')`，文字居中。
3. 绑定：`node.on(Laya.Event.CLICK, this, handler)`；销毁：`node.off(...)`。
4. 登录、广告、分享统一走 `runAction`，成功/失败都要有界面反馈。
5. 复审做 10 次场景重载，确认无重复按钮与重复回调。

## 7 复审准入条件

| 编号 | 条件                                                       | 证据要求                                    |
| ---- | ---------------------------------------------------------- | ------------------------------------------- |
| P0-1 | `advanceTick` 使用 `.snapshot`，`recruit` 返回完整结果     | 类型检查通过；R03-04 实际执行               |
| P0-2 | 场景唯一持有 `StatusText`/`ActionBar`，无 `stage.addChild` | 场景树截图；无重复节点；R-03 场景运行       |
| P0-3 | 生命周期订阅、暂停、delta 限幅                             | 后台 10 秒无 tick；回前台无跳变；R04-09     |
| P1-1 | `share.png` 位于发布包根                                   | `Test-Path` + 开发者工具文件面板 + 分享成功 |
| P1-2 | 文本 6Hz 刷新，性能构建关闭日志                            | 构建配置与性能采样记录                      |
| P1-3 | 按钮有尺寸、背景、解绑                                     | 点击录屏；重载 10 次无重复监听              |
| P1-4 | 版本空值单独报错                                           | 正常与错误两条路径的日志                    |
| P1-5 | `apps/laya-client` 纳入 typecheck/Lint/CI                  | CI 日志或本地命令输出                       |
| P1-6 | `onDestroy` 完成清理                                       | 重载 10 次无泄漏、无重复回调                |
| P2   | 场景树、资源表、安全区、构建校验有文档                     | 修订后的 L3 计划 v1.1                       |

## 8 评审结论

### 8.1 结论

**不确认（需修订后复审）。**

方案在环境准备、用例设计、量化判定与证据要求方面完整度较高，黄金数据、失败路径与性能阈值也可执行。但 LayaAir 场景实现层存在 3 项 P0 阻塞：返回值契约错误、场景与代码双重建节点、生命周期缺失。按当前文本执行，R-03 无法证明“场景实际存在且挂载正确”，R-04 的前后台用例也无法通过。

### 8.2 已肯定的部分

1. LayaAir 版本固定为 3.3.0，与 `LAYA_AIR_VERSION` 一致。
2. 黄金种子、配置哈希、状态哈希、tick 与事件数与现有样本一致。
3. 广告取消、分享失败、登录失败均要求明确报错，符合“不伪造成功”的原则。
4. 性能阈值、采样时长、统计规则与判定条件量化充分。
5. 证据目录与复测规则可复核。

### 8.3 后续动作

1. 按本报告第 3、4 节修订 L3 计划为 v1.1。
2. 补 `apps/laya-client` 类型检查与 Lint，先让 P0-1 在编译期暴露。
3. 在 LayaAir IDE 3.3.0 中搭出场景树，完成一次本地运行与黄金哈希校验。
4. 按第 7 节逐项复审；全部 P0/P1 关闭后，L3 才可进入执行阶段。

## 9 附录：问题索引

| 编号 | 问题摘要                       | 位置              | 级别 |
| ---- | ------------------------------ | ----------------- | ---- |
| P0-1 | `advanceTick` 返回值误用       | L3 计划 §4.6      | P0   |
| P0-2 | 场景与代码双重建节点、双初始化 | L3 计划 §4.5/§4.6 | P0   |
| P0-3 | 生命周期未接入、delta 未限幅   | L3 计划 §4.6/§4.7 | P0   |
| P1-1 | `share.png` 发布路径不可靠     | L3 计划 §4.7/§4.9 | P1   |
| P1-2 | 文本/日志每 tick 开销          | L3 计划 §4.6      | P1   |
| P1-3 | 交互节点尺寸、反馈、解绑缺失   | L3 计划 §4.6      | P1   |
| P1-4 | 版本读取时机与错误信息         | L3 计划 §4.6      | P1   |
| P1-5 | 应用未纳入类型检查/Lint/CI     | L3 计划 §4.4      | P1   |
| P1-6 | 场景销毁清理缺失               | L3 计划 §4.6      | P1   |
| P2-1 | 层级、Z 序、安全区未定义       | L3 计划 §4.5      | P2   |
| P2-2 | `Laya: any` 绕过类型           | L3 计划 §4.6      | P2   |
| P2-3 | 资源加载与回退未定义           | L3 计划 §4.5      | P2   |
| P2-4 | 广告关闭竞态与错误归一         | L3 计划 §4.7      | P2   |
| P2-5 | 构建产物校验不完整             | L3 计划 §4.9      | P2   |
