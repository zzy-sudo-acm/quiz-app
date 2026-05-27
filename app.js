const STORAGE_KEY = "minimal_quiz_network_state_v1";

const typeLabel = {
  single: "单选题",
  multiple: "多选题",
  judge: "判断题",
};

const elements = {
  statusText: document.querySelector("#statusText"),
  restartBtn: document.querySelector("#restartBtn"),
  sequenceBtn: document.querySelector("#sequenceBtn"),
  randomBtn: document.querySelector("#randomBtn"),
  wrongBookBtn: document.querySelector("#wrongBookBtn"),
  reshuffleBtn: document.querySelector("#reshuffleBtn"),
  quizPanel: document.querySelector("#quizPanel"),
  emptyPanel: document.querySelector("#emptyPanel"),
  emptyTitle: document.querySelector("#emptyTitle"),
  emptyText: document.querySelector("#emptyText"),
  progressText: document.querySelector("#progressText"),
  typeText: document.querySelector("#typeText"),
  questionText: document.querySelector("#questionText"),
  questionMedia: document.querySelector("#questionMedia"),
  optionsList: document.querySelector("#optionsList"),
  submitBtn: document.querySelector("#submitBtn"),
  resultText: document.querySelector("#resultText"),
  nextBtn: document.querySelector("#nextBtn"),
};

let questions = [];
let questionById = new Map();
let state = createDefaultState();

function createDefaultState() {
  return {
    mode: "sequence",
    sequence: createProgress(),
    random: createProgress({ order: [] }),
    wrongBook: createProgress({ order: [] }),
    mistakes: [],
  };
}

function createProgress(extra = {}) {
  return {
    index: 0,
    selected: [],
    answered: false,
    correct: null,
    ...extra,
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || typeof saved !== "object") {
      return createDefaultState();
    }
    const mode = ["sequence", "random", "wrongBook"].includes(saved.mode)
      ? saved.mode
      : "sequence";
    return {
      mode,
      sequence: { ...createProgress(), ...(saved.sequence || {}) },
      random: { ...createProgress({ order: [] }), ...(saved.random || {}) },
      wrongBook: { ...createProgress({ order: [] }), ...(saved.wrongBook || {}) },
      mistakes: Array.isArray(saved.mistakes) ? saved.mistakes : [],
    };
  } catch {
    return createDefaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function resetProgress(progress, keepOrder = false) {
  const order = keepOrder ? progress.order || [] : [];
  Object.assign(progress, createProgress(keepOrder ? { order } : {}));
}

function sanitizeState() {
  const validIds = new Set(questions.map((question) => question.id));

  state.sequence.index = clampIndex(state.sequence.index);
  state.sequence.selected = cleanSelection(state.sequence.selected);
  state.mistakes = cleanIdList(state.mistakes, validIds);

  const randomOrder = Array.isArray(state.random.order) ? state.random.order : [];
  const orderIsValid =
    randomOrder.length === questions.length &&
    randomOrder.every((id) => validIds.has(id)) &&
    new Set(randomOrder).size === questions.length;

  if (!orderIsValid) {
    state.random.order = shuffle(questions.map((question) => question.id));
    resetProgress(state.random, true);
  } else {
    state.random.index = clampIndex(state.random.index);
    state.random.selected = cleanSelection(state.random.selected);
  }

  const mistakeIds = new Set(state.mistakes);
  state.wrongBook.order = cleanIdList(state.wrongBook.order, mistakeIds);
  const missingWrongIds = state.mistakes.filter((id) => !state.wrongBook.order.includes(id));
  if (state.mode === "wrongBook" && state.mistakes.length > 0 && state.wrongBook.order.length === 0) {
    state.wrongBook.order = shuffle(state.mistakes);
  } else if (state.mode === "wrongBook" && missingWrongIds.length > 0) {
    state.wrongBook.order = [...state.wrongBook.order, ...shuffle(missingWrongIds)];
  }
  state.wrongBook.index = clampIndex(state.wrongBook.index, state.wrongBook.order.length);
  state.wrongBook.selected = cleanSelection(state.wrongBook.selected);
}

function cleanSelection(value) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string").map((item) => item.toUpperCase())
    : [];
}

