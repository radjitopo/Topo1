import { RANKING_COVER_REVIEW } from './ranking-cover-review.js';

const coverUrl = (photoId, extra = '') =>
  `https://images.unsplash.com/photo-${photoId}?auto=format&fit=crop${extra}&w=1200&h=675&q=82`;

const rule = (rejectedPhotoId, replacement, queries) =>
  Object.freeze({
    rejected: `unsplash:${rejectedPhotoId}`,
    replacement,
    queries: Object.freeze(queries),
  });

// These rules are deliberately tied to the exact rejected asset. A moderator can
// still choose a new image later without a code-level override fighting that edit.
const LEGACY_CURATED_COVER_RULES = Object.freeze({
  'bandas-pagode': rule(
    '1736184766006-377f3e9827a1',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/Prettos_alex-pires_IV.jpg/1280px-Prettos_alex-pires_IV.jpg',
    ['Brazilian pagode samba musicians', 'roda de samba pandeiro cavaquinho'],
  ),
  'esportes-radicais': rule('1461896836934-ffe607ba8211', coverUrl('1508148557313-0795ebb67c82'), [
    'extreme sports skateboard climbing surfing',
    'adventure athlete action sport',
  ]),
  'atores-acao': rule('1781127445188-3b05a9316dde', coverUrl('1776994225844-758dbee35d2b'), [
    'action film actor cinematic portrait',
    'movie star action cinema',
  ]),
  'celebridades-fofas': rule('1514525253161-7a46d19cd819', coverUrl('1779906904862-b05321d36723'), [
    'smiling actor red carpet celebrity',
    'charismatic celebrity portrait',
  ]),
  'comidas-apimentadas': rule(
    '1563379926898-05f4575a45d8',
    coverUrl('1741210492429-da9764d16b97'),
    ['red chili peppers spicy food', 'hot pepper close up'],
  ),
  'modelos-glamourosas': rule(
    '1777828828769-c8fe6bc61c8d',
    coverUrl('1784850227103-202099fedd7f'),
    ['fashion models runway catwalk', 'high fashion runway models'],
  ),
  futebol: rule(
    '1715801903345-f1a971f0f17b',
    coverUrl('1777304881313-2f250326d08c', '&crop=focalpoint&fp-x=0.5&fp-y=0.64'),
    ['Brazilian football player match', 'soccer player stadium action'],
  ),
  'times-mundo': rule('1748112441590-48723d484a0d', coverUrl('1759156207851-ff2c0a158797'), [
    'football stadium fans club supporters',
    'soccer crowd stadium team',
  ]),
  'gambiarras-brasileiras': rule(
    '1504148455328-c376907d081c',
    coverUrl('1783303818043-bbdb333a177a', '&crop=focalpoint&fp-x=0.5&fp-y=0.28'),
    ['Brazil makeshift repair duct tape', 'improvised home repair'],
  ),
  'superpoder-incrivel': rule(
    '1503454537195-1dcabb73ffb9',
    coverUrl('1531907700752-62799b2a3e84'),
    ['child superhero cape imagination', 'superpower hero cape'],
  ),
  'criaturas-fantasticas-pet': rule(
    '1534447677768-be436bb09401',
    coverUrl('1770816206138-6237985d2e8a'),
    ['dragon unicorn mythical fantasy creature', 'fantasy creature pet'],
  ),
  'presentes-aniversario': rule(
    '1513883049090-d0b7439799bf',
    coverUrl('1764385827388-2560c0cdc1e9'),
    ['birthday gifts wrapped presents', 'gift boxes celebration'],
  ),
  'hobbies-para-comecar': rule('1545235617-9465d2a55698', coverUrl('1780751987564-79489283d67b'), [
    'creative hobbies painting pottery photography',
    'people learning a hobby',
  ]),
  'green-flags-relacionamento': rule(
    '1542338492-41740e01673f',
    coverUrl('1771946892179-41c95be77cfd'),
    ['happy supportive couple relationship', 'caring couple laughing'],
  ),
  'memes-brasileiros': rule('1768299947895-06b676197f74', coverUrl('1753351056838-143bc3e4cf03'), [
    'friends laughing at phone meme',
    'people sharing funny phone content',
  ]),
  'maiores-nomes-funk': rule('1648090322512-9db7f597200c', coverUrl('1648090319889-73787d9b3f14'), [
    'Brazil funk party DJ performer',
    'baile funk Brazil crowd',
  ]),
  'maiores-duplas-sertanejas': rule(
    '1504629127422-2353b12468dd',
    coverUrl('1758839448253-77452723ccc1'),
    ['country music duo guitar accordion', 'two country musicians performing'],
  ),
  'rappers-trappers-brasil': rule(
    '1786041069082-8550c14aeaa6',
    coverUrl('1581355931381-d1173e039b4a'),
    ['Brazilian rap trap performer concert', 'rapper on stage Brazil'],
  ),
  'realities-brasileiros': rule(
    '1758939559245-3bda75f02992',
    coverUrl('1691242717099-a2f50441d18b'),
    ['television studio reality show cameras', 'TV production studio people'],
  ),
  'viloes-cinema': rule('1517604931442-7e0c8ed2963c', coverUrl('1771295763300-561ba86be205'), [
    'cinema villain dark dramatic portrait',
    'menacing movie villain',
  ]),
  'fotografos-historia': rule(
    '1779070693953-5a2f9207a140',
    coverUrl('1699565979651-7fd87e4d38d7'),
    ['photographer taking a picture camera', 'documentary photographer portrait'],
  ),
  'fotografias-iconicas': rule(
    '1742146861179-a1f7cc547e3d',
    coverUrl('1533158307587-828f0a76ef46'),
    ['historic iconic photographs prints', 'famous photography archive'],
  ),
  'humoristas-brasileiros': rule(
    '1731007733979-6f3d7b8632ae',
    coverUrl('1768508947365-db7c7802c5d0'),
    ['Brazilian comedian microphone stage', 'stand up comedian performing'],
  ),
  'animais-extintos': rule('1782848796142-88a50598df91', coverUrl('1777558097139-a218deb4414c'), [
    'extinct animals fossil skeleton museum',
    'prehistoric animal museum exhibit',
  ]),
  'motos-iconicas': rule('1787310725110-932df03f7c9f', coverUrl('1778867084345-54d5edaacf72'), [
    'iconic vintage motorcycle',
    'classic motorcycle street',
  ]),
  'carros-design': rule('1785498491915-d535dddc97b7', coverUrl('1780673395726-35557da0149e'), [
    'beautiful classic car automotive design',
    'iconic sports car design',
  ]),
  'corridas-automobilismo': rule(
    '1558981806-ec527fa84c39',
    coverUrl('1771979407989-8272af46af9b'),
    ['motorsport race cars track competition', 'famous auto race circuit'],
  ),
  'pilotos-automobilismo': rule(
    '1503376780353-7e6692767b70',
    coverUrl('1759646847922-05d123b50061'),
    ['racing driver helmet formula one car', 'motorsport driver portrait'],
  ),
  'embalagens-iconicas': rule(
    '1781232815711-1c1d9ec1ca44',
    coverUrl('1767191519538-ca236bc9b583'),
    ['iconic product packaging boxes', 'colorful food packaging design'],
  ),
  'produtos-brasileiros-iconicos': rule(
    '1606021490433-d28d1d978deb',
    coverUrl('1601600576337-c1d8a0d1373c'),
    ['iconic Brazilian supermarket products', 'Brazil grocery products shelf'],
  ),
  'eventos-esportivos-floripa': rule(
    '1461896836934-ffe607ba8211',
    coverUrl('1668195327624-06e596eb797c'),
    ['Florianopolis beach sports event Brazil', 'Brazil beach athlete sport'],
  ),
  destinos: rule('1488646953014-85cb44e25828', coverUrl('1662997677426-2225712f97cd'), [
    'iconic Brazilian travel destination landscape',
    'Brazil natural destination editorial travel',
  ]),
  musica: rule('1511379938547-c1f69419868d', coverUrl('1632054553871-c2817a775d18'), [
    'Brazilian singer live band performance',
    'Brazil music artist on stage',
  ]),
  praias: rule('1507525428034-b723cf961d3e', coverUrl('1681157865251-2155d60882c0'), [
    'Florianopolis beach aerial Santa Catarina',
    'Florianopolis coastline Brazil',
  ]),
  cidades: rule('1477959858617-67f85cf4f1df', coverUrl('1783364690185-05db07c5f40d'), [
    'Brazilian city aerial skyline',
    'Brazil city urban landscape',
  ]),
  'bairros-floripa': rule('1449157291145-7efd050a4d0e', coverUrl('1565574337618-b08146e94992'), [
    'Florianopolis neighborhood aerial Brazil',
    'Beira Mar Norte Florianopolis city',
  ]),
  'carros-eletricos': rule('1503736334956-4c8f8e92946d', coverUrl('1593941707874-ef25b8b4a92b'), [
    'electric car charging close up',
    'modern EV charging station',
  ]),
  'lugares-date': rule('1519741497674-611481863552', coverUrl('1782022536439-f0ccc8fdd59f'), [
    'couple romantic candlelight dinner date',
    'intimate restaurant date night',
  ]),
  'filmes-80': rule('1485846234645-a62644f84728', coverUrl('1769397830996-c0e1a18c0a87'), [
    '1980s movie VHS tape nostalgia',
    'eighties cinema VHS collection',
  ]),
  'series-tv': rule('1522869635100-9f4c5e86aa37', coverUrl('1764194105737-952018cbef1d'), [
    'person choosing a television series streaming',
    'watching TV series at home remote',
  ]),
  'marcas-esportivas': rule('1517836357463-d25dfeac3438', coverUrl('1760302318631-a8d342cd4951'), [
    'sportswear brands sneaker store',
    'athletic shoes streetwear display',
  ]),
  'moda-polemica': rule('1771919383240-d0a30993fc38', coverUrl('1784850758006-21742e6553ad'), [
    'controversial avant garde fashion runway',
    'unusual repurposed clothing editorial',
  ]),
  dramas: rule('1766844649143-af98d71e346b', coverUrl('1758611973429-2dc4a2b75775'), [
    'emotional viewer crying watching drama',
    'sad television drama audience at home',
  ]),
  animes: rule('1612036782180-6f0b6cd846fe', coverUrl('1755973707772-f57eeaf78a05'), [
    'anime characters Japanese animation display',
    'anime character collection colorful',
  ]),
  'influencers-brasil': rule('1516321318423-f06f85e504b3', coverUrl('1745848413060-0827ec268cda'), [
    'Brazil content creator filming social video',
    'influencer camera studio creator',
  ]),
  'piores-pandemia': rule('1609767806693-65144bf78fcf', coverUrl('1609767726954-7297b60278d5'), [
    'Covid lockdown masked person empty street',
    'pandemic isolation face mask city',
  ]),
  'jogos-roblox': rule('1554410637-1a8267402b57', coverUrl('1656639969809-ebc544c96955'), [
    'Roblox games laptop screen',
    'playing Roblox computer',
  ]),
  'quarto-dos-sonhos': rule('1616486338812-3dadae4b4ace', coverUrl('1770941633927-b7a15557e0e1'), [
    'dream bedroom cozy interior wide',
    'large stylish bedroom interior',
  ]),
  'frases-adultos-irritantes': rule(
    '1529156069898-49953e39b3ac',
    coverUrl('1752652012419-ec5b0062eb51'),
    ['parent scolding upset child at home', 'adult arguing with teenager family'],
  ),
  'restaurantes-floripa': rule(
    '1504674900247-0877df9cc836',
    coverUrl('1649424189596-48738f6cc597'),
    ['Florianopolis restaurant interior Brazil', 'Florianopolis cafe dining local'],
  ),
  'brechos-floripa': rule('1445205170230-053b83016050', coverUrl('1778512408867-f657b926cc4f'), [
    'thrift store shoppers browsing vintage clothes',
    'second hand clothing circular fashion',
  ]),
  'filmes-ficcao-cientifica': rule(
    '1517486518908-97a5f91b325f',
    coverUrl('1694547278143-4c83c9d46b1e'),
    ['science fiction cinema astronaut cinematic', 'surreal sci fi movie scene'],
  ),
  'series-comedia': rule('1615986200762-a1ed9610d3b1', coverUrl('1758525862263-af89b090fb56'), [
    'friends laughing watching comedy TV series',
    'funny show audience popcorn couch',
  ]),
  'artistas-visuais-brasileiros': rule(
    '1774125553858-3f41e84d4e92',
    coverUrl('1711809814870-72b7c756bd37'),
    ['Brazilian visual artist paintings street exhibition', 'Brazil artist colorful canvases'],
  ),
  'acessorios-look': rule('1784850758006-21742e6553ad', coverUrl('1569388330292-79cc1ec67270'), [
    'fashion accessories jewelry sunglasses editorial',
    'accessories transform outfit flat lay',
  ]),
  'celebridades-estilosas': rule(
    '1657412235086-c2de1a1176a9',
    coverUrl('1584634407036-a403356514cd'),
    ['stylish celebrities red carpet fashion', 'celebrity event formal style'],
  ),
  'personagens-videogame': rule(
    '1760900954419-89f057caf7f2',
    coverUrl('1566577134665-2c674085abf7'),
    ['iconic video game character figures', 'famous gaming characters collection'],
  ),
  'trilhas-jogos': rule('1655029164758-51e484f5576b', coverUrl('1576074209600-499947598aed'), [
    'video game controller headphones soundtrack',
    'gaming music headphones console',
  ]),
  'gadgets-anos-2000': rule('1761906976176-0559a6d130dd', coverUrl('1773998240458-9a36e718c63a'), [
    'early 2000s iPod MP3 player nostalgia',
    'Y2K gadgets retro technology',
  ]),
});

