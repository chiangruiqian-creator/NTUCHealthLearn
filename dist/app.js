const STORAGE_KEY = "ntuc-volunteer-learning-progress-v1";

const state = {
  modules: [],
  filter: "all",
  search: "",
  currentModule: null,
  currentStep: "video",
  progress: loadProgress(),
};

const dashboardView = document.querySelector("#dashboard-view");
const moduleView = document.querySelector("#module-view");
const courseGrid = document.querySelector("#course-grid");
const sidebar = document.querySelector("#sidebar");

function loadProgress() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
  renderProgress();
}

function moduleProgress(id) {
  return state.progress[id] || { video: false, learn: false, quiz: false };
}

async function initialise() {
  const response = await fetch("data/courses.json");
  if (!response.ok) throw new Error("Course catalogue could not be loaded.");
  state.modules = await response.json();
  bindEvents();
  renderCatalogue();
  renderProgress();
  routeFromUrl();
}

function bindEvents() {
  document.querySelector("#course-search").addEventListener("input", (event) => {
    state.search = event.target.value.trim().toLowerCase();
    renderCatalogue();
  });

  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach((item) => item.classList.toggle("is-active", item === button));
      renderCatalogue();
    });
  });

  document.querySelector("[data-continue]").addEventListener("click", () => openNextModule());
  document.querySelector("[data-back]").addEventListener("click", showDashboard);
  document.querySelector("[data-nav-home]").addEventListener("click", (event) => { event.preventDefault(); showDashboard(); });
  document.querySelector("[data-nav-catalogue]").addEventListener("click", (event) => {
    event.preventDefault(); showDashboard(); setTimeout(() => document.querySelector("#course-catalogue").scrollIntoView(), 0);
  });

  document.querySelector("[data-reset-progress]").addEventListener("click", () => {
    if (!window.confirm("Reset all learning progress stored in this browser?")) return;
    state.progress = {};
    localStorage.removeItem(STORAGE_KEY);
    renderCatalogue();
    renderProgress();
    if (state.currentModule) renderModule(state.currentModule, state.currentStep);
  });

  document.querySelector(".mobile-menu").addEventListener("click", (event) => {
    const open = sidebar.classList.toggle("is-open");
    event.currentTarget.setAttribute("aria-expanded", String(open));
  });

  document.querySelectorAll("[data-step]").forEach((button) => button.addEventListener("click", () => switchStep(button.dataset.step)));
  document.querySelector("[data-complete-video]").addEventListener("click", () => completeStep("video", "learn"));
  document.querySelector("[data-complete-learn]").addEventListener("click", () => completeStep("learn", "quiz"));
  document.querySelectorAll("[data-previous]").forEach((button) => button.addEventListener("click", () => switchStep(button.dataset.previous)));
  document.querySelector("#quiz-form").addEventListener("submit", submitQuiz);
  window.addEventListener("popstate", routeFromUrl);
}

function renderCatalogue() {
  const modules = state.modules.filter((module) => {
    const matchesFilter = state.filter === "all" || module.categoryKey === state.filter;
    const haystack = `${module.title} ${module.description} ${module.category}`.toLowerCase();
    return matchesFilter && haystack.includes(state.search);
  });

  if (!modules.length) {
    courseGrid.innerHTML = `<div class="empty-state"><h3>No modules found</h3><p>Try another search term or filter.</p></div>`;
    return;
  }

  courseGrid.innerHTML = modules.map((module) => {
    const progress = moduleProgress(module.id);
    const complete = progress.quiz;
    const started = progress.video || progress.learn;
    return `
      <article class="course-card">
        <div class="course-card-image">
          <img src="${module.image}" alt="${module.imageAlt}" loading="lazy" onerror="this.src='https://i.ytimg.com/vi/${module.video.id}/hqdefault.jpg'" />
          <span class="course-status">${complete ? "Completed" : started ? "In progress" : "Not started"}</span>
        </div>
        <div class="course-card-body">
          <div class="course-meta"><span>${module.code}</span><span>${module.duration}</span></div>
          <h3>${module.title}</h3>
          <p>${module.description}</p>
          <button class="${complete ? "secondary-button" : "primary-button"}" type="button" data-open-module="${module.id}">
            ${complete ? "Review module" : started ? "Continue module" : "Open module"}
          </button>
        </div>
      </article>`;
  }).join("");

  document.querySelectorAll("[data-open-module]").forEach((button) => {
    button.addEventListener("click", () => {
      const module = state.modules.find((item) => item.id === button.dataset.openModule);
      const progress = moduleProgress(module.id);
      const step = !progress.video ? "video" : !progress.learn ? "learn" : "quiz";
      openModule(module, step);
    });
  });
}

