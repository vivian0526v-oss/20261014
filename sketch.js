// ======================================================
// p5.js Google Sheets 題庫測驗系統
// 功能：
// 1. 從 Google Sheets 發布的公開 CSV 載入題庫。
// 2. 每次從完整有效題庫不重複隨機抽出 5 題。
// 3. 每題 20 分，滿分 100 分，60 分以上通過。
// 4. 保留答對、答錯與正確答案的顏色及動畫。
// 5. 通過顯示煙火；未通過顯示星星與愛心加油特效。
// 6. 支援電腦、平板、手機直向與橫向畫面。
// ======================================================

// ------------------------------------------------------
// Google Sheets CSV 設定區
// ------------------------------------------------------
// 請只修改下面這一行，貼上 Google 試算表「發布到網路」後的 CSV 網址。
// 網址格式通常如下：
// https://docs.google.com/spreadsheets/d/試算表ID/export?format=csv&gid=工作表ID
// 注意：試算表必須公開發布，且第一列欄位名稱必須完全符合下方六個欄位。
const GOOGLE_SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQHFfOwMuoegT5-CNigGFH5iP66oQNXkxRSAZxSU-X-K9vxib_JI1MepKa22mTckxLUN70QmjVQP7TD/pub?gid=1439523259&single=true&output=csv";

// ------------------------------------------------------
// Google Fonts 字型名稱
// ------------------------------------------------------
const CHINESE_FONT = "LXGW WenKai Mono TC"; // 繁體中文主要使用的字型
const ENGLISH_FONT = "Indie Flower"; // 英文標籤與英文字母使用的字型

// ------------------------------------------------------
// 測驗規則設定
// ------------------------------------------------------
const QUIZ_QUESTION_COUNT = 5; // 每回合固定抽出五題
const POINTS_PER_QUESTION = 20; // 每題答對可得二十分
const PASSING_SCORE = 60; // 六十分以上判定為通過

// ------------------------------------------------------
// 顏色設定
// ------------------------------------------------------
const COLORS = {
  background: "#e3d5ca", // 畫布背景顏色
  normal: "#ffffff", // 尚未作答的選項顏色
  correct: "#e9edc9", // 答對時使用者選項顏色
  wrong: "#ffccd5", // 答錯時使用者選項顏色
  answer: "#d88180", // 答錯後正確答案顏色
  darkText: "#3d3d3d", // 一般文字顏色
  button: "#9cafb7", // 按鈕背景顏色
  buttonHover: "#78909c", // 按鈕滑過顏色
  border: "#777777", // 選項外框顏色
  loading: "#52734d", // 載入中文字顏色
  error: "#a44a5b" // 錯誤中文字顏色
};

// ------------------------------------------------------
// 題庫與載入狀態
// ------------------------------------------------------
let allQuestions = []; // 儲存 Google Sheets 載入後的完整有效題庫
let quizQuestions = []; // 儲存目前這一回合抽出的五題
let isLoadingQuestions = true; // 是否正在載入題庫
let loadErrorMessage = ""; // 顯示給使用者的載入錯誤訊息

// ------------------------------------------------------
// 測驗狀態
// ------------------------------------------------------
let currentQuestionIndex = 0; // 目前題目索引
let selectedIndex = -1; // 使用者選擇的選項索引；-1 代表尚未作答
let correctCount = 0; // 目前答對題數
let quizFinished = false; // 是否已完成五題

// ------------------------------------------------------
// p5.js DOM 按鈕與畫面資料
// ------------------------------------------------------
let nextButton; // 下一題按鈕
let restartButton; // 重新測驗按鈕
let reloadButton; // 題庫失敗時的重新載入按鈕
let optionAreas = []; // 儲存四個選項的點擊範圍
let layout; // 儲存目前畫面尺寸對應的響應式版面

// ------------------------------------------------------
// 成績特效狀態
// ------------------------------------------------------
let resultEffectType = "none"; // 特效類型：none、fireworks 或 encouragement
let resultEffectInitialized = false; // 是否已建立目前成績特效
let fireworkBursts = []; // 煙火爆炸中心資料
let fireworkParticles = []; // 煙火粒子資料
let encouragementParticles = []; // 星星與愛心粒子資料

// ------------------------------------------------------
// 特效數量上限，避免手機效能負擔過大
// ------------------------------------------------------
const EFFECT_LIMITS = {
  maxBursts: 5, // 同時存在的煙火中心上限
  maxFireworkParticles: 220, // 煙火粒子總數上限
  maxEncouragementParticles: 46 // 星星與愛心總數上限
};

