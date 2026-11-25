# CI 持续集成配置示例集

| 项目     | 内容                                                               |
| -------- | ------------------------------------------------------------------ |
| 文档编号 | LZS-M1-CI-EXAMPLES-001                                             |
| 版本     | v1.0                                                               |
| 编制日期 | 2026-11-25                                                         |
| 覆盖平台 | GitHub Actions、GitLab CI、Jenkins                                 |
| 覆盖栈   | Node.js（pnpm）、Java（Maven/JDK 17）、Go（1.22）                  |
| 关联任务 | E-02 云端 CI、E-03 基线标签                                        |
| 适用仓库 | `e:\SmallGames\fkzyad`，Node 模板已对齐 Node 22.20.0 + pnpm 11.6.0 |

> 本文中的配置均为**独立可复制**的模板。每段配置前的说明给出文件路径、前置依赖和需要替换的参数；替换项统一用 `<>` 标注。Java/Go 模板与当前仓库无直接关系，仅作为多技术栈参考。

---

## 0 使用说明

### 0.1 流水线阶段映射

| 阶段     | GitHub Actions     | GitLab CI         | Jenkins            |
| -------- | ------------------ | ----------------- | ------------------ |
| 代码检出 | `actions/checkout` | Runner 自动 clone | `checkout scm`     |
| 依赖安装 | `pnpm install`     | `script`          | `sh` + `retry`     |
| 质量检查 | 独立 step          | `quality` stage   | `Quality` stage    |
| 单元测试 | 独立 step + 覆盖率 | `test` stage      | `Test` stage       |
| 构建打包 | 独立 step          | `build` stage     | `Build` stage      |
| 制品上传 | `upload-artifact`  | `artifacts:`      | `archiveArtifacts` |

### 0.2 通用可替换参数

| 占位符             | 含义                     | 本项目取值                   |
| ------------------ | ------------------------ | ---------------------------- |
| `<主分支>`         | 触发 CI 的主分支         | `main`                       |
| `<发布分支通配>`   | 发布分支规则             | `release/**`                 |
| `<标签通配>`       | 发布标签规则             | `v*`                         |
| `<Node 版本>`      | Node.js 版本             | `22.20.0`                    |
| `<pnpm 版本>`      | pnpm 版本                | `11.6.0`                     |
| `<JDK 版本>`       | Java 版本                | `17`                         |
| `<Maven 版本>`     | Maven 版本               | `3.9`                        |
| `<Go 版本>`        | Go 版本                  | `1.22`                       |
| `<制品路径>`       | 构建产物目录             | `packages/*/dist`            |
| `<覆盖率路径>`     | 覆盖率报告目录           | `packages/core/coverage`     |
| `<Runner 标签>`    | Jenkins agent 标签       | `linux`                      |
| `<Jenkins 工具名>` | Jenkins 全局工具配置名称 | `node-22.20.0` / `jdk-17` 等 |

### 0.3 前置依赖

**GitHub Actions**

1. 仓库 Settings → Actions → General 允许 Actions 运行。
2. 无需额外 Secret；若需发布 Release，配置 `GITHUB_TOKEN` 权限或 Personal Access Token。
3. 使用 `pnpm/action-setup` 时不要在 `packageManager` 字段与 `version` 参数间冲突；本仓库以 `version: 11.6.0` 为准。

**GitLab CI**

1. 项目已启用 Shared Runner 或注册 Docker Runner。
2. `.gitlab-ci.yml` 放在仓库根目录。
3. 受保护分支与 CI/CD Variables 按需配置；缓存目录需在 Runner 卷上可写。

**Jenkins**

1. 安装插件：Pipeline、Git、GitHub Branch Source（可选）、NodeJS、JDK Tool、Maven Integration、Go（或使用自定义工具安装）。
2. 全局工具配置中创建与 `tools {}` 同名的工具：`node-22.20.0`、`jdk-17`、`maven-3.9`、`go-1.22`。
3. agent 节点具备对应标签（示例为 `linux`），并预装 `corepack`、`git`。
4. 凭据：Git 拉取凭据 ID 按实际填写。

