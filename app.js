(function () {
  const dataset = window.STRIVER_LEETCODE_DATA;
  const entries = dataset.entries.map((entry, index) => ({
    ...entry,
    globalOrder: index + 1,
    difficulty: normalizeDifficulty(entry.difficulty)
  }));

  const doneKey = "striver-leetcode-done-v1";
  let done = new Set(loadDone());
  let visibleRows = [];
  const state = {
    view: "unique",
    query: "",
    sheet: "all",
    difficulties: new Set(["Easy", "Medium", "Hard"]),
    groupBy: "topic",
    sortBy: "sheet",
    duplicatesOnly: false,
    hideDone: false
  };

  const elements = {
    uniqueTotal: document.getElementById("uniqueTotal"),
    entryTotal: document.getElementById("entryTotal"),
    sdeTotal: document.getElementById("sdeTotal"),
    a2zTotal: document.getElementById("a2zTotal"),
    doneTotal: document.getElementById("doneTotal"),
    searchInput: document.getElementById("searchInput"),
    sheetFilter: document.getElementById("sheetFilter"),
    groupFilter: document.getElementById("groupFilter"),
    sortFilter: document.getElementById("sortFilter"),
    duplicatesOnly: document.getElementById("duplicatesOnly"),
    hideDone: document.getElementById("hideDone"),
    copyLinks: document.getElementById("copyLinks"),
    downloadCsv: document.getElementById("downloadCsv"),
    clearProgress: document.getElementById("clearProgress"),
    resultSummary: document.getElementById("resultSummary"),
    statusMessage: document.getElementById("statusMessage"),
    results: document.getElementById("results")
  };

  const uniqueRowsCache = buildUniqueRows(entries);
  const duplicateUrls = new Set(
    uniqueRowsCache.filter((row) => row.entries.length > 1).map((row) => row.leetcodeUrl)
  );

  init();

  function init() {
    renderHeaderStats();
    bindEvents();
    render();
  }

  function bindEvents() {
    elements.searchInput.addEventListener("input", (event) => {
      state.query = event.target.value.trim().toLowerCase();
      render();
    });

    document.querySelectorAll("[data-view]").forEach((button) => {
      button.addEventListener("click", () => {
        state.view = button.dataset.view;
        document.querySelectorAll("[data-view]").forEach((item) => {
          item.classList.toggle("is-active", item === button);
        });
        render();
      });
    });

    elements.sheetFilter.addEventListener("change", (event) => {
      state.sheet = event.target.value;
      render();
    });

    elements.groupFilter.addEventListener("change", (event) => {
      state.groupBy = event.target.value;
      render();
    });

    elements.sortFilter.addEventListener("change", (event) => {
      state.sortBy = event.target.value;
      render();
    });

    document.querySelectorAll("[name='difficulty']").forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        state.difficulties = new Set(
          Array.from(document.querySelectorAll("[name='difficulty']:checked")).map((item) => item.value)
        );
        render();
      });
    });

    elements.duplicatesOnly.addEventListener("change", (event) => {
      state.duplicatesOnly = event.target.checked;
      render();
    });

    elements.hideDone.addEventListener("change", (event) => {
      state.hideDone = event.target.checked;
      render();
    });

    elements.copyLinks.addEventListener("click", copyVisibleLinks);
    elements.downloadCsv.addEventListener("click", downloadCsv);
    elements.clearProgress.addEventListener("click", clearProgress);
  }

  function renderHeaderStats() {
    elements.uniqueTotal.textContent = dataset.stats.uniqueProblems;
    elements.entryTotal.textContent = dataset.stats.totalEntries;
    elements.sdeTotal.textContent = `${dataset.stats.bySheet.SDE.entries} / ${dataset.stats.bySheet.SDE.uniqueProblems}`;
    elements.a2zTotal.textContent = `${dataset.stats.bySheet.A2Z.entries} / ${dataset.stats.bySheet.A2Z.uniqueProblems}`;
    elements.doneTotal.textContent = `${done.size} / ${dataset.stats.uniqueProblems}`;
  }

  function render() {
    const baseRows = state.view === "unique" ? uniqueRowsCache : entries.map(entryToRow);
    const rows = sortRows(baseRows.filter(matchesFilters));
    visibleRows = rows;
    renderHeaderStats();
    renderSummary(rows);
    renderResults(rows);
  }

  function renderSummary(rows) {
    const kind = state.view === "unique" ? "unique problems" : "sheet entries";
    const visibleLinks = new Set(rows.map((row) => row.leetcodeUrl)).size;
    elements.resultSummary.textContent = `${rows.length} ${kind} visible, ${visibleLinks} unique LeetCode links`;
  }

  function renderResults(rows) {
    elements.results.replaceChildren();

    if (!rows.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "No links match the current filters.";
      elements.results.append(empty);
      return;
    }

    const groups = groupRows(rows);
    groups.forEach(([groupName, groupRowsList]) => {
      const section = document.createElement("section");
      section.className = "group";

      if (state.groupBy !== "none") {
        const title = document.createElement("h2");
        title.className = "group-title";
        title.textContent = groupName;
        const count = document.createElement("span");
        count.textContent = `${groupRowsList.length} links`;
        title.append(count);
        section.append(title);
      }

      const list = document.createElement("div");
      list.className = "problem-list";
      groupRowsList.forEach((row) => list.append(createProblemRow(row)));
      section.append(list);
      elements.results.append(section);
    });
  }

  function createProblemRow(row) {
    const article = document.createElement("article");
    article.className = "problem-row";

    const doneLabel = document.createElement("label");
    doneLabel.className = "done-box";
    doneLabel.title = "Mark done";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = done.has(row.leetcodeUrl);
    checkbox.addEventListener("change", () => {
      toggleDone(row.leetcodeUrl, checkbox.checked);
    });
    doneLabel.append(checkbox);

    const main = document.createElement("div");
    main.className = "problem-main";

    const titleLine = document.createElement("div");
    titleLine.className = "problem-title-line";

    const title = document.createElement("a");
    title.className = "problem-title";
    title.href = row.leetcodeUrl;
    title.target = "_blank";
    title.rel = "noreferrer";
    title.textContent = row.title;
    titleLine.append(title);

    const difficulty = document.createElement("span");
    difficulty.className = `difficulty ${difficultyClass(row.difficulty)}`;
    difficulty.textContent = row.difficulty;
    titleLine.append(difficulty);
    main.append(titleLine);

    const meta = document.createElement("p");
    meta.className = "meta-line";
    meta.textContent = metaText(row);
    main.append(meta);

    const chips = document.createElement("div");
    chips.className = "chips";
    row.sheetKeys.forEach((sheetKey) => {
      chips.append(chip(sheetKey === "SDE" ? "SDE" : "A2Z DSA", `sheet-${sheetKey.toLowerCase()}`));
    });
    row.paths.slice(0, 4).forEach((path) => chips.append(chip(path, "path")));
    if (row.paths.length > 4) {
      chips.append(chip(`+${row.paths.length - 4} more`, "path"));
    }
    main.append(chips);

    const actions = document.createElement("div");
    actions.className = "problem-actions";
    actions.append(actionLink("LeetCode", row.leetcodeUrl, "primary"));
    if (row.articleUrl) {
      actions.append(actionLink("TUF", row.articleUrl, "secondary"));
    }

    article.append(doneLabel, main, actions);
    return article;
  }

  function buildUniqueRows(sourceEntries) {
    const grouped = new Map();
    sourceEntries.forEach((entry) => {
      if (!grouped.has(entry.leetcodeUrl)) {
        grouped.set(entry.leetcodeUrl, []);
      }
      grouped.get(entry.leetcodeUrl).push(entry);
    });

    return Array.from(grouped.values()).map((items) => {
      const names = unique(items.map((item) => item.problemName));
      const difficulties = unique(items.map((item) => item.difficulty));
      const sheetKeys = unique(items.map((item) => item.sheetKey));
      const paths = unique(items.map(formatPath));
      return {
        type: "unique",
        title: names[0],
        aliases: names.slice(1),
        difficulty: difficulties.length === 1 ? difficulties[0] : "Mixed",
        difficulties,
        leetcodeUrl: items[0].leetcodeUrl,
        leetcodeSlug: items[0].leetcodeSlug,
        articleUrl: firstValue(items.map((item) => item.articleUrl)),
        sheetKeys,
        paths,
        entries: items,
        category: items[0].category || "Other",
        globalOrder: Math.min(...items.map((item) => item.globalOrder))
      };
    });
  }

  function entryToRow(entry) {
    return {
      type: "entry",
      title: entry.problemName,
      aliases: [],
      difficulty: entry.difficulty,
      difficulties: [entry.difficulty],
      leetcodeUrl: entry.leetcodeUrl,
      leetcodeSlug: entry.leetcodeSlug,
      articleUrl: entry.articleUrl,
      sheetKeys: [entry.sheetKey],
      paths: [formatPath(entry)],
      entries: [entry],
      category: entry.category || "Other",
      globalOrder: entry.globalOrder
    };
  }

  function matchesFilters(row) {
    if (state.hideDone && done.has(row.leetcodeUrl)) return false;
    if (state.duplicatesOnly && !duplicateUrls.has(row.leetcodeUrl)) return false;

    if (state.sheet === "both") {
      if (!hasBothSheets(row.leetcodeUrl)) return false;
    } else if (state.sheet !== "all" && !row.sheetKeys.includes(state.sheet)) {
      return false;
    }

    if (!row.difficulties.some((difficulty) => state.difficulties.has(difficulty))) return false;

    if (!state.query) return true;
    const haystack = [
      row.title,
      row.aliases.join(" "),
      row.leetcodeSlug,
      row.leetcodeUrl,
      row.sheetKeys.join(" "),
      row.paths.join(" ")
    ].join(" ").toLowerCase();
    return haystack.includes(state.query);
  }

  function sortRows(rows) {
    const sorted = [...rows];
    const difficultyOrder = { Easy: 1, Medium: 2, Hard: 3, Mixed: 4 };
    sorted.sort((a, b) => {
      if (state.sortBy === "title") return a.title.localeCompare(b.title);
      if (state.sortBy === "difficulty") {
        const diff = (difficultyOrder[a.difficulty] || 9) - (difficultyOrder[b.difficulty] || 9);
        return diff || a.title.localeCompare(b.title);
      }
      return a.globalOrder - b.globalOrder;
    });
    return sorted;
  }

  function groupRows(rows) {
    if (state.groupBy === "none") return [["All links", rows]];

    const groups = new Map();
    rows.forEach((row) => {
      const key = state.groupBy === "sheet" ? sheetGroup(row) : row.category || "Other";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    });
    return Array.from(groups.entries());
  }

  function sheetGroup(row) {
    if (row.sheetKeys.includes("SDE") && row.sheetKeys.includes("A2Z")) return "In both sheets";
    if (row.sheetKeys.includes("SDE")) return "SDE sheet only";
    return "A2Z DSA sheet only";
  }

  function hasBothSheets(url) {
    const row = uniqueRowsCache.find((item) => item.leetcodeUrl === url);
    return row ? row.sheetKeys.includes("SDE") && row.sheetKeys.includes("A2Z") : false;
  }

  function toggleDone(url, checked) {
    if (checked) {
      done.add(url);
    } else {
      done.delete(url);
    }
    saveDone();
    render();
  }

  function clearProgress() {
    done = new Set();
    saveDone();
    setStatus("Done marks cleared.");
    render();
  }

  async function copyVisibleLinks() {
    const links = unique(visibleRows.map((row) => row.leetcodeUrl));
    if (!links.length) {
      setStatus("No visible links to copy.");
      return;
    }
    const text = links.join("\n");
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        fallbackCopy(text);
      }
      setStatus(`${links.length} links copied.`);
    } catch {
      fallbackCopy(text);
      setStatus(`${links.length} links copied.`);
    }
  }

  function downloadCsv() {
    const rows = visibleRows.map((row) => ({
      title: row.title,
      difficulty: row.difficulty,
      sheets: row.sheetKeys.join(" + "),
      topics: row.paths.join(" | "),
      leetcode: row.leetcodeUrl
    }));
    if (!rows.length) {
      setStatus("No visible rows to export.");
      return;
    }
    const header = ["Title", "Difficulty", "Sheets", "Topics", "LeetCode URL"];
    const csv = [
      header.join(","),
      ...rows.map((row) => [row.title, row.difficulty, row.sheets, row.topics, row.leetcode].map(csvCell).join(","))
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "striver-leetcode-links.csv";
    link.click();
    URL.revokeObjectURL(url);
    setStatus(`${rows.length} rows exported.`);
  }

  function fallbackCopy(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.append(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }

  function setStatus(message) {
    elements.statusMessage.textContent = message;
    window.clearTimeout(setStatus.timer);
    setStatus.timer = window.setTimeout(() => {
      elements.statusMessage.textContent = "";
    }, 2600);
  }

  function normalizeDifficulty(value) {
    const text = String(value || "").trim().toLowerCase();
    if (text === "easy") return "Easy";
    if (text === "medium") return "Medium";
    if (text === "hard") return "Hard";
    return "Mixed";
  }

  function difficultyClass(value) {
    return value.toLowerCase();
  }

  function formatPath(entry) {
    const parts = [entry.sheetShortName, entry.category, entry.subcategory].filter(Boolean);
    return parts.join(" > ");
  }

  function metaText(row) {
    const slug = row.leetcodeSlug ? `leetcode.com/problems/${row.leetcodeSlug}` : row.leetcodeUrl;
    const aliasText = row.aliases.length ? ` | Also listed as: ${row.aliases.join(", ")}` : "";
    const countText = row.entries.length > 1 ? ` | ${row.entries.length} sheet placements` : "";
    return `${slug}${countText}${aliasText}`;
  }

  function chip(text, extraClass) {
    const item = document.createElement("span");
    item.className = `chip ${extraClass || ""}`.trim();
    item.textContent = text;
    return item;
  }

  function actionLink(text, href, extraClass) {
    const link = document.createElement("a");
    link.href = href;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.className = extraClass || "";
    link.textContent = text;
    return link;
  }

  function unique(items) {
    return Array.from(new Set(items.filter(Boolean)));
  }

  function firstValue(items) {
    return items.find(Boolean) || null;
  }

  function csvCell(value) {
    return `"${String(value || "").replace(/"/g, '""')}"`;
  }

  function loadDone() {
    try {
      return JSON.parse(localStorage.getItem(doneKey) || "[]");
    } catch {
      return [];
    }
  }

  function saveDone() {
    localStorage.setItem(doneKey, JSON.stringify(Array.from(done)));
  }
})();
