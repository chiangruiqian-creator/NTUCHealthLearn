# NTUC Health Volunteer Learning Campus

A public, anonymous student prototype for video-led volunteer preparation. The interface is deliberately similar to a modern learning-management system without copying NTULearn.

## Learning flow

Each module follows three activity types:

1. **Watch** — an embedded public learning video.
2. **Learn** — concise key ideas, a realistic scenario and takeaways.
3. **Check** — a three-question knowledge check. All answers must be correct.

Progress is stored only in the visitor's browser using `localStorage`. There is no account, database, staff portal or personal-data collection.

## Content management

Edit `dist/data/courses.json` to add or update modules. Each module supplies its card image, YouTube video, learning notes, scenario, takeaways and quiz. The catalogue and lesson interface are generated automatically.

## Local preview

Serve the `dist` directory with any static HTTP server. Opening `index.html` directly will not load the JSON catalogue in browsers that block local file requests.

## Disclaimer

Student prototype developed for NTUC Health review. Learning content, access arrangements and volunteering requirements are subject to confirmation by NTUC Health. External videos remain the property of their respective publishers.