### 0.4 验证方法总览

| 平台    | 语法校验                                                                                     | 首次运行验证                            |
| ------- | -------------------------------------------------------------------------------------------- | --------------------------------------- |
| GitHub  | `actionlint .github/workflows/*.yml`（可选安装）                                             | `gh run list` / `gh run watch <run-id>` |
| GitLab  | 项目 → CI/CD → Editor → Validate，或 `/-/ci/lint`                                            | 提交后查看 Pipelines 页面               |
| Jenkins | `curl -X POST -F "jenkinsfile=<Jenkinsfile" <JENKINS_URL>/pipeline-model-converter/validate` | 手动 Build with Parameters / 首次构建   |

---

## 1 GitHub Actions

### 1.1 Node.js（pnpm monorepo）

**文件路径**：`.github/workflows/ci-node.yml`
**说明**：本仓库已有基础 [ci.yml](../.github/workflows/ci.yml)，本模板在其上增加缓存、安装重试、标签触发、并发取消与制品上传；可直接替换或作为新工作流并存。

```yaml
# ============================================================
# GitHub Actions · Node.js（pnpm monorepo）
# 文件：.github/workflows/ci-node.yml
# 可调参数：分支、Node/pnpm 版本、制品路径、重试次数
# ============================================================
name: ci-node

on:
  push:
    branches: [main, 'release/**'] # <主分支>、<发布分支通配>
    tags: ['v*'] # <标签通配>：打标签时也触发
  pull_request:
    branches: [main]

permissions:
  contents: read # 最小权限，上传制品不需要写权限

# 同一 ref 的新流水线取消旧的，避免重复消耗额度
concurrency:
  group: ci-node-${{ github.ref }}
  cancel-in-progress: true

env:
  NODE_VERSION: '22.20.0' # 与 .nvmrc / engines 保持一致
  PNPM_VERSION: '11.6.0'

jobs:
  ci:
    name: 质量 · 测试 · 构建
    runs-on: ubuntu-latest
    timeout-minutes: 30 # 防止卡死占用额度
    steps:
      - name: 检出代码
        uses: actions/checkout@v4
        with:
          fetch-depth: 1 # 仅当前提交，加速检出

      - name: 安装 pnpm
        uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
          run_install: false # 安装交给下一步，便于统一重试

      - name: 安装 Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: pnpm # 缓存 pnpm store，命中后安装显著加速

      - name: 安装依赖（失败重试）
        uses: nick-fields/retry@v3
        with:
          timeout_minutes: 10
          max_attempts: 3 # 网络抖动时最多尝试 3 次
          retry_on: error
          command: pnpm install --frozen-lockfile

      - name: 格式检查
        run: pnpm run format:check

      - name: Lint
        run: pnpm run lint

      - name: 类型检查
        run: pnpm run typecheck

      - name: 单元测试
        run: pnpm run test

      - name: 覆盖率
        run: pnpm run test:coverage

      - name: 上传覆盖率报告
        if: always() # 测试失败也保留现场
        uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: packages/core/coverage # <覆盖率路径>
          if-no-files-found: warn
          retention-days: 7 # 保留天数，按需调整

      - name: 构建
        run: pnpm run build

      - name: 内容校验
        run: pnpm run validate:content

      - name: 黄金回放
        run: pnpm run replay:golden

      - name: 上传构建产物
        uses: actions/upload-artifact@v4
        with:
          name: build-dist
          path: |
            packages/*/dist
            apps/laya-client/dist
          if-no-files-found: warn # 客户端未构建时不阻断
          retention-days: 7

  release:
    name: 标签制品归档
    if: startsWith(github.ref, 'refs/tags/') # 仅标签推送触发
    needs: ci
    runs-on: ubuntu-latest
    permissions:
      contents: write # 创建 Release 需要写权限，仅本 job 提升
    steps:
      - name: 检出代码
        uses: actions/checkout@v4
      - name: 下载构建产物
        uses: actions/download-artifact@v4
        with:
          name: build-dist
          path: dist
      - name: 归档为 Release 附件
        uses: softprops/action-gh-release@v2 # 可选；无发布需求可删除本 job
        with:
          files: dist/**/*
          generate_release_notes: true
```

