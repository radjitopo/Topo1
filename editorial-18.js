Object.assign(editorial, {
  'bandas-ilha-da-magia': {
    about:
      'Florianópolis criou uma cena musical com sotaque próprio, capaz de misturar folclore, rock, reggae, jazz, rap e experimentação. Este ranking reúne bandas e grupos de diferentes gerações ligados à cidade para descobrir qual deles melhor traduz a força musical da Ilha da Magia.',
    facts: [
      'O movimento Mané Beat reuniu nomes como Dazaranha, Iriê, Phunky Buddha, Tijuquera e Stonkas y Congas no fim dos anos 1990.',
      'A produção local também passa pela música de raiz do Grupo Engenho e por bandas instrumentais como Brasil Papaya e Skrotes.',
    ],
    related: ['bandas-rock-ilha-da-magia', 'bandas-rock', 'generos-musicais'],
  },
  'bandas-rock-ilha-da-magia': {
    about:
      'Das canções do Expresso Rural ao reggae rock do Dazaranha, passando pelo peso instrumental do Brasil Papaya e pela cena alternativa que ocupou bares e festivais, o rock de Florianópolis construiu muitas histórias. Aqui, vinte bandas disputam o título de maior nome roqueiro da Ilha.',
    facts: [
      'A cena independente de Florianópolis reuniu vertentes como punk, hardcore, surf rock, metal, psicodelia e rock alternativo.',
      'Bandas locais de épocas diferentes circularam por festivais, casas de show, universidades e projetos autorais da cidade.',
    ],
    related: ['bandas-ilha-da-magia', 'bandas-rock', 'guitarristas'],
  },
});

(() => {
  if (typeof document === 'undefined') return;
  const style = document.createElement('style');
  style.id = 'duelCompactFixedCards';
  style.textContent = `
    body.popElectric.rankingPage .duelChoice,
    body.popElectric.rankingPage .duelChoice.duelChoiceWithPhoto {
      height: 220px !important;
      min-height: 220px !important;
      max-height: 220px !important;
      box-sizing: border-box;
      overflow: hidden;
    }
    body.popElectric.rankingPage .duelChoice {
      grid-template-rows: minmax(0, 1fr) !important;
    }
    body.popElectric.rankingPage .duelChoice.duelChoiceWithPhoto {
      grid-template-rows: 96px minmax(0, 1fr) !important;
      gap: 9px !important;
      padding: 12px !important;
    }
    body.popElectric.rankingPage .duelChoicePhoto {
      height: 96px !important;
      min-height: 96px !important;
      max-height: 96px !important;
    }
    body.popElectric.rankingPage .duelChoice.duelChoiceWithPhoto > strong {
      font-size: clamp(20px, 3vw, 32px) !important;
      line-height: 1 !important;
    }
    @media (max-width: 900px) {
      body.popElectric.rankingPage .rankingVoteModes {
        margin-bottom: 6px !important;
      }
      body.popElectric.rankingPage .rankingDuel {
        padding: 6px 6px 8px !important;
      }
      body.popElectric.rankingPage .duelChoices {
        grid-template-columns: minmax(0, 1fr) 22px minmax(0, 1fr) !important;
      }
      body.popElectric.rankingPage .duelChoice,
      body.popElectric.rankingPage .duelChoice.duelChoiceWithPhoto {
        height: 142px !important;
        min-height: 142px !important;
        max-height: 142px !important;
        padding: 8px 6px !important;
      }
      body.popElectric.rankingPage .duelChoice {
        grid-template-rows: minmax(0, 1fr) !important;
      }
      body.popElectric.rankingPage .duelChoice.duelChoiceWithPhoto {
        grid-template-rows: 50px minmax(0, 1fr) !important;
        gap: 5px !important;
        padding: 6px !important;
      }
      body.popElectric.rankingPage .duelChoicePhoto {
        height: 50px !important;
        min-height: 50px !important;
        max-height: 50px !important;
      }
      body.popElectric.rankingPage .duelChoice > strong,
      body.popElectric.rankingPage .duelChoice.duelChoiceWithPhoto > strong {
        font-size: clamp(17px, 5.1vw, 22px) !important;
        line-height: 1 !important;
      }
      body.popElectric.rankingPage .duelChoicePhoto small {
        display: none !important;
      }
      body.popElectric.rankingPage .duelShareBar {
        margin-top: 8px !important;
      }
      body.popElectric.rankingPage .duelShareButton {
        width: 100% !important;
        min-height: 40px !important;
      }
    }
  `;
  document.head.appendChild(style);
})();
