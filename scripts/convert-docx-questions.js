const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const zlib = require("node:zlib");

const ROOT_DIR = path.resolve(__dirname, "..");
const DEFAULT_DOCX = path.join(ROOT_DIR, "web开发实践选择题.docx");
const OUTPUT_JSON = path.join(ROOT_DIR, "questions.json");
const OUTPUT_REPORT = path.join(ROOT_DIR, "convert-report.md");

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

const SUPPLEMENTED_ANSWERS = [
  "B",
  "B",
  "B",
  "C",
  "C",
  "B",
  "A",
  "C",
  "C",
  "D",
  "B",
  "D",
  "D",
  "A",
  "A",
  "C",
  "B",
  "B",
  "B",
  "A",
  "C",
  "D",
  "D",
  "D",
  "A",
  "D",
  "D",
  "C",
  "A",
  "A",
  "A",
  "A",
  "A",
  "C",
  "B",
];

const QUESTION_HEADER_RE = /^(\d+)\s*[.．、]\s*\((单选题|多选题|判断题)\)\s*$/;
const OPTION_KEY_RE = /^([A-H])\.?$/i;
const ANSWER_RE = /正确答案\s*[:：]\s*([A-H]+)/i;
const SKIP_RE = /^(AI讲解|\d+分)$/;