**可调项**：分支/标签规则、`max_attempts`、`retention-days`、`path` 列表；如需矩阵构建，可增加 `strategy.matrix.node: [20, 22]`。

### 1.2 Java（Maven + JDK 17）

**文件路径**：`.github/workflows/ci-java.yml`
**说明**：适用于标准 Maven 工程，产物为 `target/*.jar`。

```yaml
# ============================================================
# GitHub Actions · Java（Maven）
# 文件：.github/workflows/ci-java.yml
# 可调参数：JDK 版本、Maven 参数、制品路径
# ============================================================
name: ci-java

on:
  push:
    branches: [main, 'release/**']
    tags: ['v*']
  pull_request:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: ci-java-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - name: 检出代码
        uses: actions/checkout@v4

      - name: 安装 JDK
        uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '17' # <JDK 版本>
          cache: maven # 缓存 ~/.m2/repository

      - name: 单元测试（失败重试）
        uses: nick-fields/retry@v3
        with:
          timeout_minutes: 15
          max_attempts: 2 # 依赖下载失败时重试；断言失败请关闭重试
          command: mvn -B -ntp test

      - name: 打包
        run: mvn -B -ntp package -DskipTests # 测试已在上一步完成

      - name: 上传测试报告
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: surefire-reports
          path: target/surefire-reports
          if-no-files-found: warn

      - name: 上传 JAR
        uses: actions/upload-artifact@v4
        with:
          name: java-dist
          path: target/*.jar # <制品路径>
          if-no-files-found: error
          retention-days: 7
```

### 1.3 Go（Go 1.22）

**文件路径**：`.github/workflows/ci-go.yml`
**说明**：使用 `go.mod` 锁定版本；开启 race 检测，产物为单个二进制。

```yaml
# ============================================================
# GitHub Actions · Go
# 文件：.github/workflows/ci-go.yml
# 可调参数：Go 版本、包路径、输出文件名
# ============================================================
name: ci-go

on:
  push:
    branches: [main, 'release/**']
    tags: ['v*']
  pull_request:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: ci-go-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - name: 检出代码
        uses: actions/checkout@v4

      - name: 安装 Go
        uses: actions/setup-go@v5
        with:
          go-version: '1.22' # 也可用 go-version-file: go.mod
          cache: true # 缓存模块与构建缓存

      - name: 静态检查
        run: go vet ./...

      - name: 单元测试（含竞态检测）
        run: go test -race -coverprofile=coverage.out ./...

      - name: 构建
        run: go build -trimpath -ldflags="-s -w" -o bin/app ./cmd/app # <入口包>

      - name: 上传覆盖率
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: go-coverage
          path: coverage.out
          if-no-files-found: warn

      - name: 上传二进制
        uses: actions/upload-artifact@v4
        with:
          name: go-bin
          path: bin/app
          if-no-files-found: error
```

---

## 2 GitLab CI

### 2.1 Node.js（pnpm monorepo）

**文件路径**：`.gitlab-ci.yml`（根目录）
**说明**：使用 `node:22.20.0` 镜像 + corepack 激活 pnpm；缓存以 `pnpm-lock.yaml` 哈希为键。

