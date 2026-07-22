# Capital Chase

A web game that helps 4th graders learn U.S. state capitals by chasing a spy from capital to capital.

**Play:** [chrisloken.github.io/state-capitals](https://chrisloken.github.io/state-capitals/)

## Play locally

```bash
npm install
npm run dev
```

## How it works

- The map shows all 50 states, capital cities, and routes between nearby capitals.
- Each clue is a spy-story tip pointing to a nearby capital (no city names spoiled).
- Pick the right city to stay on the spy’s trail; a wrong guess means you travel there, then backtrack.
- Travel uses a car, train, or plane depending on distance.
- Win by correctly tracking the spy **5 times in a row**.

## Scripts

| Command           | Description                    |
| ----------------- | ------------------------------ |
| `npm run dev`     | Start the development server   |
| `npm run build`   | Production build               |
| `npm run preview` | Preview the production build   |
