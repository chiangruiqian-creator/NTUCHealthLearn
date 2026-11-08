const STORAGE_KEY = "ntuc-volunteer-learning-progress-v1";
const PREFERENCES_KEY = "ntuc-volunteer-display-v1";
const SITE_TITLE = "NTUC Health Volunteer Learning Campus";
const SITE_DESCRIPTION = document.querySelector('meta[name="description"]').content;
const readStored = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } };
const preferences = readStored(PREFERENCES_KEY, { language: "en", font: 0 });
const state = {
  modules: [], filter: "all", search: "", catalogueOpen: false, currentModule: null, currentStep: "video",
  language: ["en", "zh", "ms", "ta"].includes(preferences.language) ? preferences.language : "en",
  font: Math.max(0, Math.min(4, Number(preferences.font) || 0)),
  progress: readStored(STORAGE_KEY, {}),
  contentLanguages: {},
};
const dashboardView = document.querySelector("#dashboard-view");
const moduleView = document.querySelector("#module-view");
const courseGrid = document.querySelector("#course-grid");
const sidebar = document.querySelector("#sidebar");
const e = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
function t(key, values = {}) {
  let text = window.LANGUAGE_PACKS?.[state.language]?.[key] || key;
  Object.entries(values).forEach(([name, value]) => { text = text.replaceAll(`{${name}}`, value); });
  return text;
}
const staticText = [];
const textWalker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
while (textWalker.nextNode()) {
  const node = textWalker.currentNode;
  if (node.textContent.trim() && !node.parentElement.closest("script, option, #progress-count, #continue-heading, #continue-description, [data-continue], [data-complete-reading], #language-message")) {
    staticText.push({ node, original: node.textContent, key: node.textContent.trim() });
  }
}
const staticAttributes = [...document.querySelectorAll("[aria-label], [placeholder], [title]")].flatMap((element) =>
  ["aria-label", "placeholder", "title"].filter((attribute) => element.hasAttribute(attribute)).map((attribute) => ({ element, attribute, key: element.getAttribute(attribute) })));