```yaml
# ============================================================
# GitLab CI · Node.js（pnpm）
# 文件：.gitlab-ci.yml
# 可调参数：镜像标签、缓存目录、分支规则、重试次数
# ============================================================
stages: [quality, test, build]

default:
  image: node:22.20.0 # <Node 版本>
  before_script:
    - corepack enable
    - corepack prepare pnpm@11.6.0 --activate # <pnpm 版本>
    - pnpm config set store-dir "$CI_PROJECT_DIR/.pnpm-store"

variables:
  PNPM_STORE_DIR: '$CI_PROJECT_DIR/.pnpm-store'
  CI: 'true'

# 依赖锁变化才重建缓存，命中率高
cache:
  key:
    files: [pnpm-lock.yaml]
  paths: [.pnpm-store]

# 共用规则：MR、主分支、发布分支、标签
.ci_rules: &ci_rules
  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'
    - if: '$CI_COMMIT_BRANCH =~ /^(main|release\/.*)$/'
    - if: '$CI_COMMIT_TAG'
    - when: never # 其他分支不跑，节省 Runner

quality:
  stage: quality
  <<: *ci_rules
  retry:
    max: 2
    when: [runner_system_failure, stuck_or_timeout_failure] # 仅基础设施故障重试
  script:
    - pnpm install --frozen-lockfile
    - pnpm run format:check
    - pnpm run lint
    - pnpm run typecheck

test:
  stage: test
  <<: *ci_rules
  script:
    - pnpm install --frozen-lockfile
    - pnpm run test
    - pnpm run test:coverage
  artifacts:
    when: always
    expire_in: 7 days # 保留期
    paths:
      - packages/core/coverage # <覆盖率路径>
    reports:
      junit: packages/*/reports/junit.xml # 有则填，无则删除本行

build:
  stage: build
  <<: *ci_rules
  script:
    - pnpm install --frozen-lockfile
    - pnpm run build
    - pnpm run validate:content
    - pnpm run replay:golden
  artifacts:
    expire_in: 7 days
    paths:
      - packages/*/dist
      - apps/laya-client/dist
```

### 2.2 Java（Maven）

**文件路径**：`.gitlab-ci.yml`
**说明**：Maven 镜像自带 JDK；缓存 `.m2/repository`。

```yaml
# ============================================================
# GitLab CI · Java（Maven）
# 文件：.gitlab-ci.yml
# 可调参数：镜像 JDK 版本、Maven 参数、JAR 路径
# ============================================================
stages: [test, build]

default:
  image: maven:3.9-eclipse-temurin-17 # <Maven 版本> + <JDK 版本>
  tags: [docker] # <Runner 标签>，按实际修改

variables:
  MAVEN_OPTS: '-Dmaven.repo.local=$CI_PROJECT_DIR/.m2/repository'
  MAVEN_CLI_OPTS: '-B -ntp'

cache:
  key:
    files: [pom.xml] # 依赖变化时失效
  paths: [.m2/repository]

test:
  stage: test
  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'
    - if: '$CI_COMMIT_BRANCH =~ /^(main|release\/.*)$/'
    - if: '$CI_COMMIT_TAG'
    - when: never
  retry:
    max: 2
    when: [runner_system_failure, stuck_or_timeout_failure]
  script:
    - mvn $MAVEN_CLI_OPTS test # 仅运行测试
  artifacts:
    when: always
    expire_in: 7 days
    reports:
      junit: target/surefire-reports/*.xml

build:
  stage: build
  needs: [test] # 测试通过后才打包
  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'
    - if: '$CI_COMMIT_BRANCH =~ /^(main|release\/.*)$/'
    - if: '$CI_COMMIT_TAG'
    - when: never
  script:
    - mvn $MAVEN_CLI_OPTS package -DskipTests # 编译 + 打包
  artifacts:
    expire_in: 7 days
    paths:
      - target/*.jar # <制品路径>
```

### 2.3 Go

**文件路径**：`.gitlab-ci.yml`
**说明**：缓存 `GOCACHE`，测试开启竞态检测并输出覆盖率。

