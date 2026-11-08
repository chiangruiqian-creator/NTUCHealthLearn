# NTUC Health Volunteer Learning Campus

A public, anonymous student prototype for volunteer preparation through written guides, videos and practical knowledge checks. The interface is deliberately similar to a modern learning-management system without copying NTULearn.

Production website: https://ntuchealthlearn.vercel.app/

Vercel deploys the `dist` directory automatically when changes are pushed to the `main` branch of `chiangruiqian-creator/NTUCHealthLearn`.

## Learning flow

Video modules follow three activity types:

1. **Watch** — an embedded public learning video.
2. **Learn** — concise key ideas, a realistic scenario and takeaways.
3. **Check** — a three-question knowledge check. Choosing an answer immediately shows whether it is correct, the correct response and an explanation. All answers must be correct to finish.

Reading guides use `format: "reading"`. They show written expectations and examples, with a **Mark as read** action. They do not require a video or quiz. The Code of Ethics, everyday values and language/dialect guide use this format.

The top menu and expandable learning directory provide direct access to all content. The Upskilling filter includes communication, language and everyday values.

Progress is stored only in the visitor's browser using `localStorage`. There is no account, database, staff portal or personal-data collection. Existing video-module progress remains compatible.

## Language and readability

The top language selector changes both the interface and all written learning content into English, Simplified Chinese, Malay or Tamil. This includes catalogue cards, headings, notes, scenarios, takeaways, quiz options, feedback, durations and image descriptions. `dist/locales.js` stores interface labels, while `dist/data/courses.zh.json`, `courses.ms.json` and `courses.ta.json` contain the written course translations. Language packs are loaded on demand and reused for the current session. No external translation service receives learner answers or content.

Embedded videos retain the publisher's original audio. A note beside each video explains how to use YouTube captions or auto-translate when available. Choosing a learning language does not create translated audio or guarantee that the publisher provides captions.

The language selector preserves progress, answers and quiz results. The English source remains unchanged, so changing language does not affect correct-answer indices or completion requirements.

The A− and A+ buttons adjust text from 100% to 150% in 12.5% steps. Language and text-size preferences are saved in this browser separately from learning progress.

## Content management

Edit `dist/data/courses.json` to add or update modules. The catalogue, module directory and reading/lesson interface are generated automatically from this structured file. This is a file-based content catalogue, not an authenticated CMS editor.

Every module needs a unique `id` and `code`, a `title`, `category`, `categoryKey`, `duration`, `description`, `image`, `imageAlt`, and a `lesson`. The lesson contains `title`, `introduction`, `sections` (each with `heading` and `body`), `scenario`, and `takeaways`.

For a written guide, add `"format": "reading"` and omit `video` and `quiz`. Copy the Code of Ethics entry as a template. Supported category keys include `values`, `language`, `communication`, `safety`, `engagement` and `digital`.

For a video module, supply `video` (`id`, `title`, `introduction`, `source`, `url`) and `quiz`. Each question needs `question`, `options`, a zero-based `answer`, and detailed `feedback`. Optional `wrongFeedback` entries can explain individual choices. `feedback` should explain why the correct behaviour matters and why the alternatives are unsuitable, because it appears immediately after selection.

When editing English content, update all three course language files before publishing. Each translation file is an object keyed by the stable module `id`. It contains translated `category`, `title`, `duration`, `description`, `imageAlt`, `lesson`, and where applicable `video` text and `quiz` text. Preserve section, takeaway, question and option order. Do not duplicate structural identifiers, media URLs, answer indices or progress in these files. The validator checks all modules and text fields for missing or unchanged translations and matching array lengths.

Have the relevant NTUC Health reviewer confirm training expectations and language phrasing before operational use. Keep the student-prototype disclaimer visible.

## Local preview

Run `node scripts/serve.mjs` and open http://127.0.0.1:4186/. Opening `index.html` directly will not load the JSON catalogue in browsers that block local file requests.

Run `node scripts/check.mjs` to check unique module identifiers, navigation targets, reading-only format, quiz answers and translation placeholders. Run `node --check dist/app.js` and `node --check dist/locales.js` for JavaScript syntax checks.

## Disclaimer

Student prototype developed for NTUC Health review. Learning content, access arrangements and volunteering requirements are subject to confirmation by NTUC Health. External videos remain the property of their respective publishers.
