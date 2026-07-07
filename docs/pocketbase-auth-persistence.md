# PocketBase 登录态持久化方案

## 目标

关闭浏览器后，用户下次打开应用时仍然保持登录。

## 方案

- 前端不再直接把登录态当作“内存态”。
- 新增同源 `/api/auth/*` 网关。
- 网关把 PocketBase 的 token 放进 `HttpOnly Cookie`。
- 前端启动时请求 `/api/auth/session`，由网关读取 Cookie 并调用 PocketBase `auth-refresh`。
- 登录成功后，前端只把会话保存在内存中。

## 你需要在腾讯云上做的事情

### 1. 启动 PocketBase

如果 PocketBase 已经在跑，这一步可以跳过。

### 2. 构建并启动 auth BFF

在项目根目录执行：

```bash
npm run auth:bff:build
npm run auth:bff:start
```

默认情况下，BFF 会监听 `127.0.0.1:3001`。

### 3. 配置 Nginx 反向代理

把下面这段加到你站点的 `server` 配置里：

```nginx
location /api/auth/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

### 4. 重新加载 Nginx

```bash
nginx -t
systemctl reload nginx
```

### 5. 验证

1. 打开应用，登录一次。
2. 关闭浏览器。
3. 重新打开浏览器并访问应用。
4. 如果网络和 PocketBase 正常，页面会自动恢复到已登录状态。

## 本地开发步骤

### 1. 启动 PocketBase

```bash
npm run pb:serve
```

### 2. 启动前端

```bash
npm run dev
```

开发环境下，Vite 会直接挂载同一套 `/api/auth/*` 网关处理器，不需要额外启动 `auth:bff:start`。

如果要验证服务器部署形态，可以单独运行：

```bash
npm run auth:bff:build
npm run auth:bff:start
```

默认情况下，独立 BFF 会监听 `127.0.0.1:3001`。

## HTTPS 之后怎么升级

等你申请到域名并启用 HTTPS 后，只需要做两件事：

1. 继续沿用现在这套 BFF 逻辑。
2. 把 BFF 的 Cookie `Secure` 打开。

如果你在 Nginx 里正确传了 `X-Forwarded-Proto: https`，BFF 会自动把 Cookie 设为 `Secure`。
