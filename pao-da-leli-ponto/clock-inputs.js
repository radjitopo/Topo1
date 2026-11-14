(function () {
  function normalize(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    let match = /^(\d{1,2}):(\d{2})$/.exec(text);
    if (!match && /^\d{3,4}$/.test(text)) match = [text, text.slice(0, -2), text.slice(-2)];
    if (!match && /^\d{1,2}$/.test(text)) match = [text, text, '00'];
    if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return text;
    return match[1].padStart(2, '0') + ':' + match[2];
  }
  function valid(value) { return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value); }
  function prepare(root) {
    root.querySelectorAll('input[type="time"]').forEach(input => {
      input.type = 'text';
      input.dataset.clockInput = 'true';
      input.inputMode = 'numeric';
      input.placeholder = 'HH:mm';
      input.maxLength = 5;
      input.autocomplete = 'off';
      input.setAttribute('pattern', '(?:[01][0-9]|2[0-3]):[0-5][0-9]');
      input.setAttribute('title', 'Digite o horário, por exemplo 08:30 ou 0830.');
    });
  }
  window.leliClock = { normalize, valid, prepare };
  prepare(document);
  new MutationObserver(() => prepare(document)).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('input', event => {
    const input = event.target;
    if (!input.matches('[data-clock-input]')) return;
    input.setCustomValidity('');
    if (/^\d{4}$/.test(input.value)) input.value = normalize(input.value);
  }, true);
  document.addEventListener('blur', event => {
    const input = event.target;
    if (!input.matches('[data-clock-input]')) return;
    const previous = input.value;
    input.value = normalize(input.value);
    input.setCustomValidity(input.value && !valid(input.value) ? 'Use um horário válido no formato HH:mm.' : '');
    if (previous !== input.value) input.dispatchEvent(new Event('input', { bubbles: true }));
  }, true);
  document.addEventListener('keydown', event => {
    if (event.key !== 'Enter' || !event.target.matches('[data-clock-input]')) return;
    event.target.value = normalize(event.target.value);
  }, true);
})();
