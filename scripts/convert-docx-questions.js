const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const zlib = require("node:zlib");

const ROOT_DIR = path.resolve(__dirname, "..");
const OUTPUT_JSON = path.join(ROOT_DIR, "questions.json");
const OUTPUT_REPORT = path.join(ROOT_DIR, "convert-report.md");
const IMAGE_DIR = path.join(ROOT_DIR, "assets", "question-images");

const TYPE_MAP = {
  单选题: "single",
  多选题: "multiple",
  判断题: "judge",
};

const TYPE_NAME = {
  single: "单选题",
  multiple: "多选题",
  judge: "判断题",
};

const QUESTION_HEADER_RE = /^(\d+)\s*[.．、]\s*\(([^)]+)\)\s*$/;
const OPTION_LINE_RE = /^([A-H])\s*[.．、]\s*(.*)$/i;
const FIGURE_HINT_RE = /(如下图|如图所示|图所示|下图|图中|配置信息如图|所示的网络|网络拓扑|拓扑图|组网图)/;
const MANUAL_ANSWER_OVERRIDES = [
  {
    type: "judge",
    question: "由于TCP协议在建立连接和关闭连接时都采用三次握手机制，所以TCP支持可靠传输。",
    answer: ["B"],
    note: "用户确认：正确答案为错",
  },
];
const MANUAL_IMAGE_HINT_IGNORES = [
  {
    question:
      "交换机某个端口配置信息如图，下列说法错误的是？ interface G0/0/1 port link-type trunk port trunk pvid vlan 200 port trunk allow-pass vlan 100",
    note: "题干配置命令已完整保留，不需要图片",
  },
];

function findDocxPath() {
  const fromArg = process.argv[2] ? path.resolve(process.argv[2]) : null;
  const candidates = [
    fromArg,
    path.join(ROOT_DIR, "网络互联选择题.docx"),
    path.join(os.homedir(), "OneDrive", "桌面", "网络互联选择题.docx"),
    path.join(os.homedir(), "Desktop", "网络互联选择题.docx"),
  ].filter(Boolean);

  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error(
      `未找到 Word 文件。请执行：node scripts/convert-docx-questions.js "C:\\path\\to\\网络互联选择题.docx"`
    );
  }
  return found;
}

function findEndOfCentralDirectory(buffer) {
  const minOffset = Math.max(0, buffer.length - 0xffff - 22);
  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      return offset;
    }
  }
  throw new Error("无法读取 docx：没有找到 ZIP 目录");
}

function openZip(filePath) {
  const buffer = fs.readFileSync(filePath);
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const entries = new Map();
  let offset = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error("无法读取 docx：ZIP 中央目录损坏");
    }

    const compression = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const nameStart = offset + 46;
    const name = buffer.toString("utf8", nameStart, nameStart + fileNameLength);

    entries.set(name, {
      compression,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    });

    offset = nameStart + fileNameLength + extraLength + commentLength;
  }

  function readEntry(name) {
    const entry = entries.get(name);
    if (!entry) {
      return null;
    }

    const localOffset = entry.localHeaderOffset;
    if (buffer.readUInt32LE(localOffset) !== 0x04034b50) {
      throw new Error(`无法读取 ZIP 条目：${name}`);
    }

    const localFileNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localFileNameLength + localExtraLength;
    const compressed = buffer.subarray(dataStart, dataStart + entry.compressedSize);

    if (entry.compression === 0) {
      return Buffer.from(compressed);
    }
    if (entry.compression === 8) {
      return zlib.inflateRawSync(compressed);
    }
    throw new Error(`不支持的 ZIP 压缩方式 ${entry.compression}：${name}`);
  }

  return {
    entries,
    readEntry,
    readText(name) {
      const entry = readEntry(name);
      return entry ? entry.toString("utf8") : null;
    },
  };
}

function decodeXml(value) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(parseInt(number, 10)));
}

function normalizeText(text) {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/\u3000/g, " ")
    .replace(/[ \t\r\n]+/g, " ")
    .trim();
}

function normalizeForSignature(text) {
  return normalizeText(String(text || "")).replace(/\s+/g, " ");
}

