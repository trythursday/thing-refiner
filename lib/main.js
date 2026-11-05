import { generate, preload } from "./ai.js";
import { exportMarkdown, exportDocx, exportPdf } from "./export.js";
import {
  getApiKey,
  clearStorage,
} from "https://cdn.jsdelivr.net/gh/trythursday/ai-for-all@main/src/client/storage.js";
import {
  isFreeKey,
  keyExpiry,
} from "https://cdn.jsdelivr.net/gh/trythursday/ai-for-all@main/src/client/ai-for-all-client.js";

const markedPromise = import("https://esm.sh/marked");

const setup = document.querySelector("ai-setup");
const root = document.querySelector("#root");
const app = document.querySelector("#app");
const goal = document.querySelector("#goal");
const goalError = document.querySelector("#goal-error");
const product = document.querySelector("#product");
const context = document.querySelector("#context");
const contextDialog = document.querySelector("#context-dialog");
const contextOpen = document.querySelector("#context-open");
const helpDialog = document.querySelector("#help-dialog");
const helpOpen = document.querySelector("#help-open");
const saveStatus = document.querySelector("#save-status");
const refine = document.querySelector("#refine");
const back = document.querySelector("#back");
const clear = document.querySelector("#clear");
const random = document.querySelector("#random");
const result = document.querySelector("#result");
const loading = document.querySelector("#loading");
const loadingText = loading.querySelector(".loading-text");
const exportBar = document.querySelector("#export");
const providerNote = document.querySelector("#provider-note");

const TOOLBAR = [
  "bold",
  "italic",
  "heading",
  "|",
  "quote",
  "unordered-list",
  "ordered-list",
  "checklist",
  "|",
  "link",
  "|",
  "preview",
  "fullscreen",
  "|",
  "guide",
];

let parse;
let editor;
let latest = {};

const getProduct = () => (editor ? editor.value() : product.value);

const setProduct = (value) => {
  if (editor) editor.value(value);
  else product.value = value;
};

/* Persistence */

const DOC_KEYS = {
  goal: "thursday.thing-refiner.goal",
  product: "thursday.thing-refiner.product",
  context: "thursday.thing-refiner.context",
};

const AUTOSAVE_DELAY = 5_000;

let autosaveTimer;
let statusTimer;
let programmatic = false;

const saveDocument = () => {
  window.clearTimeout(autosaveTimer);
  window.clearTimeout(statusTimer);

  saveStatus.textContent = "Autosaving…";

  localStorage.setItem(DOC_KEYS.goal, goal.value);
  localStorage.setItem(DOC_KEYS.product, getProduct());
  localStorage.setItem(DOC_KEYS.context, context.value);

  // One beat, so the change of state is visible.
  statusTimer = window.setTimeout(() => {
    saveStatus.textContent = "Saved";
  }, 300);
};

// Autosave five seconds after the user stops typing.
const scheduleSave = () => {
  if (programmatic) return;

  window.clearTimeout(autosaveTimer);
  saveStatus.textContent = "";
  autosaveTimer = window.setTimeout(saveDocument, AUTOSAVE_DELAY);
};

const restoreDocument = () => {
  programmatic = true;

  goal.value = localStorage.getItem(DOC_KEYS.goal) ?? "";
  setProduct(localStorage.getItem(DOC_KEYS.product) ?? "");
  context.value = localStorage.getItem(DOC_KEYS.context) ?? "";

  programmatic = false;

  contextLabel();
  updateExport();
};

const updateExport = () => {
  exportBar.hidden = !getProduct().trim();
};

const ensureEditor = () => {
  if (editor) {
    editor.codemirror.refresh();
    return;
  }

  editor = new window.EasyMDE({
    element: product,
    forceSync: true,
    spellChecker: false,
    status: false,
    toolbar: TOOLBAR,
    placeholder: product.placeholder,
  });

  editor.codemirror.on("change", () => {
    updateExport();
    scheduleSave();
  });

  // The editor fills its pane, so it has to re-measure when the pane resizes.
  window.addEventListener("resize", () => editor.codemirror.refresh());
};

const showApp = () => {
  setup.hidden = true;
  app.hidden = false;
  ensureEditor();
  restoreDocument();
};

/* Provider footer */

const formatRemaining = (ms) => {
  const total = Math.max(0, Math.ceil(ms / 60_000));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;

  if (!hours) return `${minutes}m`;

  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
};

const renderProvider = () => {
  const apiKey = getApiKey();

  providerNote.hidden = !apiKey;

  if (!apiKey) return;

  if (!isFreeKey(apiKey)) {
    providerNote.textContent = "Using a custom AI provider";
    return;
  }

  const expiry = keyExpiry(apiKey);

  providerNote.textContent =
    expiry && expiry > Date.now()
      ? `Using AI For All, access expires in ${formatRemaining(expiry - Date.now())}`
      : "Using AI For All, access has expired";
};

// One field per section of the answer, in the order they are written.
const SECTIONS = [
  ["Readback", "readback"],
  ["Add", "add"],
  ["Remove", "remove"],
  ["Readiness", "readiness"],
];

const toMarkdown = (reply) =>
  SECTIONS.filter(([, field]) => reply[field] !== undefined)
    .map(([heading, field]) => `## ${heading}\n\n${reply[field]}`)
    .join("\n\n");

let frame = 0;

