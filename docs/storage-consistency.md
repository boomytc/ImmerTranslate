# 存储与同步一致性契约

本文档约定本地设置、规则、悬浮球等配置在多页面并发读写与云同步场景下的一致性边界。

## 写入入口与默认值合并

所有需要记录修改时间并参与云同步的用户修改，都必须通过 `saveEdit`（或其事务内版本 `transaction.saveEdit`）写入。两者在 `src/libs/storage.js` 中共用同一套 `stageEdit` 实现：

1. 在同一个跨页面事务锁（`withTransaction`）内读取当前已存储的值；若键缺失，则按 `options.defaultValue` 或 `EDIT_DEFAULTS[key]` 取默认基线。
2. 对读取值的克隆副本执行纯同步更新函数（reducer），并用 `isSameStorageValue` 与原值做深比较。
3. 只有当值确实发生变化时，才把业务键的写入与 `STOKEY_SYNC` 中对应 `syncMeta[syncKey]` 的更新（推进单调递增的 `updateAt`；若已记录 `firstAttemptAt`，同时置位 `pendingUpload: true`）放进同一笔原子提交里一并落盘。

针对同步配置 `STOKEY_SYNC` 本身的编辑，`stageEdit` 会剥离外部传入的 `destinationRevision` 并保留现有的 `syncMeta` 与 `destinationRevision`，防止表单提交把过期元数据写回存储；而在 `stage` 阶段，只要 `DESTINATION_FIELDS`（`syncType`、`syncUrl`、`syncUser`、`syncKey`、`syncEncryptKey`）发生变化且未传 `preserveDestination: true`，`destinationRevision` 会自动加 1 并清空 `syncMeta`。

低层接口（`trySetObj`、`setObj`、`putObj`、`transaction.setObj`、`updateSyncState`、`transaction.del`）只用于三类场景，**不会**自动生成用户编辑时间戳或标记待上传：

- **默认初始化**：如安装时通过 `tryInitDefaultData` 写入 `DEFAULT_SETTING`、`DEFAULT_RULES`、`DEFAULT_SYNC`。
- **仅本地使用的非同步状态**：如悬浮球位置 `putFab`、划词翻译框位置 `putTranBox`，以及 `storageState.remove()` 调用 `storage.del` 删除本地键。
- **接收已校验的远端同步数据**：`src/libs/sync.js` 在远端校验通过后通过 `transaction.setObj` 写入业务数据，并用 `updateSyncState` 更新 `syncMeta`。

### 读取合并、编辑重放与无改动保护

- **读取只在内存中补默认值，不写盘也不触发上传**：`getSettingWithDefault`、`normalizeStoredSetting`、`readSyncSnapshot`、`SettingProvider`（`src/hooks/Setting.js`）与 `PageRuntime`（`src/libs/pageRuntime.js`）在读取设置时，都会在内存中将已存数据与 `DEFAULT_SETTING`、`DEFAULT_TRANBOX_SETTING` 合并，缺失版本号时回退到 `DEFAULT_SETTING.version`，并调用 `normalizeApiThinkingSettings` 将 `transApis` 中的思考配置整理为当前结构。`getRulesWithDefault`、`getSyncWithDefault`、`getFabWithDefault` 同理，仅在内存中返回默认值。单纯的读取（包括首次加载、窗口切回刷新、刚接受远端数据后的重读）绝不会把内存合并结果写回存储、把 `dirty` 设为 `true`、推进 `updateAt` / `committedEditVersion`，或安排上传任务。
- **真实用户修改在最新合并基线上重放**：在 `SettingProvider` 的 `updateSetting` 中，用户发起改动时，更新函数会在事务锁内先拿到最新存储的 `previous`，计算 `current = normalizeStoredSetting(previous)`，再将本次变更合并进去并归一化成 `next`。若 `isSameStorageValue(current, next)` 为真（即实际内容与当前生效配置一致），`updateSetting` 会直接返回原始 `previous`，使 `stageEdit` 判定 `changed: false`——从而原封不动保留磁盘上原有的存储形态和 `syncMeta`，不会因为打开设置或格式归一化而产生一次多余的云端覆盖上传。只有确实产生差异时，才会将合并并归一化后的新结构连同新时间戳一起保存。
- **JSON 导入与同步加密信封**：在设置页导入 JSON 配置（`src/views/Options/Setting.js`）时，会将 `version` 设为当前结构版本 `CURRENT_SETTINGS_VERSION`（当前为 `3`）再交由 `updateSetting` 写入。云端同步数据（`src/libs/syncCrypto.js`）外层保留明文 `key` 与 `updateAt` 供定位与比对，业务 `value` 必须使用当前版本的加密信封（`encrypted: true`、`version: 1`、`alg: "AES-GCM"`、`kdf: "PBKDF2-SHA-256"`、`iterations: 100000` 及 `salt`/`iv`/`data`）；`decryptSyncValue` 会拒绝任何非当前信封格式的远端数据。