function parseAttributes(xml) {
  const attributes = {};
  const attributeRe = /([A-Za-z_][\w:.-]*)="([^"]*)"/g;
  let match;
  while ((match = attributeRe.exec(xml))) {
    attributes[match[1]] = decodeXml(match[2]);
  }
  return attributes;
}

function readRelationships(relsXml) {
  const relationships = new Map();
  const relRe = /<Relationship\b[^>]*\/>/g;
  let match;
  while ((match = relRe.exec(relsXml))) {
    const attributes = parseAttributes(match[0]);
    if (!attributes.Id || !attributes.Target) {
      continue;
    }
    const target = attributes.Target.replace(/\\/g, "/");
    const targetPath = target.startsWith("/")
      ? target.replace(/^\/+/, "")
      : path.posix.normalize(`word/${target}`);
    relationships.set(attributes.Id, {
      id: attributes.Id,
      type: attributes.Type || "",
      target,
      targetPath,
      isImage: /\/image$/i.test(attributes.Type || "") || targetPath.startsWith("word/media/"),
    });
  }
  return relationships;
}

function readParagraphText(paragraphXml) {
  const parts = [];
  const textRe = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:tab\b[^>]*\/>|<w:br\b[^>]*\/>/g;
  let match;
  while ((match = textRe.exec(paragraphXml))) {
    if (match[1] !== undefined) {
      parts.push(decodeXml(match[1]));
    } else if (match[0].startsWith("<w:tab")) {
      parts.push("\t");
    } else {
      parts.push("\n");
    }
  }
  return normalizeText(parts.join(""));
}

function readParagraphImages(paragraphXml) {
  const ids = [];
  const blipRe = /<a:blip\b[^>]*(?:r:embed|r:link)="([^"]+)"[^>]*\/?>/g;
  const imageDataRe = /<v:imagedata\b[^>]*r:id="([^"]+)"[^>]*\/?>/g;
  let match;

  while ((match = blipRe.exec(paragraphXml))) {
    ids.push(decodeXml(match[1]));
  }
  while ((match = imageDataRe.exec(paragraphXml))) {
    ids.push(decodeXml(match[1]));
  }

  return [...new Set(ids)];
}

function readParagraphs(documentXml) {
  const paragraphs = [];
  const paragraphRe = /<w:p\b[\s\S]*?<\/w:p>/g;
  let match;
  let index = 0;

  while ((match = paragraphRe.exec(documentXml))) {
    index += 1;
    paragraphs.push({
      index,
      text: readParagraphText(match[0]),
      images: readParagraphImages(match[0]),
    });
  }

  return paragraphs;
}

function parseCorrectAnswer(line, type) {
  const correctIndex = line.indexOf("正确答案");
  if (correctIndex === -1) {
    return [];
  }

  const rest = normalizeText(line.slice(correctIndex + "正确答案".length)).replace(/^[:：]\s*/, "");
  if (type === "judge") {
    const judgeMatch = rest.match(/^(对|错|正确|错误|A|B)/i);
    if (!judgeMatch) {
      return [];
    }
    const value = judgeMatch[1].toUpperCase();
    if (value === "对" || value === "正确" || value === "A") {
      return ["A"];
    }
    if (value === "错" || value === "错误" || value === "B") {
      return ["B"];
    }
    return [];
  }

  const letterMatch = rest.match(/^([A-H]+)/i);
  return letterMatch ? [...letterMatch[1].toUpperCase()] : [];
}

function findManualAnswerOverride(question, type) {
  const normalizedQuestion = normalizeForSignature(question);
  return MANUAL_ANSWER_OVERRIDES.find(
    (override) =>
      override.type === type && normalizeForSignature(override.question) === normalizedQuestion
  );
}

function isManualImageHintIgnored(question) {
  const normalizedQuestion = normalizeForSignature(question);
  return MANUAL_IMAGE_HINT_IGNORES.some(
    (item) => normalizeForSignature(item.question) === normalizedQuestion
  );
}

