import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import vm from "node:vm";
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const courses = JSON.parse(await read("dist/data/courses.json"));
const ids = new Set(); const codes = new Set(); let questions = 0;
for (const course of courses) {
  assert(!ids.has(course.id), `Duplicate id: ${course.id}`); ids.add(course.id);
  assert(!codes.has(course.code), `Duplicate code: ${course.code}`); codes.add(course.code);
  for (const key of ["id", "title", "description", "categoryKey", "image", "imageAlt", "duration"]) assert(course[key], `${course.id}: missing ${key}`);
  assert(course.lesson.sections.length && course.lesson.takeaways.length, `${course.id}: missing learning content`);
  if (course.format === "reading") { assert(!course.video && !course.quiz, `${course.id}: reading guides must not require a video or quiz`); continue; }
  assert(/^[\w-]{11}$/.test(course.video.id), `${course.id}: invalid video id`);
  assert(course.quiz.length, `${course.id}: no questions`);
  for (const question of course.quiz) {
    assert(Number.isInteger(question.answer) && question.answer >= 0 && question.answer < question.options.length, `${course.id}: invalid correct answer`);
    assert(question.feedback.length > 120, `${course.id}: explanation needs more detail`); questions++;
  }
}
const html = await read("dist/index.html");
let translatedFields = 0;
function checkTranslation(source, translated, path, allowIdentical = false) {
  if (typeof source === "string") {
    assert(typeof translated === "string" && translated.trim(), `${path}: missing translation`);
    assert(allowIdentical || translated !== source, `${path}: untranslated English content`);
    translatedFields++;
  } else if (Array.isArray(source)) {
    assert(Array.isArray(translated) && source.length === translated.length, `${path}: mismatched array length`);
    source.forEach((item, index) => checkTranslation(item, translated[index], `${path}.${index}`));
  } else if (source && typeof source === "object") {
    for (const [key, value] of Object.entries(source)) {
      if (["id", "url", "answer"].includes(key)) continue;
      checkTranslation(value, translated?.[key], `${path}.${key}`, key === "source");
    }
  }
}
for (const language of ["zh", "ms", "ta"]) {
  const translations = JSON.parse(await read(`dist/data/courses.${language}.json`));
  assert.deepEqual(Object.keys(translations).sort(), [...ids].sort(), `${language}: missing or extra module translations`);
  for (const course of courses) {
    const translated = translations[course.id];
    for (const key of ["category", "title", "duration", "description", "imageAlt", "lesson", ...(course.video ? ["video", "quiz"] : [])]) {
      checkTranslation(course[key], translated[key], `${language}.${course.id}.${key}`);
    }
    for (const key of ["id", "code", "categoryKey", "format", "image"]) assert(!(key in translated), `${language}.${course.id}: must preserve base ${key}`);
    if (translated.video) for (const key of ["id", "url"]) assert(!(key in translated.video), `${language}.${course.id}: must preserve base video ${key}`);
    for (const question of translated.quiz || []) assert(!("answer" in question), `${language}.${course.id}: translated quizzes must use the base answer index`);
  }
}
for (const [, id] of html.matchAll(/data-menu-module="([^"]+)"/g)) assert(ids.has(id), `Navigation points to missing module: ${id}`);
const context = { window: {} }; vm.runInNewContext(await read("dist/locales.js"), context);
for (const [language, dictionary] of Object.entries(context.window.LANGUAGE_PACKS)) {
  if (language === "en") continue;
  for (const [key, value] of Object.entries(dictionary)) {
    assert(value.trim(), `${language}: empty translation for ${key}`);
    assert.deepEqual([...key.matchAll(/\{\w+\}/g)].map(x => x[0]).sort(), [...value.matchAll(/\{\w+\}/g)].map(x => x[0]).sort(), `${language}: mismatched variables in ${key}`);
  }
}
console.log(`Validated ${courses.length} modules, ${questions} questions, ${translatedFields} translated content fields, reading routes and interface variables.`);
