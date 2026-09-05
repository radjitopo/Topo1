Object.assign(editorial, {
  'celebridades-cerveja': {
    about:
      'Há encontros que seriam mais interessantes pelo papo do que pela fama. Escolher uma celebridade para dividir uma mesa mistura admiração, curiosidade, humor e a vontade de descobrir o que existe por trás da persona pública — valendo nomes do Brasil, do mundo e de qualquer época.',
    facts: [
      'A convivência informal costuma revelar lados de figuras públicas que entrevistas promocionais raramente mostram.',
      'Listas desse tipo mudam com as gerações: carisma e identificação pesam tanto quanto talento ou notoriedade.',
    ],
    related: ['famosos-melhor-amigo', 'celebridades-fofas', 'celebridades-dividem-opinioes'],
  },
});

if (typeof document !== 'undefined') {
  const duelPhotoScript = document.createElement('script');
  duelPhotoScript.src = '/duel-option-photos.js?v=20260904-1-verified-entities';
  duelPhotoScript.async = true;
  document.head.appendChild(duelPhotoScript);

  const duelCreditScript = document.createElement('script');
  duelCreditScript.src = '/editorial-duel-credit.js?v=20260904-1-info-credit';
  duelCreditScript.async = true;
  document.head.appendChild(duelCreditScript);

  const duelPhotoPolish = document.createElement('style');
  duelPhotoPolish.id = 'duelPhotoPolish';
  duelPhotoPolish.textContent = `
    body.popElectric.rankingPage .duelChoices{
      position:relative;
      display:flex !important;
      align-items:stretch !important;
      gap:16px !important;
    }
    body.popElectric.rankingPage .duelChoices > .duelChoice{
      flex:1 1 0 !important;
      width:0 !important;
      min-width:0 !important;
      max-width:none !important;
      box-sizing:border-box;
    }
    body.popElectric.rankingPage .duelVersus{
      position:absolute !important;
      left:50% !important;
      top:50% !important;
      z-index:4;
      width:30px;
      height:30px;
      display:grid !important;
      place-items:center;
      transform:translate(-50%,-50%);
      background:var(--clean-soft,#f3f3f0);
      pointer-events:none;
    }
    body.popElectric.rankingPage .duelChoice.duelChoiceWithVerifiedPhoto{
      min-height:270px !important;
      grid-template-rows:154px minmax(78px,1fr) !important;
      align-content:stretch !important;
      gap:7px !important;
    }
    body.popElectric.rankingPage .duelChoiceVerifiedPhoto{
      width:100% !important;
      height:154px !important;
      min-height:154px !important;
      max-height:154px !important;
      box-sizing:border-box;
    }
    body.popElectric.rankingPage .duelChoice.duelChoiceWithVerifiedPhoto>strong{
      width:100%;
      min-height:78px;
      display:flex;
      align-items:center;
      justify-content:center;
      margin:0 !important;
      padding:4px 6px !important;
      box-sizing:border-box;
      text-align:center;
    }
    body.popElectric.rankingPage.duelPortraitContext .duelChoiceVerifiedPhoto img{
      object-position:center 20% !important;
    }

    /* Só mostra fotos quando as DUAS opções do duelo têm imagem válida. */
    body.popElectric.rankingPage .duelChoices:not(.duelPairHasTwoPhotos) .duelChoiceVerifiedPhoto{
      display:none !important;
    }
    body.popElectric.rankingPage .duelChoices:not(.duelPairHasTwoPhotos) .duelChoice.duelChoiceWithVerifiedPhoto{
      min-height:220px !important;
      height:auto !important;
      max-height:none !important;
      display:grid !important;
      grid-template-rows:minmax(0,1fr) !important;
      place-items:center !important;
      gap:0 !important;
      padding:16px !important;
    }
    body.popElectric.rankingPage .duelChoices:not(.duelPairHasTwoPhotos) .duelChoice.duelChoiceWithVerifiedPhoto>strong{
      width:auto !important;
      height:auto !important;
      min-height:0 !important;
      max-height:none !important;
      padding:0 !important;
    }

    @media(max-width:900px){
      body.popElectric.rankingPage .duelChoices{
        gap:12px !important;
      }
      body.popElectric.rankingPage .duelVersus{
        width:24px;
        height:24px;
        font-size:8px;
      }
      body.popElectric.rankingPage .duelChoices > .duelChoice{
        flex:1 1 0 !important;
        width:0 !important;
        min-width:0 !important;
        height:142px !important;
        min-height:142px !important;
        max-height:142px !important;
        box-sizing:border-box !important;
      }

      /* Foto em retângulo fixo no topo + nome em faixa fixa embaixo.
         Tudo continua dentro do mesmo card externo de 142px. */
      body.popElectric.rankingPage .duelPairHasTwoPhotos .duelChoice.duelChoiceWithVerifiedPhoto{
        height:142px !important;
        min-height:142px !important;
        max-height:142px !important;
        grid-template-rows:74px 56px !important;
        gap:2px !important;
        padding:5px !important;
        box-sizing:border-box !important;
      }
      body.popElectric.rankingPage .duelPairHasTwoPhotos .duelChoiceVerifiedPhoto{
        width:100% !important;
        height:74px !important;
        min-height:74px !important;
        max-height:74px !important;
        box-sizing:border-box !important;
      }
      body.popElectric.rankingPage .duelPairHasTwoPhotos .duelChoice.duelChoiceWithVerifiedPhoto>strong{
        width:100% !important;
        height:56px !important;
        min-height:56px !important;
        max-height:56px !important;
        display:flex !important;
        align-items:flex-end !important;
        justify-content:center !important;
        overflow:hidden !important;
        margin:0 !important;
        padding:0 3px 6px !important;
        box-sizing:border-box !important;
        text-align:center !important;
        font-size:clamp(16px,4.6vw,20px) !important;
        line-height:.96 !important;
      }

      body.popElectric.rankingPage .duelChoices:not(.duelPairHasTwoPhotos) > .duelChoice,
      body.popElectric.rankingPage .duelChoices:not(.duelPairHasTwoPhotos) .duelChoice.duelChoiceWithVerifiedPhoto{
        height:142px !important;
        min-height:142px !important;
        max-height:142px !important;
        grid-template-rows:minmax(0,1fr) !important;
        gap:0 !important;
        padding:8px 6px !important;
      }
      body.popElectric.rankingPage .duelChoices:not(.duelPairHasTwoPhotos) .duelChoice.duelChoiceWithVerifiedPhoto>strong{
        width:auto !important;
        height:auto !important;
        min-height:0 !important;
        max-height:none !important;
        display:block !important;
        overflow:visible !important;
        padding:0 !important;
        font-size:clamp(18px,5.1vw,23px) !important;
        line-height:1 !important;
      }
    }
  `;
  document.head.appendChild(duelPhotoPolish);

  const foldDuelTitle = (value) =>
    String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

  const syncDuelPortraitContext = () => {
    const title = foldDuelTitle(
      document.querySelector('.rankingHero h1, .rankingHead h1, .rankingMain h1, h1')?.textContent,
    );
    const portraitWords = [
      'jogador',
      'jogadora',
      'goleiro',
      'zagueiro',
      'atacante',
      'meio campista',
      'lateral',
      'volante',
      'camisa 10',
      'futebolista',
      'ator',
      'atriz',
      'cantor',
      'cantora',
      'musico',
      'guitarrista',
      'baixista',
      'baterista',
      'rapper',
      'vocalista',
      'piloto',
      'pintor',
      'pintora',
      'fotografo',
      'fotografa',
      'celebridade',
    ];
    document.body?.classList.toggle(
      'duelPortraitContext',
      portraitWords.some((word) => title.includes(word)),
    );
  };

  const syncDuelPairPhotos = () => {
    document.querySelectorAll('.duelChoices').forEach((pair) => {
      const choices = [...pair.querySelectorAll(':scope > .duelChoice')];
      if (choices.length !== 2) {
        pair.classList.remove('duelPairHasTwoPhotos');
        return;
      }
      const bothHavePhotos = choices.every((choice) =>
        Boolean(choice.querySelector(':scope > .duelChoiceVerifiedPhoto')),
      );
      pair.classList.toggle('duelPairHasTwoPhotos', bothHavePhotos);
    });
  };

  let pairSyncQueued = false;
  const queueDuelPairSync = () => {
    if (pairSyncQueued) return;
    pairSyncQueued = true;
    requestAnimationFrame(() => {
      pairSyncQueued = false;
      syncDuelPairPhotos();
    });
  };

  syncDuelPortraitContext();
  syncDuelPairPhotos();
  new MutationObserver(() => {
    syncDuelPortraitContext();
    queueDuelPairSync();
  }).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}