function applyPreferences() {
  document.documentElement.lang = state.language === "zh" ? "zh-Hans" : state.language;
  document.documentElement.style.fontSize = `${100 + state.font * 12.5}%`;
  document.querySelector('meta[name="description"]').content = t(SITE_DESCRIPTION);
  staticText.forEach(({ node, original, key }) => { if (node.isConnected) node.textContent = original.replace(key, t(key)); });
  staticAttributes.forEach(({ element, attribute, key }) => element.setAttribute(attribute, t(key)));
  document.querySelector("#interface-language").value = state.language;
  document.querySelector('[data-font-change="-1"]').disabled = state.font === 0;
  document.querySelector('[data-font-change="1"]').disabled = state.font === 4;
  try { localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ language: state.language, font: state.font })); } catch { /* Display controls also work without storage. */ }
}
const contentLanguage = () => state.language === "zh" ? "zh-Hans" : state.language;
async function loadContentLanguage(language) {
  if (language === "en" || state.contentLanguages[language]) return;
  const response = await fetch(`data/courses.${language}.json`);
  if (!response.ok) throw new Error("Translated learning content could not be loaded.");
  const translations = await response.json();
  if (state.modules.some((module) => !translations[module.id]?.lesson)) throw new Error("Incomplete learning translation.");
  state.contentLanguages[language] = translations;
}
function localiseModule(module) {
  const translated = state.contentLanguages[state.language]?.[module.id];
  if (!translated) return module;
  return {
    ...module, ...translated,
    id: module.id, code: module.code, categoryKey: module.categoryKey, format: module.format, image: module.image,
    ...(module.video ? { video: { ...module.video, ...translated.video, id: module.video.id, url: module.video.url } } : {}),
    ...(module.quiz ? { quiz: module.quiz.map((question, index) => ({ ...question, ...translated.quiz[index], answer: question.answer })) } : {}),
  };
}
const isReading = (module) => module.format === "reading";
const moduleProgress = (id) => state.progress[id] || { video: false, learn: false, quiz: false, read: false };
const isComplete = (module) => Boolean(isReading(module) ? moduleProgress(module.id).read : moduleProgress(module.id).quiz);
const hasStarted = (module) => Object.values(moduleProgress(module.id)).some(Boolean);
const nextStep = (module) => isReading(module) ? "reading" : !moduleProgress(module.id).video ? "video" : !moduleProgress(module.id).learn ? "learn" : "quiz";
function saveProgress() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress)); } catch { /* The current session can still track progress. */ }
  renderProgress();
}
async function initialise() {
  applyPreferences(); bindEvents();
  document.querySelector("#interface-language").disabled = true;
  new ResizeObserver(([entry]) => document.documentElement.style.setProperty("--header-height", `${entry.target.getBoundingClientRect().height}px`)).observe(document.querySelector(".site-header"));
  const response = await fetch("data/courses.json");
  if (!response.ok) throw new Error("Course catalogue could not be loaded.");
  state.modules = await response.json();
  try { await loadContentLanguage(state.language); }
  catch {
    state.language = "en";
    const message = document.querySelector("#language-message");
    message.textContent = "The selected translation could not be loaded. Showing English. Please select your language to try again.";
    message.hidden = false;
  }
  applyPreferences();
  document.querySelector("#interface-language").disabled = false;
  renderDirectory(); renderCatalogue(); renderProgress(); routeFromUrl();
}
function closeMenu() {
  sidebar.classList.remove("is-open");
  document.querySelector(".mobile-menu").setAttribute("aria-expanded", "false");
}
function bindEvents() {
  document.querySelector("#course-search").addEventListener("input", (event) => { state.search = event.target.value.trim().toLowerCase(); renderCatalogue(); });
  document.addEventListener("click", (event) => {
    const opener = event.target.closest("[data-open-module], [data-menu-module]");
    if (opener) {
      event.preventDefault();
      const module = state.modules.find((item) => item.id === (opener.dataset.openModule || opener.dataset.menuModule));
      if (module) openModule(module, nextStep(module));
      return;
    }
    const filter = event.target.closest("[data-filter], [data-menu-filter], [data-nav-catalogue]");
    if (filter) {
      event.preventDefault(); state.catalogueOpen = true; state.filter = filter.dataset.filter || filter.dataset.menuFilter || "all";
      state.search = ""; document.querySelector("#course-search").value = ""; showDashboard();
      document.querySelector("#course-catalogue").scrollIntoView({ behavior: "smooth" }); return;
    }
    if (event.target.closest("[data-nav-home], [data-menu-home], [data-back]")) {
      event.preventDefault();
      if (event.target.closest("[data-nav-home], [data-menu-home]")) { state.catalogueOpen = false; state.filter = "all"; state.search = ""; document.querySelector("#course-search").value = ""; }
      showDashboard();
    }
    const step = event.target.closest("[data-step]"); if (step) switchStep(step.dataset.step);
  });
  document.querySelector("[data-continue]").addEventListener("click", () => {
    const module = state.modules.find((item) => !isComplete(item)) || state.modules[0]; if (module) openModule(module, nextStep(module));
  });
  document.querySelector("[data-reset-progress]").addEventListener("click", () => {
    if (!window.confirm(t("Reset all learning progress stored in this browser?"))) return;
    state.progress = {}; saveProgress(); renderCatalogue();
    if (state.currentModule) renderModule(state.currentModule, state.currentStep);
  });
  document.querySelector(".mobile-menu").addEventListener("click", (event) => {
    const open = sidebar.classList.toggle("is-open"); event.currentTarget.setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeMenu(); });
  document.querySelector("[data-complete-video]").addEventListener("click", () => completeStep("video", "learn"));
  document.querySelector("[data-complete-learn]").addEventListener("click", () => completeStep("learn", "quiz"));
  document.querySelector("[data-complete-reading]").addEventListener("click", () => {
    if (!state.currentModule) return;
    state.progress[state.currentModule.id] = { ...moduleProgress(state.currentModule.id), read: true };
    saveProgress(); renderModule(state.currentModule, "reading"); document.querySelector("#display-status").textContent = t("Guide read");
  });
  document.querySelectorAll("[data-previous]").forEach((button) => button.addEventListener("click", () => switchStep(button.dataset.previous)));
  document.querySelector("#quiz-form").addEventListener("submit", submitQuiz);
  document.querySelector("#quiz-form").addEventListener("change", (event) => {
    if (event.target.matches('input[type="radio"]')) {
      showQuestionFeedback(Number(event.target.closest("fieldset").dataset.question)); document.querySelector("#quiz-result").hidden = true;
    }
  });
  document.querySelector("#interface-language").addEventListener("change", async (event) => {
    const quizModuleId = state.currentModule?.id;
    const answers = state.currentModule && !isReading(state.currentModule) ? [...document.querySelectorAll('#quiz-form input:checked')].map(input => ({ name: input.name, value: input.value })) : [];
    const hadResult = Boolean(state.currentModule && !isReading(state.currentModule) && !document.querySelector("#quiz-result").hidden);
    const selector = event.target; const requestedLanguage = selector.value;
    selector.disabled = true; document.querySelector("#main-content").setAttribute("aria-busy", "true");
    const message = document.querySelector("#language-message"); message.hidden = true;
    try {
      await loadContentLanguage(requestedLanguage);
      state.language = requestedLanguage; applyPreferences(); renderDirectory(); renderCatalogue(); renderProgress();
      if (state.currentModule) renderModule(state.currentModule, state.currentStep);
      if (state.currentModule?.id === quizModuleId) answers.forEach(({ name, value }) => {
        const input = document.querySelector(`#quiz-form input[name="${name}"][value="${value}"]`);
        if (input) { input.checked = true; showQuestionFeedback(Number(input.closest("fieldset").dataset.question)); }
      });
      if (hadResult && state.currentModule?.id === quizModuleId) renderQuizResult(state.currentModule, answers.reduce((score, answer) => score + Number(Number(answer.value) === state.currentModule.quiz[Number(answer.name.split("-")[1])].answer), 0));
      document.title = state.currentModule ? `${localiseModule(state.currentModule).title} | ${t(SITE_TITLE)}` : t(SITE_TITLE);
    } catch {
      selector.value = state.language;
      message.textContent = t("The translation could not be loaded. Please try selecting your language again."); message.hidden = false;
    } finally { selector.disabled = false; document.querySelector("#main-content").removeAttribute("aria-busy"); }
  });
  document.querySelectorAll("[data-font-change]").forEach((button) => button.addEventListener("click", () => {
    state.font = Math.max(0, Math.min(4, state.font + Number(button.dataset.fontChange))); applyPreferences();
    document.querySelector("#display-status").textContent = `${t("Text size")}: ${100 + state.font * 12.5}%`;
  }));
  window.addEventListener("popstate", routeFromUrl);
}
function matchesFilter(module) {
  if (state.filter === "all") return true;
  if (state.filter === "upskilling") return ["language", "communication"].includes(module.categoryKey) || module.id === "everyday-volunteer-values";
  if (state.filter === "ethics") return ["ethics", "values"].includes(module.categoryKey);
  return module.categoryKey === state.filter;
}
function renderDirectory() {
  document.querySelector("#module-directory").innerHTML = state.modules.map(localiseModule).map((module) => `<a href="?module=${e(module.id)}&step=${isReading(module) ? "learn" : "video"}" data-open-module="${e(module.id)}" lang="${contentLanguage()}">${e(module.title)}</a>`).join("");
}
function renderCatalogue() {
  const modules = state.modules.filter((module) => {
    const translated = localiseModule(module);
    return matchesFilter(module) && `${module.title} ${module.description} ${module.category} ${translated.title} ${translated.description} ${translated.category}`.toLowerCase().includes(state.search);
  }).map(localiseModule);
  document.querySelectorAll("[data-filter]").forEach((button) => { button.classList.toggle("is-active", button.dataset.filter === state.filter); button.setAttribute("aria-pressed", String(button.dataset.filter === state.filter)); });
  updateNavigation();
  courseGrid.innerHTML = modules.length ? modules.map((module) => {
    const complete = isComplete(module); const started = hasStarted(module);
    const label = isReading(module) ? complete ? "Guide read" : module.id === "code-of-ethics" ? "Read expectations" : "Read guide" : complete ? "Review module" : started ? "Continue module" : "Open module";
    return `<article class="course-card"><div class="course-card-image"><img src="${e(module.image)}" alt="${e(module.imageAlt)}" loading="lazy" /><span class="course-status">${e(t(complete ? "Completed" : started ? "In progress" : "Not started"))}</span></div><div class="course-card-body"><div class="course-meta"><span>${e(module.code)}</span><span>${e(module.duration)}</span></div><span class="format-label">${e(t(isReading(module) ? "Reading guide" : "Video module"))}</span><h3>${e(module.title)}</h3><p>${e(module.description)}</p><button class="${complete ? "secondary-button" : "primary-button"}" type="button" data-open-module="${e(module.id)}">${e(t(label))}</button></div></article>`;
  }).join("") : `<div class="empty-state"><h3>${e(t("No modules found"))}</h3><p>${e(t("Try another search term or filter."))}</p></div>`;
}
function updateNavigation() {
  document.querySelectorAll("[data-menu-module]").forEach((link) => {
    const active = state.currentModule?.id === link.dataset.menuModule; link.classList.toggle("is-active", active);
    active ? link.setAttribute("aria-current", "page") : link.removeAttribute("aria-current");
  });
  document.querySelectorAll("[data-menu-home], [data-nav-home]").forEach((link) => link.classList.toggle("is-active", !state.currentModule && !state.catalogueOpen));
  document.querySelectorAll("[data-menu-filter]").forEach((link) => link.classList.toggle("is-active", !state.currentModule && state.catalogueOpen && state.filter === link.dataset.menuFilter));
}
function renderProgress() {
  const complete = state.modules.filter(isComplete).length; const total = state.modules.length;
  document.querySelector("#progress-count").textContent = t("{complete} of {total} complete", { complete, total });
  document.querySelector("#progress-bar").style.width = `${total ? complete / total * 100 : 0}%`;
  const next = state.modules.find((module) => !isComplete(module)) || state.modules[0];
  if (next) {
    document.querySelector("#continue-description").textContent = t(isReading(next) ? "Read this guide at your own pace, then mark it as read." : "Each module follows a simple sequence: watch, learn and check your understanding.");
    document.querySelector("#continue-heading").textContent = t(hasStarted(next) ? "Continue: {title}" : "Start: {title}", { title: localiseModule(next).title });
    document.querySelector("[data-continue]").textContent = t(isReading(next) ? "Read guide" : hasStarted(next) ? "Continue module" : "Start module");
  }
}
function moduleUrl(module, step) { return `?module=${encodeURIComponent(module.id)}&step=${step === "reading" ? "learn" : step}`; }
function openModule(module, step = nextStep(module), updateHistory = true) {
  state.currentModule = module; state.currentStep = isReading(module) ? "reading" : step;
  dashboardView.hidden = true; moduleView.hidden = false; closeMenu(); renderModule(module, state.currentStep); updateNavigation();
  if (updateHistory) history.pushState({}, "", moduleUrl(module, state.currentStep));
  window.scrollTo({ top: 0, behavior: "smooth" }); document.querySelector("#main-content").focus({ preventScroll: true });
}
function showDashboard(event, updateHistory = true) {
  event?.preventDefault?.(); state.currentModule = null; document.title = t(SITE_TITLE); document.querySelector("#video-frame").innerHTML = "";
  moduleView.hidden = true; dashboardView.hidden = false; closeMenu();
  if (updateHistory) history.pushState({}, "", location.pathname);
  renderCatalogue(); renderProgress(); window.scrollTo({ top: 0, behavior: "smooth" });
}
function routeFromUrl() {
  const params = new URLSearchParams(location.search); const module = state.modules.find((item) => item.id === params.get("module"));
  const step = ["video", "learn", "quiz"].includes(params.get("step")) ? params.get("step") : "video";
  module ? openModule(module, step, false) : showDashboard(null, false);
}
function lessonHtml(module) {
  return `${module.lesson.sections.map((section) => `<article class="learning-block"><h3>${e(section.heading)}</h3><p>${e(section.body)}</p></article>`).join("")}<aside class="scenario"><h3>${e(t("Try this in practice"))}</h3><p>${e(module.lesson.scenario)}</p></aside><article class="learning-block"><h3>${e(t("Remember"))}</h3><ul class="takeaway-list">${module.lesson.takeaways.map((item) => `<li>${e(item)}</li>`).join("")}</ul></article>`;
}
function renderModule(module, step) {
  module = localiseModule(module);
  document.title = `${module.title} | ${t(SITE_TITLE)}`;
  document.querySelector("#module-code").textContent = module.code; document.querySelector("#module-category").textContent = t(module.category);
  document.querySelector("#module-title").textContent = module.title;
  document.querySelector("#module-duration").textContent = t(isReading(module) ? "{duration} · Reading guide" : "{duration} · 3 learning activities", { duration: module.duration });
  const activities = isReading(module) ? [["reading", module.id === "code-of-ethics" ? "Volunteer expectations" : "Read & reflect", "Reading guide"]] : [["video", "Watch", "Video lesson"], ["learn", "Learn", "Key ideas"], ["quiz", "Check", "Knowledge check"]];
  document.querySelector(".activity-list").innerHTML = activities.map(([key, title, description], i) => `<button type="button" role="tab" data-step="${key}"><span class="step-number">${i + 1}</span><span><strong>${e(t(title))}</strong><small>${e(t(description))}</small></span><span class="step-state ${moduleProgress(module.id)[key === "reading" ? "read" : key] ? "is-complete" : ""}" aria-hidden="true"></span></button>`).join("");
  document.querySelector("#video-frame").innerHTML = "";
  if (isReading(module)) {
    document.querySelector("#reading-heading").textContent = module.lesson.title; document.querySelector("#reading-introduction").textContent = module.lesson.introduction;
    document.querySelector("#reading-note").hidden = module.id !== "code-of-ethics"; document.querySelector("#reading-content").innerHTML = lessonHtml(module);
    const done = isComplete(module); const button = document.querySelector("[data-complete-reading]"); button.textContent = t(done ? "Guide read" : "Mark as read"); button.disabled = done;
  } else {
    document.querySelector("#video-heading").textContent = module.video.title; document.querySelector("#video-introduction").textContent = module.video.introduction;
    document.querySelector("#video-source").textContent = t("Video source: {source}", { source: module.video.source }); document.querySelector("#video-link").href = module.video.url;
    document.querySelector("#learn-heading").textContent = module.lesson.title; document.querySelector("#learn-introduction").textContent = module.lesson.introduction;
    document.querySelector("#learning-content").innerHTML = lessonHtml(module); renderQuiz(module);
  }
  switchStep(step, false);
}
function renderQuiz(module) {
  document.querySelector("#quiz-form").innerHTML = module.quiz.map((question, index) => `<fieldset class="quiz-question" data-question="${index}"><legend>${index + 1}. ${e(question.question)}</legend>${question.options.map((option, optionIndex) => `<label class="quiz-option"><input type="radio" name="question-${index}" value="${optionIndex}" aria-describedby="feedback-${index}" /><span>${e(option)}</span></label>`).join("")}<div class="question-feedback" id="feedback-${index}" role="status" aria-live="polite" hidden></div></fieldset>`).join(""); document.querySelector("#quiz-result").hidden = true;
}
function switchStep(step, updateHistory = true) {
  if (!state.currentModule) return;
  step = isReading(state.currentModule) ? "reading" : ["video", "learn", "quiz"].includes(step) ? step : "video"; state.currentStep = step;
  document.querySelectorAll("[data-panel]").forEach((panel) => { panel.hidden = panel.dataset.panel !== step; });
  document.querySelectorAll("[data-step]").forEach((button) => { button.classList.toggle("is-active", button.dataset.step === step); button.setAttribute("aria-selected", String(button.dataset.step === step)); });
  const frame = document.querySelector("#video-frame");
  if (step === "video" && !frame.firstChild) {
    const video = localiseModule(state.currentModule).video; frame.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${e(video.id)}?rel=0&hl=${state.language}&cc_lang_pref=${state.language === "zh" ? "zh-Hans" : state.language}" title="${e(video.title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
  } else if (step !== "video") frame.innerHTML = "";
  if (updateHistory) history.replaceState({}, "", moduleUrl(state.currentModule, step));
}
function completeStep(step, next) {
  if (!state.currentModule) return;
  state.progress[state.currentModule.id] = { ...moduleProgress(state.currentModule.id), [step]: true }; saveProgress(); renderModule(state.currentModule, next); history.replaceState({}, "", moduleUrl(state.currentModule, next));
}
function showQuestionFeedback(index) {
  const question = localiseModule(state.currentModule).quiz[index]; const fieldset = document.querySelector(`[data-question="${index}"]`);
  const selected = fieldset.querySelector("input:checked"); const correct = Boolean(selected && Number(selected.value) === question.answer);
  fieldset.classList.toggle("is-correct", correct); fieldset.classList.toggle("is-wrong", !correct);
  fieldset.querySelectorAll(".quiz-option").forEach((option) => option.classList.toggle("is-selected", Boolean(option.querySelector("input:checked"))));
  const feedback = fieldset.querySelector(".question-feedback"); feedback.hidden = false;
  const whyWrong = selected && !correct ? question.wrongFeedback?.[Number(selected.value)] : "";
  feedback.innerHTML = selected ? `<strong>${e(t(correct ? "Correct." : "Not quite."))}</strong> ${whyWrong ? `<p>${e(whyWrong)}</p>` : ""}${!correct ? `<p><strong>${e(t("Correct answer:"))}</strong> <span>${e(question.options[question.answer])}</span></p>` : ""}<p>${e(question.feedback)}</p>${!correct ? `<p>${e(t("Please try another answer."))}</p>` : ""}` : e(t("Choose an answer before finishing."));
  return correct;
}
function submitQuiz(event) {
  event.preventDefault(); const module = state.currentModule; if (!module || isReading(module)) return;
  const score = module.quiz.reduce((sum, _, index) => sum + Number(showQuestionFeedback(index)), 0); const passed = score === module.quiz.length;
  const result = renderQuizResult(module, score);
  if (passed) { state.progress[module.id] = { video: true, learn: true, quiz: true }; saveProgress(); document.querySelector('[data-step="quiz"] .step-state').classList.add("is-complete"); }
  result.scrollIntoView({ behavior: "smooth", block: "center" });
}
function renderQuizResult(module, score) {
  const passed = score === module.quiz.length; const result = document.querySelector("#quiz-result");
  result.hidden = false; result.className = `quiz-result${passed ? " is-success" : ""}`;
  result.innerHTML = `<strong>${e(t(passed ? "Module complete" : "{score}/{total} correct", { score, total: module.quiz.length }))}</strong><p>${e(t(passed ? "Your completion has been saved on this browser." : "Review the feedback and try again. All answers must be correct to complete the module."))}</p>`;
  return result;
}
initialise().catch(() => { document.querySelector("#interface-language").disabled = false; courseGrid.innerHTML = `<div class="empty-state"><h3>${e(t("Learning catalogue unavailable"))}</h3><p>${e(t("Please refresh the page to try again."))}</p></div>`; });
