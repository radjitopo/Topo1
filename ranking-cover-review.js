const coverUrl = (photoId, extra = '') =>
  `https://images.unsplash.com/photo-${photoId}?auto=format&fit=crop${extra}&w=1200&h=675&q=82`;

const photo = ({
  rankingId,
  rejectedPhotoId,
  replacementPhotoId,
  sourcePage,
  reason,
  queries,
  extra = '',
}) =>
  Object.freeze({
    rankingId,
    rejectedAsset: `unsplash:${rejectedPhotoId}`,
    replacement: coverUrl(replacementPhotoId, extra),
    sourcePage,
    license: 'Unsplash License',
    reason,
    queries: Object.freeze(queries),
  });

const original = ({ rankingId, rejectedPhotoId, path, reason, queries }) =>
  Object.freeze({
    rankingId,
    rejectedAsset: `unsplash:${rejectedPhotoId}`,
    replacement: `https://somostopo.com.br${path}`,
    sourcePage: null,
    license: 'Arte original TOPO',
    reason,
    queries: Object.freeze(queries),
  });

const clubHistory = (rankingId, rejectedPhotoId, filename, club) =>
  original({
    rankingId,
    rejectedPhotoId,
    path: `/covers/football/${filename}.svg`,
    reason: `A foto anterior mostrava outro clube ou um estádio sem relação clara com o ${club}.`,
    queries: [`${club} futebol ídolos história`, `${club} cores torcida estádio`],
  });

export const RANKING_COVER_REVIEW_KEY = '20260901_cover_relevance';