// ======================================================
// p5.js 初始化函式
// ======================================================
function setup() {
  // 建立符合瀏覽器視窗大小的全螢幕畫布
  createCanvas(windowWidth, windowHeight);

  // 設定文字以水平與垂直置中方式繪製
  textAlign(CENTER, CENTER);

  // 設定預設中文字型
  textFont(CHINESE_FONT);

  // 計算初始響應式版面
  layout = getResponsiveLayout();

  // 建立下一題按鈕並設定點擊事件
  nextButton = createButton("下一題");
  styleButton(nextButton);
  nextButton.mousePressed(goToNextQuestion);

  // 建立重新測驗按鈕並設定點擊事件
  restartButton = createButton("重新測驗");
  styleButton(restartButton);
  restartButton.mousePressed(restartQuiz);

  // 建立題庫重新載入按鈕並設定點擊事件
  reloadButton = createButton("重新載入題庫");
  styleButton(reloadButton);
  reloadButton.mousePressed(loadQuestionBank);

  // 初始狀態先隱藏三個按鈕
  nextButton.hide();
  restartButton.hide();
  reloadButton.hide();

  // 開始從 Google Sheets 載入題庫
  loadQuestionBank();
}

// ======================================================
// p5.js 每一幀繪圖函式
// ======================================================
function draw() {
  // 每一幀重新取得版面，確保視窗尺寸改變後能立即適應
  layout = getResponsiveLayout();

  // 填滿畫布背景
  background(COLORS.background);

  // 題庫載入期間顯示載入畫面
  if (isLoadingQuestions) {
    drawLoadingScreen();
    return;
  }

  // 題庫載入失敗時顯示錯誤畫面
  if (loadErrorMessage !== "") {
    drawErrorScreen();
    return;
  }

  // 題庫載入成功後，依照測驗狀態顯示答題或成績畫面
  if (quizFinished) {
    drawResultScreen();
  } else {
    drawQuizScreen();
  }
}

// ======================================================
// Google Sheets 題庫載入
// ======================================================
function loadQuestionBank() {
  // 設定為載入中，避免重新載入時仍顯示舊畫面
  isLoadingQuestions = true;
  loadErrorMessage = "";
  allQuestions = [];
  quizQuestions = [];
  quizFinished = false;

  // 載入期間隱藏所有操作按鈕
  nextButton.hide();
  restartButton.hide();
  reloadButton.hide();

  // 在網址後加入時間戳，避免瀏覽器或代理伺服器使用舊 CSV 快取
  const separator = GOOGLE_SHEET_CSV_URL.includes("?") ? "&" : "?";
  const cacheBustedUrl = `${GOOGLE_SHEET_CSV_URL}${separator}quizCache=${Date.now()}`;

  // 使用 p5.js loadTable 直接讀取 Google Sheets 發布的 CSV
  loadTable(
    cacheBustedUrl,
    "csv",
    "header",
    handleTableLoaded,
    handleTableError
  );
}

// ------------------------------------------------------
// CSV 載入成功回呼
// ------------------------------------------------------
function handleTableLoaded(table) {
  // 取得並清理欄位名稱，處理 UTF-8 BOM 與欄位名稱前後空白
  const columnMap = createColumnMap(table);

  // 定義本測驗要求的六個欄位
  const requiredColumns = [
    "question",
    "optionA",
    "optionB",
    "optionC",
    "optionD",
    "answerIndex"
  ];

  // 找出缺少的欄位
  const missingColumns = requiredColumns.filter(
    (columnName) => columnMap[columnName] === undefined
  );

  // 欄位不完整時停止處理並顯示明確錯誤
  if (missingColumns.length > 0) {
    handleTableError(
      `Google Sheets 缺少欄位：${missingColumns.join(", ")}。`
    );
    return;
  }

  // 逐列讀取並驗證 CSV 題目
  for (let rowIndex = 0; rowIndex < table.getRowCount(); rowIndex++) {
    // 取得目前資料列
    const row = table.getRow(rowIndex);

    // 從指定欄位讀取並清理資料
    const question = cleanCell(row.getString(columnMap.question));
    const optionA = cleanCell(row.getString(columnMap.optionA));
    const optionB = cleanCell(row.getString(columnMap.optionB));
    const optionC = cleanCell(row.getString(columnMap.optionC));
    const optionD = cleanCell(row.getString(columnMap.optionD));
    const answerText = cleanCell(row.getString(columnMap.answerIndex));

    // 將答案索引轉成數字；只接受 0、1、2、3
    const answerIndex = Number(answerText);
    const isAnswerIndexValid = /^[0-3]$/.test(answerText);

    // 略過空白列、欄位不完整列與答案索引錯誤列
    if (
      question === "" ||
      optionA === "" ||
      optionB === "" ||
      optionC === "" ||
      optionD === "" ||
      !isAnswerIndexValid ||
      !Number.isInteger(answerIndex)
    ) {
      continue;
    }

    // 將一列資料轉成測驗使用的題目物件
    allQuestions.push({
      question: question,
      options: [optionA, optionB, optionC, optionD],
      answerIndex: answerIndex
    });
  }

  // 題庫至少需要五題，否則無法完成指定的五題測驗
  if (allQuestions.length < QUIZ_QUESTION_COUNT) {
    handleTableError(
      `有效題目只有 ${allQuestions.length} 題，至少需要 ${QUIZ_QUESTION_COUNT} 題。`
    );
    return;
  }

  // 設定載入成功狀態
  isLoadingQuestions = false;
  loadErrorMessage = "";

  // 從完整題庫開始第一回合測驗
  startNewQuiz();
}

