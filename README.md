# MiMo Credits Widget

<div align="center">

![Electron](https://img.shields.io/badge/Electron-35-blue?style=flat-square&logo=electron)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow?style=flat-square&logo=javascript)
![Platform](https://img.shields.io/badge/Platform-Windows-lightgrey?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

**MiMo 积分使用情况桌面小组件**

一个轻量级的 Electron 桌面应用，用于实时显示 MiMo 平台的 Token 使用情况。

[功能特性](#功能特性) · [安装指南](#安装指南) · [使用方法](#使用方法) · [配置说明](#配置说明)

</div>

---

## 功能特性

- 🖥️ **桌面悬浮窗** - 始终置顶，不影响工作
- 📊 **实时数据** - 自动刷新积分使用情况
- 📈 **可视化进度条** - 直观显示使用百分比
- 🔄 **自动重试** - 网络异常时自动重试
- 📝 **日志系统** - 完整的日志记录和轮转
- 🎨 **圆角窗口** - 精美的 UI 设计
- ⚡ **轻量高效** - 低内存占用

## 截图

<div align="center">
<img src="refactor-preview-final.png" alt="MiMo Credits Widget Preview" width="300">
</div>

## 安装指南

### 前置要求

- Windows 10/11
- Node.js 18+ (推荐使用 LTS 版本)
- Google Chrome 浏览器
- WSL (Windows Subsystem for Linux)

### 安装步骤

1. **克隆仓库**
   ```bash
   git clone https://github.com/VimRev/MiMo-Credits-Widget.git
   cd MiMo-Credits-Widget
   ```

2. **安装依赖**
   ```bash
   cd widget
   npm install
   ```

3. **配置 WSL 服务**

   在 WSL 中运行 MiMo 积分服务（默认端口 19220）：
   ```bash
   # 在 WSL 中
   python3 ~/mimo-credits-service.py
   ```

4. **启动应用**

   双击运行 `start-mimo-widget.bat` 或在命令行执行：
   ```bash
   start-mimo-widget.bat
   ```

## 使用方法

### 启动应用

```bash
# 方式 1: 使用启动脚本（推荐）
start-mimo-widget.bat

# 方式 2: 手动启动
cd widget
npx electron .
```

### 界面说明

| 区域 | 说明 |
|------|------|
| **顶部** | 计划名称和到期日期 |
| **进度条** | Token 使用百分比 |
| **统计** | 剩余额度、预估 Token 数、余额 |
| **状态指示灯** | 🟢 正常 / 🟡 缓慢 / 🔴 错误 |

### 状态指示灯

| 颜色 | 状态 | 说明 |
|------|------|------|
| 🟢 绿色 | 正常 | 数据更新正常 |
| 🟡 黄色 | 缓慢 | 数据超过 2 个周期未更新 |
| 🔴 红色 | 错误 | 连接失败或请求超时 |

## 配置说明

### 主配置文件

编辑 `widget/config.js` 可修改以下配置：

```javascript
module.exports = {
  // 数据服务端点
  serviceUrl: 'http://127.0.0.1:19220/api/credits',
  
  // 自动刷新间隔（毫秒）
  refreshInterval: 30000,
  
  // 请求超时时间（毫秒）
  requestTimeout: 10000,
  
  // 窗口尺寸
  window: {
    width: 268,
    height: 176,
    yOffset: 0,  // 距离屏幕顶部的偏移量
  },
};
```

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `ELECTRON_LOG_DIR` | 日志目录 | `%APPDATA%/MiMo-Credits-Widget/logs` |
| `SERVICE_PORT` | 服务端口 | `19220` |
| `CHROME_CDP_PORT` | Chrome CDP 端口 | `9224` |

### 日志配置

日志文件存储在 `%APPDATA%/MiMo-Credits-Widget/logs/` 目录：

- 日志级别：DEBUG, INFO, WARN, ERROR
- 单文件最大：5MB
- 保留文件数：7 个
- 敏感信息自动脱敏

## 项目结构

```
MiMo-Credits-Widget/
├── .gitignore
├── README.md
├── start-mimo-widget.bat    # 启动脚本
├── open-mimo-login-chrome.bat
├── HERMES_FIX_INSTRUCTIONS.md
├── refactor-preview-final.png
└── widget/                  # Electron 应用
    ├── config.js            # 配置文件
    ├── main.js              # 主进程
    ├── preload.js           # 安全桥接
    ├── renderer.js          # 渲染进程
    ├── logger.js            # 日志模块
    ├── index.html           # UI 结构
    ├── style.css            # 样式表
    └── package.json         # 依赖配置
```

## 技术架构

```
┌─────────────────────────────────────────────────────┐
│                  start-mimo-widget.bat               │
│  启动 WSL 服务 → 健康检查 → 启动 Electron           │
└─────────────────────────┬───────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────┐
│                 Main Process (main.js)               │
│  - 创建窗口                                          │
│  - IPC 通信                                          │
│  - 日志管理                                          │
└─────────────────────────┬───────────────────────────┘
                          │ contextBridge
┌─────────────────────────▼───────────────────────────┐
│                 Preload (preload.js)                 │
│  - widgetAPI.close()                                 │
│  - widgetAPI.getConfig()                             │
│  - widgetAPI.log()                                   │
└─────────────────────────┬───────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────┐
│               Renderer Process (renderer.js)         │
│  - 数据获取 (fetch)                                  │
│  - UI 更新                                           │
│  - 错误处理                                          │
└─────────────────────────┬───────────────────────────┘
                          │ HTTP
┌─────────────────────────▼───────────────────────────┐
│              WSL Python Service (19220)              │
│  - MiMo API 代理                                     │
│  - Chrome CDP 集成                                   │
└─────────────────────────────────────────────────────┘
```

## 开发指南

### 本地开发

```bash
# 进入 widget 目录
cd widget

# 安装依赖
npm install

# 启动开发模式
npx electron .
```

### 查看日志

```bash
# 查看实时日志
tail -f %APPDATA%\MiMo-Credits-Widget\logs\mimo-*.log
```

### 调试模式

```bash
# 启用调试输出
set NODE_ENV=development
npx electron .
```

## 常见问题

### Q: 启动后显示"本地服务未启动"

A: 确保 WSL 中的 MiMo 服务正在运行：
```bash
# 在 WSL 中检查
curl http://127.0.0.1:19220/api/credits
```

### Q: 窗口无法置顶

A: 检查 Windows 设置中是否允许应用置顶显示。

### Q: 数据不更新

A: 检查网络连接和服务状态，查看日志文件获取详细错误信息。

### Q: 如何修改刷新间隔

A: 编辑 `widget/config.js` 中的 `refreshInterval` 值（单位：毫秒）。

## 更新日志

### v3.0.0 (2026-05-31)
- ✨ 添加日志系统
- ⚡ 优化圆角窗口性能
- 🐛 修复内存泄漏
- 🔄 添加错误重试机制
- 📊 修复百分比计算

### v2.0.0
- 🎨 重构 UI 设计
- 📈 添加进度条可视化
- 🔧 优化配置管理

### v1.0.0
- 🎉 初始版本

## 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 致谢

- [Electron](https://www.electronjs.org/) - 桌面应用框架
- [MiMo](https://mimo.ai) - AI 编程助手

## 联系方式

- GitHub: [@VimRev](https://github.com/VimRev)
- Issues: [GitHub Issues](https://github.com/VimRev/MiMo-Credits-Widget/issues)

---

<div align="center">

**如果这个项目对你有帮助，请给一个 ⭐ Star 支持一下！**

</div>