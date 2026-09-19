# ========== 阶段1：构建（用 Node 镜像编译前端静态文件） ==========
FROM node:20-alpine AS builder
WORKDIR /app

# 先拷依赖清单，利用 Docker 层缓存：依赖不变就不重新 npm ci
COPY package*.json ./
RUN npm ci

# 再拷入源码并打包
COPY . .
RUN npm run build

# ========== 阶段2：托管（用 nginx 提供静态文件 + 反向代理 /api） ==========
FROM nginx:1.27-alpine
ENV TZ=Asia/Shanghai

# 把构建产物放进 nginx 默认目录
COPY --from=builder /app/dist /usr/share/nginx/html
# 自定义 nginx 配置（含 /api 反向代理和 SPA 路由兜底）
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