// ------------------------------------------------------
// CSV 載入失敗回呼
// ------------------------------------------------------
function handleTableError(error) {
  // 設定載入結束但發生錯誤
  isLoadingQuestions = false;

  // 將錯誤內容轉成可讀文字；若無內容則使用一般提示
  const detail = error ? String(error) : "請檢查網址與發布設定。";
  loadErrorMessage = `無法讀取 Google Sheets 題庫。${detail}`;

  // 顯示重新載入按鈕，讓老師修正設定後可直接重試
  reloadButton.show();
}

// ------------------------------------------------------
// 建立清理後的欄位名稱對照表
// ------------------------------------------------------
function createColumnMap(table) {
  // 建立空的欄位名稱對照表
  const columnMap = {};

  // 逐一清理欄位名稱並記錄其欄位索引
  for (let columnIndex = 0; columnIndex < table.columns.length; columnIndex++) {
    const columnName = cleanCell(table.columns[columnIndex]);
    columnMap[columnName] = columnIndex;
  }

  // 回傳欄位名稱到索引的對照表
  return columnMap;
}

// ------------------------------------------------------
// 清理 Google Sheets CSV 儲存格內容
// ------------------------------------------------------
function cleanCell(value) {
  // 將 null 或 undefined 轉成空字串，再移除 BOM 與前後空白
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .trim();
}

// ======================================================
// 抽題與測驗流程
// ======================================================
function sampleQuestions() {
  // 複製完整題庫，避免改變原始題庫的排列順序
  const shuffledQuestions = [...allQuestions];

  // 使用 Fisher-Yates 洗牌，確保每題抽出機率均等
  for (let index = shuffledQuestions.length - 1; index > 0; index--) {
    // 隨機決定交換位置
    const randomIndex = floor(random(index + 1));

    // 交換兩個題目物件
    [shuffledQuestions[index], shuffledQuestions[randomIndex]] = [
      shuffledQuestions[randomIndex],
      shuffledQuestions[index]
    ];
  }

  // 取出前五題；因為洗牌來自完整陣列，所以同回合不會重複
  return shuffledQuestions.slice(0, QUIZ_QUESTION_COUNT);
}

function startNewQuiz() {
  // 每次開始或重新測驗，都從已載入的完整題庫重新抽五題
  quizQuestions = sampleQuestions();

  // 重設所有答題狀態
  currentQuestionIndex = 0;
  selectedIndex = -1;
  correctCount = 0;
  quizFinished = false;

  // 清除上一回合的成績特效
  resetResultEffects();

  // 隱藏不應出現的按鈕
  nextButton.hide();
  restartButton.hide();
  reloadButton.hide();
}

function chooseAnswer(answerIndex) {
  // 題庫尚未準備好、測驗已完成或本題已作答時不處理
  if (
    isLoadingQuestions ||
    loadErrorMessage !== "" ||
    quizFinished ||
    selectedIndex !== -1
  ) {
    return;
  }

  // 檢查答案索引是否在四個選項範圍內
  if (answerIndex < 0 || answerIndex >= 4) {
    return;
  }

  // 記錄使用者選擇的選項
  selectedIndex = answerIndex;

  // 答案正確時增加答對題數
  if (selectedIndex === quizQuestions[currentQuestionIndex].answerIndex) {
    correctCount++;
  }
}

function goToNextQuestion() {
  // 尚未作答時不允許跳到下一題
  if (selectedIndex === -1) {
    return;
  }

  // 還有下一題時，清除選擇並前進
  if (currentQuestionIndex < quizQuestions.length - 1) {
    currentQuestionIndex++;
    selectedIndex = -1;
    nextButton.hide();
    return;
  }

  // 完成第五題後進入成績畫面
  quizFinished = true;
  nextButton.hide();
  startResultEffects();
}

function restartQuiz() {
  // 保留已載入的完整題庫，只重新隨機抽出五題
  if (allQuestions.length >= QUIZ_QUESTION_COUNT) {
    startNewQuiz();
  }
}

// ======================================================
// 載入與錯誤畫面
// ======================================================
function drawLoadingScreen() {
  // 隱藏不應出現的按鈕
  nextButton.hide();
  restartButton.hide();
  reloadButton.hide();

  // 使用繁體中文字型繪製載入訊息
  useChineseFont();
  fill(COLORS.loading);
  textStyle(BOLD);
  textSize(layout.resultTitleSize);
  text("正在載入題庫……", width / 2, height * 0.42);

  // 顯示簡短英文標籤，實際使用 Indie Flower 字型
  useEnglishFont();
  textStyle(NORMAL);
  textSize(layout.englishLabelSize);
  text("Loading questions...", width / 2, height * 0.53);
}

function drawErrorScreen() {
  // 使用繁體中文字型繪製錯誤標題
  useChineseFont();
  fill(COLORS.error);
  textStyle(BOLD);
  textSize(layout.resultTitleSize);
  text("題庫載入失敗", width / 2, height * 0.25);

  // 繪製錯誤說明，支援中英文及長文字換行
  textStyle(NORMAL);
  textSize(layout.messageSize);
  drawResponsiveText(
    loadErrorMessage,
    width / 2,
    height * 0.43,
    layout.questionWidth,
    layout.questionLineHeight
  );

  // 顯示重新載入按鈕
  reloadButton.show();
  reloadButton.position(
    width / 2 - layout.buttonWidth / 2,
    min(height * 0.68, height - layout.buttonHeight - 14)
  );
  reloadButton.size(layout.buttonWidth, layout.buttonHeight);
}

