
var _a = Vue;
var createApp = _a.createApp;
var ref = _a.ref;
var computed = _a.computed;

// ============ STORAGE ============
var LS_KEY = 'nursing_quiz_data';
var EXAM_LS_KEY = 'nursing_exam_data';
function loadData() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; }
  catch(e) { return {}; }
}
function saveData(data) { localStorage.setItem(LS_KEY, JSON.stringify(data)); }
function loadExamData() {
  try { return JSON.parse(localStorage.getItem(EXAM_LS_KEY)) || {}; }
  catch(e) { return {}; }
}
function saveExamData(data) { localStorage.setItem(EXAM_LS_KEY, JSON.stringify(data)); }

// ============ HELPERS ============
function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function showToast(msg) {
  var el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(function() { el.classList.remove('show'); }, 1500);
}

function parseAnswer(ans) {
  return ans.split('、').map(function(s) { return s.trim(); }).filter(Boolean);
}

function normalizeAnswer(ans) {
  return parseAnswer(ans).sort().join('');
}

// ============ CHAPTER NAMES ============
var chapterNames = [];
var seen = {};
for (var i = 0; i < ALL_QUESTIONS.length; i++) {
  var ch = ALL_QUESTIONS[i].chapter;
  if (!seen[ch]) { seen[ch] = true; chapterNames.push(ch); }
}

// ============ EXAM YEAR LIST ============
var examYears = Object.keys(EXAM_PAPERS).sort();