```yaml
# ============================================================
# GitLab CI · Go
# 文件：.gitlab-ci.yml
# 可调参数：镜像 Go 版本、入口包、二进制名
# ============================================================
stages: [test, build]

default:
  image: golang:1.22 # <Go 版本>
  tags: [docker]

variables:
  GOCACHE: '$CI_PROJECT_DIR/.cache/go-build'
  GOFLAGS: '-mod=readonly'

cache:
  key:
    files: [go.sum]
  paths: [.cache/go-build]

.ci_rules: &ci_rules
  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'
    - if: '$CI_COMMIT_BRANCH =~ /^(main|release\/.*)$/'
    - if: '$CI_COMMIT_TAG'
    - when: never

test:
  stage: test
  <<: *ci_rules
  retry:
    max: 2
    when: [runner_system_failure, stuck_or_timeout_failure]
  script:
    - go vet ./...
    - go test -race -coverprofile=coverage.out ./...
  coverage: '/coverage: \d+\.\d+% of statements/' # 从日志提取覆盖率
  artifacts:
    when: always
    expire_in: 7 days
    paths: [coverage.out]

build:
  stage: build
  <<: *ci_rules
  script:
    - go build -trimpath -ldflags="-s -w" -o bin/app ./cmd/app # <入口包>
  artifacts:
    expire_in: 7 days
    paths: [bin/app]
```

---

## 3 Jenkins

> Jenkins 的工具名必须与「全局工具配置」完全一致；以下以 `node-22.20.0`、`jdk-17`、`maven-3.9`、`go-1.22` 为例。缓存依赖持久化 agent 的 workspace 或挂载卷，不能依赖 `stash` 跨构建复用。

### 3.1 Node.js（Declarative Pipeline）

**文件路径**：`Jenkinsfile`（仓库根目录）

```groovy
// ============================================================
// Jenkins · Node.js（pnpm）
// 文件：Jenkinsfile
// 前置：NodeJS 插件、全局工具 node-22.20.0、agent 标签 linux
// ============================================================
pipeline {
  agent { label 'linux' } // <Runner 标签>
  tools { nodejs 'node-22.20.0' } // <Jenkins 工具名>

  options {
    timeout(time: 30, unit: 'MINUTES') // 整体超时
    disableConcurrentBuilds() // 同一 Job 不并发
    timestamps() // 日志加时间戳，需 Timestamper 插件
    buildDiscarder(logRotator(numToKeepStr: '20')) // 保留 20 次构建
  }

  environment {
    CI = 'true'
    PNPM_HOME = "${WORKSPACE}/.pnpm"
    PATH = "${PNPM_HOME}:${env.PATH}"
  }

  stages {
    stage('Checkout') {
      steps { checkout scm }
    }

    stage('Install') {
      steps {
        retry(2) { // 失败重试 2 次（共 3 次）
          sh '''
            corepack enable
            corepack prepare pnpm@11.6.0 --activate
            pnpm config set store-dir .pnpm-store
            pnpm install --frozen-lockfile
          '''
        }
      }
    }

    stage('Quality') {
      steps {
        sh 'pnpm run format:check'
        sh 'pnpm run lint'
        sh 'pnpm run typecheck'
      }
    }

    stage('Test') {
      steps {
        sh 'pnpm run test'
        sh 'pnpm run test:coverage'
      }
      post {
        always {
          junit allowEmptyResults: true, testResults: 'packages/*/reports/junit.xml'
          archiveArtifacts artifacts: 'packages/core/coverage/**', allowEmptyArchive: true
        }
      }
    }

    stage('Build') {
      when {
        anyOf { // 仅在主分支、发布分支或标签上构建
          branch 'main'
          branch 'release/*'
          tag 'v*'
        }
      }
      steps {
        sh 'pnpm run build'
        sh 'pnpm run validate:content'
        sh 'pnpm run replay:golden'
      }
    }

    stage('Archive') {
      when { branch 'main' }
      steps {
        archiveArtifacts artifacts: 'packages/*/dist/**,apps/laya-client/dist/**', fingerprint: true
      }
    }
  }

  post {
    always { cleanWs() } // 清理工作区，持久化 agent 上尤其重要
    failure { echo 'CI 失败，请查看上方阶段日志与归档制品' }
  }
}
```

### 3.2 Java（Maven）

