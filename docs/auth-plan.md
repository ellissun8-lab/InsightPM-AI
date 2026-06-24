# ProofLoop Auth Plan

> **版本**: 1.0.0  
> **日期**: 2026-06-24  
> **状态**: Cloud Foundation 阶段（规划文档）

---

## 一、当前状态

### 1.1 登录注册

- `/login` 页面是 Demo UI
- 不接真实 Auth 后端
- 任意邮箱/密码直接跳转到 `/dashboard`
- `/signup` 页面显示"正式账号系统将在 SaaS 版本启用"

### 1.2 用户管理

- 无真实用户系统
- 无 session 管理
- 无权限控制

---

## 二、目标架构

### 2.1 Supabase Auth

- 使用 Supabase Auth 提供 email/password 登录
- 支持 magic link（可选）
- 支持 OAuth（Google、GitHub，后续）

### 2.2 用户流程

```
/signup
  ↓
创建 Supabase Auth 用户
  ↓
创建 workspace (name = "{email} 的工作区")
  ↓
创建 workspace 成员关系
  ↓
跳转 /dashboard

/login
  ↓
Supabase Auth 登录
  ↓
获取 session
  ↓
跳转 /dashboard

/logout
  ↓
清除 session
  ↓
跳转 /login
```

---

## 三、路由权限

### 3.1 公开路由（无需登录）

| 路由 | 说明 |
|------|------|
| `/` | 官网首页 |
| `/marketing` | 营销页（重定向到 `/`） |
| `/login` | 登录页 |
| `/signup` | 注册页 |

### 3.2 受保护路由（需要登录）

| 路由 | 说明 |
|------|------|
| `/dashboard` | 控制台 |
| `/new-analysis` | 新建分析 |
| `/runs` | 运行历史 |
| `/runs/[caseName]` | 运行详情 |
| `/analysis-report` | 分析报告 |
| `/analysis-report/print` | 打印页面 |
| `/training-data` | 训练数据 |
| `/evaluation` | 评估校验 |
| `/settings` | 系统设置 |

---

## 四、Middleware 实现

### 4.1 Supabase Middleware

```typescript
// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          res.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          res.cookies.delete({ name, ...options })
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  // Public routes
  const publicRoutes = ['/', '/marketing', '/login', '/signup']
  if (publicRoutes.includes(req.nextUrl.pathname)) {
    return res
  }

  // Demo mode bypass
  if (process.env.PROOFLOOP_DEMO_KEY) {
    const demoKey = req.headers.get('x-demo-key')
    if (demoKey === process.env.PROOFLOOP_DEMO_KEY) {
      return res
    }
  }

  // Protected routes - require session
  if (!session) {
    const redirectUrl = req.nextUrl.clone()
    redirectUrl.pathname = '/login'
    redirectUrl.searchParams.set('redirect', req.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  return res
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/new-analysis/:path*',
    '/runs/:path*',
    '/analysis-report/:path*',
    '/training-data/:path*',
    '/evaluation/:path*',
    '/settings/:path*',
  ],
}
```

---

## 五、Workspace 设计

### 5.1 Workspace 创建

- 用户注册时自动创建默认 workspace
- Workspace name = "{email} 的工作区"
- 用户可以创建多个 workspace（后续）

### 5.2 Workspace 关联

所有数据都关联到 workspace_id：

- runs.workspace_id
- training_datasets.workspace_id
- custom_scenarios.workspace_id
- workspace_settings.workspace_id
- api_key_settings.workspace_id

### 5.3 Workspace 成员

```sql
create table if not exists workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text default 'member',
  created_at timestamptz default now()
);

create unique index if not exists idx_workspace_members_unique 
on workspace_members(workspace_id, user_id);
```

---

## 六、Demo Mode

### 6.1 环境变量

```
PROOFLOOP_DEMO_KEY=your-demo-key
```

### 6.2 使用方式

- 前端在请求头中添加 `x-demo-key: {demo-key}`
- Middleware 检查 header，如果匹配则跳过 Auth
- 适用于演示、测试、开发环境

### 6.3 Demo 用户

- Demo 模式下创建一个虚拟 workspace
- 所有 Demo 数据关联到这个 workspace
- 不需要真实 Auth 用户

---

## 七、Session 管理

### 7.1 Session 存储

- 使用 Supabase Auth 的 session
- 存储在 httpOnly cookie 中
- 自动刷新 token

### 7.2 Session 有效期

- Access Token: 1 小时
- Refresh Token: 7 天
- 自动续期

---

## 八、实施计划

### Phase 1: 基础准备（当前）

- [x] 创建 Supabase client 文件
- [x] 规划 Auth 架构
- [ ] 创建 workspace_members 表
- [ ] 更新 cloud-schema.sql

### Phase 2: Auth 集成（下一步）

- [ ] 安装 `@supabase/ssr`
- [ ] 实现 middleware.ts
- [ ] 修改 `/login` 接入 Supabase Auth
- [ ] 修改 `/signup` 接入 Supabase Auth
- [ ] 添加 logout 功能

### Phase 3: Workspace 集成

- [ ] 注册时创建 workspace
- [ ] API Route 读取当前用户 workspace
- [ ] 所有数据关联 workspace_id

### Phase 4: 权限控制

- [ ] Workspace 成员管理
- [ ] 角色权限（owner、admin、member、viewer）
- [ ] 数据隔离

---

## 九、安全注意事项

### 9.1 环境变量

- `SUPABASE_SERVICE_ROLE_KEY` 只在服务端使用
- 不要在客户端暴露 service role key
- 使用 Vercel Environment Variables 存储

### 9.2 RLS (Row Level Security)

- 所有表都应该启用 RLS
- 用户只能访问自己 workspace 的数据
- Service role 可以绕过 RLS

### 9.3 CORS

- 只允许 Vercel 域名访问
- 不允许跨域请求

---

*本文档在 Cloud Foundation 阶段创建，后续根据实施情况更新。*
