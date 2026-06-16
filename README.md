# 小红书→AI文案生成器

Chrome 浏览器插件，一键提取小红书笔记内容，直接调用 AI 生成文案。

## 功能

- 📖 **一键提取**：在小红书笔记页面自动抓取标题、正文、作者、标签
- 🤖 **AI 生成**：直接调用 Claude / GPT / DeepSeek 等模型生成文案
- 📋 **一键复制**：生成的文案一键复制到剪贴板
- 🎨 **多文案类型**：小红书 / 朋友圈 / 短视频脚本 / 公众号文章
- 🔌 **多提供商**：支持 Anthropic、OpenAI、DeepSeek 及任何 OpenAI 兼容接口

## 安装

1. 打开 Chrome，地址栏输入 `chrome://extensions`
2. 右上角开启「开发者模式」
3. 左上角点「加载已解压的扩展程序」
4. 选择本文件夹
5. 点插件图标 → ⚙️ → 填入 API Key → 保存

## 使用

```
打开小红书笔记 → 点插件图标 → 选文案类型 → 点「AI 生成文案」→ 复制
```

## API Key 获取

| 提供商 | 获取地址 |
|--------|---------|
| Anthropic | https://console.anthropic.com/settings/keys |
| OpenAI | https://platform.openai.com/api-keys |
| DeepSeek | https://platform.deepseek.com/api_keys |

## 文件结构

```
├── manifest.json    # 插件配置
├── content.js       # 页面内容提取（在小红书页面运行）
├── popup.html       # 插件弹窗界面
├── popup.js         # 弹窗逻辑 + AI API 调用
├── options.html     # API 设置页面
├── options.js       # 设置逻辑
└── icons/           # 图标
```