// ======================================================
// 答題畫面
// ======================================================
function drawQuizScreen() {
  // 取得目前題目
  const currentQuestion = quizQuestions[currentQuestionIndex];

  // 答題畫面不顯示成績與錯誤相關按鈕
  restartButton.hide();
  reloadButton.hide();

  // 使用中文字型繪製中文標題
  useChineseFont();
  fill(COLORS.darkText);
  textStyle(BOLD);
  textSize(layout.titleSize);
  text("p5.js 簡易指令練習測驗", width / 2, layout.titleY);

  // 使用 Indie Flower 顯示英文小標籤，保留兩種 Google Fonts 的使用
  useEnglishFont();
  textStyle(NORMAL);
  textSize(layout.englishLabelSize);
  text("p5.js QUIZ", width / 2, layout.englishLabelY);

  // 顯示目前題數
  useChineseFont();
  textSize(layout.progressSize);
  text(`第 ${currentQuestionIndex + 1} 題／共 ${quizQuestions.length} 題`, width / 2, layout.progressY);

  // 繪製題目文字
  textStyle(BOLD);
  textSize(layout.questionSize);
  drawResponsiveText(
    currentQuestion.question,
    width / 2,
    layout.questionY,
    layout.questionWidth,
    layout.questionLineHeight
  );

  // 清除上一幀選項區域並繪製四個選項
  optionAreas = [];
  for (let index = 0; index < currentQuestion.options.length; index++) {
    drawOption(
      currentQuestion.options[index],
      index,
      layout.optionX,
      layout.optionStartY + index * layout.optionGap,
      layout.optionWidth,
      layout.optionHeight
    );
  }

  // 作答後顯示結果訊息與下一題按鈕
  if (selectedIndex !== -1) {
    drawAnswerMessage();

    nextButton.show();
    nextButton.position(
      width / 2 - layout.buttonWidth / 2,
      layout.nextButtonY
    );
    nextButton.size(layout.buttonWidth, layout.buttonHeight);
  } else {
    nextButton.hide();
  }
}

function drawOption(label, index, x, y, optionWidth, optionHeight) {
  // 取得目前題目及其正確答案索引
  const currentQuestion = quizQuestions[currentQuestionIndex];

  // 建立繪製位置副本，讓動畫不改變實際點擊範圍
  let drawX = x;
  let drawY = y;

  // 預設選項使用白色背景
  let optionColor = color(COLORS.normal);

  // 作答後依照答題結果設定顏色與動畫
  if (selectedIndex !== -1) {
    // 使用者選到的選項使用答對或答錯顏色
    if (index === selectedIndex) {
      optionColor = color(
        index === currentQuestion.answerIndex
          ? COLORS.correct
          : COLORS.wrong
      );
    }

    // 使用者答錯時，將正確答案標示為指定的紅色
    if (
      index === currentQuestion.answerIndex &&
      selectedIndex !== currentQuestion.answerIndex
    ) {
      optionColor = color(COLORS.answer);
    }

    // 計算選項跳動與移動動畫位移
    const animationOffset = sin(frameCount * 0.12) * 8;

    // 答對選項上下跳動
    if (
      index === selectedIndex &&
      index === currentQuestion.answerIndex
    ) {
      drawY += animationOffset;
    }

    // 答錯選項左右移動
    if (
      index === selectedIndex &&
      index !== currentQuestion.answerIndex
    ) {
      drawX += animationOffset;
    }

    // 答錯時正確答案上下跳動
    if (
      index === currentQuestion.answerIndex &&
      selectedIndex !== currentQuestion.answerIndex
    ) {
      drawY += animationOffset;
    }
  }

  // 儲存未動畫位移的點擊區域，避免使用者難以點擊移動中的選項
  optionAreas[index] = {
    x: x,
    y: y,
    width: optionWidth,
    height: optionHeight
  };

  // 設定選項陰影
  drawingContext.shadowBlur = 8;
  drawingContext.shadowColor = "rgba(0, 0, 0, 0.18)";

  // 繪製選項背景與外框
  fill(optionColor);
  stroke(COLORS.border);
  strokeWeight(2);
  rect(drawX, drawY, optionWidth, optionHeight, 12);

  // 清除陰影，避免影響後續文字與特效
  drawingContext.shadowBlur = 0;

  // 繪製選項文字
  useChineseFont();
  fill(COLORS.darkText);
  textStyle(NORMAL);
  textSize(layout.optionTextSize);
  drawResponsiveText(
    `${String.fromCharCode(65 + index)}. ${label}`,
    drawX + optionWidth / 2,
    drawY + optionHeight / 2,
    optionWidth - layout.optionPadding * 2,
    layout.optionLineHeight
  );
}