// ============ APP ============
createApp({
  setup: function() {
    var storage = ref(loadData());
    var examStorage = ref(loadExamData());
    var page = ref('setup');
    var selectedChapters = ref(chapterNames.slice());
    var questionCount = ref(30);
    var sessionQuestions = ref([]);
    var currentIndex = ref(0);
    var answers = ref({});
    var showResult = ref(false);
    var reviewExpandId = ref(null);
    var isExamMode = ref(false);
    var currentExamYear = ref('');

    var wrongIds = computed({
      get: function() { return storage.value.wrongIds || []; },
      set: function(v) { storage.value.wrongIds = v; saveData(storage.value); }
    });
    var starredIds = computed({
      get: function() { return storage.value.starredIds || []; },
      set: function(v) { storage.value.starredIds = v; saveData(storage.value); }
    });
    var history = computed({
      get: function() { return storage.value.history || []; },
      set: function(v) { storage.value.history = v; saveData(storage.value); }
    });
    var examHistory = computed({
      get: function() { return examStorage.value.history || []; },
      set: function(v) { examStorage.value.history = v; saveExamData(examStorage.value); }
    });

    var currentQuestion = computed(function() {
      return sessionQuestions.value[currentIndex.value] || null;
    });
    var progressPercent = computed(function() {
      if (!sessionQuestions.value.length) return 0;
      return Math.round((Object.keys(answers.value).length / sessionQuestions.value.length) * 100);
    });

    // ============ EXAM DATA HELPERS ============
    function getExamStats(year) {
      var paper = EXAM_PAPERS[year];
      if (!paper) return null;
      var records = (examStorage.value.history || []).filter(function(r) { return r.year === year; });
      var best = null;
      records.forEach(function(r) {
        if (!best || r.rate > best.rate) best = r;
      });
      return {
        year: year,
        title: paper.title,
        questionCount: paper.questionCount,
        attemptCount: records.length,
        bestRate: best ? best.rate : null,
        lastAttempt: records.length ? records[0].date : null
      };
    }

    function startExam(year) {
      var paper = EXAM_PAPERS[year];
      if (!paper) return;
      // 真题题目没有 id，用 year+index 生成
      var qs = paper.questions.map(function(q, i) {
        var qCopy = JSON.parse(JSON.stringify(q));
        qCopy.id = 'exam_' + year + '_' + i;
        qCopy.examYear = year;
        qCopy.examIndex = i;
        return qCopy;
      });
      sessionQuestions.value = qs;
      answers.value = {};
      currentIndex.value = 0;
      showResult.value = false;
      reviewExpandId.value = null;
      isExamMode.value = true;
      currentExamYear.value = year;
      page.value = 'quiz';
      window.scrollTo(0, 0);
    }

    function startQuiz() {
      var pool = ALL_QUESTIONS.filter(function(q) { return selectedChapters.value.indexOf(q.chapter) >= 0; });
      if (!pool.length) { showToast('请至少选择一个章节'); return; }
      var count = Math.min(questionCount.value, pool.length);
      pool = shuffle(pool).slice(0, count);
      sessionQuestions.value = pool;
      answers.value = {};
      currentIndex.value = 0;
      showResult.value = false;
      reviewExpandId.value = null;
      isExamMode.value = false;
      currentExamYear.value = '';
      page.value = 'quiz';
      window.scrollTo(0, 0);
    }

    function startWrongQuiz() {
      if (!wrongIds.value.length) { showToast('暂无错题'); return; }
      var pool = ALL_QUESTIONS.filter(function(q) { return wrongIds.value.indexOf(q.id) >= 0; });
      sessionQuestions.value = shuffle(pool);
      answers.value = {};
      currentIndex.value = 0;
      showResult.value = false;
      reviewExpandId.value = null;
      isExamMode.value = false;
      currentExamYear.value = '';
      page.value = 'quiz';
      window.scrollTo(0, 0);
    }

    function startStarredQuiz() {
      if (!starredIds.value.length) { showToast('暂无收藏'); return; }
      var pool = ALL_QUESTIONS.filter(function(q) { return starredIds.value.indexOf(q.id) >= 0; });
      sessionQuestions.value = shuffle(pool);
      answers.value = {};
      currentIndex.value = 0;
      showResult.value = false;
      reviewExpandId.value = null;
      isExamMode.value = false;
      currentExamYear.value = '';
      page.value = 'quiz';
      window.scrollTo(0, 0);
    }

    function selectAnswer(optKey) {
      if (showResult.value) return;
      var q = currentQuestion.value;
      if (!q) return;
      if (q.type === 'multi') {
        var current = answers.value[q.id] || '';
        var arr = current ? current.split('、') : [];
        var idx = arr.indexOf(optKey);
        if (idx >= 0) arr.splice(idx, 1);
        else arr.push(optKey);
        answers.value[q.id] = arr.sort().join('、');
      } else {
        answers.value[q.id] = optKey;
      }
    }

    function isSelected(optKey) {
      var q = currentQuestion.value;
      if (!q) return false;
      var ans = answers.value[q.id] || '';
      if (q.type === 'multi') {
        return ans.split('、').indexOf(optKey) >= 0;
      }
      return ans === optKey;
    }

    function getOptionClass(optKey) {
      var q = currentQuestion.value;
      if (!q) return '';
      if (!showResult.value) {
        return isSelected(optKey) ? 'selected' : '';
      }
      var correctKeys = parseAnswer(q.answer);
      var selectedKeys = (answers.value[q.id] || '').split('、').filter(Boolean);
      if (correctKeys.indexOf(optKey) >= 0) return 'correct';
      if (selectedKeys.indexOf(optKey) >= 0) return 'wrong';
      return '';
    }

    function goNext() {
      if (currentIndex.value < sessionQuestions.value.length - 1) {
        currentIndex.value++;
        window.scrollTo(0, 0);
      }
    }

    function goPrev() {
      if (currentIndex.value > 0) {
        currentIndex.value--;
        window.scrollTo(0, 0);
      }
    }

    function jumpToQuestion(idx) {
      currentIndex.value = idx;
      window.scrollTo(0, 0);
    }

    function submitQuiz() {
      var unanswered = sessionQuestions.value.filter(function(q) { return !answers.value[q.id]; });
      if (unanswered.length) {
        if (!confirm('还有 ' + unanswered.length + ' 题未作答，确定提交吗？')) return;
      }
      var wrongArr = [];
      sessionQuestions.value.forEach(function(q) {
        var ua = normalizeAnswer(answers.value[q.id] || '');
        var ea = normalizeAnswer(q.answer);
        if (ua !== ea) wrongArr.push(q.id);
      });
      var currentWrong = wrongIds.value.slice();
      wrongArr.forEach(function(id) {
        if (currentWrong.indexOf(id) < 0) currentWrong.push(id);
      });
      wrongIds.value = currentWrong;
      
      var correctCount = sessionQuestions.value.length - wrongArr.length;

      if (isExamMode.value) {
        var examRecord = {
          date: new Date().toISOString(),
          year: currentExamYear.value,
          total: sessionQuestions.value.length,
          correct: correctCount,
          rate: Math.round((correctCount / sessionQuestions.value.length) * 100),
          answered: Object.keys(answers.value).length,
          wrongIds: wrongArr
        };
        examHistory.value = [examRecord].concat(examHistory.value).slice(0, 50);
      }

      var record = {
        date: new Date().toISOString(),
        total: sessionQuestions.value.length,
        correct: correctCount,
        answered: Object.keys(answers.value).length,
        chapter: isExamMode.value ? ('真题' + currentExamYear.value) : selectedChapters.value.join(','),
        wrongIds: wrongArr
      };
      history.value = [record].concat(history.value).slice(0, 50);
      
      showResult.value = true;
      page.value = 'result';
      currentIndex.value = 0;
      window.scrollTo(0, 0);
    }

    var resultStats = computed(function() {
      if (!sessionQuestions.value.length) return null;
      var correct = 0;
      sessionQuestions.value.forEach(function(q) {
        var ua = normalizeAnswer(answers.value[q.id] || '');
        var ea = normalizeAnswer(q.answer);
        if (ua === ea) correct++;
      });
      return {
        correct: correct,
        total: sessionQuestions.value.length,
        rate: Math.round((correct / sessionQuestions.value.length) * 100),
        answered: Object.keys(answers.value).length
      };
    });

    function toggleStar(qId) {
      var arr = starredIds.value.slice();
      var idx = arr.indexOf(qId);
      if (idx >= 0) arr.splice(idx, 1);
      else arr.push(qId);
      starredIds.value = arr;
    }

    function isStarred(qId) {
      return starredIds.value.indexOf(qId) >= 0;
    }

    function toggleReview(id) {
      reviewExpandId.value = reviewExpandId.value === id ? null : id;
    }

    function getQuestionById(id) {
      for (var i = 0; i < ALL_QUESTIONS.length; i++) {
        if (ALL_QUESTIONS[i].id === id) return ALL_QUESTIONS[i];
      }
      return null;
    }

    function getTypeLabel(type) {
      if (type === 'judge') return '判断题';
      if (type === 'single') return '单选题';
      if (type === 'multi') return '多选题';
      return type;
    }

    function goSetup() {
      page.value = 'setup';
      showResult.value = false;
      isExamMode.value = false;
      currentExamYear.value = '';
      window.scrollTo(0, 0);
    }

    function goExamList() {
      page.value = 'exam_list';
      isExamMode.value = false;
      window.scrollTo(0, 0);
    }

    function toggleChapter(ch) {
      var arr = selectedChapters.value.slice();
      var idx = arr.indexOf(ch);
      if (idx >= 0) arr.splice(idx, 1);
      else arr.push(ch);
      selectedChapters.value = arr;
    }

    function formatDate(iso) {
      var d = new Date(iso);
      return d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0') + ' ' +
        String(d.getHours()).padStart(2, '0') + ':' +
        String(d.getMinutes()).padStart(2, '0');
    }

    return {
      page: page, selectedChapters: selectedChapters, questionCount: questionCount,
      chapterNames: chapterNames, sessionQuestions: sessionQuestions,
      currentIndex: currentIndex, answers: answers, showResult: showResult,
      reviewExpandId: reviewExpandId, wrongIds: wrongIds, starredIds: starredIds,
      history: history, examHistory: examHistory, examYears: examYears,
      isExamMode: isExamMode, currentExamYear: currentExamYear,
      currentQuestion: currentQuestion, progressPercent: progressPercent,
      resultStats: resultStats,
      ALL_QUESTIONS: ALL_QUESTIONS, EXAM_PAPERS: EXAM_PAPERS,
      startQuiz: startQuiz, startWrongQuiz: startWrongQuiz, startStarredQuiz: startStarredQuiz,
      selectAnswer: selectAnswer, isSelected: isSelected, getOptionClass: getOptionClass,
      goNext: goNext, goPrev: goPrev, jumpToQuestion: jumpToQuestion, submitQuiz: submitQuiz,
      toggleStar: toggleStar, isStarred: isStarred, toggleReview: toggleReview,
      getQuestionById: getQuestionById, getTypeLabel: getTypeLabel,
      goSetup: goSetup, toggleChapter: toggleChapter, goExamList: goExamList,
      startExam: startExam, getExamStats: getExamStats,
      parseAnswer: parseAnswer, normalizeAnswer: normalizeAnswer,
      formatDate: formatDate
    };
  },
  template: '\
  <div>\
    <div v-if="page === \'setup\'">\
      <div class="card">\
        <div class="card-title">选择章节</div>\
        <div class="chapter-grid">\
          <span v-for="ch in chapterNames" :key="ch"\
            class="tag tag-chapter" :class="{ active: selectedChapters.includes(ch) }"\
            @click="toggleChapter(ch)">{{ ch }}</span>\
        </div>\
      </div>\
      <div class="card">\
        <div class="card-title">题目数量</div>\
        <div class="slider-container">\
          <input type="range" v-model.number="questionCount" min="5" max="100" step="5">\
          <input type="number" v-model.number="questionCount" min="5" max="510">\
          <span class="text-sm">题</span>\
        </div>\
        <div class="text-sm mt-12" style="color:#999">\
          当前章节共 {{ ALL_QUESTIONS.filter(function(q){return selectedChapters.includes(q.chapter)}).length }} 题可选\
        </div>\
      </div>\
      <button class="btn btn-primary" @click="startQuiz" style="margin-top:8px">开始刷题</button>\
      <div class="flex-row mt-16" style="gap:12px">\
        <button class="btn btn-outline" style="flex:1" @click="startWrongQuiz">错题重练 ({{ wrongIds.length }})</button>\
        <button class="btn btn-outline" style="flex:1" @click="startStarredQuiz">收藏题目 ({{ starredIds.length }})</button>\
      </div>\
      <button class="btn btn-primary mt-12" style="width:100%;background:linear-gradient(135deg,#c0392b,#e74c3c)" @click="goExamList">\
        真题演练\
      </button>\
      <div v-if="history.length" class="card mt-16">\
        <div class="card-title">历史记录</div>\
        <div v-for="(h, i) in history.slice(0,10)" :key="i" class="flex-between" style="padding:8px 0;border-bottom:1px solid #f0f0f0">\
          <span class="text-sm">{{ formatDate(h.date) }}</span>\
          <span :class="h.correct/h.total >= 0.8 ? \'text-green\' : h.correct/h.total >= 0.6 ? \'text-orange\' : \'text-red\'" style="font-weight:600">\
            {{ h.correct }}/{{ h.total }} ({{ Math.round(h.correct/h.total*100) }}%)\
          </span>\
        </div>\
      </div>\
    </div>\
    \
    <div v-if="page === \'exam_list\'">\
      <button class="btn btn-outline mb-16" @click="goSetup">← 返回首页</button>\
      <div class="card">\
        <div class="card-title">真题试卷</div>\
        <div class="text-sm mb-16" style="color:#999">历年护理责任组长竞聘考试真题，全卷模拟实战</div>\
        <div v-for="year in examYears" :key="year" class="exam-card" @click="startExam(year)">\
          <div class="flex-between">\
            <div>\
              <div style="font-size:18px;font-weight:700;margin-bottom:4px">{{ getExamStats(year).title }}</div>\
              <div class="text-sm" style="color:#666">{{ getExamStats(year).questionCount }} 题 · 原卷顺序</div>\
            </div>\
            <div style="text-align:right">\
              <div v-if="getExamStats(year).bestRate !== null" class="text-sm">\
                <span style="color:#27ae60;font-weight:600">最佳 {{ getExamStats(year).bestRate }}%</span>\
              </div>\
              <div v-if="getExamStats(year).attemptCount" class="text-sm" style="color:#999">\
                已做 {{ getExamStats(year).attemptCount }} 次\
              </div>\
              <div v-if="getExamStats(year).bestRate === null" class="text-sm" style="color:#e67e22">\
                未练习\
              </div>\
            </div>\
          </div>\
          <div style="margin-top:12px">\
            <span class="tag tag-chapter active" style="cursor:pointer">开始全卷刷题 →</span>\
          </div>\
        </div>\
      </div>\
    </div>\
    \
    <div v-if="page === \'quiz\' && !showResult">\
      <div class="flex-between mb-12">\
        <span class="text-sm">{{ currentIndex + 1 }} / {{ sessionQuestions.length }}</span>\
        <div class="flex-row" style="gap:8px">\
          <span v-if="isExamMode" class="tag" style="background:#fdecea;color:#c0392b;font-size:11px">真题模式</span>\
          <button class="star-btn" :class="{ starred: isStarred(currentQuestion?.id) }"\
            @click="toggleStar(currentQuestion?.id)">{{ isStarred(currentQuestion?.id) ? \'★\' : \'☆\' }}</button>\
          <span class="text-sm" style="color:#999">{{ Object.keys(answers).length }}题已答</span>\
        </div>\
      </div>\
      <div class="progress-bar"><div class="progress-fill" :style="{ width: progressPercent + \'%\' }"></div></div>\
      \
      <div v-if="currentQuestion" class="card">\
        <div class="q-meta">\
          <span class="q-type" :class="currentQuestion.type">{{ getTypeLabel(currentQuestion.type) }}</span>\
          <span class="q-num">{{ isExamMode ? \'第\' + (currentQuestion.examIndex + 1) + \'题\' : currentQuestion.chapter }}</span>\
          <span v-if="currentQuestion.type === \'multi\'" style="color:#8e44ad;font-size:12px">（多选）</span>\
        </div>\
        <div style="font-size:16px;line-height:1.7;margin-bottom:16px;white-space:pre-wrap">{{ currentQuestion.question }}</div>\
        \
        <div v-for="(val, key) in currentQuestion.options" :key="key"\
          class="option" :class="getOptionClass(key)"\
          @click="selectAnswer(key)">\
          <span class="opt-label">{{ key }}</span>\
          <span style="flex:1">{{ val }}</span>\
        </div>\
      </div>\
      \
      <div class="flex-row mt-12" style="gap:12px">\
        <button class="btn btn-outline" style="flex:1" @click="goPrev" :disabled="currentIndex === 0">上一题</button>\
        <button v-if="currentIndex < sessionQuestions.length - 1" class="btn btn-primary" style="flex:1" @click="goNext">下一题</button>\
        <button v-else class="btn btn-danger" style="flex:1" @click="submitQuiz">提交答卷</button>\
      </div>\
      \
      <div class="card mt-12">\
        <div class="text-sm mb-12" style="color:#999">题目导航（点击跳转）</div>\
        <div style="display:flex;flex-wrap:wrap;gap:6px">\
          <span v-for="(q, i) in sessionQuestions" :key="q.id"\
            @click="jumpToQuestion(i)"\
            :style="{\
              width:\'32px\',height:\'32px\',borderRadius:\'6px\',display:\'flex\',alignItems:\'center\',justifyContent:\'center\',\
              fontSize:\'12px\',cursor:\'pointer\',fontWeight:\'500\',\
              background: i === currentIndex ? \'#4A90D9\' : answers[q.id] ? \'#e8f0fe\' : \'#f0f0f0\',\
              color: i === currentIndex ? \'white\' : answers[q.id] ? \'#4A90D9\' : \'#999\'\
            }">{{ i + 1 }}</span>\
        </div>\
      </div>\
    </div>\
    \
    <div v-if="page === \'result\' && resultStats">\
      <div class="card text-center">\
        <div v-if="isExamMode" class="text-sm mb-12" style="color:#c0392b;font-weight:600">\
          {{ currentExamYear }} 年真题\
        </div>\
        <div class="score-circle" :style="{ borderColor: resultStats.rate >= 80 ? \'#27ae60\' : resultStats.rate >= 60 ? \'#f39c12\' : \'#e74c3c\' }">\
          <span :class="resultStats.rate >= 80 ? \'text-green\' : resultStats.rate >= 60 ? \'text-orange\' : \'text-red\'">{{ resultStats.rate }}%</span>\
        </div>\
        <div class="mt-12 text-lg">{{ resultStats.correct }} / {{ resultStats.total }}</div>\
        <div class="text-sm" style="margin-top:4px">\
          答对 {{ resultStats.correct }} 题 · 答错 {{ resultStats.total - resultStats.correct }} 题 · 未答 {{ resultStats.total - resultStats.answered }} 题\
        </div>\
      </div>\
      \
      <div class="flex-row mt-12" style="gap:12px">\
        <button class="btn btn-outline" style="flex:1" @click="isExamMode ? goExamList() : goSetup()">\
          {{ isExamMode ? \'返回真题列表\' : \'返回首页\' }}\
        </button>\
        <button v-if="!isExamMode" class="btn btn-primary" style="flex:1" @click="startQuiz">再来一卷</button>\
        <button v-if="isExamMode" class="btn btn-primary" style="flex:1" @click="startExam(currentExamYear)">重新做这份卷子</button>\
      </div>\
      \
      <div class="section-title">\
        <span>逐题回顾</span>\
        <span class="text-sm">{{ sessionQuestions.length }} 题</span>\
      </div>\
      \
      <div v-for="(q, i) in sessionQuestions" :key="q.id"\
        class="review-item"\
        :class="{\
          correct: normalizeAnswer(answers[q.id] || \'\') === normalizeAnswer(q.answer),\
          wrong: normalizeAnswer(answers[q.id] || \'\') !== normalizeAnswer(q.answer),\
          open: reviewExpandId === q.id\
        }"\
        @click="toggleReview(q.id)">\
        <div class="flex-between">\
          <div class="flex-row" style="gap:8px">\
            <span class="q-type" :class="q.type">{{ getTypeLabel(q.type) }}</span>\
            <span style="font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px">{{ i + 1 }}. {{ q.question }}</span>\
          </div>\
          <div class="flex-row" style="gap:6px">\
            <span :style="{ color: normalizeAnswer(answers[q.id] || \'\') === normalizeAnswer(q.answer) ? \'#27ae60\' : \'#e74c3c\', fontSize:\'18px\' }">\
              {{ normalizeAnswer(answers[q.id] || \'\') === normalizeAnswer(q.answer) ? \'✓\' : \'✗\' }}\
            </span>\
            <span style="font-size:12px;color:#999">详情</span>\
          </div>\
        </div>\
        <div class="review-expand">\
          <div style="margin-top:8px;font-size:15px;line-height:1.7;white-space:pre-wrap">{{ q.question }}</div>\
          <div style="margin-top:8px;padding:8px 12px;background:#f0f8f0;border-radius:8px;font-size:14px">\
            <span style="color:#27ae60;font-weight:600">正确答案：{{ q.answer }}</span>\
            <span v-if="answers[q.id]" :style="{ color: normalizeAnswer(answers[q.id] || \'\') === normalizeAnswer(q.answer) ? \'#27ae60\' : \'#e74c3c\', marginLeft:\'12px\' }">\
              {{ normalizeAnswer(answers[q.id] || \'\') === normalizeAnswer(q.answer) ? \'✓ 回答正确\' : \'✗ 你的答案：\' + (answers[q.id] || \'未作答\') }}\
            </span>\
          </div>\
          <div v-for="(val, key) in q.options" :key="key" style="padding:8px 0;font-size:14px;display:flex;align-items:flex-start;gap:8px">\
            <span v-if="parseAnswer(q.answer).includes(key)" style="color:#27ae60;font-weight:600;font-size:16px;flex-shrink:0">✓</span>\
            <span v-else style="color:#ccc;font-size:16px;flex-shrink:0">○</span>\
            <span :style="{ color: parseAnswer(q.answer).includes(key) ? \'#27ae60\' : \'#666\', fontWeight: parseAnswer(q.answer).includes(key) ? \'600\' : \'400\' }">\
              {{ key }}. {{ val }}\
            </span>\
          </div>\
          <div v-if="q.analysis || q.keyPoint || q.memoryTip" style="margin-top:8px;padding:10px 14px;background:#fafafa;border-radius:8px;font-size:13px;line-height:1.7">\
            <div v-if="q.analysis" style="margin-bottom:6px">\
              <span style="color:#2c3e50;font-weight:600">解析：</span>\
              <span style="color:#333">{{ q.analysis }}</span>\
            </div>\
            <div v-if="q.keyPoint" style="margin-bottom:4px">\
              <span style="color:#2c3e50;font-weight:600">考点：</span>\
              <span style="color:#555">{{ q.keyPoint }}</span>\
            </div>\
            <div v-if="q.memoryTip" style="margin-bottom:4px">\
              <span style="color:#2c3e50;font-weight:600">记忆要点：</span>\
              <span style="color:#555">{{ q.memoryTip }}</span>\
            </div>\
          </div>\
          <div v-else style="margin-top:8px;padding:8px 12px;background:#fff;border-radius:8px;font-size:13px;color:#999">\
            暂无解析\
          </div>\
          <div class="flex-row mt-12" style="gap:8px">\
            <button class="btn btn-sm" :class="isStarred(q.id) ? \'btn-primary\' : \'btn-outline\'"\
              @click.stop="toggleStar(q.id)">{{ isStarred(q.id) ? \'★ 已收藏\' : \'☆ 收藏\' }}</button>\
          </div>\
        </div>\
      </div>\
    </div>\
  </div>'
}).mount('#app');