const REVIEWED_COVER_RULES = Object.fromEntries(
  RANKING_COVER_REVIEW.map((review) => [
    review.rankingId,
    Object.freeze({
      rejected: review.rejectedAsset,
      replacement: review.replacement,
      queries: review.queries,
    }),
  ]),
);

export const CURATED_COVER_RULES = Object.freeze({
  ...LEGACY_CURATED_COVER_RULES,
  ...REVIEWED_COVER_RULES,
});

const CATEGORY_HINTS = Object.freeze({
  Arte: 'art photography',
  Cinema: 'cinema film',
  Comida: 'food photography',
  Diversão: 'people fun lifestyle',
  Esporte: 'sports action',
  Famosos: 'celebrity portrait',
  Florianópolis: 'Florianopolis Brazil',
  Moda: 'fashion editorial',
  Motores: 'automotive motorsport',
  Música: 'musicians live performance',
  Natureza: 'nature wildlife',
  Produtos: 'product photography',
  TV: 'television studio',
  Vida: 'people lifestyle',
});

const SEARCH_STOP_WORDS = new Set([
  'a',
  'as',
  'de',
  'do',
  'dos',
  'e',
  'em',
  'é',
  'maior',
  'mais',
  'melhor',
  'o',
  'os',
  'qual',
  'que',
  'quem',
  'todos',
  'você',
]);