function drawAnswerMessage() {
  // 取得目前題目的正確答案索引
  const currentQuestion = quizQuestions[currentQuestionIndex];

  // 使用繁體中文字型顯示答題結果
  useChineseFont();
  textStyle(BOLD);
  textSize(layout.messageSize);

  // 依照答題結果顯示不同訊息
  if (selectedIndex === currentQuestion.answerIndex) {
    fill("#52734d");
    text("答對了！", width / 2, layout.messageY);
  } else {
    fill("#a44a5b");
    text(
      `答錯了！正確答案是 ${String.fromCharCode(65 + currentQuestion.answerIndex)}`,
      width / 2,
      layout.messageY
    );
  }
}

// ======================================================
// 成績畫面與特效
// ======================================================
function drawResultScreen() {
  // 第一次繪製成績畫面時確保特效已建立
  if (!resultEffectInitialized) {
    startResultEffects();
  }

  // 先繪製背景特效，再繪製文字，讓資訊保持清楚
  if (resultEffectType === "fireworks") {
    drawFireworkEffect();
  } else if (resultEffectType === "encouragement") {
    drawEncouragementEffect();
  }

  // 隱藏下一題按鈕並顯示重新測驗按鈕
  nextButton.hide();
  restartButton.show();
  restartButton.position(
    width / 2 - layout.buttonWidth / 2,
    layout.restartButtonY
  );
  restartButton.size(layout.buttonWidth, layout.buttonHeight);

  // 計算總分及是否通過
  const totalScore = correctCount * POINTS_PER_QUESTION;
  const passed = totalScore >= PASSING_SCORE;

  // 繪製成績文字
  useChineseFont();
  fill(COLORS.darkText);
  textStyle(BOLD);
  textSize(layout.resultTitleSize);
  text("測驗完成！", width / 2, layout.resultTitleY);

  textSize(layout.scoreSize);
  text(`答對 ${correctCount}／${quizQuestions.length} 題`, width / 2, layout.scoreY);

  textSize(layout.percentageSize);
  text(`總成績：${totalScore} 分`, width / 2, layout.percentageY);

  // 顯示通過或加油訊息
  textSize(layout.encourageSize);
  if (passed) {
    fill("#52734d");
    text(
      totalScore === 100 ? "太棒了！全部答對！" : "恭喜通過！繼續保持！",
      width / 2,
      layout.encourageY
    );
  } else {
    fill("#a44a5b");
    text("加油！再練習一次，你一定會進步！", width / 2, layout.encourageY);
  }

  // 顯示明確的通過狀態
  textStyle(NORMAL);
  textSize(layout.statusSize);
  fill(COLORS.darkText);
  text(
    passed ? "已通過（60 分以上）" : "尚未達到 60 分，再接再厲！",
    width / 2,
    layout.statusY
  );
}

function startResultEffects() {
  // 先清除前一輪的特效資料
  resetResultEffects();

  // 依照總分決定顯示煙火或加油特效
  resultEffectType = correctCount * POINTS_PER_QUESTION >= PASSING_SCORE
    ? "fireworks"
    : "encouragement";

  // 標記特效已初始化
  resultEffectInitialized = true;

  // 建立初始特效
  if (resultEffectType === "fireworks") {
    createFireworkBurst();
    createFireworkBurst();
  } else {
    createEncouragementParticles();
  }
}

function resetResultEffects() {
  // 清空所有粒子與煙火資料
  fireworkBursts = [];
  fireworkParticles = [];
  encouragementParticles = [];

  // 重設特效狀態
  resultEffectType = "none";
  resultEffectInitialized = false;
}

// ------------------------------------------------------
// 煙火特效
// ------------------------------------------------------
function createFireworkBurst() {
  // 將煙火安排在畫面左右兩側，避免遮住主要成績文字
  const leftSide = random() < 0.5;
  const burstX = leftSide
    ? random(width * 0.10, width * 0.32)
    : random(width * 0.68, width * 0.90);
  const burstY = random(height * 0.08, height * 0.30);

  // 超過中心數量上限時移除最早的煙火
  if (fireworkBursts.length >= EFFECT_LIMITS.maxBursts) {
    fireworkBursts.shift();
  }

  // 建立煙火中心資料
  const burstColor = color(
    random(180, 255),
    random(70, 240),
    random(80, 255),
    235
  );
  const maxLife = random(50, 78);

  fireworkBursts.push({
    x: burstX,
    y: burstY,
    color: burstColor,
    age: 0,
    life: 1,
    maxLife: maxLife
  });

  // 建立由爆炸中心向外飛散的粒子
  const particleCount = floor(random(30, 46));
  for (let index = 0; index < particleCount; index++) {
    if (fireworkParticles.length >= EFFECT_LIMITS.maxFireworkParticles) {
      break;
    }

    const angle = random(TWO_PI);
    const speed = random(1.4, 4.8);
    const particleLife = random(45, 85);

    fireworkParticles.push({
      x: burstX,
      y: burstY,
      vx: cos(angle) * speed,
      vy: sin(angle) * speed,
      gravity: random(0.025, 0.075),
      size: random(2, 5),
      color: color(
        random(180, 255),
        random(70, 240),
        random(80, 255),
        245
      ),
      life: particleLife,
      maxLife: particleLife
    });
  }
}

