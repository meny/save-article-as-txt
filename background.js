async function extractText(tabId) {
  const code = `
    (() => {
      const el = document.querySelector('article') || document.querySelector('main') || document.body;
      const title = document.querySelector('h1')?.innerText || document.title;
      let text = '';
      const sel = window.getSelection().toString();
      if (sel) text = sel;
      else {
        const paras = [...el.querySelectorAll('p')].map(p => p.innerText.trim()).filter(Boolean);
        text = paras.length ? paras.join("\\n\\n") : el.innerText;
      }
      return { title, text };
    })();
  `;
  const [res] = await browser.tabs.executeScript(tabId, { code });
  return res;
}

function cleanFilename(name) {
  return (name || "article")
    .replace(/[:/\\\\<>?"|*]+/g, "")
    .replace(/\\s+/g, " ")
    .trim()
    .slice(0, 120);
}

browser.browserAction.onClicked.addListener(async (tab) => {
  try {
    console.log("Roman's Save Article as TXT: Clicked", tab.url);

    // Detect Reader Mode
    if (tab.url.startsWith("about:reader?url=")) {
      const originalUrl = decodeURIComponent(tab.url.split("url=")[1]);
      console.log("Reader Mode detected. Fetching from:", originalUrl);
      const newTab = await browser.tabs.create({ url: originalUrl, active: false });

      // Wait for page to load fully
      await new Promise(resolve => {
        const listener = (tid, changeInfo) => {
          if (tid === newTab.id && changeInfo.status === "complete") {
            browser.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        };
        browser.tabs.onUpdated.addListener(listener);
      });

      const result = await extractText(newTab.id);
      await browser.tabs.remove(newTab.id);
      await saveText(result);
      return;
    }

    const result = await extractText(tab.id);
    await saveText(result);
  } catch (err) {
    console.error("Roman's Save Article as TXT ERROR:", err);
    alert("Save failed: " + err.message);
  }
});

async function saveText({ title, text }) {
  if (!text) {
    alert("No text extracted.");
    return;
  }
  const filename = "Articles/" + cleanFilename(title) + ".txt";
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  await browser.downloads.download({
    url,
    filename,
    saveAs: false,
    conflictAction: "uniquify"
  });
  console.log("Roman's Save Article as TXT: Saved", filename);
}
