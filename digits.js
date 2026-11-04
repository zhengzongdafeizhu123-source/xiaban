(function (root) {
  'use strict';
  root.MoneyDigits = function (element, value) {
    var text = String(value);
    if (element.dataset.number === text) return;
    element.dataset.number = text;
    var safe = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    element.innerHTML = safe.replace(/[68]/g, function (digit) { return '<span class="digit-' + digit + '">' + digit + '</span>'; });
  };
})(typeof window === 'undefined' ? globalThis : window);