function drawFireworkEffect() {
  // 定期產生新的煙火，讓特效持續播放
  if (frameCount % 42 === 0) {
    createFireworkBurst();
  }

  // 更新並繪製煙火中心光圈
  for (let index = fireworkBursts.length - 1; index >= 0; index--) {
    const burst = fireworkBursts[index];
    burst.age++;
    burst.life = 1 - burst.age / burst.maxLife;

    if (burst.life <= 0) {
      fireworkBursts.splice(index, 1);
      continue;
    }

    noStroke();
    fill(
      red(burst.color),
      green(burst.color),
      blue(burst.color),
      burst.life * 75
    );
    ellipse(burst.x, burst.y, 18 + (1 - burst.life) * 35);
  }

  // 更新並繪製煙火粒子
  for (let index = fireworkParticles.length - 1; index >= 0; index--) {
    const particle = fireworkParticles[index];
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.vy += particle.gravity;
    particle.vx *= 0.985;
    particle.life--;

    if (particle.life <= 0) {
      fireworkParticles.splice(index, 1);
      continue;
    }

    const alpha = map(particle.life, 0, particle.maxLife, 0, 235);
    noStroke();
    fill(
      red(particle.color),
      green(particle.color),
      blue(particle.color),
      alpha
    );
    ellipse(particle.x, particle.y, particle.size);
  }
}

// ------------------------------------------------------
// 星星與愛心加油特效
// ------------------------------------------------------
function createEncouragementParticles() {
  // 建立固定數量的星星與愛心，並讓它們從下方持續飄動
  while (encouragementParticles.length < EFFECT_LIMITS.maxEncouragementParticles) {
    const isHeart = random() < 0.35;
    const particleLife = random(180, 340);

    encouragementParticles.push({
      x: random(width * 0.08, width * 0.92),
      y: random(height * 0.04, height * 0.95),
      size: random(10, 20),
      speed: random(0.25, 0.75),
      sway: random(0.4, 1.2),
      phase: random(TWO_PI),
      rotation: random(-0.25, 0.25),
      rotationSpeed: random(-0.02, 0.02),
      color: color(
        random(210, 255),
        random(100, 220),
        random(120, 255),
        random(130, 220)
      ),
      type: isHeart ? "heart" : "star",
      life: particleLife,
      maxLife: particleLife
    });
  }
}

function drawEncouragementEffect() {
  // 更新每一個星星或愛心粒子
  for (const particle of encouragementParticles) {
    particle.y -= particle.speed;
    particle.x += sin(frameCount * 0.025 * particle.sway + particle.phase) * 0.45;
    particle.rotation += particle.rotationSpeed;
    particle.life--;

    // 粒子離開畫面或生命結束後，從畫面下方重新出現
    if (particle.life <= 0 || particle.y < -30) {
      particle.x = random(width * 0.08, width * 0.92);
      particle.y = height + random(10, 80);
      particle.life = random(180, 340);
      particle.maxLife = particle.life;
    }

    // 根據生命比例計算淡入淡出透明度
    const lifeRatio = particle.life / particle.maxLife;
    const alpha = constrain(
      min(lifeRatio * 2, (1 - lifeRatio) * 2) * 210,
      25,
      210
    );

    // 繪製旋轉中的圖形粒子
    push();
    translate(particle.x, particle.y);
    rotate(particle.rotation);
    noStroke();
    fill(
      red(particle.color),
      green(particle.color),
      blue(particle.color),
      alpha
    );

    if (particle.type === "heart") {
      drawHeart(0, 0, particle.size);
    } else {
      drawStar(0, 0, particle.size * 0.45, particle.size, 5);
    }
    pop();
  }
}

function drawStar(x, y, innerRadius, outerRadius, points) {
  // 交錯繪製內外半徑，組成星星形狀
  beginShape();
  for (let index = 0; index < points * 2; index++) {
    const angle = -HALF_PI + (index * PI) / points;
    const radius = index % 2 === 0 ? outerRadius : innerRadius;
    vertex(x + cos(angle) * radius, y + sin(angle) * radius);
  }
  endShape(CLOSE);
}

function drawHeart(x, y, size) {
  // 使用兩個圓形與一個三角形組成愛心
  ellipse(x - size * 0.28, y - size * 0.12, size * 0.58, size * 0.58);
  ellipse(x + size * 0.28, y - size * 0.12, size * 0.58, size * 0.58);
  triangle(
    x - size * 0.55,
    y,
    x + size * 0.55,
    y,
    x,
    y + size * 0.78
  );
}

// ======================================================
// 滑鼠、觸控與鍵盤操作
// ======================================================
function mousePressed() {
  // 題庫尚未完成載入、顯示錯誤或已完成測驗時不處理選項
  if (isLoadingQuestions || loadErrorMessage !== "" || quizFinished) {
    return;
  }

  // 檢查四個選項的點擊範圍
  for (let index = 0; index < optionAreas.length; index++) {
    const area = optionAreas[index];
    const isInside =
      mouseX >= area.x &&
      mouseX <= area.x + area.width &&
      mouseY >= area.y &&
      mouseY <= area.y + area.height;

    if (isInside) {
      chooseAnswer(index);
      break;
    }
  }
}