// Every change is pinned to the rejected asset. A later moderator upload is
// therefore preserved instead of being overwritten by this editorial review.
export const RANKING_COVER_REVIEW = Object.freeze([
  photo({
    rankingId: 'item-casa-vale-cada-centavo',
    rejectedPhotoId: '1759563871365-4b90aa1ddd5c',
    replacementPhotoId: '1740803292822-a742c6a4fef0',
    sourcePage: 'https://unsplash.com/photos/a-bunch-of-microwaves-that-are-on-a-shelf-KGDAMKJZ0G8',
    reason: 'A imagem de moda não representava eletrodomésticos e itens úteis para casa.',
    queries: ['eletrodomésticos para casa loja', 'kitchen appliances home store'],
  }),
  photo({
    rankingId: 'melhor-selecao-brasileira-historia',
    rejectedPhotoId: '1517836357463-d25dfeac3438',
    replacementPhotoId: '1783434423797-9b765312cd69',
    sourcePage:
      'https://unsplash.com/photos/young-man-in-brazil-jersey-celebrating-in-stadium-seats-8Sd35IaxoyM',
    reason: 'A academia anterior não tinha relação com a Seleção Brasileira de futebol.',
    queries: ['Seleção Brasileira futebol torcida camisa amarela', 'Brazil football fan stadium'],
  }),
  original({
    rankingId: 'maior-clube-america-do-sul',
    rejectedPhotoId: '1767468017997-2c36b0db45cf',
    path: '/covers/editorial/maior-clube-america-do-sul.svg',
    reason: 'O estádio europeu anterior contradizia o recorte sul-americano do ranking.',
    queries: ['clubes futebol América do Sul estádio', 'South American football clubs'],
  }),
  photo({
    rankingId: 'filmes-80',
    rejectedPhotoId: '1485846234645-a62644f84728',
    replacementPhotoId: '1701190126391-53d1d0f8d6b3',
    sourcePage:
      'https://unsplash.com/photos/an-old-vhs-tape-recorder-with-the-words-hs-on-it-HNg3b38pOMc',
    reason: 'A nova fita VHS comunica os anos 80 sem destacar um filme fora da década.',
    queries: ['filmes anos 80 VHS cinema', '1980s movie VHS nostalgia'],
  }),
  photo({
    rankingId: 'desenhos-anos-2000',
    rejectedPhotoId: '1761749971266-36a73a578dde',
    replacementPhotoId: '1736917291455-b215eba03730',
    sourcePage:
      'https://unsplash.com/photos/a-computer-monitor-sitting-on-top-of-a-wooden-desk-Axqxj7chPWQ',
    reason: 'A capa anterior remetia a um personagem de outra época, não aos anos 2000.',
    queries: ['desenhos anos 2000 televisão CRT nostalgia', '2000s cartoons television nostalgia'],
  }),
  photo({
    rankingId: 'carros-viagem-estrada',
    rejectedPhotoId: '1492144534655-ae79c964c9d7',
    replacementPhotoId: '1722192298791-a7842ae60d09',
    sourcePage:
      'https://unsplash.com/photos/a-car-driving-down-a-road-with-mountains-in-the-background-YM0UVOJX-lQ',
    reason: 'A foto de showroom foi trocada por um carro realmente em uma grande viagem.',
    queries: ['carro viagem estrada montanhas', 'road trip car scenic highway'],
  }),
  photo({
    rankingId: 'bolsa-grife-mais-desejada',
    rejectedPhotoId: '1780337092515-2ca475d4a86a',
    replacementPhotoId: '1774141818089-d211d5bd01f9',
    sourcePage:
      'https://unsplash.com/photos/leather-handbags-displayed-in-a-retail-store-window-O-4BnZxePJo',
    reason: 'O objeto borrado anterior não comunicava bolsas de grife.',
    queries: ['bolsas de luxo vitrine sem logotipo', 'luxury handbags boutique display'],
  }),
  photo({
    rankingId: 'marca-luxo-mais-desejada',
    rejectedPhotoId: '1776762893024-890728937eab',
    replacementPhotoId: '1721152531778-47bb07d618bc',
    sourcePage:
      'https://unsplash.com/photos/a-store-filled-with-lots-of-clothing-and-a-chandelier-xhua3vydjbw',
    reason: 'As casas tropicais anteriores não representavam marcas e bens de luxo.',
    queries: ['boutique de luxo neutra sem logotipo', 'luxury fashion boutique interior'],
  }),
  photo({
    rankingId: 'comida',
    rejectedPhotoId: '1504674900247-0877df9cc836',
    replacementPhotoId: '1696071506684-98cc784a89df',
    sourcePage: 'https://unsplash.com/photos/a-bowl-of-soup-with-a-spoon-in-it-IGsSbLoTkro',
    reason: 'A mesa genérica foi substituída por uma moqueca fotografada no Brasil.',
    queries: ['moqueca comida brasileira panela', 'Brazilian food moqueca'],
  }),
  photo({
    rankingId: 'marca-brasileira-mais-querida',
    rejectedPhotoId: '1563013544-824ae1b704d3',
    replacementPhotoId: '1662692735672-544412d65934',
    sourcePage: 'https://unsplash.com/photos/flag-of-brazil-on-pole-RJz9Xmro1Fc',
    reason: 'O pagamento on-line anterior não deixava claro o recorte de marcas brasileiras.',
    queries: ['marcas brasileiras bandeira Brasil', 'Brazil brands national identity'],
  }),
  photo({
    rankingId: 'melhor-coisa-comprar-usada',
    rejectedPhotoId: '1768987439382-894ea4e2a736',
    replacementPhotoId: '1781730441165-069bffd27f90',
    sourcePage:
      'https://unsplash.com/photos/rows-of-various-chairs-and-small-tables-for-sale-PoV-NPTexeo',
    reason: 'A caixa de comércio eletrônico foi trocada por itens reais de segunda mão.',
    queries: ['móveis usados brechó feira', 'second hand furniture flea market'],
  }),
  photo({
    rankingId: 'marcas-tecnologia',
    rejectedPhotoId: '1688895463871-f5e81079d7be',
    replacementPhotoId: '1765256931521-0f843b7b3100',
    sourcePage:
      'https://unsplash.com/photos/close-up-view-of-a-green-circuit-board-with-components-sLokLHv-aH0',
    reason: 'A tela de uma marca específica criava viés; a placa eletrônica é neutra.',
    queries: ['placa eletrônica tecnologia circuito', 'technology circuit board components'],
  }),
  photo({
    rankingId: 'maiores-nomes-funk',
    rejectedPhotoId: '1648090322512-9db7f597200c',
    replacementPhotoId: '1633657321321-e7770338ea7c',
    sourcePage: 'https://unsplash.com/photos/a-man-that-is-standing-up-with-some-djs-g6U2o8Xj06U',
    reason: 'A festa genérica foi trocada por um DJ em uma noite urbana de São Paulo.',
    queries: ['funk brasileiro DJ baile São Paulo', 'Brazilian funk party DJ'],
  }),
  photo({
    rankingId: 'surpresas-professor',
    rejectedPhotoId: '1517048676732-d65bc937f952',
    replacementPhotoId: '1598981457915-aea220950616',
    sourcePage: 'https://unsplash.com/photos/student-writing-at-classroom-desk--hgJu2ykh4E',
    reason: 'A reunião corporativa anterior não representava uma surpresa em sala de aula.',
    queries: ['aluno fazendo prova sala de aula', 'student taking test classroom'],
  }),
  photo({
    rankingId: 'celebridades-fofas',
    rejectedPhotoId: '1514525253161-7a46d19cd819',
    replacementPhotoId: '1767954825607-b4b979fb4a12',
    sourcePage:
      'https://unsplash.com/photos/person-making-heart-shape-with-hands-at-concert-LpamLygXb98',
    reason: 'A foto de moda anterior não comunicava carinho ou simpatia.',
    queries: ['coração com as mãos fãs celebridade', 'heart hands concert appreciation'],
  }),
  original({
    rankingId: 'comedias-cinema',
    rejectedPhotoId: '1751823886813-0cfc86cb9478',
    path: '/covers/editorial/comedias-cinema.svg',
    reason: 'O cenário vazio anterior não comunicava humor nem cinema.',
    queries: ['comédia cinema risada película', 'comedy cinema laughter film'],
  }),
  photo({
    rankingId: 'animacoes-cinema',
    rejectedPhotoId: '1729006426245-b774fc155c1e',
    replacementPhotoId: '1681372751506-1586b0542195',
    sourcePage:
      'https://unsplash.com/photos/a-book-with-a-drawing-of-a-person-sitting-at-a-table-bNjYwZrkJ3A',
    reason: 'A plateia genérica foi substituída pelo processo visual de um storyboard.',
    queries: ['storyboard animação cinema desenho', 'animation movie storyboard drawing'],
  }),
  photo({
    rankingId: 'joia-mais-famosa-historia',
    rejectedPhotoId: '1774814304604-17eb38d59207',
    replacementPhotoId: '1673640525972-3c0dd5e6a933',
    sourcePage: 'https://unsplash.com/photos/a-gold-crown-with-black-and-white-stones--6nDec_KT7U',
    reason: 'As alianças comuns foram trocadas por uma peça histórica com grandes gemas.',
    queries: ['joia histórica coroa diamantes', 'historic jewel crown gemstones'],
  }),
  original({
    rankingId: 'times-mundo',
    rejectedPhotoId: '1748112441590-48723d484a0d',
    path: '/covers/editorial/times-mundo.svg',
    reason: 'A torcida de um único clube criava viés em um ranking mundial.',
    queries: [
      'maiores clubes futebol mundo estádio neutro',
      'world football clubs neutral stadium',
    ],
  }),
  photo({
    rankingId: 'melhor-jogador-futebol-todos-tempos',
    rejectedPhotoId: '1764438344341-d4700ad674f0',
    replacementPhotoId: '1772707681004-ebbce15554d4',
    sourcePage:
      'https://unsplash.com/photos/a-soccer-player-kicks-ball-on-illuminated-field-at-night-KqfSsAMlVjE',
    reason: 'A imagem amadora anterior foi trocada por uma cena forte e neutra em estádio.',
    queries: ['jogador futebol estádio luzes ação', 'football player stadium lights action'],
  }),
  photo({
    rankingId: 'filmes-ficcao-cientifica',
    rejectedPhotoId: '1517486518908-97a5f91b325f',
    replacementPhotoId: '1758685296030-d46ee930c898',
    sourcePage:
      'https://unsplash.com/photos/a-red-and-gray-spacecraft-sits-in-a-rocky-area-fAKEIhRSmGo',
    reason: 'A nova nave em cenário alienígena comunica ficção científica imediatamente.',
    queries: ['nave ficção científica planeta cinema', 'science fiction spaceship alien planet'],
  }),
  photo({
    rankingId: 'produto-barato-facilita-vida',
    rejectedPhotoId: '1647427017067-8f33ccbae493',
    replacementPhotoId: '1783099779673-cc79dc0380f7',
    sourcePage:
      'https://unsplash.com/photos/woman-organizing-kitchen-drawer-with-utensils-3UFrDDL6sEE',
    reason: 'A maquininha de pagamento não representava utilidades pequenas do cotidiano.',
    queries: ['organizador utilidades domésticas baratas', 'small home organization products'],
  }),
  original({
    rankingId: 'embalagens-iconicas',
    rejectedPhotoId: '1781232815711-1c1d9ec1ca44',
    path: '/covers/editorial/embalagens-iconicas.svg',
    reason: 'As caixas genéricas anteriores não representavam formatos icônicos de embalagem.',
    queries: ['embalagens icônicas garrafa lata caixa perfume', 'iconic packaging bottle can box'],
  }),
  clubHistory(
    'melhores-jogadores-athletico-pr',
    '1774419477272-693534dc0bdb',
    'athletico-pr',
    'Athletico Paranaense',
  ),
  clubHistory(
    'melhores-jogadores-atletico-mg',
    '1781152791898-945ca008c8ef',
    'atletico-mg',
    'Atlético Mineiro',
  ),
  clubHistory('melhores-jogadores-bahia', '1785812739492-f14d5b752382', 'bahia', 'Bahia'),
  clubHistory('melhores-jogadores-botafogo', '1767780648479-8938e1899fdd', 'botafogo', 'Botafogo'),
  clubHistory('melhores-jogadores-ceara', '1780766382589-5e517d4f0b81', 'ceara', 'Ceará'),
  clubHistory(
    'melhores-jogadores-corinthians',
    '1780766382547-a0ffa16bd32d',
    'corinthians',
    'Corinthians',
  ),
  clubHistory('melhores-jogadores-coritiba', '1504016798967-59a258e9386d', 'coritiba', 'Coritiba'),
  clubHistory('melhores-jogadores-cruzeiro', '1777643155941-088f4b2a8940', 'cruzeiro', 'Cruzeiro'),
  clubHistory('melhores-jogadores-flamengo', '1782471606936-5457f0cc4850', 'flamengo', 'Flamengo'),
  clubHistory(
    'melhores-jogadores-fluminense',
    '1769859177914-f66488d71193',
    'fluminense',
    'Fluminense',
  ),
  clubHistory(
    'melhores-jogadores-fortaleza',
    '1782472003016-0a22e37bbf9e',
    'fortaleza',
    'Fortaleza',
  ),
  clubHistory('melhores-jogadores-goias', '1715801903345-f1a971f0f17b', 'goias', 'Goiás'),
  clubHistory('melhores-jogadores-gremio', '1781793708575-f586c9f14011', 'gremio', 'Grêmio'),
  clubHistory(
    'melhores-jogadores-internacional',
    '1749427861548-e716efe71e3e',
    'internacional',
    'Internacional',
  ),
  clubHistory('melhores-jogadores-santos', '1571754472834-677ab0a62ba7', 'santos', 'Santos'),
  clubHistory(
    'melhores-jogadores-sao-paulo',
    '1779449607463-701d1c9f38f7',
    'sao-paulo',
    'São Paulo',
  ),
  clubHistory('melhores-jogadores-sport', '1784095578967-8bc09bedc2e2', 'sport', 'Sport'),
  clubHistory('melhores-jogadores-vasco', '1777643156041-465946d94f72', 'vasco', 'Vasco'),
  clubHistory('melhores-jogadores-vitoria', '1748112441590-48723d484a0d', 'vitoria', 'Vitória'),
]);

export const RANKING_COVER_REVIEW_COUNT = RANKING_COVER_REVIEW.length;