function parseOptions(lines) {
  const options = [];
  let current = null;

  for (const line of lines) {
    const optionMatch = OPTION_LINE_RE.exec(line);
    if (optionMatch) {
      if (current) {
        options.push({
          key: current.key,
          text: current.parts.map(normalizeText).filter(Boolean).join("\n"),
        });
      }
      current = {
        key: optionMatch[1].toUpperCase(),
        parts: optionMatch[2] ? [optionMatch[2]] : [],
      };
      continue;
    }

    if (current) {
      current.parts.push(line);
    }
  }

  if (current) {
    options.push({
      key: current.key,
      text: current.parts.map(normalizeText).filter(Boolean).join("\n"),
    });
  }

  const seen = new Set();
  return options.filter((option) => {
    if (!option.text || seen.has(option.key)) {
      return false;
    }
    seen.add(option.key);
    return true;
  });
}

function parseQuestionBody(type, bodyParagraphs) {
  const lines = bodyParagraphs.map((paragraph) => paragraph.text).filter(Boolean);
  const firstOptionIndex = lines.findIndex((line) => OPTION_LINE_RE.test(line));
  const questionLines = firstOptionIndex === -1 ? lines : lines.slice(0, firstOptionIndex);
  let options = firstOptionIndex === -1 ? [] : parseOptions(lines.slice(firstOptionIndex));

  if (type === "judge" && options.length === 0) {
    options = [
      { key: "A", text: "对" },
      { key: "B", text: "错" },
    ];
  }

  return {
    question: normalizeText(questionLines.join(" ")),
    options,
  };
}

function parseKnowledge(metaParagraphs) {
  const startIndex = metaParagraphs.findIndex((paragraph) => /^知识点\s*[:：]?/.test(paragraph.text));
  if (startIndex === -1) {
    return "";
  }

  const first = metaParagraphs[startIndex].text.replace(/^知识点\s*[:：]?\s*/, "");
  const lines = first ? [first] : [];

  for (let index = startIndex + 1; index < metaParagraphs.length; index += 1) {
    const text = metaParagraphs[index].text;
    if (!text) {
      continue;
    }
    if (/^AI讲解/.test(text) || QUESTION_HEADER_RE.test(text)) {
      break;
    }
    lines.push(text);
  }

  return lines.map(normalizeText).filter(Boolean).join("、");
}

function optionKeySet(options) {
  return new Set(options.map((option) => option.key));
}

function validateQuestion(item) {
  const issues = [];
  const keys = optionKeySet(item.options);
  const answerSet = new Set(item.answer);

  if (!item.question) {
    issues.push("缺少题干");
  }
  if (item.answer.length === 0) {
    issues.push("缺少正确答案");
  }
  if (item.type !== "judge" && item.options.length === 0) {
    issues.push("缺少选择题选项");
  }
  if (item.type === "single" && item.answer.length !== 1) {
    issues.push(`单选题答案数量不是 1，answer=${item.answer.join("")}`);
  }
  if (item.type === "judge" && ![...answerSet].every((key) => key === "A" || key === "B")) {
    issues.push(`判断题答案不是 对/错 或 A/B，answer=${item.answer.join("")}`);
  }
  if (keys.size && ![...answerSet].every((key) => keys.has(key))) {
    issues.push(`正确答案包含未解析出的选项 ${[...answerSet].filter((key) => !keys.has(key)).join("")}`);
  }
  if (item.type === "multiple" && item.answer.length < 2) {
    issues.push(`多选题正确答案少于 2 个，answer=${item.answer.join("")}`);
  }

  return issues;
}

function shouldSkip(issues) {
  return issues.some((issue) =>
    /缺少题干|缺少正确答案|缺少选择题选项|正确答案包含未解析出的选项|单选题答案数量不是|判断题答案不是/.test(
      issue
    )
  );
}

function buildQuestionSignature(item) {
  return JSON.stringify({
    question: normalizeForSignature(item.question),
    options: item.options.map((option) => [option.key, normalizeForSignature(option.text)]),
    answer: item.answer,
  });
}

