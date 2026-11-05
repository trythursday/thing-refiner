# Thing Refiner

An experiment in using generative AI in a non-chat form. You write a goal and
whatever you have of the thing itself, press a button, and get one read-only
answer: one thing to add, one thing to remove, and how close it is to being
shippable. There is no back-and-forth — every answer stands alone.

Part of [Thursday](https://github.com/trythursday/thursday).

## Run it

No build step. Any static server over the repo root works:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>. It needs to be served over HTTP — the page
uses ES modules, which will not load from `file://`.

The first visit asks you to pick an AI provider. A free key from
[AI for All](https://ai-for-all.trythursday.org) is enough to try it.

## What is on the page

- **Goal** — what you are trying to make or do. Required.
- **Product** — the thing itself, as far as you have got, in markdown. Leave it
  empty and you get the first step instead.
- **Additional context** — background that changes the answer but has no place in
  the product.
- **Refine** — the one button. It comes back with a readback, one thing to add,
  one thing to remove, and a note on how ready the thing is.

The product is saved to `localStorage` as you type, and exports to markdown,
DOCX or PDF.

## Layout

- `index.html` — the page
- `lib/` — the OpenAI client and the page script
- `static/` — CSS, and the examples behind Random example
- `SYSTEM_PROMPT.md` — the prompt the model runs under

The AI setup panel, its stylesheet and the AI For All key client are shared with
[Next Steps](https://github.com/trythursday/next-steps) and load from
[ai-for-all](https://github.com/trythursday/ai-for-all).

## License

MIT. Feel free to copy and share.