function renderProgress() {
  const complete = state.modules.filter((module) => moduleProgress(module.id).quiz).length;
  const total = state.modules.length || 8;
  document.querySelector("#progress-count").textContent = `${complete} of ${total} complete`;
  document.querySelector("#progress-bar").style.width = `${(complete / total) * 100}%`;

  const next = state.modules.find((module) => !moduleProgress(module.id).quiz) || state.modules[0];
  if (next) {
    const started = moduleProgress(next.id).video || moduleProgress(next.id).learn;
    document.querySelector("#continue-heading").textContent = started ? `Continue: ${next.title}` : `Start: ${next.title}`;
    document.querySelector("[data-continue]").textContent = started ? "Continue module" : "Start module";
  }
}

function openNextModule() {
  const next = state.modules.find((module) => !moduleProgress(module.id).quiz) || state.modules[0];
  if (!next) return;
  const progress = moduleProgress(next.id);
  openModule(next, !progress.video ? "video" : !progress.learn ? "learn" : "quiz");
}

function openModule(module, step = "video", updateHistory = true) {
  state.currentModule = module;
  state.currentStep = step;
  dashboardView.hidden = true;
  moduleView.hidden = false;
  sidebar.classList.remove("is-open");
  document.querySelector(".mobile-menu").setAttribute("aria-expanded", "false");
  renderModule(module, step);
  if (updateHistory) history.pushState({}, "", `?module=${encodeURIComponent(module.id)}&step=${step}`);
  window.scrollTo({ top: 0, behavior: "smooth" });
  document.querySelector("#main-content").focus({ preventScroll: true });
}

function showDashboard(event, updateHistory = true) {
  if (event?.preventDefault) event.preventDefault();
  state.currentModule = null;
  moduleView.hidden = true;
  dashboardView.hidden = false;
  if (updateHistory) history.pushState({}, "", location.pathname);
  renderCatalogue();
  renderProgress();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function routeFromUrl() {
  const params = new URLSearchParams(location.search);
  const module = state.modules.find((item) => item.id === params.get("module"));
  const step = ["video", "learn", "quiz"].includes(params.get("step")) ? params.get("step") : "video";
  module ? openModule(module, step, false) : showDashboard(null, false);
}

function renderModule(module, step) {
  const progress = moduleProgress(module.id);
  document.title = `${module.title} | NTUC Health Volunteer Learning Campus`;
  document.querySelector("#module-code").textContent = module.code;
  document.querySelector("#module-category").textContent = module.category;
  document.querySelector("#module-title").textContent = module.title;
  document.querySelector("#module-duration").textContent = `${module.duration} · 3 learning activities`;
  document.querySelector("#video-heading").textContent = module.video.title;
  document.querySelector("#video-introduction").textContent = module.video.introduction;
  document.querySelector("#video-frame").innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${module.video.id}?rel=0" title="${module.video.title}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
  document.querySelector("#video-source").textContent = `Video source: ${module.video.source}`;
  document.querySelector("#video-link").href = module.video.url;
  document.querySelector("#learn-heading").textContent = module.lesson.title;
  document.querySelector("#learn-introduction").textContent = module.lesson.introduction;
  document.querySelector("#learning-content").innerHTML = `
    ${module.lesson.sections.map((section) => `<article class="learning-block"><h3>${section.heading}</h3><p>${section.body}</p></article>`).join("")}
    <aside class="scenario"><h3>Try this in practice</h3><p>${module.lesson.scenario}</p></aside>
    <article class="learning-block"><h3>Remember</h3><ul class="takeaway-list">${module.lesson.takeaways.map((item) => `<li>${item}</li>`).join("")}</ul></article>`;
  renderQuiz(module);

  document.querySelectorAll("[data-step]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.step === step);
    button.setAttribute("aria-selected", String(button.dataset.step === step));
    const completed = progress[button.dataset.step];
    button.querySelector(".step-state").classList.toggle("is-complete", completed);
  });
  switchStep(step, false);
}