function keyPressed() {
  // 成績畫面按 R 可重新抽題開始
  if (quizFinished) {
    if (key === "r" || key === "R") {
      restartQuiz();
    }
    return;
  }

  // 尚未作答時允許使用數字鍵 1～4 選擇答案
  if (selectedIndex === -1) {
    const keyIndex = int(key) - 1;
    if (keyIndex >= 0 && keyIndex < 4) {
      chooseAnswer(keyIndex);
    }
    return;
  }

  // 作答後按 Enter 或空白鍵進入下一題
  if (keyCode === ENTER || key === " ") {
    goToNextQuestion();
  }
}

// ======================================================
// 按鈕樣式與字型函式
// ======================================================
function styleButton(button) {
  // 設定按鈕的外觀、觸控尺寸與字型
  button.style("font-family", `"${CHINESE_FONT}", monospace`);
  button.style("font-size", "18px");
  button.style("color", "#ffffff");
  button.style("background-color", COLORS.button);
  button.style("border", "none");
  button.style("border-radius", "10px");
  button.style("cursor", "pointer");
  button.style("min-height", "48px");
  button.style("padding", "8px 18px");
  button.style("touch-action", "manipulation");

  // 滑鼠移入時變更按鈕顏色
  button.mouseOver(() => button.style("background-color", COLORS.buttonHover));

  // 滑鼠移出時恢復按鈕顏色
  button.mouseOut(() => button.style("background-color", COLORS.button));
}

function useChineseFont() {
  // 切換至 Google Fonts 的繁體中文字型
  textFont(CHINESE_FONT);
}

function useEnglishFont() {
  // 切換至 Google Fonts 的英文手寫字型
  textFont(ENGLISH_FONT);
}

// ======================================================
// 響應式文字換行
// ======================================================
function drawResponsiveText(content, x, y, maxWidth, lineHeight) {
  // 將內容轉成字串並依換行符號分段
  const paragraphs = String(content).split("\n");
  const lines = [];

  // 逐段處理中文、英文與程式碼文字
  for (const paragraph of paragraphs) {
    // 有空白的文字優先依照單字換行，沒有空白則逐字換行
    if (paragraph.includes(" ")) {
      appendWordWrappedLines(paragraph, maxWidth, lines);
    } else {
      appendCharacterWrappedLines(paragraph, maxWidth, lines);
    }
  }

  // 沒有內容時不繪製
  if (lines.length === 0) {
    return;
  }

  // 計算整段文字高度並逐行置中繪製
  const totalHeight = lines.length * lineHeight;
  for (let index = 0; index < lines.length; index++) {
    const lineY = y - totalHeight / 2 + lineHeight / 2 + index * lineHeight;
    text(lines[index], x, lineY);
  }
}

function appendCharacterWrappedLines(content, maxWidth, lines) {
  // 將沒有空白的中文或長字串逐字分行
  let currentLine = "";
  for (const character of content) {
    const testLine = currentLine + character;
    if (textWidth(testLine) > maxWidth && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = character;
    } else {
      currentLine = testLine;
    }
  }

  // 保留最後一行；空白段落不新增內容
  if (currentLine.length > 0) {
    lines.push(currentLine);
  }
}

function appendWordWrappedLines(content, maxWidth, lines) {
  // 將有空白的英文或程式碼依照單字分行
  const words = content.split(/\s+/).filter((word) => word.length > 0);
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine.length > 0
      ? `${currentLine} ${word}`
      : word;

    if (textWidth(testLine) <= maxWidth || currentLine.length === 0) {
      // 單字未超過寬度時加入目前行
      if (currentLine.length === 0 && textWidth(word) > maxWidth) {
        // 單一長單字仍超過寬度時，改用逐字切割
        appendCharacterWrappedLines(word, maxWidth, lines);
        currentLine = "";
      } else {
        currentLine = testLine;
      }
    } else {
      // 超過寬度時先保存目前行，再處理下一行
      lines.push(currentLine);
      if (textWidth(word) > maxWidth) {
        appendCharacterWrappedLines(word, maxWidth, lines);
        currentLine = "";
      } else {
        currentLine = word;
      }
    }
  }

  // 保存最後一行
  if (currentLine.length > 0) {
    lines.push(currentLine);
  }
}

