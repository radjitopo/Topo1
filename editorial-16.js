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
    body.popElectric.rankingPage .duelChoice.duelChoiceWithVerifiedPhoto{
      grid-template-rows:154px auto;
      gap:7px;
    }
    body.popElectric.rankingPage .duelChoiceVerifiedPhoto{
      height:154px;
    }
    body.popElectric.rankingPage.duelPortraitContext .duelChoiceVerifiedPhoto img{
      object-position:center 20%;
    }
    @media(max-width:900px){
      body.popElectric.rankingPage .duelChoice.duelChoiceWithVerifiedPhoto{
        grid-template-rows:88px auto;
        gap:4px;
      }
      body.popElectric.rankingPage .duelChoiceVerifiedPhoto{
        height:88px;
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

  syncDuelPortraitContext();
  new MutationObserver(syncDuelPortraitContext).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}
