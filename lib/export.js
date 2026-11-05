import { marked } from "https://esm.sh/marked";

const DOCX_URL = "https://esm.sh/docx";

const slug = (title) =>
  (title || "thing")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "thing";

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.click();

  URL.revokeObjectURL(url);
}

export function exportMarkdown(text, title) {
  download(
    new Blob([text], { type: "text/markdown;charset=utf-8" }),
    `${slug(title)}.md`,
  );
}

export function exportPdf(text, title) {
  const body = marked.parse(text);
  const win = window.open("", "_blank");

  if (!win) return;

  win.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
      body { font-family: ui-sans-serif, sans-serif; line-height: 1.5; max-width: 70ch; margin: 2rem auto; padding: 0 1rem; }
      pre { background: #f4f4f4; padding: 1rem; overflow: auto; }
      code { font-family: ui-monospace, monospace; }
      @media print { body { margin: 0; } }
    </style>
  </head>
  <body>${body}</body>
</html>`);

  win.document.close();
  win.focus();
  win.print();
}

export async function exportDocx(text, title) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import(
    DOCX_URL
  );

  const HEADINGS = [
    HeadingLevel.HEADING_1,
    HeadingLevel.HEADING_2,
    HeadingLevel.HEADING_3,
    HeadingLevel.HEADING_4,
  ];

  const children = [];

  for (const token of marked.lexer(text)) {
    if (token.type === "heading") {
      children.push(
        new Paragraph({
          text: token.text,
          heading: HEADINGS[Math.min(token.depth, 4) - 1],
        }),
      );
    } else if (token.type === "paragraph") {
      children.push(new Paragraph({ children: [new TextRun(token.text)] }));
    } else if (token.type === "list") {
      for (const item of token.items) {
        children.push(
          new Paragraph({ text: item.text, bullet: { level: 0 } }),
        );
      }
    } else if (token.type === "code") {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: token.text, font: "monospace" })],
        }),
      );
    } else if (token.type === "hr") {
      children.push(new Paragraph({ text: "" }));
    } else if (token.text) {
      children.push(new Paragraph({ children: [new TextRun(token.text)] }));
    }
  }

  const blob = await Packer.toBlob(new Document({ sections: [{ children }] }));

  download(blob, `${slug(title)}.docx`);
}
