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
for (const [, id] of html.matchAll(/data-menu-module="([^"]+)"/g)) assert(ids.has(id), `Navigation points to missing module: ${id}`);
const context = { window: {} }; vm.runInNewContext(await read("dist/locales.js"), context);
for (const [language, dictionary] of Object.entries(context.window.LANGUAGE_PACKS)) {
  if (language === "en") continue;
  for (const [key, value] of Object.entries(dictionary)) {
    assert(value.trim(), `${language}: empty translation for ${key}`);
    assert.deepEqual([...key.matchAll(/\{\w+\}/g)].map(x => x[0]).sort(), [...value.matchAll(/\{\w+\}/g)].map(x => x[0]).sort(), `${language}: mismatched variables in ${key}`);
  }
}
console.log(`Validated ${courses.length} modules, ${questions} questions, reading routes and translation variables.`);