function parseQuestions(paragraphs) {
  const headers = paragraphs
    .map((paragraph, index) => {
      const match = QUESTION_HEADER_RE.exec(paragraph.text);
      return match
        ? {
            index,
            paragraphIndex: paragraph.index,
            docNo: Number(match[1]),
            label: match[2],
            type: TYPE_MAP[match[2]] || null,
          }
        : null;
    })
    .filter(Boolean);

  const sourceCounts = { single: 0, multiple: 0, judge: 0 };
  const rawItems = [];
  const skipped = [];
  const warnings = [];
  const manualFixes = [];

  headers.forEach((header, headerIndex) => {
    if (header.type) {
      sourceCounts[header.type] += 1;
    }

    if (!header.type) {
      return;
    }

    const nextHeader = headers[headerIndex + 1];
    const segment = paragraphs.slice(header.index + 1, nextHeader ? nextHeader.index : paragraphs.length);
    const answerIndex = segment.findIndex((paragraph) => paragraph.text.includes("正确答案"));
    const body = answerIndex === -1 ? segment : segment.slice(0, answerIndex);
    const meta = answerIndex === -1 ? [] : segment.slice(answerIndex + 1);
    const parsedBody = parseQuestionBody(header.type, body);
    const manualOverride =
      answerIndex === -1 ? findManualAnswerOverride(parsedBody.question, header.type) : null;

    if (answerIndex === -1 && !manualOverride) {
      skipped.push({
        sourceNo: header.docNo,
        type: header.type,
        paragraph: header.paragraphIndex,
        question: parsedBody.question || normalizeText(segment.map((paragraph) => paragraph.text).filter(Boolean).join(" ")),
        reason: "未找到文档里的“正确答案”",
      });
      return;
    }

    const item = {
      sourceNo: header.docNo,
      sourceParagraph: header.paragraphIndex,
      type: header.type,
      question: parsedBody.question,
      options: parsedBody.options,
      answer: manualOverride ? manualOverride.answer : parseCorrectAnswer(segment[answerIndex].text, header.type),
      knowledge: parseKnowledge(meta),
      imageRIds: [...new Set(body.flatMap((paragraph) => paragraph.images))],
    };
    const issues = validateQuestion(item);

    if (manualOverride) {
      manualFixes.push({
        sourceNo: item.sourceNo,
        type: item.type,
        paragraph: item.sourceParagraph,
        question: item.question,
        answer: item.answer,
        reason: manualOverride.note,
      });
    }

    if (shouldSkip(issues)) {
      skipped.push({
        sourceNo: item.sourceNo,
        type: item.type,
        paragraph: item.sourceParagraph,
        question: item.question.slice(0, 120),
        reason: issues.join("；"),
      });
      return;
    }

    if (issues.length) {
      warnings.push({
        sourceNo: item.sourceNo,
        type: item.type,
        paragraph: item.sourceParagraph,
        question: item.question.slice(0, 80),
        reason: issues.join("；"),
      });
    }

    rawItems.push(item);
  });

  return {
    sourceCounts,
    rawItems,
    skipped,
    warnings,
    manualFixes,
  };
}

function dedupeQuestions(rawItems) {
  const seen = new Map();
  const unique = [];
  const duplicates = [];

  for (const item of rawItems) {
    const signature = buildQuestionSignature(item);
    const kept = seen.get(signature);
    if (kept) {
      if (!kept.knowledge && item.knowledge) {
        kept.knowledge = item.knowledge;
      }
      if (kept.imageRIds.length === 0 && item.imageRIds.length > 0) {
        kept.imageRIds = item.imageRIds;
      }
      duplicates.push({
        sourceNo: item.sourceNo,
        sourceParagraph: item.sourceParagraph,
        type: item.type,
        question: item.question.slice(0, 100),
        keptSourceNo: kept.sourceNo,
        keptParagraph: kept.sourceParagraph,
      });
      continue;
    }

    seen.set(signature, item);
    unique.push(item);
  }

  return {
    unique,
    duplicates,
  };
}

function resetGeneratedImages() {
  fs.mkdirSync(IMAGE_DIR, { recursive: true });
  for (const entry of fs.readdirSync(IMAGE_DIR)) {
    if (/^(network_\d+|unmatched_docx_image_\d+)/.test(entry)) {
      fs.rmSync(path.join(IMAGE_DIR, entry), { force: true });
    }
  }
}

function writeImage(zip, rel, id) {
  if (!rel) {
    return null;
  }
  const imageBuffer = zip.readEntry(rel.targetPath);
  if (!imageBuffer) {
    return null;
  }

  const originalExt = path.posix.extname(rel.targetPath).toLowerCase() || ".png";
  const safeExt = originalExt === ".jpeg" ? ".jpg" : originalExt;
  const fileName = `network_${String(id).padStart(3, "0")}${safeExt}`;
  const outputPath = path.join(IMAGE_DIR, fileName);
  fs.writeFileSync(outputPath, imageBuffer);
  return `assets/question-images/${fileName}`;
}

