# Legal Translation Review System

专业的法律英语翻译审核系统，支持多模型协同翻译、智能审核和知识库增强。

> 本 README 已合并项目根目录下的所有文档（README.md、QUICKSTART.md、USAGE.md、EXAMPLES.md、PROJECT_SUMMARY.md），作为唯一入口文档便于查阅与维护。

---

## 项目概览与特性（原 README）

### 三阶段翻译工作流
- **阶段一：初始翻译** - 多个AI模型并行翻译
- **阶段二：审核评价** - 专业审核模型评判翻译质量并提供建议
- **阶段三：综合翻译** - 综合前两阶段结果，生成最优翻译

### 灵活的模型配置
- 支持自定义API端点、API Key、模型ID
- 可配置系统提示词、温度参数等
- 支持任意数量的模型组合
- 每个环节独立配置

### 知识库增强（RAG）
- 支持上传法律词典等参考文档
- 自定义嵌入模型
- 智能检索相关知识辅助翻译

### 简洁的用户界面
- 黑白色调，专业简约
- 对话式交互体验
- 实时查看各模型输出
- 直观的配置管理

### 项目结构

```
legal-translation-system/
├── frontend/              # Vue 3 前端应用
│   ├── src/
│   │   ├── components/   # UI组件
│   │   ├── views/        # 页面视图
│   │   ├── stores/       # 状态管理
│   │   ├── services/     # API服务
│   │   └── types/        # TypeScript类型
│   └── package.json
├── backend/              # Node.js 后端服务
│   ├── src/
│   │   ├── routes/       # API路由
│   │   ├── services/     # 业务逻辑
│   │   ├── models/       # 数据模型
│   │   └── utils/        # 工具函数
│   └── package.json
└── README.md
```

### 快速开始（简要）

前置要求：Node.js 18+；包管理器（pnpm 或 npm）

```bash
# 后端
cd backend && pnpm install
# 前端
cd ../frontend && pnpm install
```

开发模式：

```bash
cd backend && pnpm dev
cd frontend && pnpm dev
```

访问 http://localhost:5173 即可使用。

---

## 快速开始指南（原 QUICKSTART.md）

### 一键启动（推荐）

#### Linux / Mac
```bash
./start.sh
```

#### Windows
```bash
start.bat
```

启动脚本会自动：
1. 检查 Node.js 环境
2. 安装依赖（如果需要）
3. 创建配置文件
4. 启动后端和前端服务

启动后访问：http://localhost:5173

### 手动启动

#### 1. 安装依赖
```bash
# 后端
cd backend
npm install  # 或 pnpm install

# 前端
cd ../frontend
npm install  # 或 pnpm install
```

#### 2. 配置环境
```bash
cd backend
cp .env.example .env
# 根据需要编辑 .env 文件
```

#### 3. 启动服务

终端 1 - 后端：
```bash
cd backend
npm run dev
```

终端 2 - 前端：
```bash
cd frontend
npm run dev
```

#### 首次使用配置
- 进入 http://localhost:5173 → 模型配置 → 添加并“测试”模型；确保“已启用”。
- 可按文档示例配置多家模型与嵌入模型。

#### 常见问题（节选）
- 端口占用（3000/5173）→ 修改 backend/.env 或关闭占用进程
- 前端无法连后端 → 检查 `/api` 代理、健康检查、网络/防火墙

---

## 使用指南（原 USAGE.md）

### 安装与启动
（参见上文“快速开始指南/手动启动”）

### 模型配置与推荐
- 至少 1 个翻译模型（建议 2-3 个）
- 可选：审核/综合/嵌入模型

示例（OpenAI GPT-4）：
```
名称：GPT-4 翻译
阶段：翻译模型
API端点：https://api.openai.com/v1/chat/completions
API Key：sk-...
模型ID：gpt-4
系统提示词：专业法律翻译专家
温度：0.3
```

### 知识库（可选）
- 在“知识库”上传 TXT/PDF/DOCX/MD（≤10MB），选择嵌入模型后自动向量化

