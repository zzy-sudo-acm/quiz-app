# Web 开发实践刷题网页

这是一个只使用静态 HTML/CSS/JavaScript 的移动端刷题网页，可部署到 GitHub Pages，也可作为 PWA 近似离线使用。题库来自 `web开发实践选择题.docx`。

## 文件

- `index.html`：页面入口
- `style.css`：移动端优先样式
- `app.js`：顺序/随机/错题本、判题、`localStorage` 进度保存
- `questions.json`：前端直接读取的静态题库
- `web开发实践选择题.docx`：当前题库源文件
- `web开发实践选择题-答案核对.md`：缺答案题目的补全答案核对表
- `scripts/convert-docx-questions.js`：把 Word 转成静态题库的开发脚本
- `convert-report.md`：转换统计和答案来源说明
- `manifest.json`：PWA 应用清单
- `service-worker.js`：离线缓存核心文件
- `icon.svg`：PWA 图标

## 当前题库统计

- 导入题目：85 道
- 单选题：85 道
- 需要人工审题补全答案：35 道
- 从 Word 原文读取正确答案：50 道

详见 `convert-report.md`。

## 重新转换 Word 题库

转换脚本不需要额外 npm 依赖，直接用 Node.js 运行：

```bash
node scripts/convert-docx-questions.js
```

也可以指定 Word 路径：

```bash
node scripts/convert-docx-questions.js "C:\path\to\web开发实践选择题.docx"
```

脚本会生成或覆盖：

- `questions.json`
- `convert-report.md`

## 本地预览

```bash
python -m http.server 8000
```

然后打开：

```text
http://localhost:8000/
```

## GitHub Pages

仓库地址：

```text
https://github.com/zzy-sudo-acm/quiz-app
```

线上地址：

```text
https://zzy-sudo-acm.github.io/quiz-app/
```

推送到 `main` 分支后，如果 GitHub Pages 配置为 `main` 分支 `/root`，页面会自动更新。首次打开新版本后，service worker 会更新到 `quiz-pwa-v4` 并刷新缓存；如果手机端仍显示旧题库，联网刷新一次页面即可。
