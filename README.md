# 网络互联刷题网页

这是一个只使用静态 HTML/CSS/JavaScript 的移动端刷题网页，可部署到 GitHub Pages，也可作为 PWA 近似离线使用。题库已从《网络互联选择题.docx》转换为静态 `questions.json`，图片题图片已提取到 `assets/question-images/`。

## 文件

- `index.html`：页面入口
- `style.css`：移动端优先样式，包含图片题自适应样式
- `app.js`：顺序/随机/错题本、单选/多选/判断判题、`localStorage` 进度保存
- `questions.json`：前端直接读取的静态题库
- `assets/question-images/`：Word 中提取出的题图
- `scripts/convert-docx-questions.js`：把 Word 转成静态题库和图片资源的开发脚本
- `convert-report.md`：转换统计、跳过题、重复题和图片匹配报告
- `manifest.json`：PWA 应用清单
- `service-worker.js`：离线缓存核心文件，并预缓存/运行时缓存题图
- `icon.svg`：PWA 图标

## 当前题库统计

- 导入题目：105 道
- 单选题：65 道
- 多选题：31 道
- 判断题：9 道
- 图片题：7 道

详见 `convert-report.md`。

## 重新转换 Word 题库

转换脚本不需要额外 npm 依赖，直接用 Node.js 运行：

```bash
node scripts/convert-docx-questions.js "C:\Users\zzy\OneDrive\桌面\网络互联选择题.docx"
```

脚本会生成或覆盖：

- `questions.json`
- `assets/question-images/network_*.png|jpg`
- `convert-report.md`

转换规则：

- 优先以 Word 中的“正确答案”为准，不使用“我的答案”；文档缺标准答案但已人工确认的题会在报告中单独列出。
- 解析单选题、多选题、判断题；没有标准答案且无人工补充规则的题会跳过并写入报告。
- 多选题答案保存为数组，例如 `["A", "D"]`。
- 判断题保存为 A/B，其中 A=对，B=错，兼容网页判题逻辑。
- 重复题按“题干 + 选项 + 正确答案”去重。
- 图片按 Word 中出现的位置绑定到题目，题库中使用相对路径，适合 GitHub Pages 子路径部署。

## 本地预览

```bash
python -m http.server 8000
```

然后打开：

```text
http://localhost:8000/
```

## 上传并更新 GitHub Pages

如果仓库已经配置好远程地址：

```bash
git add index.html style.css app.js service-worker.js manifest.json questions.json assets/question-images scripts/convert-docx-questions.js convert-report.md README.md
git commit -m "Replace question bank with network interconnection questions"
git push
```

GitHub Pages 使用 `main` 分支 `/root` 时，推送后会自动重新部署。首次打开新版本后，service worker 会更新到 `quiz-pwa-v3` 并刷新缓存；如果手机端仍显示旧题库，联网刷新一次页面即可。

## 离线验证

1. 在线打开网页，确认题库和图片题能加载。
2. 切换顺序刷题、随机刷题、错题本，做几道题。
3. 关闭网络或开启飞行模式。
4. 刷新或从主屏幕重新打开网页，确认题目、已缓存图片和错题记录仍可使用。