function renderQuiz(module) {
  document.querySelector("#quiz-form").innerHTML = module.quiz.map((question, questionIndex) => `
    <fieldset class="quiz-question" data-question="${questionIndex}">
      <legend>${questionIndex + 1}. ${question.question}</legend>
      ${question.options.map((option, optionIndex) => `
        <label class="quiz-option">
          <input type="radio" name="question-${questionIndex}" value="${optionIndex}" />
          <span>${option}</span>
        </label>`).join("")}
      <span class="question-feedback" hidden></span>
    </fieldset>`).join("");
  const result = document.querySelector("#quiz-result");
  result.hidden = true;
  result.className = "quiz-result";
}

function switchStep(step, updateHistory = true) {
  state.currentStep = step;
  document.querySelectorAll("[data-panel]").forEach((panel) => panel.hidden = panel.dataset.panel !== step);
  document.querySelectorAll("[data-step]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.step === step);
    button.setAttribute("aria-selected", String(button.dataset.step === step));
  });
  if (updateHistory && state.currentModule) history.replaceState({}, "", `?module=${encodeURIComponent(state.currentModule.id)}&step=${step}`);
  document.querySelector(`[data-panel="${step}"] h2`)?.focus?.({ preventScroll: true });
}

function completeStep(step, nextStep) {
  if (!state.currentModule) return;
  state.progress[state.currentModule.id] = { ...moduleProgress(state.currentModule.id), [step]: true };
  saveProgress();
  renderModule(state.currentModule, nextStep);
}

function submitQuiz(event) {
  event.preventDefault();
  const module = state.currentModule;
  let score = 0;
  module.quiz.forEach((question, index) => {
    const fieldset = document.querySelector(`[data-question="${index}"]`);
    const selected = document.querySelector(`input[name="question-${index}"]:checked`);
    const correct = selected && Number(selected.value) === question.answer;
    if (correct) score += 1;
    fieldset.classList.toggle("is-correct", Boolean(correct));
    fieldset.classList.toggle("is-wrong", !correct);
    const feedback = fieldset.querySelector(".question-feedback");
    feedback.hidden = false;
    feedback.textContent = correct ? `Correct. ${question.feedback}` : selected ? `Not quite. ${question.feedback}` : "Choose an answer before checking.";
  });

  const passed = score === module.quiz.length;
  const result = document.querySelector("#quiz-result");
  result.hidden = false;
  result.classList.toggle("is-success", passed);
  result.innerHTML = passed
    ? `<strong>Module complete — ${score}/${module.quiz.length}</strong><br />Well done. Your completion has been saved on this browser.`
    : `<strong>${score}/${module.quiz.length} correct</strong><br />Review the feedback and try again. All answers must be correct to complete the module.`;

  if (passed) {
    state.progress[module.id] = { video: true, learn: true, quiz: true };
    saveProgress();
    renderCatalogue();
    document.querySelector('[data-step="quiz"] .step-state').classList.add("is-complete");
  }
  result.scrollIntoView({ behavior: "smooth", block: "center" });
}

initialise().catch((error) => {
  courseGrid.innerHTML = `<div class="empty-state"><h3>Learning catalogue unavailable</h3><p>${error.message}</p></div>`;
});
