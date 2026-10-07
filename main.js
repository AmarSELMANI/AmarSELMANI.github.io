/* Theme toggle + footer year. No dependencies. */
(function () {
  "use strict";

  var root = document.documentElement;
  var KEY = "mas-theme";

  function read() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function write(v) {
    try { localStorage.setItem(KEY, v); } catch (e) { /* private mode: ignore */ }
  }

  var saved = read();
  if (saved === "dark" || saved === "light") {
    root.setAttribute("data-theme", saved);
  }

  function systemPrefersDark() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  var btn = document.getElementById("theme-toggle");
  if (btn) {
    btn.addEventListener("click", function () {
      var current = root.getAttribute("data-theme");
      if (!current) { current = systemPrefersDark() ? "dark" : "light"; }
      var next = current === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      write(next);
      btn.setAttribute("aria-label", "Switch to " + (next === "dark" ? "light" : "dark") + " theme");
    });
  }

  var year = document.getElementById("year");
  if (year) { year.textContent = String(new Date().getFullYear()); }
})();