function cleanIdList(value, validIds) {
  const seen = new Set();
  const ids = [];
  if (!Array.isArray(value)) {
    return ids;
  }
  for (const item of value) {
    const id = Number(item);
    if (Number.isInteger(id) && validIds.has(id) && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

function clampIndex(value, total = questions.length) {
  const numeric = Number.isInteger(value) ? value : 0;
  return Math.min(Math.max(numeric, 0), total);
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function getActiveProgress() {
  if (state.mode === "wrongBook") {
    return state.wrongBook;
  }
  return state[state.mode];
}

function getActiveTotal() {
  if (state.mode === "wrongBook") {
    return state.wrongBook.order.length;
  }
  return questions.length;
}

function getModeTitle() {
  if (state.mode === "random") {
    return "随机刷题";
  }
  if (state.mode === "wrongBook") {
    return "错题本";
  }
  return "顺序刷题";
}

function getCurrentQuestion() {
  const progress = getActiveProgress();
  const total = getActiveTotal();
  if (progress.index >= total) {
    return null;
  }
  if (state.mode === "random") {
    return questionById.get(progress.order[progress.index]) || null;
  }
  if (state.mode === "wrongBook") {
    return questionById.get(progress.order[progress.index]) || null;
  }
  return questions[progress.index] || null;
}

function setMode(mode) {
  state.mode = mode;
  if (mode === "random" && state.random.order.length !== questions.length) {
    state.random.order = shuffle(questions.map((question) => question.id));
    resetProgress(state.random, true);
  }
  if (mode === "wrongBook") {
    state.wrongBook.order = shuffle(state.mistakes);
    resetProgress(state.wrongBook, true);
  }
  saveState();
  render();
}

function restartCurrentMode() {
  if (state.mode === "random") {
    resetProgress(state.random, true);
  } else if (state.mode === "wrongBook") {
    state.wrongBook.order = state.wrongBook.order.filter((id) => state.mistakes.includes(id));
    resetProgress(state.wrongBook, true);
  } else {
    resetProgress(state.sequence);
  }
  saveState();
  render();
}

function reshuffle() {
  state.mode = "random";
  state.random.order = shuffle(questions.map((question) => question.id));
  resetProgress(state.random, true);
  saveState();
  render();
}

function selectOption(key) {
  const question = getCurrentQuestion();
  const progress = getActiveProgress();
  if (!question || progress.answered) {
    return;
  }

  if (question.type === "multiple") {
    const selected = new Set(progress.selected);
    if (selected.has(key)) {
      selected.delete(key);
    } else {
      selected.add(key);
    }
    progress.selected = [...selected].sort();
  } else {
    progress.selected = [key];
    gradeCurrentQuestion();
    return;
  }

  saveState();
  render();
}

function gradeCurrentQuestion() {
  const question = getCurrentQuestion();
  const progress = getActiveProgress();
  if (!question || progress.answered || progress.selected.length === 0) {
    return;
  }

  const selected = [...progress.selected].sort();
  const answer = [...question.answer].sort();
  progress.answered = true;
  progress.correct = selected.length === answer.length && selected.every((key, index) => key === answer[index]);
  if (progress.correct && state.mode === "wrongBook") {
    removeMistake(question.id);
  }
  if (!progress.correct) {
    addMistake(question.id);
  }
  saveState();
  render();
}

function goNext() {
  const progress = getActiveProgress();
  if (!progress.answered) {
    return;
  }
  const question = getCurrentQuestion();
  if (state.mode === "wrongBook" && progress.correct && question) {
    const previousLength = progress.order.length;
    progress.order = progress.order.filter((id) => id !== question.id);
    if (progress.order.length === previousLength) {
      progress.index += 1;
    }
    progress.index = clampIndex(progress.index, progress.order.length);
  } else {
    progress.index += 1;
  }
  progress.selected = [];
  progress.answered = false;
  progress.correct = null;
  saveState();
  render();
}

function addMistake(id) {
  if (!state.mistakes.includes(id)) {
    state.mistakes.push(id);
  }
}

function removeMistake(id) {
  state.mistakes = state.mistakes.filter((item) => item !== id);
}

function render() {
  elements.sequenceBtn.classList.toggle("active", state.mode === "sequence");
  elements.randomBtn.classList.toggle("active", state.mode === "random");
  elements.wrongBookBtn.classList.toggle("active", state.mode === "wrongBook");
  elements.wrongBookBtn.textContent = `错题本（${state.mistakes.length}）`;

  if (!questions.length) {
    showEmpty("题库为空", "请先运行 node scripts/convert-docx-questions.js 生成 questions.json。");
    return;
  }

  const progress = getActiveProgress();
  const question = getCurrentQuestion();
  if (state.mode === "wrongBook" && state.mistakes.length === 0 && !question) {
    showEmpty("错题本", "暂无错题，做错的题会自动加入这里", "错题本");
    return;
  }
  if (!question) {
    renderFinished();
    return;
  }

  elements.emptyPanel.hidden = true;
  elements.quizPanel.hidden = false;
  const total = getActiveTotal();
  elements.statusText.textContent = getModeTitle();
  elements.progressText.textContent = `第 ${progress.index + 1} / ${total} 题`;
  elements.typeText.textContent = typeLabel[question.type] || question.type;
  elements.questionText.textContent = question.question;

  renderQuestionImage(question);
  renderOptions(question, progress);
  renderActions(question, progress);
}

function renderQuestionImage(question) {
  elements.questionMedia.innerHTML = "";
  elements.questionMedia.hidden = true;

  if (!question.image) {
    return;
  }

  const image = document.createElement("img");
  image.src = question.image;
  image.alt = "题目配图";
  image.loading = "lazy";
  image.addEventListener("error", () => {
    elements.questionMedia.innerHTML = "";
    const fallback = document.createElement("p");
    fallback.className = "image-fallback";
    fallback.textContent = "图片加载失败";
    elements.questionMedia.append(fallback);
  });

  elements.questionMedia.append(image);
  elements.questionMedia.hidden = false;
}

function renderOptions(question, progress) {
  elements.optionsList.innerHTML = "";
  const selected = new Set(progress.selected);

  for (const option of question.options) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "option-button";
    button.classList.toggle("selected", selected.has(option.key));
    button.classList.toggle("locked", progress.answered);
    button.disabled = progress.answered;
    button.addEventListener("click", () => selectOption(option.key));

    const key = document.createElement("span");
    key.className = "option-key";
    key.textContent = `${option.key}.`;

    const text = document.createElement("span");
    text.className = "option-text";
    text.textContent = option.text;

    button.append(key, text);
    elements.optionsList.append(button);
  }
}

function renderActions(question, progress) {
  const isMultiple = question.type === "multiple";
  elements.submitBtn.hidden = !isMultiple || progress.answered;
  elements.submitBtn.disabled = progress.selected.length === 0 || progress.answered;

  const total = getActiveTotal();
  elements.nextBtn.disabled = !progress.answered;
  elements.nextBtn.textContent = progress.index + 1 >= total ? "完成本轮" : "下一题";

  elements.resultText.className = "result-text";
  if (!progress.answered) {
    elements.resultText.textContent = "";
    return;
  }

  if (progress.correct) {
    elements.resultText.textContent = "回答正确";
    elements.resultText.classList.add("correct");
  } else {
    elements.resultText.textContent = `回答错误，正确答案是：${question.answer.join("")}`;
    elements.resultText.classList.add("wrong");
  }
}

function renderFinished() {
  const total = getActiveTotal();
  elements.quizPanel.hidden = false;
  elements.emptyPanel.hidden = true;
  elements.statusText.textContent = getModeTitle();
  elements.progressText.textContent = `第 ${total} / ${total} 题`;
  elements.typeText.textContent = "已完成";
  elements.questionText.textContent = state.mode === "wrongBook" ? "本轮错题练习完成" : "本轮刷题完成";
  elements.questionMedia.innerHTML = "";
  elements.questionMedia.hidden = true;
  elements.optionsList.innerHTML = "";
  elements.submitBtn.hidden = true;
  elements.resultText.className = "result-text";
  elements.resultText.textContent = "";
  elements.nextBtn.disabled = true;
  elements.nextBtn.textContent = "已完成";
}

function showEmpty(title, text, status = "题库不可用") {
  elements.quizPanel.hidden = true;
  elements.emptyPanel.hidden = false;
  elements.questionMedia.innerHTML = "";
  elements.questionMedia.hidden = true;
  elements.emptyTitle.textContent = title;
  elements.emptyText.textContent = text;
  elements.statusText.textContent = status;
}

async function boot() {
  try {
    const response = await fetch("questions.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      questions = [];
      showEmpty("题库为空", "请先运行 node scripts/convert-docx-questions.js 生成 questions.json。");
      return;
    }

    questions = data;
    questionById = new Map(questions.map((question) => [question.id, question]));
    state = loadState();
    sanitizeState();
    saveState();
    render();
  } catch (error) {
    showEmpty("题库加载失败", "请通过 python -m http.server 8000 启动后访问。");
  }
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}

elements.sequenceBtn.addEventListener("click", () => setMode("sequence"));
elements.randomBtn.addEventListener("click", () => setMode("random"));
elements.wrongBookBtn.addEventListener("click", () => setMode("wrongBook"));
elements.restartBtn.addEventListener("click", restartCurrentMode);
elements.reshuffleBtn.addEventListener("click", reshuffle);
elements.submitBtn.addEventListener("click", gradeCurrentQuestion);
elements.nextBtn.addEventListener("click", goNext);

registerServiceWorker();
boot();
