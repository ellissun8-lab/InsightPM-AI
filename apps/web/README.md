# ProofLoop Web Application

> AI 驱动的用户反馈分析工具 - Web 前端应用

---

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

### 构建生产版本

```bash
npm run build
npm start
```

---

## 存储模式

ProofLoop 支持两种存储模式，通过环境变量 `PROOFLOOP_STORAGE_MODE` 控制：

### Local Mode（默认）

```env
PROOFLOOP_STORAGE_MODE=local
```

- 使用本地 `runs/`、`training-data/`、`evaluation-data/` 目录
- 适合本地开发和 Demo
- 分析结果存储在文件系统

### Cloud Mode

```env
PROOFLOOP_STORAGE_MODE=cloud
```

- 使用 Supabase Postgres 存储数据
- 使用 Supabase Storage 存储文件
- 适合 Vercel 部署
- 需要配置 Supabase 环境变量

---

## 环境变量

创建 `.env.local` 文件（参考 `.env.example`）：

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Storage Mode
PROOFLOOP_STORAGE_MODE=local  # local | cloud

# AI Provider
OPENAI_API_KEY=sk-xxx
DEEPSEEK_API_KEY=sk-xxx
ANTHROPIC_API_KEY=sk-ant-xxx

# App Configuration
APP_URL=http://localhost:3000
```

**⚠️ 安全注意事项**：
- `SUPABASE_SERVICE_ROLE_KEY` 只在服务端使用，不要暴露给客户端
- 不要提交真实的 `.env` 文件到 Git
- 使用 Vercel Environment Variables 配置生产环境

---

## 主要路由

| 路由 | 页面 | 说明 |
|------|------|------|
| `/` | 官网首页 | 产品介绍、营销展示 |
| `/login` | 登录页 | Demo 登录入口 |
| `/signup` | 注册页 | 账号注册（Demo 模式） |
| `/dashboard` | 控制台 | 运行概览、最近运行、统计卡片 |
| `/new-analysis` | 新建分析 | 上传 CSV、配置参数、触发分析 |
| `/runs` | 运行历史 | 所有分析运行的完整列表 |
| `/runs/[caseName]` | 运行详情 | 单个运行的详细信息 |
| `/analysis-report` | 分析报告 | 报告查看、分组切换 |
| `/analysis-report/print` | 打印页面 | PDF 导出专用 |
| `/training-data` | 训练数据 | 数据集管理、字段配置 |
| `/evaluation` | 评估校验 | 评估结果查看 |
| `/settings` | 系统设置 | 工作区、引擎、验证、场景、API 密钥 |

---

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Next.js | 14.x | React 框架 (App Router) |
| React | 18.x | UI 库 |
| TypeScript | 5.x | 类型安全 |
| Tailwind CSS | 3.x | 样式框架 |
| Supabase | - | Auth + Postgres + Storage |
| Lucide React | - | 图标库 |

---

## 项目结构

```
src/
├── app/                    # Next.js App Router 页面
│   ├── api/                # API Routes
│   ├── dashboard/          # 控制台页面
│   ├── new-analysis/       # 新建分析页面
│   ├── runs/               # 运行历史页面
│   ├── analysis-report/    # 分析报告页面
│   ├── training-data/      # 训练数据页面
│   ├── evaluation/         # 评估校验页面
│   ├── settings/           # 系统设置页面
│   ├── login/              # 登录页面
│   ├── signup/             # 注册页面
│   └── marketing/          # 营销页面（重定向）
├── components/             # React 组件
│   ├── Sidebar.tsx         # 侧边栏导航
│   ├── StatusBadge.tsx     # 状态徽章
│   ├── DashboardToolbar.tsx # 控制台工具栏
│   └── TodayOverview.tsx   # 今日概览
├── lib/                    # 工具函数
│   ├── supabase/           # Supabase 客户端
│   │   ├── client.ts       # 浏览器端客户端
│   │   ├── server.ts       # 服务端客户端
│   │   └── admin.ts        # 管理员客户端
│   ├── data/               # 数据仓库层
│   │   ├── storage-mode.ts # 存储模式判断
│   │   ├── runs-repository.ts
│   │   ├── training-repository.ts
│   │   ├── settings-repository.ts
│   │   ├── scenarios-repository.ts
│   │   └── artifacts-repository.ts
│   ├── run-status.ts       # 运行状态判断
│   ├── format.ts           # 格式化工具
│   ├── report-display.ts   # 报告显示
│   └── dashboard-filter.ts # 控制台过滤
└── styles/                 # 样式文件
```

---

## API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/runs` | GET | 获取所有运行数据（支持 local/cloud） |
| `/api/training-data` | GET | 获取训练数据统计（支持 local/cloud） |
| `/api/upload` | POST | 上传反馈文件 |
| `/api/storage/upload` | POST | 上传到 Supabase Storage（cloud 模式） |
| `/api/analyze` | POST | 触发分析流程 |
| `/api/runs/[caseName]` | GET | 获取单个运行详情 |
| `/api/runs/[caseName]/report` | GET | 获取运行报告 |
| `/api/runs/[caseName]/validation` | GET | 获取校验结果 |
| `/api/runs/[caseName]/download` | GET | 下载运行产物 |

