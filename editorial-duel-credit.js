(() => {
  if (typeof document === 'undefined') return;

  const PUBLIC_DOMAIN = /\b(public domain|cc0)\b/i;

  function installStyles() {
    if (document.getElementById('duelPhotoCreditStyles')) return;
    const style = document.createElement('style');
    style.id = 'duelPhotoCreditStyles';
    style.textContent = `
      body.popElectric.rankingPage .duelChoiceVerifiedPhoto > small{
        display:none !important;
      }
      body.popElectric.rankingPage .duelPhotoInfo{
        position:absolute;
        right:5px;
        bottom:5px;
        z-index:3;
        width:20px;
        height:20px;
        display:grid;
        place-items:center;
        border:1px solid rgba(255,255,255,.92);
        border-radius:50%;
        background:rgba(0,0,0,.62);
        color:#fff;
        font:900 12px/1 Arial,Helvetica,sans-serif;
        cursor:pointer;
        user-select:none;
        -webkit-tap-highlight-color:transparent;
      }
      body.popElectric.rankingPage .duelPhotoInfo:hover,
      body.popElectric.rankingPage .duelPhotoInfo:focus-visible{
        background:#000;
        outline:2px solid #fff;
        outline-offset:1px;
      }
      body.popElectric.rankingPage .duelPhotoCreditPanel{
        position:absolute;
        left:5px;
        right:31px;
        bottom:5px;
        z-index:2;
        display:none;
        min-height:20px;
        align-items:center;
        padding:4px 6px;
        border-radius:4px;
        background:rgba(0,0,0,.82);
        color:#fff;
        text-align:left;
        font:700 7px/1.2 Arial,Helvetica,sans-serif;
        letter-spacing:0;
      }
      body.popElectric.rankingPage .duelPhotoCreditPanel.open{
        display:flex;
      }
      @media(max-width:900px){
        body.popElectric.rankingPage .duelPhotoInfo{
          right:4px;
          bottom:4px;
          width:17px;
          height:17px;
          font-size:10px;
        }
        body.popElectric.rankingPage .duelPhotoCreditPanel{
          left:4px;
          right:26px;
          bottom:4px;
          min-height:17px;
          padding:3px 4px;
          font-size:6px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function stopDuel(event) {
    event.preventDefault();
    event.stopPropagation();
  }

  function enhanceFrame(frame) {
    if (!(frame instanceof HTMLElement) || frame.dataset.creditUiReady === '1') return;
    frame.dataset.creditUiReady = '1';

    const original = frame.querySelector(':scope > small');
    const credit = String(original?.textContent || '').replace(/\s+/g, ' ').trim();
    if (!credit || PUBLIC_DOMAIN.test(credit)) return;

    const info = document.createElement('span');
    info.className = 'duelPhotoInfo';
    info.setAttribute('role', 'button');
    info.setAttribute('tabindex', '0');
    info.setAttribute('aria-label', 'Ver crédito da foto');
    info.setAttribute('aria-expanded', 'false');
    info.textContent = 'i';

    const panel = document.createElement('span');
    panel.className = 'duelPhotoCreditPanel';
    panel.textContent = credit;

    const toggle = (event) => {
      stopDuel(event);
      const open = !panel.classList.contains('open');
      panel.classList.toggle('open', open);
      info.setAttribute('aria-expanded', String(open));
    };

    info.addEventListener('click', toggle);
    info.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') toggle(event);
    });
    panel.addEventListener('click', stopDuel);

    frame.append(panel, info);
  }

  function scan(root = document) {
    root.querySelectorAll?.('.duelChoiceVerifiedPhoto').forEach(enhanceFrame);
  }

  installStyles();
  scan();

  new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches?.('.duelChoiceVerifiedPhoto')) enhanceFrame(node);
        scan(node);
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