## 分层职责与版本计数

| 层级                    | 对应模块                                                                                               | 核心职责                                                                                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 持久化与跨页面协调      | `storage.js`、`storageCoordination.js`、`background.js`                                                | 跨页面加锁串行化（`withStorageLock`、`withTransaction`、`installStorageCoordinator`）、生成单调 `updateAt`、维护 `destinationRevision`、部分写入失败后的回滚补偿         |
| 页面状态机              | `storageState.js`                                                                                      | 维护当前页面单个存储键的已确认基线 `base`、待执行意图队列 `pending`、乐观投影 `snapshot`、页内串行队列（`writeQueues` / `syncQueues`）、防抖同步调度（3000ms）与故障恢复 |
| 同步控制器与网络同步    | `storageSyncController.js`、`sync.js`、`syncCrypto.js`                                                 | 独立于组件挂载期的同步执行（`syncStorageState`）、在锁外发起 WebDAV / GitHub Gist 网络请求与加解密、校验后提交远端结果及口令轮换（`changeSyncEncryptKey`）               |
| 界面 Hooks 与运行时订阅 | `hooks/Storage.js`、`Setting.js`、`Rules.js`、`Sync.js`、`Fab.js`、`Tranbox.js` 与 `pageRuntime.js` 等 | 订阅 `storageState` 快照驱动渲染、把用户操作包装为纯更新函数入队，以及在选项页（`isOptions()`）绑定 `syncStorageState`                                                   |

`storageState.js` 通过三个计数区分不同阶段的变更：

- **`revision`（状态作用域修订号）**：当已确认基线 `base` 发生实质变化（`adoptBase` 内经 `!isSameStorageValue` 判定）、有新操作入队（`submit`），或进入恢复状态（`recover`）时递增。`syncStorageState` 和 `markSynced(expectedRevision)` 用它判断当前视图和基线是否已经过期。
- **`editVersion`（意图排队版本号）**：在 `submit` 把操作放进 `pending` 队列时**立即递增**，无需等到拿到写锁。`load()` 和 `syncStorageState` 都会检查它，只要用户提交了新编辑，进行中的重读或网络同步就能立刻识别并放弃覆盖。
- **`committedEditVersion`（已落盘改动版本号）**：**只有** `storage.saveEdit` 成功落盘并且 `receipt.changed === true` 时才递增（同时记录 `editTimestamp = receipt.updateAt` 并置 `dirty = true`）。乐观预览（`project()`）、无实质变化的空操作（`changed: false`）、本地 `remove()` 或 `save(null)` 都不会递增它，也不会触发上传。

### 队列执行与组件卸载边界

- 页面呈现的 `snapshot.data` 由 `project()` 把 `pending` 中未取消的意图按顺序叠加到已确认 `base` 上实时算出。
- 在 `writeQueues` 串行队列中，每个写入任务在拿到持久化回执后，必须先从 `pending` 移除自身 `intent`、更新 `committedEditVersion` / `editTimestamp` / `dirty` 并通过 `adoptBase(receipt.value)` 更新基线，然后再调用 `scheduleSync()`；所有这些动作都在下一条写操作或重读开始前完成。
- React 组件卸载（例如切换路由或卸载某个视图组件）只是调用 `unsubscribe()` 取消本地监听（最后一个订阅者离开时仅解除事件订阅并标记 `reloadOnSubscribe = true`），**不会**取消已经排入 `writeQueues` 或 `syncQueues` 的写入与同步任务。只有整个标签页文档被关闭或切入浏览器缓存冻结才是另一个边界；即便如此，后台协调器已经接手并启动写入的提交仍会完成落盘。

## 编辑与状态契约

