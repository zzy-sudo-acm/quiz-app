# 极简刷题网页

这是一个只使用 Python 和原生 HTML/CSS/JavaScript 的刷题网页，可部署到 GitHub Pages，也可作为 PWA 离线使用。

当你有一场会考原题的应试考试时候，在你有word文档的题库时，这个网页可以帮助你快速记忆，相比看word文档更加舒服。

## 文件

- `parse_docx.py`：从《最终版本.docx》解析题库并生成 `questions.json`
- `questions.json`：前端直接读取的题库数据
- `index.html`：页面入口
- `style.css`：移动端优先样式
- `app.js`：刷题逻辑、顺序/随机/错题本模式、`localStorage` 进度保存、service worker 注册
- `manifest.json`：PWA 应用清单
- `service-worker.js`：离线缓存
- `icon.svg`：PWA 图标
- `parse_errors.txt`：解析异常或修复记录

## 本地生成题库

安装依赖：

```bash
python -m pip install python-docx
```

解析题库：

```bash
python parse_docx.py
```

本地预览：

```bash
python -m http.server 8000
```

浏览器打开本机 8000 端口地址即可预览。

## 上传到 GitHub

1. 在 GitHub 新建一个仓库，例如 `quiz-app`。
2. 在项目目录执行：

```bash
git init
git add .
git commit -m "Initial quiz PWA"
git branch -M main
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin main
```

如果仓库已经存在并且已经配置过远程地址，只需要执行：

```bash
git add .
git commit -m "Prepare PWA for GitHub Pages"
git push
```

## 开启 GitHub Pages

1. 打开 GitHub 仓库页面。
2. 进入 `Settings`。
3. 打开 `Pages`。
4. 在 `Build and deployment` 里选择 `Deploy from a branch`。
5. Branch 选择 `main`，目录选择 `/root`。
6. 保存后等待部署完成。

部署完成后访问：

```text
https://<你的用户名>.github.io/<仓库名>/
```

本项目所有页面资源都使用相对路径，适合直接放在 GitHub Pages 的仓库子路径下访问。

## 添加到手机主屏幕

iPhone Safari：

1. 打开部署后的网页。
2. 点击分享按钮。
3. 选择“添加到主屏幕”。
4. 确认名称后添加。

Android Chrome / Edge：

1. 打开部署后的网页。
2. 点击浏览器菜单。
3. 选择“安装应用”或“添加到主屏幕”。
4. 确认安装。

## 验证离线可用

1. 手机第一次在线打开网页，等待题库加载完成。
2. 切换一次顺序刷题、随机刷题或错题本，确认页面能正常作答。
3. 关闭网络，或开启飞行模式。
4. 重新打开已添加到主屏幕的应用，或刷新网页。
5. 如果仍能看到题目并继续刷题，说明离线缓存已生效。

`service-worker.js` 会缓存这些核心文件：

- `index.html`
- `style.css`
- `app.js`
- `questions.json`
- `manifest.json`

当前离线缓存版本为 `quiz-pwa-v2`。如果手机端仍显示旧页面，先联网打开一次新页面，等待刷新完成后再测试离线。

## 功能说明

- 默认顺序刷题。
- 随机刷题会把整套题随机打乱，本轮内不重复。
- 错题本会自动记录顺序刷题和随机刷题中答错的题，同一道题不会重复记录。
- 错题本按钮显示当前错题数量，例如 `错题本（3）`。
- 每次进入错题本都会重新打乱错题顺序，只练当前错题。
- 在错题本里答对某题后，这道题会自动移出错题本；在普通顺序/随机模式答对不会自动移出。
- 顺序刷题、随机刷题和错题记录都会保存在 `localStorage`。
- `重新开始` 会重置当前模式进度。
- `重新洗牌` 会切换到随机刷题并生成新的随机顺序。
- 答错只显示正确答案，不显示解析。
- `id=472` 的原始 Word 文档中只保留了 D 选项，A/B/C 选项缺失；`parse_docx.py` 已按题干语义补齐并写入 `parse_errors.txt` 作为修复记录，网页可正常显示和作答。

## 错题本测试

1. 打开网页后先点错一道题，顶部应显示 `错题本（1）`。
2. 再答错同一道题，数量不应重复增加。
3. 点击 `错题本（1）`，页面只显示错题，总题数应是错题数量，不是 611。
4. 在错题本里答错，该题继续保留。
5. 在错题本里答对，该题会自动移出错题本。
6. 刷新页面后，错题本数量仍应保留。