function writeUnmatchedImage(zip, rel, index) {
  const imageBuffer = zip.readEntry(rel.targetPath);
  if (!imageBuffer) {
    return null;
  }
  const originalExt = path.posix.extname(rel.targetPath).toLowerCase() || ".png";
  const safeExt = originalExt === ".jpeg" ? ".jpg" : originalExt;
  const fileName = `unmatched_docx_image_${String(index).padStart(2, "0")}${safeExt}`;
  fs.writeFileSync(path.join(IMAGE_DIR, fileName), imageBuffer);
  return `assets/question-images/${fileName}`;
}

function buildOutputQuestions(uniqueItems, zip, relationships) {
  const output = [];
  const imageIssues = [];
  const usedImageTargets = new Set();

  uniqueItems.forEach((item, index) => {
    const id = index + 1;
    const question = {
      id,
      type: item.type,
      question: item.question,
      options: item.options,
      answer: item.answer,
    };

    if (item.knowledge) {
      question.knowledge = item.knowledge;
    }

    if (item.imageRIds.length > 1) {
        imageIssues.push({
          id,
          sourceNo: item.sourceNo,
          question: item.question,
          reason: `同一题检测到 ${item.imageRIds.length} 张图片，仅自动使用第一张`,
        });
    }

    if (item.imageRIds.length > 0) {
      const rel = relationships.get(item.imageRIds[0]);
      const imagePath = writeImage(zip, rel, id);
      if (imagePath) {
        question.image = imagePath;
        usedImageTargets.add(rel.targetPath);
      } else {
        imageIssues.push({
          id,
          sourceNo: item.sourceNo,
          question: item.question,
          reason: `图片关系 ${item.imageRIds[0]} 无法解析或文件缺失`,
        });
      }
    } else if (FIGURE_HINT_RE.test(item.question) && !isManualImageHintIgnored(item.question)) {
      imageIssues.push({
        id,
        sourceNo: item.sourceNo,
        question: item.question,
        reason: "题干包含图示提示，但未在该题范围内检测到图片",
      });
    }

    output.push(question);
  });

  const allImageRels = [...relationships.values()].filter((rel) => rel.isImage);
  const unmatchedImageRels = allImageRels.filter((rel) => !usedImageTargets.has(rel.targetPath));
  const unmatchedImages = [];
  const unmatchedTargets = new Set();
  unmatchedImageRels.forEach((rel) => {
    if (usedImageTargets.has(rel.targetPath) || unmatchedTargets.has(rel.targetPath)) {
      return;
    }
    unmatchedTargets.add(rel.targetPath);
    const outputPath = writeUnmatchedImage(zip, rel, unmatchedImages.length + 1);
    if (outputPath) {
      unmatchedImages.push({
        source: rel.targetPath,
        output: outputPath,
      });
    }
  });

  return {
    output,
    imageIssues,
    unmatchedImages,
  };
}

function countByType(questions) {
  return questions.reduce(
    (counts, question) => {
      counts[question.type] = (counts[question.type] || 0) + 1;
      return counts;
    },
    { single: 0, multiple: 0, judge: 0 }
  );
}

function formatIssueList(items, formatter, emptyText = "无") {
  if (items.length === 0) {
    return emptyText;
  }
  return items.map((item, index) => `${index + 1}. ${formatter(item)}`).join("\n");
}