```groovy
// ============================================================
// Jenkins · Java（Maven）
// 前置：JDK Tool、Maven Integration、全局工具 jdk-17 / maven-3.9
// ============================================================
pipeline {
  agent { label 'linux' }
  tools {
    jdk 'jdk-17' // <Jenkins 工具名>
    maven 'maven-3.9'
  }

  options {
    timeout(time: 30, unit: 'MINUTES')
    disableConcurrentBuilds()
    timestamps()
  }

  stages {
    stage('Checkout') { steps { checkout scm } }

    stage('Test') {
      steps {
        retry(2) { // 依赖下载失败时重试
          sh 'mvn -B -ntp test'
        }
      }
      post {
        always {
          junit allowEmptyResults: true, testResults: 'target/surefire-reports/*.xml'
        }
      }
    }

    stage('Package') {
      steps {
        sh 'mvn -B -ntp package -DskipTests'
      }
    }

    stage('Archive') {
      when { anyOf { branch 'main'; tag 'v*' } }
      steps {
        archiveArtifacts artifacts: 'target/*.jar', fingerprint: true
      }
    }
  }

  post { always { cleanWs() } }
}
```

### 3.3 Go

```groovy
// ============================================================
// Jenkins · Go
// 前置：Go 插件或全局工具 go-1.22，agent 具备 go 环境
// ============================================================
pipeline {
  agent { label 'linux' }
  tools { go 'go-1.22' } // <Jenkins 工具名>

  options {
    timeout(time: 20, unit: 'MINUTES')
    disableConcurrentBuilds()
    timestamps()
  }

  environment {
    GOCACHE = "${WORKSPACE}/.cache/go-build" // 持久化 agent 上可复用
    GOFLAGS = '-mod=readonly'
  }

  stages {
    stage('Checkout') { steps { checkout scm } }

    stage('Vet & Test') {
      steps {
        sh 'go vet ./...'
        retry(2) { sh 'go test -race -coverprofile=coverage.out ./...' }
      }
      post {
        always { archiveArtifacts artifacts: 'coverage.out', allowEmptyArchive: true }
      }
    }

    stage('Build') {
      when { anyOf { branch 'main'; tag 'v*' } }
      steps {
        sh 'go build -trimpath -ldflags="-s -w" -o bin/app ./cmd/app'
        archiveArtifacts artifacts: 'bin/app', fingerprint: true
      }
    }
  }

  post { always { cleanWs() } }
}
```

---

## 4 最佳实践对照

### 4.1 缓存优化

| 平台    | 做法                                                                  | 注意                                                      |
| ------- | --------------------------------------------------------------------- | --------------------------------------------------------- |
| GitHub  | `setup-node cache: pnpm`、`setup-java cache: maven`、`setup-go cache` | 锁文件变化自动换键；monorepo 注意 `cache-dependency-path` |
| GitLab  | `cache.key.files` 指向锁文件，缓存 store/`.m2`/`GOCACHE`              | 缓存不跨 Runner 强一致；大缓存会拖慢上传                  |
| Jenkins | 持久化 agent workspace、`pnpm store` 放固定目录、挂载卷               | `cleanWs()` 会清空缓存，需把缓存目录移出 workspace        |

### 4.2 失败重试

| 平台    | 推荐                                                     | 注意                                       |
| ------- | -------------------------------------------------------- | ------------------------------------------ |
| GitHub  | `nick-fields/retry` 包裹安装/测试步骤                    | 只对网络类步骤重试，业务断言失败不应重试   |
| GitLab  | `retry.when` 限定 `runner_system_failure` 等基础设施故障 | 避免 `always` 掩盖真实失败                 |
| Jenkins | `retry(n) { sh ... }`                                    | 重试块尽量小，避免重复执行已成功的耗时步骤 |

### 4.3 条件触发

| 平台    | 规则示例                                                                    |
| ------- | --------------------------------------------------------------------------- |
| GitHub  | `on.push.branches/tags`、`if: startsWith(github.ref, 'refs/tags/')`         |
| GitLab  | `rules: if: $CI_PIPELINE_SOURCE == "merge_request_event"`、`$CI_COMMIT_TAG` |
| Jenkins | `when { anyOf { branch 'main'; tag 'v*' } }`                                |

