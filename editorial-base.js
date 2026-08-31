const editorial = {};

(function labelRankingVoteTabs() {
  const installStyles = () => {
    if (document.getElementById('dueloNoTopoStyles')) return;
    const style = document.createElement('style');
    style.id = 'dueloNoTopoStyles';
    style.textContent = `
      body.popElectric.rankingPage .rankingVoteModes button[data-ranking-vote-mode="duelo"] {
        background: #711c24;
        color: #fff;
      }
      body.popElectric.rankingPage .rankingVoteModes button[data-ranking-vote-mode="duelo"]:hover,
      body.popElectric.rankingPage .rankingVoteModes button[data-ranking-vote-mode="duelo"]:focus-visible,
      body.popElectric.rankingPage .rankingVoteModes button[data-ranking-vote-mode="duelo"].active {
        background: #57151b;
        color: #fff;
      }
      body.popElectric.rankingPage .rankingVoteModes button[data-ranking-vote-mode="duelo"].active {
        box-shadow: inset 0 -4px 0 rgba(255,255,255,.28);
      }
    `;
    document.head.appendChild(style);
  };

  const relabel = (root = document) => {
    root.querySelectorAll?.('[data-ranking-vote-mode="livre"]').forEach((button) => {
      if (button.dataset.viewRankingLabelled === '1') return;
      const icon = button.querySelector('span');
      button.dataset.viewRankingLabelled = '1';
      button.setAttribute('aria-label', 'Ver o ranking');
      button.replaceChildren();
      if (icon) button.append(icon);
      button.append(document.createTextNode(' VER O RANKING'));
    });

    root.querySelectorAll?.('[data-ranking-vote-mode="duelo"]').forEach((button) => {
      if (button.dataset.dueloTopoLabelled === '1') return;
      const icon = button.querySelector('span');
      button.dataset.dueloTopoLabelled = '1';
      button.setAttribute('aria-label', 'Duelo no Topo');
      button.replaceChildren();
      if (icon) button.append(icon);
      button.append(document.createTextNode(' DUELO NO TOPO'));
    });
  };

  installStyles();
  relabel();
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (
          node.matches?.('[data-ranking-vote-mode="livre"], [data-ranking-vote-mode="duelo"]')
        ) {
          relabel(node.parentElement || node);
        } else if (
          node.querySelector?.('[data-ranking-vote-mode="livre"], [data-ranking-vote-mode="duelo"]')
        ) {
          relabel(node);
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