- **更新函数必须纯且同步**：为了做界面预览（`project()`）以及在写锁内基于最新持久化值重放（`stageEdit`），更新函数可能会执行多次，因此不能包含副作用或返回 Promise（`storageState.js` 与 `storage.js` 都会直接抛出 `TypeError`）。时间戳（`timestamp = Date.now()`）与输入参数（通过 `cloneStorageValue` 隔离）必须在入队前固定捕获。
- **每个意图最多落盘一次，副作用在成功之后**：每条排队意图最多触发一次持久化尝试，失败后不会自动重试。`publishStorageWrite` 广播、触发同步（`scheduleSync` / `trySyncRules`）等后续动作必须在持久化 Promise 成功后执行。
- **锁内空改动（No-op）判断**：`stageEdit` 在事务锁内使用 `isSameStorageValue` 把新值与当前存储值做深比较。比较时忽略对象属性顺序，但严格区分数组元素顺序；若判定相等，直接返回 `changed: false`，不写盘也不改 `syncMeta`。
- **替换内容与删除本地键严格分开**：`saveEdit` / `save` 的语义始终是替换存储内容。清空一个需要同步的集合（如 `useRules().clear()` 保留 `*` 全局规则，或清空 `transApis`、`prompts`、`customStyles` 数组）会写入空集合并推进 `updateAt`，以便同步到远端覆盖旧数据；而删除本地键是独立操作，`remove()` 调用 `storage.del` 清除本地数据并置 `dirty = false`（不触发同步），且只要当前控制器未重新初始化、仍处于 `base === null`，后续重读会保持 `null` 而不会回填 `defaultValue`。（`save(null)` 保留为仅本地置空的瞬态兼容路径，不调用 `storage.del` 也不参与同步。）
- **缺失数据按默认值展示但不落盘**：存储键不存在时，首次加载及各 `get*WithDefault` / `readSyncSnapshot` 只在内存中返回默认值，不会因为“读过一次”而写入存储。
- **`updateAt` 单调递增与首次同步保护（`firstAttemptAt` / `pendingUpload`）**：
  - 对配置了 `syncKey` 的键，每次发生实质改动的 `stageEdit` 都会按 `Math.max(timestamp, updateAt + 1)` 推进 `updateAt`。
  - 在从未同步过（`syncAt === 0`）的设备上，只要尚未标记 `pendingUpload`，`sync.js` 会把请求里的 `updateAt` 当作 `0`，优先从远端拉取备份，避免新设备误覆盖云端数据；发出首次网络请求前，`sync.js` 会先在 `syncMeta[key]` 写入 `firstAttemptAt`。
  - 一旦存在 `firstAttemptAt`，后续任何本地实质修改都会在 `stageEdit` 中同时标上 `pendingUpload: true`。如果首次同步请求失败或同步期间用户又有新改动，`pendingUpload: true` 会保护本地较高的 `updateAt` 不被重新归零；在下次带着 `isFirstSync && originalMeta.pendingUpload` 上传前，`syncData` 会先发一次 `updateAt: 0` 的请求并用当前 `syncEncryptKey` 解密校验现有远端备份，确认口令有效后才允许本地改动覆盖云端。此外，若同步写回阶段因并发新提交（`committedEditVersion` 已变）被守卫拒绝，也会保留本地最新时间戳与 `pendingUpload: true` 供下次重传。
- **存储变更通知只作废缓存，不在事务内等待重载**：
  - `storageEvents.js` 监听扩展的 `browser.storage.onChanged`（`local` 区域）、Web 环境的 `storage` 事件、页面 `focus` / `pageshow` 以及页内提交后的 `publishStorageWrite`。
  - 这些事件统一调用 `requestRefresh()`，只递增 `invalidation` 并在微任务（`Promise.resolve().then(...)`）里把 `load()` 排入本页 `enqueueWrite` 队列——既不直接采信事件载荷、不发起新写入，也不会在事件回调或活跃事务锁内部同步等待重载完成。
  - `readCurrent` 执行时，常规刷新直接调用 `readStoredObjects` / `getObj` 无锁读取并经 `isCurrent()` 检验是否过期；处于恢复状态（`recovering === true`）时，则走 `storage.withTransaction` 经后台协调器加锁读取最新值与 `syncMeta[syncKey]`，等待后台可能仍在落盘的 `pendingCommit` 完成。（选项页启动同步后则通过 `refreshStorageKeys` 等待已挂载的订阅者完成 `load()`。）

## 失败恢复、锁外网络与规则编辑器边界