// ======================================================
// 響應式版面計算
// ======================================================
function getResponsiveLayout() {
  // 取得畫布尺寸與方向
  const canvasWidth = width;
  const canvasHeight = height;
  const isLandscape = canvasWidth > canvasHeight;
  const isSmallPortrait = canvasWidth < 600 && !isLandscape;
  const baseSize = min(canvasWidth, canvasHeight);

  // 設定手機與較大螢幕的左右邊界
  const horizontalMargin = isSmallPortrait ? 18 : 30;
  const optionWidth = min(780, max(250, canvasWidth - horizontalMargin * 2));

  // 橫向畫面採用較矮的選項，避免四個選項超出畫布
  const optionHeight = isLandscape
    ? 46
    : isSmallPortrait
      ? 56
      : 64;
  const optionGap = optionHeight + (isSmallPortrait ? 9 : isLandscape ? 6 : 12);

  // 設定各種文字大小，並限制最小與最大值
  const titleSize = constrain(baseSize * 0.055, isSmallPortrait ? 21 : 24, 42);
  const progressSize = constrain(baseSize * 0.028, 15, 24);
  const questionSize = constrain(baseSize * 0.038, isSmallPortrait ? 17 : 19, 30);
  const optionTextSize = constrain(baseSize * 0.03, 15, 24);
  const messageSize = constrain(baseSize * 0.035, 16, 28);

  // 設定多行文字行高
  const questionLineHeight = questionSize * 1.42;
  const optionLineHeight = optionTextSize * 1.30;

  // 根據方向安排標題、題目與選項位置
  const titleY = isLandscape ? 27 : canvasHeight * 0.055;
  const englishLabelY = isLandscape ? 52 : canvasHeight * 0.095;
  const progressY = isLandscape ? 76 : canvasHeight * 0.145;
  const questionY = isLandscape ? 105 : canvasHeight * 0.225;
  const optionStartY = isLandscape ? 128 : canvasHeight * 0.335;

  // 取得四個選項占用的總高度
  const optionsTotalHeight = optionHeight + optionGap * 3;
  const messageY = optionStartY + optionsTotalHeight + (isLandscape ? 14 : 24);

  // 計算下一題按鈕位置並限制在畫布範圍內
  const idealNextButtonY = messageY + (isLandscape ? 18 : 24);
  const nextButtonY = min(idealNextButtonY, canvasHeight - 58);

  // 計算成績畫面配置
  const resultTitleY = isLandscape ? canvasHeight * 0.15 : canvasHeight * 0.21;
  const scoreY = isLandscape ? canvasHeight * 0.33 : canvasHeight * 0.37;
  const percentageY = isLandscape ? canvasHeight * 0.47 : canvasHeight * 0.49;
  const encourageY = isLandscape ? canvasHeight * 0.61 : canvasHeight * 0.60;
  const statusY = isLandscape ? canvasHeight * 0.70 : canvasHeight * 0.68;
  const restartButtonY = min(canvasHeight * 0.78, canvasHeight - 62);

  // 回傳本畫面所需的完整版面資料
  return {
    isLandscape: isLandscape,
    isSmallPortrait: isSmallPortrait,
    titleSize: titleSize,
    englishLabelSize: constrain(baseSize * 0.035, 17, 28),
    progressSize: progressSize,
    questionSize: questionSize,
    optionTextSize: optionTextSize,
    messageSize: messageSize,
    resultTitleSize: constrain(baseSize * 0.065, 28, 52),
    scoreSize: constrain(baseSize * 0.052, 24, 42),
    percentageSize: constrain(baseSize * 0.045, 22, 36),
    encourageSize: constrain(baseSize * 0.03, 16, 26),
    statusSize: constrain(baseSize * 0.024, 14, 21),
    questionLineHeight: questionLineHeight,
    optionLineHeight: optionLineHeight,
    titleY: titleY,
    englishLabelY: englishLabelY,
    progressY: progressY,
    questionY: questionY,
    questionWidth: optionWidth,
    optionX: canvasWidth / 2 - optionWidth / 2,
    optionStartY: optionStartY,
    optionWidth: optionWidth,
    optionHeight: optionHeight,
    optionGap: optionGap,
    optionPadding: isSmallPortrait ? 12 : 18,
    messageY: messageY,
    nextButtonY: nextButtonY,
    resultTitleY: resultTitleY,
    scoreY: scoreY,
    percentageY: percentageY,
    encourageY: encourageY,
    statusY: statusY,
    restartButtonY: restartButtonY,
    buttonWidth: min(190, max(150, canvasWidth * (isSmallPortrait ? 0.48 : 0.28))),
    buttonHeight: 48
  };
}

// ======================================================
// 視窗尺寸改變時重新調整畫布與按鈕
// ======================================================
function windowResized() {
  // 將畫布調整成新的瀏覽器視窗大小
  resizeCanvas(windowWidth, windowHeight);

  // 重新計算響應式版面
  layout = getResponsiveLayout();

  // 依照目前畫面狀態同步按鈕的位置與尺寸
  if (quizFinished) {
    restartButton.position(width / 2 - layout.buttonWidth / 2, layout.restartButtonY);
    restartButton.size(layout.buttonWidth, layout.buttonHeight);
  } else if (selectedIndex !== -1 && loadErrorMessage === "") {
    nextButton.position(width / 2 - layout.buttonWidth / 2, layout.nextButtonY);
    nextButton.size(layout.buttonWidth, layout.buttonHeight);
  } else if (loadErrorMessage !== "") {
    reloadButton.position(
      width / 2 - layout.buttonWidth / 2,
      min(height * 0.68, height - layout.buttonHeight - 14)
    );
    reloadButton.size(layout.buttonWidth, layout.buttonHeight);
  }
}
