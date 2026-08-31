const editorial = {};

(function labelRankingViewTab() {
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
  };

  relabel();
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches?.('[data-ranking-vote-mode="livre"]')) relabel(node.parentElement || node);
        else if (node.querySelector?.('[data-ranking-vote-mode="livre"]')) relabel(node);
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