function findDocxPath() {
  const fromArg = process.argv[2] ? path.resolve(process.argv[2]) : null;
  const candidates = [
    fromArg,
    DEFAULT_DOCX,
    path.join(os.homedir(), "OneDrive", "桌面", "web开发实践选择题.docx"),
    path.join(os.homedir(), "Desktop", "web开发实践选择题.docx"),
  ].filter(Boolean);

  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error(
      '未找到 Word 文件。请执行：node scripts/convert-docx-questions.js "C:\\path\\to\\web开发实践选择题.docx"'
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
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const nameStart = offset + 46;
    const name = buffer.toString("utf8", nameStart, nameStart + fileNameLength);

    entries.set(name, {
      compression,
      compressedSize,
      localHeaderOffset,
    });

    offset = nameStart + fileNameLength + extraLength + commentLength;
  }

  return {
    readEntry(name) {
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

function readParagraphText(paragraphXml) {
  const parts = [];
  const textRe = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:tab\b[^>]*\/>|<w:br\b[^>]*\/>/g;
  let match;

  while ((match = textRe.exec(paragraphXml))) {
    if (match[1] !== undefined) {
      parts.push(decodeXml(match[1]));
    } else {
      parts.push("\n");
    }
  }

  return normalizeText(parts.join(""));
}

function readParagraphs(documentXml) {
  const paragraphs = [];
  const paragraphRe = /<w:p\b[\s\S]*?<\/w:p>/g;
  let match;
  let index = 0;

  while ((match = paragraphRe.exec(documentXml))) {
    index += 1;
    const text = readParagraphText(match[0]);
    if (text) {
      paragraphs.push({ index, text });
    }
  }

  return paragraphs;
}

function categoryForId(id) {
  if (id <= 15) {
    return "HTML/CSS";
  }
  if (id <= 35) {
    return "JavaScript";
  }
  return "Vue / Spring Boot / MyBatis";
}

function skipNoise(paragraphs, cursor) {
  let next = cursor;
  while (next < paragraphs.length && SKIP_RE.test(paragraphs[next].text)) {
    next += 1;
  }
  return next;
}

function collectQuestionLines(paragraphs, cursor) {
  const lines = [];
  let next = cursor;

  while (next < paragraphs.length && !OPTION_KEY_RE.test(paragraphs[next].text)) {
    const text = paragraphs[next].text;
    if (!SKIP_RE.test(text)) {
      lines.push(text);
    }
    next += 1;
  }

  return { question: normalizeText(lines.join(" ")), cursor: next };
}

function collectOptions(paragraphs, cursor, stopAfterFour, stopLastOptionAfterFirstLine = false) {
  const options = [];
  let next = cursor;

  while (next < paragraphs.length) {
    const keyMatch = OPTION_KEY_RE.exec(paragraphs[next].text);
    if (!keyMatch) {
      break;
    }

    const key = keyMatch[1].toUpperCase();
    next += 1;
    const parts = [];

    while (
      next < paragraphs.length &&
      !OPTION_KEY_RE.test(paragraphs[next].text) &&
      !QUESTION_HEADER_RE.test(paragraphs[next].text) &&
      !ANSWER_RE.test(paragraphs[next].text)
    ) {
      const text = paragraphs[next].text;
      if (!SKIP_RE.test(text)) {
        parts.push(text);
      }
      next += 1;

      if (stopAfterFour && stopLastOptionAfterFirstLine && options.length === 3 && parts.length > 0) {
        break;
      }
    }

    options.push({
      key,
      text: normalizeText(parts.join("\n")),
    });

    if (stopAfterFour && options.length === 4) {
      break;
    }
  }

  return { options, cursor: next };
}

function validateQuestion(question) {
  const issues = [];
  const optionKeys = new Set(question.options.map((option) => option.key));

  if (!question.question) {
    issues.push("缺少题干");
  }
  if (question.type !== "judge" && question.options.length === 0) {
    issues.push("缺少选项");
  }
  if (question.answer.length === 0) {
    issues.push("缺少答案");
  }
  if (question.type === "single" && question.answer.length !== 1) {
    issues.push(`单选题答案数量不是 1：${question.answer.join("")}`);
  }
  if (optionKeys.size && !question.answer.every((key) => optionKeys.has(key))) {
    const missing = question.answer.filter((key) => !optionKeys.has(key)).join("");
    issues.push(`答案未出现在选项中：${missing}`);
  }

  return issues;
}

function readSupplementedQuestion(paragraphs, cursor, outputId, supplementIndex) {
  const headerMatch = QUESTION_HEADER_RE.exec(paragraphs[cursor]?.text || "");
  if (!headerMatch) {
    throw new Error(`第 ${outputId} 题缺少题头，段落 ${paragraphs[cursor]?.index || "EOF"}`);
  }

  const type = TYPE_MAP[headerMatch[2]];
  let next = cursor + 1;
  const collectedQuestion = collectQuestionLines(paragraphs, next);
  next = collectedQuestion.cursor;
  const collectedOptions = collectOptions(
    paragraphs,
    next,
    true,
    supplementIndex === SUPPLEMENTED_ANSWERS.length - 1
  );
  next = collectedOptions.cursor;

  return {
    question: {
      id: outputId,
      type,
      question: collectedQuestion.question,
      options: collectedOptions.options,
      answer: [...SUPPLEMENTED_ANSWERS[supplementIndex]],
      knowledge: categoryForId(outputId),
      answerSource: "supplemented",
    },
    cursor: next,
  };
}

function readAnsweredQuestion(paragraphs, cursor, outputId) {
  let next = skipNoise(paragraphs, cursor);
  let sourceNo = outputId;
  let type = "single";

  const headerMatch = QUESTION_HEADER_RE.exec(paragraphs[next]?.text || "");
  if (headerMatch) {
    sourceNo = Number(headerMatch[1]);
    type = TYPE_MAP[headerMatch[2]];
    next += 1;
  }

  const collectedQuestion = collectQuestionLines(paragraphs, next);
  next = collectedQuestion.cursor;
  const collectedOptions = collectOptions(paragraphs, next, false);
  next = collectedOptions.cursor;

  while (next < paragraphs.length && !ANSWER_RE.test(paragraphs[next].text)) {
    next += 1;
  }

  const answerMatch = ANSWER_RE.exec(paragraphs[next]?.text || "");
  if (!answerMatch) {
    throw new Error(`第 ${outputId} 题未找到“正确答案”，段落 ${paragraphs[next]?.index || "EOF"}`);
  }

  next += 1;

  return {
    question: {
      id: outputId,
      sourceNo,
      type,
      question: collectedQuestion.question,
      options: collectedOptions.options,
      answer: [...answerMatch[1].toUpperCase()],
      knowledge: categoryForId(outputId),
      answerSource: "document",
    },
    cursor: next,
  };
}

function parseQuestions(paragraphs) {
  const questions = [];
  const issues = [];
  let cursor = 0;

  for (let index = 0; index < SUPPLEMENTED_ANSWERS.length; index += 1) {
    const parsed = readSupplementedQuestion(paragraphs, cursor, questions.length + 1, index);
    questions.push(parsed.question);
    cursor = skipNoise(paragraphs, parsed.cursor);
  }

  while (cursor < paragraphs.length) {
    cursor = skipNoise(paragraphs, cursor);
    if (cursor >= paragraphs.length) {
      break;
    }

    const parsed = readAnsweredQuestion(paragraphs, cursor, questions.length + 1);
    questions.push(parsed.question);
    cursor = skipNoise(paragraphs, parsed.cursor);
  }

  for (const question of questions) {
    const questionIssues = validateQuestion(question);
    for (const issue of questionIssues) {
      issues.push(`ID ${question.id}：${issue}`);
    }
  }

  return { questions, issues };
}

function stripInternalFields(question) {
  const { answerSource, sourceNo, ...publicQuestion } = question;
  return publicQuestion;
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

function buildReport(docxPath, paragraphs, questions, issues) {
  const counts = countByType(questions);
  const supplemented = questions.filter((question) => question.answerSource === "supplemented").length;
  const fromDocument = questions.filter((question) => question.answerSource === "document").length;

  return `# Word 题库转换报告

- 源文件：${docxPath}
- 生成时间：${new Date().toLocaleString("zh-CN")}
- 文档有效段落数：${paragraphs.length}

## 导入统计

| 项目 | 数量 |
| --- | ---: |
| 导入题目 | ${questions.length} |
| 单选题 | ${counts.single} |
| 多选题 | ${counts.multiple} |
| 判断题 | ${counts.judge} |
| 根据题意补全答案 | ${supplemented} |
| 从 Word 正确答案读取 | ${fromDocument} |
| 解析问题 | ${issues.length} |

## 答案来源说明

- 前 35 题原文没有“正确答案”字段，答案由人工审题补全，详见 \`web开发实践选择题-答案核对.md\`。
- 后 50 题读取 Word 原文中的“正确答案”字段。
- HTML/CSS 第 5 题“CSS 中组合选择器的正确写法是”按分组选择器理解，答案为 C：\`h1, p\`。

## 解析问题

${issues.length ? issues.map((issue, index) => `${index + 1}. ${issue}`).join("\n") : "无"}
`;
}

function main() {
  const docxPath = findDocxPath();
  const zip = openZip(docxPath);
  const documentXml = zip.readEntry("word/document.xml");

  if (!documentXml) {
    throw new Error("无法读取 word/document.xml");
  }

  const paragraphs = readParagraphs(documentXml.toString("utf8"));
  const parsed = parseQuestions(paragraphs);
  const publicQuestions = parsed.questions.map(stripInternalFields);

  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(publicQuestions, null, 2)}\n`, "utf8");
  fs.writeFileSync(
    OUTPUT_REPORT,
    buildReport(docxPath, paragraphs, parsed.questions, parsed.issues),
    "utf8"
  );

  const counts = countByType(parsed.questions);
  console.log(`已生成 ${path.relative(ROOT_DIR, OUTPUT_JSON)}，共 ${parsed.questions.length} 题`);
  console.log(`单选 ${counts.single}，多选 ${counts.multiple}，判断 ${counts.judge}`);
  console.log(`补全答案 ${SUPPLEMENTED_ANSWERS.length} 题，Word 原文答案 ${parsed.questions.length - SUPPLEMENTED_ANSWERS.length} 题`);

  if (parsed.issues.length) {
    console.log(`存在 ${parsed.issues.length} 个解析问题，请查看 ${path.relative(ROOT_DIR, OUTPUT_REPORT)}`);
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
