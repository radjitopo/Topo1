Object.assign(editorial,{"pequenas-tragedias-domesticas":{"about":"Dentro de casa, o desastre nem sempre precisa ser grande. Um dedinho na quina, uma meia no chão molhado ou uma toalha esquecida sobre a cama bastam para transformar segundos comuns em pequenas tragédias inesquecíveis.","facts":["Peças pequenas e rígidas concentram a pressão em uma área reduzida — o que ajuda a explicar por que pisar em um brinquedo dói tanto.","Pequenos contratempos parecem ainda piores quando acontecem com pressa, sono ou no escuro."],"related":["barulhos-irritantes","vitorias-adultas","gambiarras-brasileiras"]}});

(() => {
  const STYLE_ID = 'topoModeratorDeleteOptionStyle';
  const BUTTON_CLASS = 'rankingEditorDeleteOption';

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .rankingEditorOption { position: relative; }
      .rankingEditorOption input[data-ranking-editor-option] { padding-right: 46px; }
      .${BUTTON_CLASS} {
        position: absolute;
        right: 8px;
        top: 50%;
        transform: translateY(-50%);
        width: 32px;
        height: 32px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 0;
        border-radius: 999px;
        background: transparent;
        color: #8f1f18;
        cursor: pointer;
        z-index: 2;
      }
      .${BUTTON_CLASS}:hover,
      .${BUTTON_CLASS}:focus-visible { background: rgba(143, 31, 24, .09); }
      .${BUTTON_CLASS}:disabled { cursor: wait; opacity: .45; }
      .${BUTTON_CLASS} svg { width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
      @media (max-width: 640px) {
        .rankingEditorOption input[data-ranking-editor-option] { padding-right: 44px; }
        .${BUTTON_CLASS} { right: 6px; width: 30px; height: 30px; }
      }
    `;
    document.head.appendChild(style);
  }

  function rankingIdFromPath() {
    const match = location.pathname.match(/^\/ranking\/([^/]+)\/?$/);
    if (!match) return '';
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }

  function errorText(error) {
    return (
      {
        moderator_required: 'Esta conta não tem acesso de moderador.',
        minimum_options: 'O ranking precisa ficar com pelo menos duas opções.',
        option_not_found: 'Essa opção já não existe mais no ranking.',
        ranking_not_found: 'Esse ranking não está mais disponível.',
      }[error] || 'Não consegui excluir essa opção agora.'
    );
  }

  function removeOptionFromClient(rankingId, optionId) {
    try {
      if (typeof rankings === 'undefined' || !Array.isArray(rankings)) return;
      const ranking = rankings.find((item) => item.id === rankingId);
      if (!ranking || !Array.isArray(ranking.opts)) return;
      ranking.opts = ranking.opts.filter((option) => Number(option.id) !== optionId);
    } catch {
      // A exclusão já foi concluída no servidor; a interface pode continuar normalmente.
    }
  }

  function refreshEditorRows(form) {
    const rows = [...form.querySelectorAll('.rankingEditorOption')];
    rows.forEach((currentRow, index) => {
      const position = currentRow.querySelector(':scope > span');
      if (position) position.textContent = String(index + 1);
    });
    const count = form.querySelector('.rankingEditorOptions .rankingEditorSectionHead small');
    if (count) count.textContent = `${rows.length} opções · votos preservados`;
  }

  function decorateEditor() {
    const form = document.getElementById('rankingEditorForm');
    if (!form) return;
    ensureStyles();

    const rows = [...form.querySelectorAll('.rankingEditorOption')];
    rows.forEach((row) => {
      if (row.querySelector(`.${BUTTON_CLASS}`)) return;
      const input = row.querySelector('input[data-ranking-editor-option]');
      if (!input) return;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = BUTTON_CLASS;
      button.title = 'Excluir opção';
      button.setAttribute('aria-label', `Excluir ${input.value || 'esta opção'}`);
      button.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h16"></path><path d="M9 7V4h6v3"></path><path d="m7 7 1 13h8l1-13"></path><path d="M10 11v5M14 11v5"></path></svg>';

      button.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const currentRows = [...form.querySelectorAll('.rankingEditorOption')];
        if (currentRows.length <= 2) {
          window.alert('O ranking precisa ficar com pelo menos duas opções.');
          return;
        }

        const label = input.value.trim() || 'esta opção';
        const confirmed = window.confirm(
          `Excluir “${label}” deste ranking?\n\nOs votos e registros ligados a esta opção serão removidos. Essa ação não pode ser desfeita.`,
        );
        if (!confirmed) return;

        const rankingId = rankingIdFromPath();
        const optionId = Number(input.dataset.id);
        const status = document.getElementById('rankingEditorStatus');
        if (!rankingId || !Number.isSafeInteger(optionId)) {
          window.alert('Não consegui identificar essa opção.');
          return;
        }

        button.disabled = true;
        if (status) status.textContent = `Excluindo ${label}…`;
        try {
          const response = await fetch('/moderator-option-delete', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              rankingId,
              optionId,
              deviceId: localStorage.getItem('topo_device_id') || '',
            }),
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok) throw result;

          const nextRow = row.nextElementSibling || row.previousElementSibling;
          removeOptionFromClient(rankingId, optionId);
          row.remove();
          refreshEditorRows(form);
          if (status) status.textContent = `${label} foi excluído. Você pode continuar editando.`;
          nextRow?.querySelector('input[data-ranking-editor-option]')?.focus({ preventScroll: true });
        } catch (error) {
          button.disabled = false;
          const message = errorText(error?.error);
          if (status) status.textContent = message;
          window.alert(message);
        }
      });

      row.appendChild(button);
    });
  }

  const observer = new MutationObserver(decorateEditor);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  decorateEditor();
})();
