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
}