### 翻译流程
1. 主页输入文本 → 可选勾选“使用知识库增强”
2. 点击“开始翻译”
3. 系统按三阶段执行并展示结果
4. 历史记录页面可查看与检索历史

### FAQ（节选）
- 翻译慢：模型数量/响应速度/文本长度/知识库检索有关
- 仅用翻译模型？可以，阶段二/三可选

---

## 配置示例（原 EXAMPLES.md）

提供多家厂商与本地模型的典型 JSON 配置示例，包括：
- OpenAI（GPT-4/3.5、Embeddings）
- Anthropic Claude（需适配）
- Google Gemini（需适配）
- Ollama/LocalAI/vLLM 等 OpenAI 兼容端点

> 示例中均包含 `name/stage/apiEndpoint/apiKey/modelId/systemPrompt/temperature/maxTokens` 等关键字段，可直接复制到“模型配置”页面创建。

同时附带“系统提示词模板（翻译/审核/综合）”的基础版/详细版，便于快速落地。

---

## 项目完成总结（原 PROJECT_SUMMARY.md）

### 已完成功能
- 三阶段工作流 + 模型管理 + 知识库（RAG）+ 历史记录 + RESTful API
- 前端（Vue3/Pinia/Tailwind）与后端（Express/SQLite/TypeScript）完整实现
- 文档、脚本与示例齐备

### 结构与技术栈
- 详见“项目结构”“技术栈”章节，涵盖前后端目录、依赖与工具

### 亮点与限制
- 亮点：完整工作流、灵活配置、RAG增强、黑白简洁UI、类型安全
- 限制：向量存储内存实现、并发/缓存待优化、部分 API 需适配

### 未来规划
- 批量翻译/结果导出/术语表/进度指示/权限管理/多语言/统计追踪等

---

## 参考与许可

- 参考项目：
  - [ai-sdk-panel](https://github.com/MatrixAges/ai-sdk-panel)
  - [ai-elements-vue](https://github.com/vuepont/ai-elements-vue)

**License:** MIT

---

## 使用 Docker Compose 部署

本项目提供一键容器化部署：使用 Nginx 提供前端静态站点并反向代理 `/api` 到后端容器；后端使用 SQLite，数据与上传目录通过卷持久化。

### 前置要求
- Docker 20+
- Docker Compose v2（`docker compose` 子命令）

### 目录结构（与部署相关）
```
docker-compose.yml
backend/Dockerfile
frontend/Dockerfile
frontend/nginx.conf
```

### 启动
```bash
# 在项目根目录
docker compose build
docker compose up -d

# 访问：
http://localhost:8456
```

### 服务说明
- 前端：Nginx 容器默认暴露 8456 端口（可通过 `FRONTEND_PORT` 覆盖）；静态文件路径 `/usr/share/nginx/html`；`/api` 代理到 `backend:3000`。
- 后端：Node.js 服务监听 3000；默认 CORS 允许 `http://localhost:8456`（可通过 `CORS_ORIGIN` 覆盖）。
- 启动顺序：前端依赖后端健康检查（`/api/health`），可减少启动初期出现 `502 Bad Gateway` 的概率。
- 数据持久化：
  - SQLite 数据库：`volume backend-data → /app/data/database.sqlite`
  - 上传目录：`volume backend-uploads → /app/uploads`

### 常用操作
```bash
# 查看日志
docker compose logs -f backend
docker compose logs -f frontend

# 停止/启动
docker compose stop
docker compose start
docker compose down   # 仅移除容器，不删除卷

# 清理卷（谨慎）
docker compose down -v
```

### 环境变量（可在 docker-compose.yml 中覆盖）
- `PORT`（后端端口，默认 3000）
- `FRONTEND_PORT`（前端映射到宿主机端口，默认 `8456`）
- `CORS_ORIGIN`（前端地址，默认 `http://localhost:8456`）
- `DATABASE_PATH`（默认 `/app/data/database.sqlite`）
- `UPLOAD_DIR`（默认 `/app/uploads`）
- `MAX_FILE_SIZE`（默认 `10485760`）
