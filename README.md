# ProbeDeck-lite-theme

> ProbeDeck（探针台）的第三方主题 —— 移植自 Guoba 探针面板的界面风格。
> 卡片 / 表格 / 点阵地图三视图 + 浅色简洁风格，纯静态、零外部 CDN 依赖。

移植自：Guoba 探针面板（浅色简洁风）

---

## 一、这是什么

ProbeDeck-lite-theme 是 [gg949/ProbeDeck](https://github.com/gg949/ProbeDeck/) 的一个第三方主题

原面板用 Leaflet + unpkg / jsdelivr 的 CDN 引用，ProbeDeck 的 CSP 不允许，因此本主题做了两处替换：

| 原面板 | 本主题 |
| --- | --- |
| Leaflet + `johan/world.geo.json`（CDN） | 本地生成的点阵世界地图 SVG（`assets/world-cells.json`，64 KB） |
| Chart.js CDN | Chart.js 本地化（`assets/chart.umd.js`） |

除此之外没有外部请求：旗帜走 `/flags/<code>.svg`、OS 图标走 `/os-icons/`（都是面板自带静态文件）。

---

## 二、功能

**三视图**（右上角切换，选择记忆在 localStorage）

- **卡片**：按地区分组（美洲 / 欧洲 / 亚洲 / 大洋洲），每张卡显示状态点、国旗、价格、剩余天数、总流量、
  更新时间、IPv4/IPv6 徽章、四线延迟，以及 CPU / 内存 / 存储三条进度条和 OS、TCP/UDP、实时网速
- **表格**：状态、名称、地区、系统、CPU、内存、存储、流量、下载、上传、更新时间，点击行进详情
- **地图**：点阵世界地图，有节点的地区高亮为绿色并显示节点数量

**外观**（固定浅色风格，与 Guoba 探针一致；右上角小齿轮图标为管理后台入口）

- 页头标题跟随后台「站点标题」（`/api/config` 的 `site_title`），无写死图标
- 全部颜色走 CSS 变量，卡片白底 + 12px 圆角 + 轻阴影

**详情页**（`#/server/:id`）

- 信息卡：运行时间、架构、系统、内核、CPU、Load、上传 / 下载、本月流量、启动时间、价格、到期时间、标签
- 五张实时曲线（Chart.js）：CPU、内存、进程数、网络速度（入 / 出）、TCP / UDP
- 磁盘使用进度条 + 已用 / 总量
- 延迟 / 丢包：电信、联通、移动、字节 + 四个自定义节点（`false` 显示 `--`，`null` 显示超时）
- 磁盘 IO：读取 / 写入速率、IOPS、await、利用率（探针不上报时显示"未上报"）
- GPU：逐个列出型号与占用

**实时性**

- 列表页：WebSocket `subscribe=all` 推送，断线自动回落 5 秒 REST 轮询
- 详情页：单服务器订阅 `subscribe=<id>` + 5 秒轮询兜底
- 页面切到后台时断开轮询，回到前台恢复（按 ProbeDeck 主题规范）

---

## 三、安装

### 1. 准备仓库

把本目录推到任意 GitHub 仓库，目录内容保持为：

```
<仓库根目录>/
├── index.html
└── assets/
    ├── app.js
    ├── chart.umd.js
    └── world-cells.json
```

> `build_world_cells.py` 是地图数据生成脚本，仅供维护，**不需要上传**。

分支名随意（`main`、`build`、`dist` 都行）。

### 2. 面板后台启用

ProbeDeck 后台 → **外观设置** → 主题地址（`theme_url`）填：

```
https://github.com/gg949/probedeck-lite-theme/tree/main
```

如果主题放在子目录里，就指到那一级：

```
https://github.com/<你的用户名>/<仓库名>/tree/<分支名>/probedeck-lite-theme
```

保存后刷新面板（必要时硬刷新 Ctrl+Shift+R）。主题资源在面板侧有缓存，没生效就重启面板容器。

> 注意：地址必须是 `https://github.com/<user>/<repo>/tree/<ref>` 形式，面板只认这个格式；
> 同一个页面里如果区域筛选、卡片显示为空，先确认 `/api/servers` 能正常返回数据。

---

## 四、自定义

### 改标题

后台外观设置里的「站点标题」会同时覆盖浏览器标题和页面内的大标题（`/api/config` 的 `site_title`），无需改代码。

### 改主题色

所有颜色都是 CSS 变量，集中在 `index.html` 顶部的 `:root` 里：

```css
:root{
  --bg:#f9fafb;        /* 页面背景 */
  --card:#ffffff;      /* 卡片背景 */
  --accent:#3b82f6;    /* 强调色（进度条/按钮/链接） */
  --green:#10b981;     /* 在线 / 下载 */
  --red:#ef4444;       /* 离线 / 超时 */
  ...
}
```

改完直接 push，面板重新拉取即生效。

### 重新生成地图数据

地图点阵由 `build_world_cells.py` 从 `johan/world.geo.json` 光栅化而来（1.25° 网格、point-in-polygon）。
需要更新底图或调整粒度时改脚本顶部的 `STEP` 再跑：

```bash
# 1. 下载源数据（一次性）
curl -o countries.geo.json https://cdn.jsdelivr.net/gh/johan/world.geo.json@master/countries.geo.json

# 2. 生成
python3 build_world_cells.py countries.geo.json assets/world-cells.json
```

输出格式是 `{ "US": [[gx,gy],...], ... }`，`gx/gy` 是格号，渲染时按 `1.25°` 换算成坐标。
香港 / 澳门 / 新加坡因为面积小于一个网格，在脚本里用 `extra` 字典手动补了点。

---

## 五、目录说明

```
probedeck-lite-theme/
├── index.html                 # 入口：全部 CSS + <div id="app"> 容器 + 两个 script 引用
├── assets/
│   ├── app.js                 # 全部逻辑：hash 路由、API、WebSocket、三视图渲染、地图、图表
│   ├── chart.umd.js           # Chart.js v4.5.1 UMD 版（本地化）
│   └── world-cells.json       # 点阵世界地图数据（152 个国家 / 地区、7415 个格子）
├── build_world_cells.py       # 地图数据生成脚本（不上传）
└── README.md                  # 本文件
```

### 用到的 ProbeDeck 接口

| 接口 | 用途 |
| --- | --- |
| `GET /api/config` | 站点标题、版本号、三网显示名、自定义节点名、延迟窗口参数 |
| `GET /api/servers` | 列表数据 + 聚合统计 + `sysConfig` 显示开关 |
| `GET /api/server?id=` | 详情页初始数据 |
| `GET /api/history/all?id=&hours=24` | 详情页历史曲线（默认 24h） |
| `WS /api/ws?subscribe=all` | 列表页实时推送 |
| `WS /api/ws?subscribe=<id>` | 详情页实时推送 |

未登录访客的历史范围受面板 `public_history_hours` 限制（默认 24 小时）；
本主题不实现登录页，管理入口直接跳 `/admin#admin`。

### 字段口径（和探针上报单位对齐）

- `ram_used` / `ram_total` / `disk_used` / `disk_total` / `swap_*` 单位是 **MB**，展示时 × 1048576 再格式化
- `net_rx` / `net_tx` / `net_rx_monthly` / `net_tx_monthly` 单位是**字节**
- `net_in_speed` / `net_out_speed` 单位是 **B/s**
- 延迟丢包：`false` = 未配置 / 未上报 → 显示 `--`；`null` = 探测超时 → 显示超时；`0` 是有效值，正常显示

---

## 六、已知限制

- 地图是点阵风格，不是 Leaflet 那种可缩放矢量地图（换 Leaflet 需要面板 CSP 放行 unpkg，没做）
- 地图按**国家 / 地区**粒度统计节点数，不显示单台机器的精确坐标（ProbeDeck 不上报经纬度）
- 详情页历史曲线固定取最近 24 小时，没有做时间范围切换（原面板也没有）
- 表格视图没有按列排序（原面板也没有）

---

## 七、许可

跟随 ProbeDeck 主项目（MIT）。
Chart.js 为 MIT；地图源数据 `johan/world.geo.json` 为 MIT。