export function imageAssetKey(value) {
  if (!value) return '';
  try {
    const url = new URL(String(value), 'https://somostopo.com.br');
    if (url.hostname === 'images.unsplash.com') {
      const photoId = url.pathname.match(/\/photo-([^/]+)/)?.[1];
      if (photoId) return `unsplash:${photoId}`;
    }
    return `${url.origin}${decodeURIComponent(url.pathname)}`;
  } catch {
    return String(value);
  }
}

export function resolveRankingCover(rankingId, imageUrl) {
  const current = imageUrl || null;
  const coverRule = CURATED_COVER_RULES[String(rankingId || '')];
  if (!coverRule || imageAssetKey(current) !== coverRule.rejected) return current;
  return coverRule.replacement;
}

export function rejectedRankingCoverIssue(rankingId, imageUrl) {
  const coverRule = CURATED_COVER_RULES[String(rankingId || '')];
  if (!coverRule || imageAssetKey(imageUrl) !== coverRule.rejected) return '';
  return 'capa reprovada: a imagem não representa o assunto do ranking';
}

function searchWords(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !SEARCH_STOP_WORDS.has(word));
}

export function rankingImageSearchQueries(ranking) {
  const rankingId = String(ranking?.id || ranking?.rankingId || '');
  const coverRule = CURATED_COVER_RULES[rankingId];
  const options = Array.isArray(ranking?.options)
    ? ranking.options
    : Array.isArray(ranking?.opts)
      ? ranking.opts
      : [];
  const optionLabels = options
    .slice(0, 5)
    .map((option) => (typeof option === 'string' ? option : option?.label));
  const words = [
    ...searchWords(ranking?.question || ranking?.title || ranking?.q),
    ...optionLabels.flatMap(searchWords),
  ];
  const uniqueWords = [...new Set(words)].slice(0, 9);
  const category = String(ranking?.category || ranking?.cat || '');
  const categoryHint = CATEGORY_HINTS[category] || 'editorial photography';
  const generated = uniqueWords.length
    ? [`${categoryHint} ${uniqueWords.join(' ')}`, uniqueWords.join(' ')]
    : [categoryHint];
  return [...new Set([...(coverRule?.queries || []), ...generated].filter(Boolean))].slice(0, 4);
}

export const CURATED_COVER_COUNT = Object.keys(CURATED_COVER_RULES).length;
