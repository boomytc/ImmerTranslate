const $ = (id) => document.getElementById(id);

chrome.storage.local.get(
  { apiKey: "", sourceLang: "auto", targetLang: "zh-CN" },
  (data) => {
    $("apiKey").value = data.apiKey || "";
    $("sourceLang").value = data.sourceLang || "auto";
    $("targetLang").value = data.targetLang || "zh-CN";
  }
);

$("save").addEventListener("click", () => {
  chrome.storage.local.set(
    {
      apiKey: $("apiKey").value.trim(),
      sourceLang: $("sourceLang").value,
      targetLang: $("targetLang").value,
    },
    () => {
      $("status").textContent = "已保存";
      setTimeout(() => {
        $("status").textContent = "";
      }, 1500);
    }
  );
});
