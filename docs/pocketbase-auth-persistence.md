# PocketBase 登录态持久化方案

## 目标

关闭浏览器后，用户下次打开应用时仍然保持登录。

## 方案

- 前端不再直接把登录态当作“内存态”。
- 新增同源 `/api/auth/*` 网关。
- 网关把 PocketBase 的 token 放进 `HttpOnly Cookie`。
- 前端启动时请求 `/api/auth/session`，由网关读取 Cookie 并调用 PocketBase `auth-refresh`。
- 登录、会话恢复和昵称更新只返回公开用户资料，绝不将 PocketBase Token 返回给浏览器。
- 所有主库业务请求和 `/api/realtime` 订阅均通过 BFF 白名单代理；BFF 从 Cookie 读取 Token 后再访问 PocketBase。
- BFF 代码按领域拆分在 `server/auth-bff/`，入口 `server/pocketbase-auth-bff.ts` 只负责路由 handler 组装、异常兜底与独立服务启动。

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

`PB_BASE_URL` 仅用于 BFF 进程访问 PocketBase，上游默认值和生产环境显式配置都应为 `http://127.0.0.1:8090`。前端开发代理使用 `VITE_DEV_API_PROXY_TARGET=https://www.easybake.top` 访问 BFF，这是浏览器入口地址，不能复制给 `PB_BASE_URL`。

日常发布优先使用项目根目录的 `./deploy.sh`。脚本先保存前端构建快照，再构建、上传和验证 BFF；BFF 以整个 `dist/server/` 目录发布，探测失败时自动恢复前一个目录并重启旧服务，只有 BFF 成功后才发布前端。前端会先上传至独立版本目录，再原子切换 Nginx 的入口链接；公网验收失败时自动切回上一版本。静态入口目录保持 `755`，确保 Nginx 可读取资源。它会验证本机与公网的无凭据认证端点均返回 `400`。

前端发布目录默认最多保留 `5` 个版本：`/var/www/easybake` 当前链接和 `/var/www/easybake.previous` 回退链接所指向的版本绝不参与清理，其余版本按修改时间保留最新版本，超过数量的目录只会在公网验收成功后删除。可通过 `FRONTEND_RELEASES_TO_KEEP` 覆盖总保留数，最小为 `2`。如服务器目录、服务名或 SSH 主机不同，可设置 `BFF_REMOTE_TARGET`、`BFF_REMOTE_PATH`、`BFF_SERVICE_NAME`、`REMOTE_SSH_TARGET`、`FRONTEND_RELEASES_PATH`、`FRONTEND_CURRENT_LINK`、`FRONTEND_REMOTE_SSH_TARGET` 覆盖默认值。

脚本在上传 BFF 前使用 `FRONTEND_RELEASES_PATH/.easybake-deploy.lock` 获取服务器范围的发布锁。锁已存在时，后发任务立即退出，不会覆盖 BFF 的 `.next/.previous` 文件或前端入口；锁的 `owner` 文件会显示持有者、创建时间、最后更新时间和当前阶段。完成发布或异常退出时，脚本只会释放与自己 owner 匹配的锁，避免误解锁其他发布任务。锁路径可通过 `FRONTEND_DEPLOY_LOCK_PATH` 覆盖。

若发布电脑被强制关闭或网络中断，锁可能遗留。脚本不会按时间自动抢占，以免误伤仍在运行的发布。先确认原发布终端已停止，再在服务器执行以下受控恢复；不要使用通配符或删除 `easybake-releases` 目录：

```bash
cat /var/www/easybake-releases/.easybake-deploy.lock/owner
rm -f /var/www/easybake-releases/.easybake-deploy.lock/owner
rmdir /var/www/easybake-releases/.easybake-deploy.lock
```

### 3. 配置 Nginx 反向代理

把下面这段加到你站点的 `server` 配置里：

```nginx
location ^~ /api/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;
    proxy_read_timeout 360s;
}
```

`/api/*` 必须全部由 BFF 承接，避免浏览器直连 PocketBase 或暴露 Token。BFF 的 `PB_BASE_URL` 必须指向 PocketBase 的内网地址，例如 `http://127.0.0.1:8090`，不得填写站点公网域名，否则会形成代理循环。

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

## 开发环境步骤

### 1. 启动前端

```bash
npm run dev
```

开发环境下，Vite 会把同源 `/api/*` 请求代理到云端 BFF，不再挂载或启动本地 BFF。前提是服务器上的 PocketBase 与云端 BFF 已可访问。

本地 `.env.local` 只需要保留非敏感前端配置：

```bash
VITE_API_BASE_URL=/api
VITE_DEV_API_PROXY_TARGET=https://www.easybake.top
```

不要在本地 `.env.local` 写入 `PB_SUPERUSER_EMAIL`、`PB_SUPERUSER_PASSWORD`、`QINIU_QWEN_API_KEY` 等服务端密钥。

如果要在服务器上验证 BFF 部署形态，可以在云端 BFF 目录运行：

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
