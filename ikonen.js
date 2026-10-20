/* ikonen.js – Bedien-Symbole (Tabs, Menü, Teilen, Suche …), erzeugt vom Design-Konfigurator am 20.10.2026
   Satz: WetterPro, Strich 1.5 px, Farbe folgt currentColor. Eigene Zeichnung, frei im Projekt verwendbar.
   Aufruf: knopf.innerHTML = Ikon('search');  Namen: sun, cloud, cloudsun, rain, storm, fog, moon, wind, map, pin, calendar, sliders, search, chevron, chevdown, sunrise, sunset, check, x, chart, radar, more, share, camera, image, tropfen */
(function () {
  var STRICH = 1.5;
  var IKONEN = {
    "sun": "<circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41\"/>",
    "cloud": "<path d=\"M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z\"/>",
    "cloudsun": "<circle cx=\"8.5\" cy=\"8.5\" r=\"3.2\"/><path d=\"M8.5 2.5v1.5M8.5 13v1.5M2.5 8.5H4M13 8.5h1.5M4.3 4.3l1 1M11.7 11.7l1 1M11.7 5.3l1-1M4.3 12.7l1-1\"/><path d=\"M11 21h7.5a3.2 3.2 0 0 0 .3-6.4A4.8 4.8 0 0 0 9.6 13 4 4 0 0 0 11 21z\"/>",
    "rain": "<path d=\"M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.2\"/><path d=\"M16 14v6M8 14v6M12 16v6\"/>",
    "storm": "<path d=\"M6 16.3A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 3 7.9\"/><path d=\"m13 12-3 5h4l-3 5\"/>",
    "fog": "<path d=\"M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.2\"/><path d=\"M16 17H7M17 21H9\"/>",
    "moon": "<path d=\"M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z\"/>",
    "wind": "<path d=\"M4 6c3-2 5 2 8 0s5-2 8 0M4 12c3-2 5 2 8 0s5-2 8 0M4 18c3-2 5 2 8 0s5-2 8 0\"/>",
    "map": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M3 12h18M12 3c3.2 3 3.2 15 0 18M12 3c-3.2 3-3.2 15 0 18\"/>",
    "pin": "<circle cx=\"12\" cy=\"10\" r=\"3\"/><path d=\"M12 21c-4-4.5-7-7.6-7-11a7 7 0 0 1 14 0c0 3.4-3 6.5-7 11z\"/>",
    "calendar": "<rect x=\"3.5\" y=\"5\" width=\"17\" height=\"15.5\" rx=\"2\"/><path d=\"M3.5 10h17M8 3v4M16 3v4\"/>",
    "sliders": "<path d=\"M4 7h16M4 12h16M4 17h16\"/>",
    "search": "<circle cx=\"10.5\" cy=\"10.5\" r=\"6.5\"/><path d=\"M15.5 15.5 21 21\"/>",
    "chevron": "<path d=\"M9 5l7 7-7 7\"/>",
    "chevdown": "<path d=\"M5 9l7 7 7-7\"/>",
    "sunrise": "<path d=\"M12 2v6M4.2 10.2l1.4 1.4M2 18h2M20 18h2M18.4 11.6l1.4-1.4M22 22H2\"/><path d=\"M16 18a4 4 0 0 0-8 0\"/><path d=\"m8 6 4-4 4 4\"/>",
    "sunset": "<path d=\"M12 10V2M4.2 10.2l1.4 1.4M2 18h2M20 18h2M18.4 11.6l1.4-1.4M22 22H2\"/><path d=\"M16 18a4 4 0 0 0-8 0\"/><path d=\"m16 6-4 4-4-4\"/>",
    "check": "<path d=\"M20 6 9 17l-5-5\"/>",
    "x": "<path d=\"M18 6 6 18M6 6l12 12\"/>",
    "chart": "<path d=\"M3 20.5h18\"/><path d=\"M4 16l4.2-5.5 3.8 3 3.6-6 4.4 4.5\"/><path d=\"M6 20.5v-2M10 20.5v-3M14 20.5v-2.5M18 20.5v-3.5\"/>",
    "radar": "<rect x=\"9.2\" y=\"9.2\" width=\"5.6\" height=\"5.6\" rx=\"1\" transform=\"rotate(45 12 12)\"/><rect x=\"1.5\" y=\"10\" width=\"5.5\" height=\"4\" rx=\".8\"/><rect x=\"17\" y=\"10\" width=\"5.5\" height=\"4\" rx=\".8\"/><path d=\"M7 12h1.2M15.8 12h1.2\"/><path d=\"M12 8V5.5\"/><path d=\"M9.3 4.2a3.6 3.6 0 0 1 5.4 0\"/>",
    "more": "<circle cx=\"5\" cy=\"12\" r=\"1.4\"/><circle cx=\"12\" cy=\"12\" r=\"1.4\"/><circle cx=\"19\" cy=\"12\" r=\"1.4\"/>",
    "share": "<path d=\"M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8\"/><path d=\"m16 6-4-4-4 4\"/><path d=\"M12 2v13\"/>",
    "camera": "<path d=\"M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z\"/><circle cx=\"12\" cy=\"13\" r=\"3\"/>",
    "image": "<rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\"/><circle cx=\"9\" cy=\"9\" r=\"2\"/><path d=\"m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21\"/>",
    "tropfen": "<path d=\"M12 2.7s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11Z\"/>"
  };
  window.IKONEN_NAMEN = Object.keys(IKONEN);
  window.Ikon = function (name, klasse) {
    return '<svg class="ikon' + (klasse ? ' ' + klasse : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + STRICH + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (IKONEN[name] || '') + '</svg>';
  };
})();