const paint = () => {
  if (frame || !parse) return;

  frame = requestAnimationFrame(() => {
    frame = 0;
    result.innerHTML = parse(toMarkdown(latest));
  });
};

/* Markdown rendering for the output pane */

markedPromise.then(({ marked }) => {
  parse = marked.parse.bind(marked);

  if (latest) paint();
});

/* Examples */

let examples;

const loadExamples = async () => {
  if (!examples) {
    const { parse } = await import("https://esm.sh/smol-toml");
    const text = await (await fetch("./static/EXAMPLES.toml")).text();
    examples = parse(text).examples;
  }
  return examples;
};

/* Refine */

const clearResult = () => {
  latest = {};
  result.textContent = "";

  if (frame) {
    cancelAnimationFrame(frame);
    frame = 0;
  }
};

random.addEventListener("click", async () => {
  const all = await loadExamples();
  const example = all[Math.floor(Math.random() * all.length)];

  goal.value = example.goal;
  setProduct(example.product);
  context.value = example.context;

  contextLabel();
  updateExport();
  clearResult();
});

back.addEventListener("click", () => {
  app.dataset.view = "input";
});

clear.addEventListener("click", () => {
  const confirmed = confirm(
    "Clear the goal, the product and the additional context?",
  );

  if (!confirmed) return;

  programmatic = true;

  goal.value = "";
  setProduct("");
  context.value = "";

  programmatic = false;

  localStorage.removeItem(DOC_KEYS.goal);
  localStorage.removeItem(DOC_KEYS.product);
  localStorage.removeItem(DOC_KEYS.context);

  saveStatus.textContent = "";
  contextLabel();
  updateExport();
  clearResult();
  app.dataset.view = "input";
});

refine.addEventListener("click", async () => {
  if (!goal.value.trim()) {
    goalError.hidden = false;
    goal.setAttribute("aria-invalid", "true");
    goal.focus();
    return;
  }

  goalError.hidden = true;
  goal.removeAttribute("aria-invalid");
  saveDocument();

  // Narrow viewports hand the whole screen to the response.
  app.dataset.view = "result";

  clearResult();
  refine.disabled = true;
  result.classList.remove("error");
  loading.hidden = false;
  loadingText.textContent = "Loading (Connecting to AI provider)";

  try {
    await preload();
    loadingText.textContent = "Loading (Waiting for AI response)";

    const reply = await generate({
      goal: goal.value,
      product: getProduct(),
      context: context.value,
      onPartial: (partial) => {
        if (Object.keys(partial).length) loading.hidden = true;
        latest = partial;
        paint();
      },
    });

    if (frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }

    const markdown = toMarkdown(reply);

    if (markdown) {
      result.innerHTML = parse(markdown);
    } else {
      result.classList.add("error");
      result.textContent = "The reply came back empty or unreadable. Try again.";
    }
  } catch (error) {
    if (frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }

    const body =
      error instanceof Response ? await error.json().catch(() => null) : null;

    const apiKey = getApiKey();
    const expiry = keyExpiry(apiKey);
    const expired = isFreeKey(apiKey) && !(expiry > Date.now());

    // A reply that died halfway is no reason to throw away the half we have.
    if (Object.keys(latest).length) {
      result.insertAdjacentHTML(
        "beforeend",
        '<p class="error">AI Provider Error: Incomplete response. Please retry.</p>',
      );
    } else {
      result.classList.add("error");
      result.textContent = expired
        ? "Your free key expired. Clear the AI settings to get a new one."
        : error?.status === 401
          ? "That key was rejected. Clear the AI settings to enter another."
          : (body?.error?.message ??
            error?.message ??
            "Something went wrong.");
    }
  } finally {
    loading.hidden = true;
    refine.disabled = false;
    renderProvider();
  }
});

/* Export */

exportBar.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-export]");

  if (!button) return;

  const title = goal.value.trim() || "thing";
  const text = getProduct();

  button.disabled = true;

  try {
    if (button.dataset.export === "md") exportMarkdown(text, title);
    if (button.dataset.export === "pdf") exportPdf(text, title);
    if (button.dataset.export === "docx") await exportDocx(text, title);
  } catch (error) {
    result.classList.add("error");
    result.textContent = `Export failed: ${error.message}`;
  } finally {
    button.disabled = false;
  }
});

/* Dialogs */

for (const dialog of document.querySelectorAll("dialog")) {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
}

helpOpen.addEventListener("click", (event) => {
  event.preventDefault();
  helpDialog.showModal();
});

/* Additional context */

const contextLabel = () => {
  const bytes = new Blob([context.value]).size;

  contextOpen.textContent = bytes
    ? `Additional context (${Math.ceil(bytes / 1024)}kb)`
    : "Add additional context";
};

contextOpen.addEventListener("click", (event) => {
  event.preventDefault();
  contextDialog.showModal();
  context.focus();
});

contextDialog.addEventListener("close", contextLabel);

/* Settings */

document.querySelector("#clear-settings").addEventListener("click", (event) => {
  event.preventDefault();

  if (!confirm("This deletes the saved API key, base URL and model.")) return;

  clearStorage();
  location.reload();
});

/* Boot */

renderProvider();
setInterval(renderProvider, 30_000);

if (getApiKey()) showApp();

setup.addEventListener("setup-complete", () => {
  renderProvider();
  showApp();
});

preload();
root.hidden = false;