建议：PR/MR 只跑质量与测试；主分支跑全量并归档制品；标签触发发布归档，避免每次提交都产出发布件。

---

## 5 部署步骤

### 5.1 GitHub Actions

```bash
# 1. 将本文 §1.1 的 YAML 内容保存为 .github/workflows/ci-node.yml
#    （本仓库已有基础 ci.yml，可按需替换或新增独立工作流）

# 2. 替换占位符（分支、版本、制品路径）
# 3. 提交并推送
git add .github/workflows/ci-node.yml
git commit -m "ci: add node pipeline"
git push origin main

# 4. 查看运行
gh run list --workflow=ci-node.yml --limit 5
gh run watch <run-id>
```

### 5.2 GitLab CI

```bash
# 1. 将模板保存为仓库根目录 .gitlab-ci.yml
# 2. 在 CI/CD → Editor 中点击 Validate，或调用：
curl --header "PRIVATE-TOKEN: <token>" \
  "https://<gitlab-host>/api/v4/projects/<project-id>/ci/lint" \
  --data-urlencode "content@.gitlab-ci.yml"

# 3. 提交后查看 Pipelines
```

### 5.3 Jenkins

```bash
# 1. Jenkinsfile 放入仓库根目录
# 2. 新建 Pipeline Job → Definition: Pipeline script from SCM
# 3. 校验 Declarative 语法
curl -X POST -F "jenkinsfile=<Jenkinsfile" \
  --user "<user>:<api-token>" \
  "https://<jenkins-host>/pipeline-model-converter/validate"

# 4. 首次 Build，确认各 stage 与归档制品
```

---

## 6 验证清单

| 编号 | 检查项                       | 通过标准                                                |
| ---- | ---------------------------- | ------------------------------------------------------- |
| C-1  | 配置文件位于平台要求路径     | GitHub `.github/workflows/`、GitLab 根目录、Jenkins SCM |
| C-2  | 语法校验通过                 | `actionlint` / CI Lint / Jenkins validate 均无错误      |
| C-3  | 依赖缓存命中                 | 二次运行安装耗时明显下降                                |
| C-4  | 质量、测试、构建阶段全部执行 | 日志中三段均出现且退出码 0                              |
| C-5  | 失败路径可重试               | 人为断网/改错命令，重试生效且最终失败被标记             |
| C-6  | 条件触发正确                 | 非目标分支不触发；标签触发归档 job                      |
| C-7  | 制品可下载                   | 平台制品页存在且文件非空                                |
| C-8  | 状态码正确                   | 失败流水线为红，成功为绿                                |

---

## 7 常见问题

| 现象                 | 原因                                                   | 处理                                                       |
| -------------------- | ------------------------------------------------------ | ---------------------------------------------------------- |
| pnpm 版本冲突        | `packageManager` 与 `pnpm/action-setup.version` 不一致 | 二选一，或都锁定 `11.6.0`                                  |
| Node 引擎告警        | 本地/CI Node 不在 `>=22.20.0 <23`                      | CI 固定 22.20.0；本地用 nvm 切换                           |
| 缓存未命中           | 锁文件路径不同或缓存键含动态变量                       | `cache-dependency-path` / `cache.key.files` 指向实际锁文件 |
| GitLab 作业不触发    | `rules` 最后缺少 `when: never`                         | 补默认拒绝规则                                             |
| Jenkins 报工具不存在 | `tools` 名称与全局工具配置不一致                       | 在 Manage Jenkins → Tools 中按名称创建                     |
| 制品上传为空         | 构建未产出或路径错误                                   | 先本地确认路径；`if-no-files-found` 按需设 `warn`/`error`  |
| 重试掩盖真实失败     | `retry` 范围过大或 `when: always`                      | 仅包裹网络/基础设施步骤                                    |
