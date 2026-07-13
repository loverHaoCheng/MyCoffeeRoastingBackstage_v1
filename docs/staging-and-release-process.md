# 测试环境与发布流程

本文档用于规范 EasyBake 在服务器上的测试、验收和正式发布流程。目标是在不影响当前用户访问端的前提下，新增一套服务器测试入口，用于发布前验证登录、数据读写、HiBean 曲线、财务统计和 PocketBase 字段变更。

## 环境目标

- 保留当前正式环境作为用户访问入口。
- 新增服务器测试环境，测试通过后再发布到正式环境。
- 测试环境尽量接近正式环境，避免本地通过而服务器失败。
- 测试数据与正式数据隔离，避免发布前验证污染真实用户数据。

## 推荐拓扑

```text
正式环境：
https://easybake.top
  -> Nginx
  -> 正式前端静态目录
  -> 正式 BFF：127.0.0.1:3001
  -> 正式 PocketBase：127.0.0.1:8090

测试环境：
https://test.easybake.top
  -> Nginx
  -> 测试前端静态目录
  -> 测试 BFF：127.0.0.1:3002
  -> 测试 PocketBase：127.0.0.1:8091
```

如果暂时没有测试域名，也可以先使用服务器测试端口：

```text
http://服务器IP:5174
```

但该方式与正式 HTTPS 环境不完全一致。若 BFF Cookie 仍配置为 `Secure`，浏览器在 HTTP 下不会发送登录 Cookie，业务接口会出现 `401 Unauthorized`。因此，长期推荐使用 `https://test.easybake.top`。

## 域名与 ICP 备案判断

当前已备案或准备备案的域名是：

```text
easybake.top
```

测试域名建议使用三级域名：

```text
test.easybake.top
staging.easybake.top
```

备案判断口径：

- ICP 网站备案通常针对二级域名，例如 `easybake.top`。
- 二级域名完成网站 ICP 备案后，其下的三级、四级域名通常可以正常使用。
- `test.easybake.top` 属于 `easybake.top` 下的三级域名，通常不需要重新备案一个独立域名。
- 如果测试站长期公网开放、展示不同网站内容、或接入商要求补充网站信息，应按接入商和当地管局规则处理变更或新增网站信息。
- 测试环境建议增加访问限制，例如 Basic Auth、IP 白名单或临时账号，不建议作为公开产品入口长期暴露。

参考依据：腾讯云 ICP 备案文档说明，网站应用服务 ICP 备案只需要对二级域名备案，二级域名备案后对应三级域名、四级域名可以正常使用。

## 服务器目录约定

```text
/var/www/easybake
/var/www/easybake-releases
/var/www/easybake-staging
/var/www/easybake-staging-releases
/var/www/easybake-assets/community-qr.png

/opt/easybake-auth-bff
/opt/easybake-auth-bff-staging

/opt/pocketbase
/opt/pocketbase-staging
```

生产环境和测试环境不得共用 PocketBase 数据目录。测试环境可以从生产环境定期复制脱敏数据，也可以使用专门的测试账号手工构造数据。

正式站与测试站可共用只读的微信群二维码文件 `/var/www/easybake-assets/community-qr.png`。该文件不属于任一前端版本目录，使用本机 `./update_community_qr.sh <png-path>` 上传后立即生效，不需要重新发布任何环境。

## 端口约定

| 用途 | 正式环境 | 测试环境 |
| --- | --- | --- |
| 前端入口 | `443` | `443` 的 `test.easybake.top` 或临时 `5174` |
| BFF | `127.0.0.1:3001` | `127.0.0.1:3002` |
| PocketBase | `127.0.0.1:8090` | `127.0.0.1:8091` |

对公网优先只开放 `80/443`。BFF 和 PocketBase 端口默认只监听 `127.0.0.1`，由 Nginx 在服务器内反向代理。

## Cookie 配置原则

正式 HTTPS 环境：

```bash
COOKIE_SECURE=true
COOKIE_SAME_SITE=Lax
```

测试 HTTPS 环境：

```bash
COOKIE_SECURE=true
COOKIE_SAME_SITE=Lax
```

临时 HTTP 测试端口：

```bash
COOKIE_SECURE=false
COOKIE_SAME_SITE=Lax
```

如果在 HTTP 地址下看到接口返回 `401 Unauthorized`，并且响应头出现以下内容，通常说明登录 Cookie 没有被浏览器发送：

```text
Set-Cookie: easybake_pb_session=; Max-Age=0; Secure
```

此时优先改用 HTTPS 测试域名，或确认测试 BFF 不再给 HTTP Cookie 加 `Secure`。

## 测试环境首次搭建流程

### 人工操作

