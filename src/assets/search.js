(function () {
  window.addEventListener("DOMContentLoaded", function () {
    if (!window.PagefindUI) return;
    var link = document.querySelector('link[rel="stylesheet"][href*="/assets/style"]');
    var baseUrl = "/";
    if (link) {
      baseUrl = link.getAttribute("href").replace(/assets\/style(?:\.[a-f0-9]+)?\.css.*$/, "");
    }
    var root = document.querySelector("#search");
    if (!root) return;
    new PagefindUI({
      element: "#search",
      showSubResults: false,
      showImages: false,
      baseUrl: baseUrl,
      translations: { placeholder: "Model number, e.g. i12060 or i4618AC" }
    });
    var params = new URLSearchParams(window.location.search);
    var q = params.get("q");
    if (!q) return;
    var input = root.querySelector("input");
    if (!input) return;
    input.value = q;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
})();
