const editorial = {};

(function routeDueloDoTopoApi() {
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const raw =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input?.url || '';
    try {
      const url = new URL(raw, location.href);
      const action = url.searchParams.get('action');
      if (
        url.origin === location.origin &&
        url.pathname === '/api' &&
        (action === 'ranking-vote-modes' || action === 'ranking-duel')
      ) {
        url.pathname = '/duel-bottom-api';
        if (input instanceof Request) input = new Request(url.toString(), input);
        else if (input instanceof URL) input = url;
        else input = `${url.pathname}${url.search}${url.hash}`;
      }
    } catch {}
    return originalFetch(input, init);
  };
})();

(function labelRankingVoteTabs() {
  const installStyles = () => {
    if (document.getElementById('dueloNoTopoStyles')) return;
    const style = document.createElement('style');
    style.id = 'dueloNoTopoStyles';
    style.textContent = `
      body.popElectric.rankingPage .rankingVoteModes button[data-ranking-vote-mode="duelo"] {
        background: #92333f;
        color: #fff;
      }
      body.popElectric.rankingPage .rankingVoteModes button[data-ranking-vote-mode="duelo"]:hover,
      body.popElectric.rankingPage .rankingVoteModes button[data-ranking-vote-mode="duelo"]:focus-visible,
      body.popElectric.rankingPage .rankingVoteModes button[data-ranking-vote-mode="duelo"].active {
        background: #7d2632;
        color: #fff;
      }
      body.popElectric.rankingPage .rankingVoteModes button[data-ranking-vote-mode="duelo"].active {
        box-shadow: inset 0 -4px 0 rgba(255,255,255,.28);
      }
    `;
    document.head.appendChild(style);
  };

  const duelCopy = (root = document) => {
    root.querySelectorAll?.('.rankingFreeIntro span, .duelHomeCallout h2, .rankingModeLoading strong').forEach(
      (element) => {
        if (element.textContent.includes('Ganha, Fica')) {
          element.textContent = element.textContent.replaceAll('Ganha, Fica', 'Duelo do Topo');
        }
        if (element.textContent.includes('Ganha Fica')) {
          element.textContent = element.textContent.replaceAll('Ganha Fica', 'Duelo do Topo');
        }
      },
    );
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
      button.setAttribute('aria-label', 'Duelo do Topo');
      button.replaceChildren();
      if (icon) button.append(icon);
      button.append(document.createTextNode(' DUELO DO TOPO'));
    });
    duelCopy(root);
  };

  installStyles();
  relabel();
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        relabel(node.matches?.('body') ? node : node.parentElement || node);
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