1. 在域名服务商处新增 DNS 记录：

```text
test.easybake.top -> 服务器公网 IP
```

2. 在服务器申请或配置 `test.easybake.top` 的 HTTPS 证书。

3. 在服务器新增测试 PocketBase 数据目录和服务：

```text
/opt/pocketbase-staging
127.0.0.1:8091
```

4. 在服务器新增测试 BFF 服务：

```text
/opt/easybake-auth-bff-staging
127.0.0.1:3002
```

5. 为测试 BFF 配置独立环境变量：

```bash
PB_BASE_URL=http://127.0.0.1:8091
PB_SUPERUSER_EMAIL=测试 PocketBase 管理员邮箱
PB_SUPERUSER_PASSWORD=测试 PocketBase 管理员密码
COOKIE_SECURE=true
```

6. 在 Nginx 中配置 `test.easybake.top`：

```text
/api/* -> 127.0.0.1:3002
/*     -> /var/www/easybake-staging
```

7. 首次启用 `deploy_test.sh` 前，将测试前端入口迁移为版本目录链接：

```text
/var/www/easybake-staging
  -> /var/www/easybake-staging-releases/bootstrap-<time>
```

`/var/www/easybake-staging-releases` 及其版本目录归部署用户维护；Nginx 始终读取 `/var/www/easybake-staging`，后续脚本通过原子替换该符号链接发布和回滚。此迁移只执行一次。

### 项目操作

1. 本地完成代码开发。

2. 本地执行质量检查：

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

3. 执行测试发布脚本：

```bash
./deploy_test.sh
```

脚本提示时输入测试站 Basic Auth 密码。密码仅用于本次公网验收，不写入项目文件。脚本复用正式发布的构建、发布锁、BFF 回滚、前端原子切换、版本清理和 HTTPS 验收机制，但目标固定为测试 BFF `3002`、测试前端入口 `/var/www/easybake-staging` 和测试版本目录 `/var/www/easybake-staging-releases`。

5. 打开测试地址：

```text
https://test.easybake.top
```

6. 使用测试账号完成发布前验收。

## 发布前验收清单

每次正式发布前，至少完成以下检查：

- 登录、登出、刷新后会话恢复正常。
- DevTools Network 中业务接口不是 `401`、`403` 或 `500`。
- 生豆创建、编辑、删除正常。
- 生豆库存批次创建后库存统计正常。
- 烘焙计划创建、编辑、删除正常。
- 烘焙记录创建、编辑、删除正常。
- 销售去向下的本次最终定价保存后不消失。
- 本次最终定价会计入财务已实现收入。
- HiBean JSON 可以导入、覆盖导入和展示曲线。
- RoR 只展示大于 0 的有效数据。
- 移动端无横向滚动，底部导航可正常切换。
- 生产构建访问 `/api/health` 正常。

## 正式发布流程

1. 确认测试环境验收通过。

2. 记录本次发布版本和变更摘要。

3. 执行正式发布脚本：

```bash
./deploy.sh
```

不得跳过 `./deploy_test.sh` 直接发布未在服务器测试环境验证的业务改动。`deploy_test.sh` 不会同步或修改正式 PocketBase 数据，`deploy.sh` 也不会把测试数据库回写正式环境。

4. 发布完成后进行生产冒烟测试：

```text
https://easybake.top
```

5. 生产冒烟测试至少包含：

- 登录。
- 首页或生豆页数据正常。
- 烘焙计划列表正常。
- 烘焙记录列表正常。
- 财务页数据正常。
- `/api/health` 正常。

## 回滚原则

如果测试环境失败：

- 不发布正式环境。
- 在测试环境修复后重新验收。

如果正式发布后失败：

- 优先使用 `deploy.sh` 保留的前端版本目录和 BFF 备份回滚。
- 回滚后再次检查 `/api/health`、登录和核心列表页。
- 若失败来自 PocketBase 字段变更，优先恢复字段兼容，不直接删除已有字段。

## 数据隔离原则

- 测试环境必须使用测试 PocketBase。
- 测试账号不得直接操作正式数据。
- 需要复现生产问题时，优先复制脱敏数据到测试 PocketBase。
- 测试环境中创建的 HiBean 曲线、烘焙记录、财务数据不得同步回正式库。

## 何时可以只用测试前端端口

以下情况可以临时只新增测试前端端口：

- 只验证纯 UI 样式。
- 不验证登录态。
- 不验证 PocketBase 字段。
- 不验证财务统计和库存联动。

只要涉及登录、业务数据、Cookie、BFF 或 PocketBase，都应使用完整测试链路：

```text
测试前端 -> 测试 BFF -> 测试 PocketBase
```