---

## Demo 注意事项

### ⚠️ 当前为 Demo 模式

1. **无真实登录后端**
   - 登录页面直接跳转到控制台
   - 无需输入真实账号密码
   - 任意邮箱/密码即可登录
   - 真实 Auth 将在后续版本接入 Supabase Auth

2. **数据本地存储（Local Mode）**
   - API 密钥存储在 localStorage
   - 自定义场景仅在页面 state 中
   - 清除浏览器数据会丢失配置
   - 分析结果存储在 `runs/` 目录

3. **Cloud Mode 限制**
   - `/api/runs` 可以读取 Supabase runs 表
   - `/api/upload` 可以上传到 Supabase Storage
   - `/api/analyze` cloud worker 尚未实现
   - 真实 Auth 仍在规划中

4. **AI 模型调用**
   - 需要配置 API 密钥（设置 → API 密钥）
   - 支持 OpenAI、Anthropic、DeepSeek
   - 未配置时使用模拟数据

---

## 开发指南

### 添加新页面

1. 在 `src/app/` 下创建目录
2. 添加 `page.tsx` 文件
3. 如需 API，在 `api/` 下创建 `route.ts`

### 添加新组件

1. 在 `src/components/` 下创建文件
2. 使用 TypeScript 定义 Props
3. 遵循 Renance 暖色风格

### 数据访问

使用 Repository 层访问数据：

```typescript
import { getRuns } from "@/lib/data/runs-repository";

// 自动根据 PROOFLOOP_STORAGE_MODE 切换 local/cloud
const runs = await getRuns();
```

### 状态管理

- 使用 React `useState`/`useEffect`
- 复杂状态考虑 `useReducer`
- 避免过度使用全局状态

### 样式规范

- 使用 Tailwind CSS 类名
- 遵循 Renance 暖色系统
- 主要颜色：`#FFFCF5`, `#EFE4CC`, `#E5DED0`
- 主要文字：`#14120F`, `#6F6A5F`

---

## 部署

### Vercel 部署

参考 [Vercel + Supabase 部署指南](../../docs/vercel-supabase-deployment.md)

### 环境变量配置

在 Vercel 项目设置中配置：

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key |
| `PROOFLOOP_STORAGE_MODE` | `local` 或 `cloud` |
| `OPENAI_API_KEY` | OpenAI API Key |
| `DEEPSEEK_API_KEY` | DeepSeek API Key |

---

## 常见问题

### Q: 页面白屏怎么办？

A: 检查以下：
1. 是否运行 `npm install`
2. 是否运行 `npm run dev`
3. 控制台是否有错误
4. 端口 3000 是否被占用

### Q: 分析失败怎么办？

A: 检查以下：
1. 是否配置了 API 密钥
2. 网络是否正常
3. CSV 格式是否正确
4. 查看控制台错误信息

### Q: Cloud Mode 连接失败？

A: 检查以下：
1. Supabase 环境变量是否正确
2. Supabase 项目是否暂停（免费版 7 天不活动会暂停）
3. 网络是否正常
4. 查看 Vercel 日志

### Q: 数据丢失怎么办？

A: 
- **Local Mode**: 分析结果存在 `runs/` 目录，建议定期备份
- **Cloud Mode**: 数据存储在 Supabase，有自动备份

---

## 相关文档

- [MVP Freeze Summary](../../docs/mvp-freeze-summary.md)
- [Demo Script](../../docs/demo-script.md)
- [Cloud Schema](../../docs/cloud-schema.sql)
- [Storage Plan](../../docs/storage-plan.md)
- [Auth Plan](../../docs/auth-plan.md)
- [Vercel + Supabase 部署](../../docs/vercel-supabase-deployment.md)

---

## 许可证

Proprietary - ProofLoop Team

---

*最后更新: 2026-06-24*