- **拒绝不等于未写入**：当页面在发出 `{ type: "commit", entries }` 后与协调器断连（包括进入 bfcache 触发 `pagehide`），或部分写入回滚时检测到并发修改 / 回滚自身失败，异常上会携带 `storageOutcome: "unknown"`（或 `storageRecoveryFailed: true`）。`storageState` 在 `submit` 捕获任何持久化失败后，都会立刻调用 `recover(error)`：取消 `pending` 中所有未执行的后续意图，设置 `recovering = true`、`dirty = false`、递增 `revision` 并取消同步定时器；**绝不自动重放**被拒绝的操作（防止开关切换类操作被重复执行导致状态反转）；然后通过 `storage.withTransaction` 经协调器读取权威存储值与 `syncMeta[syncKey]`。若恢复读取再次失败，写操作会一直保持拦截状态（`recovering === true`），直到后续协调器读取成功为止。
- **网络请求、加解密与交互全部在锁外完成；过期响应在提交前拦截**：
  - `syncStorageState` 只用一个短事务读出 `{ value, syncConfig }` 快照后立刻放锁，在锁外执行 `syncData(..., { deferCommit: true })` 完成网络通信与加解密，拿到远端结果后再进入 `state.enqueueWrite` 与 `updateSyncState` 事务提交。
  - 写入前，`commit` 会校验 `isCurrent()`（`revision`、`editVersion` 未变，且无 `pending` 或 `recovering`）、`destinationRevision` 与 `syncMeta[key]` 是否仍与发请求时一致，过期响应直接拒收。
  - 一旦一份远端同步结果通过校验并进入写入，该事务会在写队列和锁内完整提交（`transaction.setObj` + `state.acceptValue`），之后排队的本地编辑更新函数才会拿到锁并在该最新基线上重放，不会用过期的整页旧快照把刚接收的远端结果覆盖回去。
- **规则编辑器的现行机制（已无规则订阅）**：
  - 当前只有“个人规则 > 内置网站规则 > 全局规则”三层本地合并逻辑，已不存在规则订阅功能。
  - 页面内可视化规则编辑器（`RuleEditorSession`、`src/libs/ruleEditorSession.js`、`src/libs/ruleEditorStorage.js`）打开时，仅在本地调用 `resolveRuleContext` / `deriveRuleContext` 计算生效规则与继承链，不加写锁也不发网络请求；拾取元素、改写选择器、修改 `pattern` 与翻译预览都在内存草稿 `draft` 中进行，同时定时用 `getRulesWithDefault` 检查外部规则是否变更。
  - 点击保存时，才把 `{ href, patch, expected, seed, inherited }` 通过 `saveSiteRule` 提交到串行写队列 `writeSiteRule`（扩展环境下经 `MSG_EDIT_RULE` 由 `background.js` 统一串行处理，避免多标签页互相覆盖）。`writeSiteRule` 先在锁外校验 `href`、`pattern` 与补丁字段，再进入单个 `withTransaction` 调用 `transaction.saveEdit(STOKEY_RULES, ...)`，在锁内重新执行纯函数 `deriveRuleContext` 复核继承链、预期字段及 `pattern` 冲突后，通过 `checkRules` 合并落盘。事务内部**不发起网络请求，也不嵌套开启另一场存储事务**；只有落盘成功后，才在锁外调用 `trySyncRules()`。
  - 选项页规则设置（`useRules`）通过 `useStorage(STOKEY_RULES, ...)` 维护个人规则与 `*` 全局规则（配合 `ruleEditPatch` 保持稀疏写入）；弹窗和快捷操作则通过 `saveRule`（`MSG_SAVE_RULE`）调用 `saveEdit(STOKEY_RULES, ...)` 落盘后再触发 `trySyncRules()`。

## 平台边界

- **扩展后台协调器串行化**：在扩展环境（`isExt`）中，选项页、弹窗与内容脚本通过长连接端口 `browser.runtime.connect({ name: "kiss-storage-transaction" })` 向 `background.js` 安装的 `installStorageCoordinator` 申请写锁，后台以 FIFO 队列串行调度所有跨页面与后台自身的 `withStorageLock` 调用。同一非后台页面内的并发调用也会先在本页队列排队；后台进程自身则禁止在同一持锁调用栈内重入 `withStorageLock`。
- **已接收提交的完成保证与断连隔离**：协调器**不设置**“固定租约到期就打断在途写盘、放行下一个写入者”的机制。只要后台已经接收 `commit` 并启动 `pendingCommit`（`commitExtensionWrites`），即使客户端随后断连或超时，队列也会等待 `pendingCommit` 彻底落盘后才将锁交给下一个等待者。页面关闭或进入浏览器往返缓存（`pagehide` 且 `event.persisted === true`）时会主动断开连接；仅针对页面被冻结而未能执行 `pagehide` 的情况，后台设有 10 秒持锁兜底超时（`STORAGE_LOCK_HOLD_TIMEOUT_MS = 10000`）释放僵尸连接。无论是断连还是超时触发的释放，后台都会立即标记隔离状态（`disconnected` / `timedOut`），拒绝该旧连接随后迟到的 `commit`，确保失效页面不会覆盖后续写入。
- **无协调器环境显式报错**：协调写入依赖扩展后台。在没有协调器的非扩展环境（`!isExt`）中，调用 `withStorageLock` 会直接报错 `"Cross-page storage coordination is unavailable"`，而不会绕过串行化直接并发写入。