function buildReport({
  docxPath,
  paragraphs,
  sourceCounts,
  rawItems,
  questions,
  duplicates,
  skipped,
  warnings,
  manualFixes,
  imageIssues,
  unmatchedImages,
}) {
  const counts = countByType(questions);
  const imageMatched = questions.filter((question) => question.image).length;
  const sourceTotal = sourceCounts.single + sourceCounts.multiple + sourceCounts.judge;

  return `# Word 题库转换报告

- 源文件：${docxPath}
- 生成时间：${new Date().toLocaleString("zh-CN")}
- 文档段落数：${paragraphs.length}

## 导入统计

| 项目 | 数量 |
| --- | ---: |
| Word 中可识别的单选/多选/判断题 | ${sourceTotal} |
| 成功解析且未去重前 | ${rawItems.length} |
| 去重后导入 | ${questions.length} |
| 去重删除 | ${duplicates.length} |
| 跳过/需处理 | ${skipped.length} |
| 单选题 | ${counts.single} |
| 多选题 | ${counts.multiple} |
| 判断题 | ${counts.judge} |
| 成功匹配图片的题目 | ${imageMatched} |
| 未绑定到导入题目的独立图片 | ${unmatchedImages.length} |

## 规则说明

- 正确答案优先读取文档中的“正确答案”，不会使用“我的答案”；文档缺标准答案但已人工确认的题会单独列出。
- 重复题按“题干 + 选项 + 正确答案”去重，保留首次出现的题目。
- 判断题在网页中按 A=对、B=错 保存，兼容原有判题逻辑。
- 图片按 Word 中图片出现在题目段落内的位置绑定到题目。

## 跳过或需要人工处理的题目

${formatIssueList(
  skipped,
  (item) =>
    `段落 ${item.paragraph}，原编号 ${item.sourceNo}，${TYPE_NAME[item.type]}：${item.reason}。题干：${item.question || "（空）"}`
)}

## 人工补充答案

${formatIssueList(
  manualFixes,
  (item) =>
    `段落 ${item.paragraph}，原编号 ${item.sourceNo}，${TYPE_NAME[item.type]}：${item.reason}，已保存为 ${item.answer.join("")}。题干：${item.question || "（空）"}`
)}

## 需要人工确认的图片题

${formatIssueList(
  imageIssues,
  (item) =>
    `导入 ID ${item.id}，原编号 ${item.sourceNo}：${item.reason}。题干：${item.question || "（空）"}`
)}

## 未绑定图片

${formatIssueList(
  unmatchedImages,
  (item) => `${item.source} 已提取为 ${item.output}`
)}

## 解析警告

${formatIssueList(
  warnings,
  (item) =>
    `段落 ${item.paragraph}，原编号 ${item.sourceNo}，${TYPE_NAME[item.type]}：${item.reason}。题干：${item.question || "（空）"}`
)}

## 去重记录

${formatIssueList(
  duplicates,
  (item) =>
    `段落 ${item.sourceParagraph}，原编号 ${item.sourceNo}，${TYPE_NAME[item.type]} 与段落 ${item.keptParagraph}，原编号 ${item.keptSourceNo} 重复。题干：${item.question}`
)}
`;
}

function main() {
  const docxPath = findDocxPath();
  const zip = openZip(docxPath);
  const documentXml = zip.readText("word/document.xml");
  const relsXml = zip.readText("word/_rels/document.xml.rels");

  if (!documentXml || !relsXml) {
    throw new Error("无法读取 word/document.xml 或 word/_rels/document.xml.rels");
  }

  const paragraphs = readParagraphs(documentXml);
  const relationships = readRelationships(relsXml);
  const parsed = parseQuestions(paragraphs);
  const deduped = dedupeQuestions(parsed.rawItems);

  resetGeneratedImages();
  const built = buildOutputQuestions(deduped.unique, zip, relationships);

  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(built.output, null, 2)}\n`, "utf8");
  fs.writeFileSync(
    OUTPUT_REPORT,
    buildReport({
      docxPath,
      paragraphs,
      sourceCounts: parsed.sourceCounts,
      rawItems: parsed.rawItems,
      questions: built.output,
      duplicates: deduped.duplicates,
      skipped: parsed.skipped,
      warnings: parsed.warnings,
      manualFixes: parsed.manualFixes,
      imageIssues: built.imageIssues,
      unmatchedImages: built.unmatchedImages,
    }),
    "utf8"
  );

  const counts = countByType(built.output);
  console.log(`已生成 ${path.relative(ROOT_DIR, OUTPUT_JSON)}，共 ${built.output.length} 题`);
  console.log(`单选 ${counts.single}，多选 ${counts.multiple}，判断 ${counts.judge}`);
  console.log(`图片题 ${built.output.filter((question) => question.image).length} 道`);
  console.log(`转换报告：${path.relative(ROOT_DIR, OUTPUT_REPORT)}`);

  if (parsed.skipped.length || built.imageIssues.length) {
    console.log("存在需要人工确认的项目，请查看 convert-report.md");
  }
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
