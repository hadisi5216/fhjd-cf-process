# API 服务

本目录是产品加工流程管理系统的 NestJS 后端，负责管理员认证、产品与工序管理、扫码枪 HTTP 接入、流转记录、预警、系统设置和大屏实时事件。

常用命令在仓库根目录执行：

```powershell
npm run dev:api
npm run build:api
npm test -w @fhjd-cf/api -- --runInBand
npm run prisma:generate
```

数据库、seed 和扫码接口调试见[开发说明](../../docs/开发说明.md)，接口与数据模型见[技术方案](../../docs/技术方案.md)。
