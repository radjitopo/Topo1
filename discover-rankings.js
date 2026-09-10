import { EXPANDED_DISCOVER_RANKINGS } from './discover-rankings-expanded.js';
import { CONSUMPTION_DISCOVER_RANKINGS } from './discover-rankings-consumption.js';
import { SPEED_DISCOVER_RANKINGS } from './discover-rankings-speed.js';

function rankingItems(block) {
  return block
    .trim()
    .split('\n')
    .map((line) => {
      const [rank, name, value] = line.split('|');
      return { rank, name, value };
    });
}

export const DISCOVER_UPDATED_AT = '2026-09-10';

export const DISCOVER_CATEGORIES = Object.freeze([
  { slug: 'todos', label: 'Todos', sourceCategories: [] },
  { slug: 'brasil', label: 'Brasil', sourceCategories: ['Brasil'] },
  {
    slug: 'mundo',
    label: 'Mundo & Geografia',
    sourceCategories: ['Mundo', 'Educação'],
  },
  {
    slug: 'dinheiro',
    label: 'Dinheiro',
    sourceCategories: ['Dinheiro', 'Economia'],
  },
  {
    slug: 'celebridades',
    label: 'Celebridades',
    sourceCategories: ['Celebridades'],
  },
  { slug: 'esportes', label: 'Esportes', sourceCategories: ['Futebol', 'Esporte'] },
  {
    slug: 'cinema-tv',
    label: 'Cinema e TV',
    sourceCategories: ['Cinema', 'Streaming'],
  },
  { slug: 'musica', label: 'Música', sourceCategories: ['Música'] },
  {
    slug: 'tecnologia',
    label: 'Tecnologia & Internet',
    sourceCategories: ['Tecnologia', 'Internet'],
  },
  { slug: 'viagens', label: 'Viagens', sourceCategories: ['Viagem'] },
  { slug: 'gastronomia', label: 'Gastronomia', sourceCategories: ['Gastronomia'] },
  { slug: 'velocidade', label: 'Velocidade', sourceCategories: ['Velocidade'] },
]);

export const DISCOVER_RANKINGS = Object.freeze([
  {
    slug: 'pessoas-mais-ricas-do-mundo',
    title: 'Pessoas mais ricas do mundo',
    category: 'Dinheiro',
    metric: 'Patrimônio estimado',
    period: '1º de setembro de 2026',
    source: 'Forbes',
    sourceUrl:
      'https://www.forbes.com/sites/forbeswealthteam/article/the-top-ten-richest-people-in-the-world/',
    note: 'Fortunas estimadas em dólares pela Forbes. Os valores variam com ações, moedas e outros ativos.',
    items: rankingItems(`
1|Elon Musk|US$ 892 bi
2|Larry Page|US$ 277 bi
3|Jeff Bezos|US$ 268 bi
4|Sergey Brin|US$ 256 bi
5|Michael Dell|US$ 241 bi
6|Mark Zuckerberg|US$ 197 bi
7|Larry Ellison|US$ 193 bi
8|Jensen Huang|US$ 191 bi
9|Steve Ballmer|US$ 155 bi
10|Amancio Ortega|US$ 148 bi`),
  },
  {
    slug: 'maiores-canais-youtube-brasil',
    title: 'Maiores canais do YouTube no Brasil',
    category: 'Internet',
    metric: 'Número de inscritos',
    period: '7 de setembro de 2026',
    source: 'Social Blade',
    sourceUrl: 'https://socialblade.com/youtube/lists/top/100/subscribers/all/BR',
    note: 'Canais classificados como sediados no Brasil, ordenados pelo total público de inscritos.',
    items: rankingItems(`
1|Bispo Bruno Leonardo|76,6 mi
2|Canal KondZilla|68,2 mi
3|LUCCAS NETO|53,6 mi
4|Natan por Aí|49,9 mi
5|Enaldinho|48,1 mi
6|Felipe Neto|48,1 mi
7|Você Sabia?|47,3 mi
8|whinderssonnunes|44,6 mi
9|GR6 EXPLODE|43,1 mi
10|CazéTV|41,5 mi`),
  },
  {
    slug: 'musicas-mais-ouvidas-spotify-brasil',
    title: 'Músicas mais ouvidas no Spotify Brasil',
    category: 'Música',
    metric: 'Reproduções na semana',
    period: 'Semana encerrada em 3 de setembro de 2026',
    source: 'Spotify via Kworb',
    sourceUrl: 'https://kworb.net/spotify/country/br_weekly.html',
    note: 'Total de reproduções registradas no ranking semanal brasileiro do Spotify.',
    items: rankingItems(`
1|Oldilla — Cuida do Pet|7.562.099
2|Jeninho — Peão Todo Tatuado|6.269.692
3|MC Leozinho ZS — Tá Pedindo Toma|6.261.641
4|João Gustavo e Murilo — Postinho de Gasolina|6.092.521
5|Zé Neto & Cristiano — Cadeira Cativa|5.888.679
6|Panda — Eu Te Seguro|5.602.828
7|Mc Jacaré — Pau Pra Toda Obra|5.443.998
8|CountryBeat — Um Peão Desse|5.431.857
9|Rincon — Não é Pressa, é Pressão|5.030.352
10|MC Lele JP — Famoso Ímã / O Poderoso Chatão|4.489.204`),
  },
  {
    slug: 'filmes-mais-assistidos-netflix',
    title: 'Filmes mais assistidos na Netflix',
    category: 'Streaming',
    metric: 'Visualizações globais na semana',
    period: '24 a 30 de agosto de 2026',
    source: 'Netflix',
    sourceUrl: 'https://www.netflix.com/tudum/top10',
    note: 'Ranking global oficial da Netflix. A plataforma divulga visualizações arredondadas por semana.',
    items: rankingItems(`
1|Grand Theft Auto VI: An Extended Look|31,1 mi
2|The Whisper Man|23,2 mi
3|The Last House|5,8 mi
4|Don’t Say Good Luck|4,4 mi
5|The Heat|4,1 mi
6|72 HOURS|3,7 mi
7|13 Minutes|3,4 mi
8|KPop Demon Hunters|2,9 mi
9|Shrek|2,7 mi
10|2012|2,7 mi`),
  },
  {
    slug: 'series-mais-assistidas-netflix',
    title: 'Séries mais assistidas na Netflix',
    category: 'Streaming',
    metric: 'Visualizações globais na semana',
    period: '24 a 30 de agosto de 2026',
    source: 'Netflix',
    sourceUrl: 'https://www.netflix.com/tudum/top10/tv',
    note: 'Ranking global oficial da Netflix, considerando cada temporada ou programa separadamente.',
    items: rankingItems(`
1|Death of the Pastor’s Wife — Temporada 1|19,0 mi
2|Beauty in Black — Temporada 3|13,0 mi
3|Outer Banks — Temporada 5|7,4 mi
4|Salish & Jordan Matter — Temporada 3|4,0 mi
5|Danny Go! — Temporada 2|3,7 mi
6|My Life With the Walter Boys — Temporada 3|2,5 mi
7|Raw — 24 de agosto de 2026|2,5 mi
8|Let’s Marry Harry: The Reunion|2,5 mi
9|Talamasca: The Secret Order — Temporada 1|2,2 mi
10|Love Is Blind: UK — Temporada 3|2,2 mi`),
  },
  {
    slug: 'maiores-torcidas-brasil',
    title: 'Maiores torcidas de futebol do Brasil',
    category: 'Futebol',
    metric: 'Percentual de menções',
    period: 'Pesquisa Ipsos-Ipec de 2025',
    source: 'CNN Brasil / Ipsos-Ipec',
    sourceUrl:
      'https://www.cnnbrasil.com.br/esportes/futebol/pesquisa-revela-ranking-das-maiores-torcidas-do-brasil-em-2025-veja/',
    note: 'Percentual dos entrevistados que mencionaram cada clube na pesquisa nacional Ipsos-Ipec.',
    items: rankingItems(`
1|Flamengo|21,2%
2|Corinthians|11,9%
3|Palmeiras|6,5%
4|São Paulo|6,4%
5|Vasco|3,4%
6|Grêmio|3,0%
7|Cruzeiro|2,3%
8|Atlético-MG|2,3%
9|Bahia|2,2%
10|Santos|2,0%`),
  },
  {
    slug: 'melhores-selecoes-futebol',
    title: 'Melhores seleções masculinas de futebol',
    category: 'Futebol',
    metric: 'Pontos no ranking FIFA',
    period: '20 de julho de 2026',
    source: 'FIFA',
    sourceUrl: 'https://inside.fifa.com/fifa-rankings/world-ranking/men',
    note: 'Ranking oficial calculado pela FIFA a partir dos resultados das seleções masculinas.',
    items: rankingItems(`
1|Espanha|1.995,88 pontos
2|Argentina|1.970,37 pontos
3|França|1.948,97 pontos
4|Inglaterra|1.922,83 pontos
5|Brasil|1.804,92 pontos
6|Marrocos|1.803,99 pontos
7|Portugal|1.787,85 pontos
8|Bélgica|1.778,36 pontos
9|Países Baixos|1.775,54 pontos
10|México|1.754,30 pontos`),
  },
  {
    slug: 'ferramentas-ia-mais-acessadas',
    title: 'Ferramentas de IA mais acessadas',
    category: 'Tecnologia',
    metric: 'Visitas mensais estimadas aos sites',
    period: 'Junho de 2026',
    source: 'OneLittleWeb',
    sourceUrl: 'https://onelittleweb.com/digital-market-intelligence/ai-tools/',
    note: 'Estimativas de tráfego web. Não incluem acessos por aplicativos nem o uso das ferramentas por API.',
    items: rankingItems(`
1|ChatGPT|5,32 bi
2|Gemini|1,14 bi
3|Claude|967,91 mi
4|Canva|759,76 mi
5|Google Translate|343,02 mi
6|DeepSeek|318,81 mi
7|Grok|189,89 mi
8|JanitorAI|173,17 mi
9|Character.AI|165,46 mi
10|Perplexity|140,70 mi`),
  },
  {
    slug: 'cidades-melhor-qualidade-vida-brasil',
    title: 'Cidades com melhor qualidade de vida no Brasil',
    category: 'Brasil',
    metric: 'Nota no Índice de Progresso Social',
    period: 'IPS Brasil 2026',
    source: 'IPS Brasil',
    sourceUrl: 'https://ipsbrasil.org.br/noticias/artigos/4ed8dfaa-a31d-487b-a4a3-692bb7070d05',
    note: 'Nota de 0 a 100. Fernando de Noronha não entra na lista por não ser formalmente um município.',
    items: rankingItems(`
1|Gavião Peixoto, SP|73,10
2|Jundiaí, SP|71,80
3|Osvaldo Cruz, SP|71,76
4|Pompéia, SP|71,76
5|Curitiba, PR|71,29
6|Nova Lima, MG|71,22
7|Gabriel Monteiro, SP|71,16
8|Cornélio Procópio, PR|71,16
9|Luzerna, SC|71,10
10|Itupeva, SP|71,08`),
  },
  {
    slug: 'cidades-mais-violentas-brasil',
    title: 'Cidades mais violentas do Brasil',
    category: 'Brasil',
    metric: 'Mortes violentas intencionais por 100 mil habitantes',
    period: 'Dados de 2025 publicados em 2026',
    source: 'Anuário Brasileiro de Segurança Pública',
    sourceUrl:
      'https://forumseguranca.org.br/wp-content/uploads/2026/07/anuario-2026-infografico.pdf',
    note: 'Considera municípios com mais de 100 mil habitantes. Neste ranking, uma taxa maior representa mais violência.',
    items: rankingItems(`
1|Maranguape, CE|100,3
2|Eunápolis, BA|85,1
3|Maracanaú, CE|80,7
4|Porto Seguro, BA|71,2
5|Simões Filho, BA|68,1
6|Jequié, BA|67,4
7|Caucaia, CE|66,6
8|Cabo de Santo Agostinho, PE|65,1
9|Santa Rita, PB|60,9
10|Juazeiro, BA|55,8`),
  },
  {
    slug: 'maiores-economias-mundo',
    title: 'Países com maior PIB',
    category: 'Economia',
    metric: 'PIB nominal projetado',
    period: 'Projeções para 2026',
    source: 'FMI / World Economic Outlook',
    sourceUrl: 'https://www.worldometers.info/gdp/gdp-by-country/',
    note: 'PIB nominal em dólares correntes, usando as projeções do FMI publicadas em abril de 2026.',
    items: rankingItems(`
1|Estados Unidos|US$ 32,38 tri
2|China|US$ 20,85 tri
3|Alemanha|US$ 5,45 tri
4|Japão|US$ 4,38 tri
5|Reino Unido|US$ 4,26 tri
6|Índia|US$ 4,15 tri
7|França|US$ 3,60 tri
8|Itália|US$ 2,74 tri
9|Rússia|US$ 2,66 tri
10|Brasil|US$ 2,64 tri`),
  },
  {
    slug: 'paises-mais-felizes-mundo',
    title: 'Países mais felizes do mundo',
    category: 'Mundo',
    metric: 'Avaliação média de vida, de 0 a 10',
    period: 'World Happiness Report 2026',
    source: 'World Happiness Report',
    sourceUrl: 'https://www.worldhappiness.report/ed/2026/',
    note: 'Média das avaliações de vida coletadas entre 2023 e 2025. Não é uma medida de emoção momentânea.',
    items: rankingItems(`
1|Finlândia|7,764
2|Islândia|7,540
3|Dinamarca|7,539
4|Costa Rica|7,439
5|Suécia|7,255
6|Noruega|7,242
7|Países Baixos|7,223
8|Israel|7,187
9|Luxemburgo|7,063
10|Suíça|7,018`),
  },
  {
    slug: 'brasileiros-mais-ricos',
    title: 'Brasileiros mais ricos',
    category: 'Dinheiro',
    metric: 'Patrimônio estimado em reais',
    period: 'Dados fechados em 30 de junho de 2026',
    source: 'Forbes Brasil',
    sourceUrl:
      'https://forbes.com.br/forbes-money/2026/08/os-10-maiores-bilionarios-do-brasil-em-2026/',
    note: 'Fortunas estimadas pela Forbes Brasil, sujeitas às oscilações dos ativos e das taxas de câmbio.',
    items: rankingItems(`
1|Eduardo Saverin|R$ 162,9 bi
2|Vicky Safra e família|R$ 130,6 bi
3|Jorge Paulo Lemann e família|R$ 103,5 bi
4|André Esteves|R$ 66,1 bi
5|Fernando Roberto Moreira Salles|R$ 50,3 bi
6|Pedro Moreira Salles|R$ 46,6 bi
7|Max Van Hoegaerden Herrmann Telles|R$ 38,8 bi
8|Miguel Gellert Krigsner|R$ 35,7 bi
9|Carlos Alberto Sicupira e família|R$ 35,4 bi
10|Ricardo Castellar de Faria|R$ 35,1 bi`),
  },
  {
    slug: 'mulheres-mais-ricas-do-mundo',
    title: 'Mulheres mais ricas do mundo',
    category: 'Dinheiro',
    metric: 'Patrimônio estimado',
    period: '1º de março de 2026',
    source: 'Forbes',
    sourceUrl:
      'https://www.forbes.com/sites/gracechung/2026/03/10/the-richest-women-in-the-world-2026/',
    note: 'Fortunas estimadas em dólares pela Forbes. Os valores variam com ações, moedas e outros ativos.',
    items: rankingItems(`
1|Alice Walton|US$ 134 bi
2|Françoise Bettencourt Meyers e família|US$ 100 bi
3|Julia Koch e família|US$ 81,2 bi
4|Iris Fontbona e família|US$ 52,6 bi
5|Jacqueline Mars|US$ 49,1 bi
6|Rafaela Aponte-Diamant|US$ 44,5 bi
7|Savitri Jindal e família|US$ 39,1 bi
8|Miriam Adelson e família|US$ 37,5 bi
9|Abigail Johnson|US$ 33,2 bi
10|Zheng Shuliang e família|US$ 33,2 bi`),
  },
  {
    slug: 'familias-mais-ricas-do-mundo',
    title: 'Famílias mais ricas do mundo',
    category: 'Dinheiro',
    metric: 'Patrimônio familiar estimado',
    period: '9 de dezembro de 2025',
    source: 'Bloomberg via The Indian Express',
    sourceUrl:
      'https://indianexpress.com/article/trending/top-10-listing/top-10-richest-families-worldwide-2025-indian-family-ranks-8th-10426187/',
    note: 'Estimativas anuais da Bloomberg para fortunas familiares. Os valores podem oscilar com ativos e moedas.',
    items: rankingItems(`
1|Família Walton|US$ 513,4 bi
2|Família Al Nahyan|US$ 335,9 bi
3|Família Al Saud|US$ 213,6 bi
4|Família Al Thani|US$ 199,5 bi
5|Família Hermès|US$ 184,5 bi
6|Família Koch|US$ 150,5 bi
7|Família Mars|US$ 143,4 bi
8|Família Ambani|US$ 105,6 bi
9|Família Wertheimer|US$ 85,6 bi
10|Família Thomson|US$ 82,1 bi`),
  },
  {
    slug: 'empresas-mais-valiosas-do-mundo',
    title: 'Empresas mais valiosas do mundo',
    category: 'Dinheiro',
    metric: 'Valor de mercado estimado',
    period: '7 de setembro de 2026',
    source: 'CompaniesMarketCap',
    sourceUrl: 'https://companiesmarketcap.com/',
    note: 'Para empresas listadas, o valor corresponde à capitalização de mercado; para empresas privadas, à avaliação disponível.',
    items: rankingItems(`
1|Nvidia|US$ 5,562 tri
2|Apple|US$ 4,669 tri
3|Alphabet|US$ 4,100 tri
4|Microsoft|US$ 3,710 tri
5|Amazon|US$ 2,788 tri
6|TSMC|US$ 2,224 tri
7|SpaceX|US$ 1,950 tri
8|Broadcom|US$ 1,702 tri
9|Saudi Aramco|US$ 1,672 tri
10|Meta|US$ 1,571 tri`),
  },
  {
    slug: 'marcas-mais-valiosas-do-mundo',
    title: 'Marcas mais valiosas do mundo',
    category: 'Dinheiro',
    metric: 'Valor de marca estimado',
    period: 'Kantar BrandZ 2026',
    source: 'Kantar BrandZ',
    sourceUrl:
      'https://www.kantar.com/north-america/Inspiration/Brands/most-valuable-global-brands-2026',
    note: 'O BrandZ combina desempenho financeiro com a percepção de consumidores para estimar o valor de cada marca.',
    items: rankingItems(`
1|Google|US$ 1,485 tri
2|Apple|US$ 1,380 tri
3|Microsoft|US$ 1,112 tri
4|Amazon|US$ 1,023 tri
5|Nvidia|US$ 814,9 bi
6|Facebook|US$ 366,6 bi
7|Instagram|US$ 286,2 bi
8|Tencent|US$ 251,6 bi
9|Oracle|US$ 235,8 bi
10|McDonald’s|US$ 235,1 bi`),
  },
  {
    slug: 'paises-maior-pib-por-habitante',
    title: 'Países com maior PIB por habitante',
    category: 'Economia',
    metric: 'PIB nominal por habitante projetado',
    period: 'Projeções para 2026',
    source: 'FMI / World Economic Outlook',
    sourceUrl: 'https://www.worldometers.info/gdp/gdp-per-capita/',
    note: 'Valores em dólares correntes para países soberanos com projeções comparáveis do FMI publicadas em abril de 2026.',
    items: rankingItems(`
1|Liechtenstein|US$ 226.809
2|Luxemburgo|US$ 158.733
3|Irlanda|US$ 140.186
4|Suíça|US$ 126.177
5|Islândia|US$ 110.048
6|Singapura|US$ 107.758
7|Noruega|US$ 105.877
8|Estados Unidos|US$ 94.430
9|Dinamarca|US$ 83.445
10|Países Baixos|US$ 79.918`),
  },
  {
    slug: 'cidades-com-mais-bilionarios',
    title: 'Cidades com mais bilionários',
    category: 'Dinheiro',
    metric: 'Número de bilionários residentes',
    period: 'Retrato em 15 de janeiro de 2026',
    source: 'Hurun Global Rich List',
    sourceUrl: 'https://www.hurun.net/en-us/info/detail?num=FTJ5PSSPOWOF',
    note: 'A cidade é definida pela residência principal dos bilionários identificados pela Hurun.',
    items: rankingItems(`
1|Nova York|146 bilionários
2|Shenzhen|132 bilionários
3|Xangai|120 bilionários
4|Pequim|107 bilionários
5|Londres|102 bilionários
6|Mumbai|95 bilionários
7|Hong Kong|88 bilionários
8|São Francisco|86 bilionários
9|Moscou|82 bilionários
10|Hangzhou|65 bilionários`),
  },
  {
    slug: 'celebridades-mais-seguidas-instagram',
    title: 'Celebridades mais seguidas no Instagram',
    category: 'Celebridades',
    metric: 'Número de seguidores',
    period: '4 e 5 de setembro de 2026',
    source: 'Epidemic Sound / HypeAuditor',
    sourceUrl: 'https://www.epidemicsound.com/blog/most-followed-on-instagram/',
    note: 'Retrato das contas pessoais, com marcas e plataformas excluídas. Os números são arredondados e mudam diariamente; a contagem de Justin Bieber foi conferida no HypeAuditor.',
    items: rankingItems(`
1|Cristiano Ronaldo|679 mi
2|Lionel Messi|517 mi
3|Selena Gomez|403 mi
4|Dwayne Johnson|381 mi
5|Kylie Jenner|381 mi
6|Ariana Grande|362 mi
7|Kim Kardashian|344 mi
8|Beyoncé|299 mi
9|Khloé Kardashian|291 mi
10|Justin Bieber|286,5 mi`),
  },
  {
    slug: 'brasileiros-mais-seguidos-instagram',
    title: 'Brasileiros mais seguidos no Instagram',
    category: 'Celebridades',
    metric: 'Número de seguidores',
    period: '10 de agosto de 2026',
    source: 'Oficina da Net',
    sourceUrl:
      'https://www.oficinadanet.com.br/post/19181-10-perfis-mais-seguidos-no-instagram-no-brasil',
    note: 'Retrato dos perfis pessoais brasileiros com maior número de seguidores. As contagens são arredondadas e podem mudar diariamente.',
    items: rankingItems(`
1|Neymar|242 mi
2|Ronaldinho Gaúcho|80,9 mi
3|Marcelo|67,2 mi
4|Vinícius Júnior|64,2 mi
5|Anitta|61,1 mi
6|Virginia Fonseca|56,4 mi
7|Tatá Werneck|54,6 mi
8|Whindersson Nunes|54,5 mi
9|Larissa Manoela|51,9 mi
10|Maisa|46,7 mi`),
  },
  {
    slug: 'celebridades-mais-seguidas-tiktok',
    title: 'Celebridades mais seguidas no TikTok',
    category: 'Celebridades',
    metric: 'Número de seguidores',
    period: '4 de setembro de 2026',
    source: 'Epidemic Sound / CreatorsJet',
    sourceUrl: 'https://www.epidemicsound.com/blog/who-has-the-most-followers-on-tiktok/',
    note: 'Contas oficiais de plataformas, marcas e eventos foram excluídas. O retrato combina a atualização dos líderes da Epidemic Sound com o catálogo ampliado do CreatorsJet.',
    items: rankingItems(`
1|Khaby Lame|162,8 mi
2|Charli D’Amelio|159,3 mi
3|MrBeast|139,8 mi
4|Bella Poarch|91,7 mi
5|Addison Rae|87,8 mi
6|Willie Salim|87,0 mi
7|Zach King|86,9 mi
8|Kimberly Loaiza|83,3 mi
9|BTS|79,2 mi
10|Will Smith|78,8 mi`),
  },
  {
    slug: 'streamers-mais-seguidos-twitch',
    title: 'Streamers mais seguidos na Twitch',
    category: 'Celebridades',
    metric: 'Número de seguidores',
    period: '4 de setembro de 2026',
    source: 'Epidemic Sound',
    sourceUrl: 'https://www.epidemicsound.com/blog/most-followed-on-twitch/',
    note: 'Ranking de canais pessoais pelo total público de seguidores. Seguidores não são o mesmo que assinantes pagos.',
    items: rankingItems(`
1|Kai Cenat|21,7 mi
2|Ibai|20,3 mi
3|Ninja|19,2 mi
4|Auronplay|17,0 mi
5|Rubius|16,5 mi
6|xQc|12,5 mi
7|EasyLiker|12,3 mi
8|TheGrefg|12,3 mi
9|Juansguarnizo|11,7 mi
10|Tfue|11,5 mi`),
  },
  {
    slug: 'criadores-conteudo-mais-poderosos',
    title: 'Criadores de conteúdo mais poderosos do mundo',
    category: 'Celebridades',
    metric: 'Posição composta e ganhos anuais estimados',
    period: 'Forbes Top Creators 2026',
    source: 'Forbes',
    sourceUrl: 'https://www.forbes.com/sites/stevenbertoni/2026/06/23/forbes-top-creators-2026/',
    note: 'A ordem combina ganhos, alcance, engajamento e empreendedorismo. O valor exibido é a estimativa de ganhos brutos entre março de 2025 e março de 2026.',
    items: rankingItems(`
1|MrBeast|US$ 300 mi
2|Dhar Mann|US$ 65 mi
3|Steven Bartlett|US$ 52 mi
4|Markiplier|US$ 38 mi
5|Rhett & Link|US$ 37 mi
6|Charli D’Amelio|US$ 18 mi
7|Druski|US$ 20 mi
8|IShowSpeed|US$ 30 mi
9|Mark Rober|US$ 30 mi
10|Codie Sanchez|US$ 31 mi`),
  },
  {
    slug: 'atores-mais-bem-pagos',
    title: 'Atores mais bem pagos de Hollywood',
    category: 'Celebridades',
    metric: 'Ganhos estimados após taxas de representantes',
    period: 'Ano de 2025',
    source: 'Forbes',
    sourceUrl: 'https://www.forbes.com/sites/mattcraig/2026/03/13/the-highest-paid-actors-of-2025/',
    note: 'Estimativas da Forbes depois das taxas de agentes e empresários. Millie Bobby Brown, John Cena e Reese Witherspoon empataram no corte com US$ 26 milhões; a lista preserva a ordem editorial da fonte.',
    items: rankingItems(`
1|Adam Sandler|US$ 48 mi
2|Tom Cruise|US$ 46 mi
3|Mark Wahlberg|US$ 44 mi
4|Scarlett Johansson|US$ 43 mi
5|Brad Pitt|US$ 41 mi
6|Denzel Washington|US$ 38 mi
7|Jack Black|US$ 28 mi
7|Jason Momoa|US$ 28 mi
9|Daniel Craig|US$ 27 mi
10|Millie Bobby Brown|US$ 26 mi`),
  },
  {
    slug: 'musicos-mais-bem-pagos',
    title: 'Músicos mais bem pagos do mundo',
    category: 'Celebridades',
    metric: 'Ganhos estimados no ano',
    period: 'Ano de 2025',
    source: 'Forbes',
    sourceUrl:
      'https://www.forbes.com/sites/martinadilicosa/2025/12/30/the-highest-paid-musicians-of-2025/',
    note: 'Estimativas da Forbes somando turnês, vendas, streaming e outros negócios musicais. Coldplay e Shakira dividem a quinta posição.',
    items: rankingItems(`
1|The Weeknd|US$ 298 mi
2|Taylor Swift|US$ 202 mi
3|Beyoncé|US$ 148 mi
4|Kendrick Lamar|US$ 109 mi
5|Coldplay|US$ 105 mi
5|Shakira|US$ 105 mi
7|Drake|US$ 78 mi
8|Chris Brown|US$ 74 mi
9|Zach Bryan|US$ 70 mi
10|Bad Bunny|US$ 66 mi`),
  },
  {
    slug: 'atores-maior-bilheteria-historia',
    title: 'Atores de maior bilheteria da história',
    category: 'Celebridades',
    metric: 'Bilheteria mundial em papéis principais',
    period: 'Dados atualizados em 23 de agosto de 2026',
    source: 'The Numbers',
    sourceUrl:
      'https://www.the-numbers.com/box-office-star-records/worldwide/lifetime-acting/top-grossing-leading-stars',
    note: 'Soma nominal da bilheteria mundial dos filmes em que cada ator teve papel principal ou integrou o elenco principal, sem ajuste pela inflação. Não representa ganhos pessoais.',
    items: rankingItems(`
1|Zoë Saldaña|US$ 15,47 bi
2|Scarlett Johansson|US$ 15,40 bi
3|Tom Holland|US$ 15,20 bi
4|Chris Pratt|US$ 15,16 bi
5|Samuel L. Jackson|US$ 14,61 bi
6|Robert Downey Jr.|US$ 14,32 bi
7|Tom Cruise|US$ 13,37 bi
8|Chris Hemsworth|US$ 12,19 bi
9|Vin Diesel|US$ 12,04 bi
10|Chris Evans|US$ 11,49 bi`),
  },
  {
    slug: 'rappers-com-mais-grammys',
    title: 'Rappers com mais Grammys',
    category: 'Celebridades',
    metric: 'Número de prêmios Grammy conquistados',
    period: 'Até 1º de fevereiro de 2026',
    source: 'Recording Academy',
    sourceUrl: 'https://www.grammy.com/news/rappers-who-have-the-most-grammy-wins/',
    note: 'Contagem oficial atualizada após o Grammy de 2026. Os totais podem incluir trabalhos em grupos, participações e créditos de produção reconhecidos pela premiação.',
    items: rankingItems(`
1|Kendrick Lamar|27 Grammys
2|Jay-Z|25 Grammys
3|Kanye West|24 Grammys
4|Eminem|15 Grammys
5|Pharrell Williams|13 Grammys
6|André 3000|9 Grammys
6|Anderson .Paak|9 Grammys
8|Lauryn Hill|8 Grammys
9|Dr. Dre|7 Grammys
10|OutKast|6 Grammys`),
  },
  {
    slug: 'artistas-mais-ouvintes-spotify',
    title: 'Artistas com mais ouvintes mensais no Spotify',
    category: 'Celebridades',
    metric: 'Ouvintes mensais',
    period: '7 de setembro de 2026',
    source: 'Spotify via Kworb',
    sourceUrl: 'https://kworb.net/spotify/listeners.html',
    note: 'Retrato da audiência mensal exibida pelo Spotify e consolidada pelo Kworb. O indicador é móvel e muda todos os dias.',
    items: rankingItems(`
1|Bruno Mars|132.890.504
2|Justin Bieber|118.820.312
3|Rihanna|116.202.772
4|The Weeknd|115.105.571
5|Taylor Swift|100.988.201
6|Lady Gaga|99.327.864
7|Shakira|99.092.619
8|Ariana Grande|97.833.083
9|Bad Bunny|97.761.530
10|Drake|96.004.692`),
  },
  {
    slug: 'melhores-clubes-futebol-mundo',
    title: 'Melhores clubes de futebol de todos os tempos',
    category: 'Futebol',
    metric: 'Seleção editorial sobre a trajetória histórica dos clubes',
    period: 'Ranking publicado em 9 de julho de 2025',
    source: 'Bleacher Report',
    sourceUrl: 'https://bleacherreport.com/articles/25224336-ranking-10-best-soccer-clubs-all-time',
    valueLabel: 'PAÍS',
    note: 'Lista histórica do Bleacher Report sobre o conjunto da obra dos clubes, em vez da força de uma temporada específica. O país de origem aparece ao lado de cada nome.',
    items: rankingItems(`
1|Real Madrid|Espanha
2|Barcelona|Espanha
3|Bayern de Munique|Alemanha
4|Juventus|Itália
5|Liverpool|Inglaterra
6|Manchester United|Inglaterra
7|Milan|Itália
8|Ajax|Países Baixos
9|Boca Juniors|Argentina
10|Palmeiras|Brasil`),
  },
  {
    slug: 'jogadores-futebol-mais-valiosos',
    title: 'Jogadores de futebol mais valiosos',
    category: 'Futebol',
    metric: 'Valor de mercado estimado',
    period: 'Atualização de julho de 2026',
    source: 'Transfermarkt',
    sourceUrl:
      'https://www.transfermarkt.com/olise-4th-cubarsi-17th-tonali-46th-50-most-valuable-players-in-the-world-after-wc-update/view/news/483327',
    note: 'Valores de mercado estimados pelo Transfermarkt; não representam necessariamente o preço de uma transferência.',
    items: rankingItems(`
1|Erling Haaland|€ 220 mi
2|Lamine Yamal|€ 220 mi
3|Kylian Mbappé|€ 200 mi
4|Michael Olise|€ 170 mi
5|Jude Bellingham|€ 160 mi
6|Pedri|€ 150 mi
7|Vinícius Júnior|€ 140 mi
8|Vitinha|€ 140 mi
9|Khvicha Kvaratskhelia|€ 140 mi
10|João Neves|€ 140 mi`),
  },
  {
    slug: 'maiores-artilheiros-copa-do-mundo',
    title: 'Maiores artilheiros da história da Copa do Mundo',
    category: 'Futebol',
    metric: 'Gols marcados em Copas do Mundo masculinas',
    period: 'Após a Copa do Mundo de 2026',
    source: 'FIFA',
    sourceUrl:
      'https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/fifa-world-cup-all-time-leading-scorers',
    note: 'Contagem oficial da FIFA após a edição de 2026. Gols em disputas por pênaltis não entram no total individual.',
    items: rankingItems(`
1|Kylian Mbappé|22 gols
2|Lionel Messi|21 gols
3|Miroslav Klose|16 gols
4|Ronaldo|15 gols
5|Gerd Müller|14 gols
5|Harry Kane|14 gols
7|Just Fontaine|13 gols
8|Pelé|12 gols
9|Sándor Kocsis|11 gols
9|Jürgen Klinsmann|11 gols`),
  },
  {
    slug: 'classificacao-formula-1-2026',
    title: 'Classificação da Fórmula 1 2026',
    category: 'Esporte',
    metric: 'Pontos no Mundial de Pilotos',
    period: 'Após o GP da Itália, 6 de setembro de 2026',
    source: 'Formula 1',
    sourceUrl: 'https://www.formula1.com/en/results/2026/drivers',
    note: 'Classificação oficial após a 13ª etapa. A temporada de 2026 ainda está em andamento e os pontos mudarão a cada Grande Prêmio.',
    items: rankingItems(`
1|Kimi Antonelli|267 pontos
2|George Russell|201 pontos
3|Lewis Hamilton|191 pontos
4|Lando Norris|171 pontos
5|Charles Leclerc|155 pontos
6|Max Verstappen|127 pontos
7|Oscar Piastri|116 pontos
8|Isack Hadjar|71 pontos
9|Liam Lawson|51 pontos
10|Pierre Gasly|41 pontos`),
  },
  {
    slug: 'tenistas-mais-semanas-numero-1-atp',
    title: 'Tenistas com mais semanas como número 1 da ATP',
    category: 'Esporte',
    metric: 'Semanas acumuladas no topo do ranking masculino',
    period: '21 de julho de 2026',
    source: 'ATP Tour',
    sourceUrl: 'https://www.atptour.com/en/news/sinner-top-10-weeks-at-no-1-july-2026',
    note: 'A ATP contabiliza o ranking oficial masculino desde 1973. Jannik Sinner estava em atividade e seu total poderia crescer após este recorte.',
    items: rankingItems(`
1|Novak Djokovic|428 semanas
2|Roger Federer|310 semanas
3|Pete Sampras|286 semanas
4|Ivan Lendl|270 semanas
5|Jimmy Connors|268 semanas
6|Rafael Nadal|209 semanas
7|John McEnroe|170 semanas
8|Björn Borg|109 semanas
9|Andre Agassi|101 semanas
10|Jannik Sinner|81 semanas`),
  },
  {
    slug: 'franquias-mais-titulos-nba',
    title: 'Franquias com mais títulos da NBA',
    category: 'Esporte',
    metric: 'Campeonatos conquistados pela franquia',
    period: 'Após as finais de 2026',
    source: 'NBA',
    sourceUrl: 'https://www.nba.com/news/most-championships-nba-history',
    note: 'A contagem acompanha a história de cada franquia, incluindo títulos obtidos antes de mudanças de cidade. Oklahoma City aparece no limite do Top 10 por ter o título mais recente entre as franquias empatadas com duas conquistas.',
    items: rankingItems(`
1|Boston Celtics|18 títulos
2|Los Angeles Lakers|17 títulos
3|Golden State Warriors|7 títulos
4|Chicago Bulls|6 títulos
5|San Antonio Spurs|5 títulos
6|Miami Heat|3 títulos
6|Detroit Pistons|3 títulos
6|Philadelphia 76ers|3 títulos
6|New York Knicks|3 títulos
10|Oklahoma City Thunder|2 títulos`),
  },
  {
    slug: 'paises-mais-medalhas-paris-2024',
    title: 'Países com mais medalhas em Paris 2024',
    category: 'Esporte',
    metric: 'Total de medalhas conquistadas',
    period: 'Jogos Olímpicos de Paris 2024',
    source: 'Comitê Olímpico Internacional',
    sourceUrl: 'https://www.olympics.com/en/olympic-games/paris-2024/medals',
    note: 'O TOPO reordena o quadro pelo total de medalhas. O quadro oficial olímpico usa primeiro o número de ouros, depois pratas e bronzes.',
    items: rankingItems(`
1|Estados Unidos|126 medalhas
2|China|91 medalhas
3|Grã-Bretanha|65 medalhas
4|França|64 medalhas
5|Austrália|53 medalhas
6|Japão|45 medalhas
7|Itália|40 medalhas
8|Países Baixos|34 medalhas
9|Alemanha|33 medalhas
10|Coreia do Sul|32 medalhas`),
  },
  {
    slug: 'lutadores-ativos-mais-vitorias-ufc',
    title: 'Lutadores ativos com mais vitórias no UFC',
    category: 'Esporte',
    metric: 'Vitórias registradas no UFC',
    period: '8 de setembro de 2026',
    source: 'UFC Record Book',
    sourceUrl: 'https://statleaders.ufc.com/?fighter_status=1',
    note: 'Recorte dos atletas marcados como ativos no livro oficial de recordes do UFC. Empates recebem a mesma posição.',
    items: rankingItems(`
1|Jim Miller|28 vitórias
2|Charles Oliveira|25 vitórias
2|Neil Magny|25 vitórias
4|Max Holloway|24 vitórias
5|Jon Jones|22 vitórias
5|Dustin Poirier|22 vitórias
7|Rafael dos Anjos|21 vitórias
8|Derrick Lewis|20 vitórias
9|Robert Whittaker|18 vitórias
9|Aljamain Sterling|18 vitórias`),
  },
  {
    slug: 'atletas-mais-bem-pagos',
    title: 'Atletas mais bem pagos do mundo',
    category: 'Dinheiro',
    metric: 'Ganhos estimados em 12 meses',
    period: 'Maio de 2025 a maio de 2026',
    source: 'Forbes',
    sourceUrl:
      'https://www.forbes.com/sites/brettknight/2026/05/22/the-worlds-10-highest-paid-athletes-2026/',
    note: 'Soma estimada de salários, prêmios, patrocínios e outras receitas antes de impostos e taxas de agentes.',
    items: rankingItems(`
1|Cristiano Ronaldo|US$ 300 mi
2|Canelo Álvarez|US$ 170 mi
3|Lionel Messi|US$ 140 mi
4|LeBron James|US$ 137,8 mi
5|Shohei Ohtani|US$ 127,6 mi
6|Stephen Curry|US$ 124,7 mi
7|Jon Rahm|US$ 107 mi
8|Karim Benzema|US$ 104 mi
9|Kevin Durant|US$ 103,8 mi
10|Lewis Hamilton|US$ 100 mi`),
  },
  {
    slug: 'carros-mais-vendidos-brasil',
    title: 'Carros mais vendidos no Brasil',
    category: 'Brasil',
    metric: 'Emplacamentos acumulados',
    period: 'Janeiro a agosto de 2026',
    source: 'Fenabrave via CarroLens',
    sourceUrl: 'https://carrolens.com.br/rankings/2026',
    note: 'Soma de automóveis e comerciais leves emplacados no Brasil no período.',
    items: rankingItems(`
1|Fiat Strada|111.736 unidades
2|Volkswagen Polo|74.903 unidades
3|Fiat Argo|63.451 unidades
4|Chevrolet Onix|62.055 unidades
5|Volkswagen T-Cross|61.932 unidades
6|Volkswagen Tera|61.921 unidades
7|BYD Dolphin Mini|51.225 unidades
8|Hyundai Creta|49.158 unidades
9|Hyundai HB20|47.275 unidades
10|BYD Song|45.075 unidades`),
  },
  {
    slug: 'cidades-mais-populosas-brasil',
    title: 'Cidades mais populosas do Brasil',
    category: 'Brasil',
    metric: 'População estimada',
    period: '1º de julho de 2026',
    source: 'IBGE',
    sourceUrl:
      'https://agenciadenoticias.ibge.gov.br/agencia-noticias/2012-agencia-de-noticias/noticias/47878-populacao-estimada-do-pais-chega-a-214-2-milhoes-de-pessoas-em-2026',
    note: 'Estimativas oficiais da população residente nos municípios brasileiros.',
    items: rankingItems(`
1|São Paulo|11.911.337 habitantes
2|Rio de Janeiro|6.731.133 habitantes
3|Brasília|3.009.996 habitantes
4|Fortaleza|2.582.360 habitantes
5|Salvador|2.559.945 habitantes
6|Belo Horizonte|2.415.451 habitantes
7|Manaus|2.327.101 habitantes
8|Curitiba|1.832.183 habitantes
9|Recife|1.588.983 habitantes
10|Goiânia|1.511.709 habitantes`),
  },
  {
    slug: 'cidades-maior-pib-brasil',
    title: 'Cidades com maior PIB do Brasil',
    category: 'Brasil',
    metric: 'PIB municipal nominal',
    period: 'Dados de 2023, divulgados em 2025',
    source: 'IBGE',
    sourceUrl:
      'https://agenciadenoticias.ibge.gov.br/agencia-noticias/2012-agencia-de-noticias/noticias/45548-municipios-dependentes-da-industria-extrativa-freiam-desconcentracao-economica-em-2023',
    note: 'Última edição disponível do PIB dos Municípios. Os valores são nominais e não medem renda por habitante.',
    items: rankingItems(`
1|São Paulo|R$ 1,07 tri
2|Rio de Janeiro|R$ 418,5 bi
3|Brasília|R$ 365,7 bi
4|Maricá|R$ 134,1 bi
5|Belo Horizonte|R$ 130,2 bi
6|Manaus|R$ 127,6 bi
7|Curitiba|R$ 120,1 bi
8|Osasco|R$ 119,4 bi
9|Porto Alegre|R$ 104,7 bi
10|Guarulhos|R$ 97,5 bi`),
  },
  {
    slug: 'nomes-bebe-mais-registrados-brasil',
    title: 'Nomes de bebê mais registrados no Brasil',
    category: 'Brasil',
    metric: 'Quantidade de registros',
    period: 'Ano de 2025',
    source: 'Arpen-Brasil via Agência Brasil',
    sourceUrl:
      'https://agenciabrasil.ebc.com.br/geral/noticia/2025-12/pelo-2o-ano-helena-lidera-ranking-de-nomes-registrados-veja-lista',
    note: 'Levantamento nacional feito a partir dos registros nos cartórios de Registro Civil.',
    items: rankingItems(`
1|Helena|28.271 registros
2|Ravi|21.982 registros
3|Miguel|21.654 registros
4|Maitê|20.677 registros
5|Cecília|20.378 registros
6|Heitor|17.751 registros
7|Arthur|17.514 registros
8|Maria Cecília|16.889 registros
9|Theo|16.766 registros
10|Aurora|16.506 registros`),
  },
  {
    slug: 'paises-mais-populosos-mundo',
    title: 'Países mais populosos do mundo',
    category: 'Mundo',
    metric: 'População estimada',
    period: 'Estimativas para 2026',
    source: 'ONU via Worldometer',
    sourceUrl: 'https://www.worldometers.info/world-population/population-by-country/',
    note: 'Estimativas baseadas na revisão mais recente da Divisão de População das Nações Unidas.',
    items: rankingItems(`
1|Índia|1.476.625.576 habitantes
2|China|1.412.914.089 habitantes
3|Estados Unidos|349.035.494 habitantes
4|Indonésia|287.886.782 habitantes
5|Paquistão|259.299.791 habitantes
6|Nigéria|242.431.832 habitantes
7|Brasil|213.562.666 habitantes
8|Bangladesh|177.818.044 habitantes
9|Rússia|143.394.458 habitantes
10|Etiópia|138.902.185 habitantes`),
  },
  {
    slug: 'paises-maior-idh',
    title: 'Países com maior desenvolvimento humano',
    category: 'Mundo',
    metric: 'Índice de Desenvolvimento Humano, de 0 a 1',
    period: 'Relatório de 2025, com dados de 2023',
    source: 'PNUD',
    sourceUrl:
      'https://hdr.undp.org/sites/default/files/2025_HDR/HDR25_Statistical_Annex_HDI_Trends_Table.pdf',
    note: 'O IDH combina longevidade, educação e renda. Posições repetidas indicam empate na classificação oficial.',
    items: rankingItems(`
1|Islândia|0,972
2|Noruega|0,970
2|Suíça|0,970
4|Dinamarca|0,962
5|Alemanha|0,959
5|Suécia|0,959
7|Austrália|0,958
8|Hong Kong|0,955
8|Países Baixos|0,955
10|Bélgica|0,951`),
  },
  {
    slug: 'paises-mais-pacificos-mundo',
    title: 'Países mais pacíficos do mundo',
    category: 'Mundo',
    metric: 'Pontuação no Global Peace Index',
    period: 'Edição de 2026',
    source: 'Institute for Economics & Peace',
    sourceUrl:
      'https://www.economicsandpeace.org/wp-content/uploads/2026/06/Global-Peace-Index-2026-Report.pdf',
    note: 'O índice combina 23 indicadores de segurança e conflitos. Neste caso, quanto menor a pontuação, melhor.',
    items: rankingItems(`
1|Islândia|1,161
2|Nova Zelândia|1,343
3|Suíça|1,363
4|Eslovênia|1,369
5|Irlanda|1,371
6|Áustria|1,421
7|Portugal|1,427
8|Singapura|1,435
9|Finlândia|1,478
10|Japão|1,489`),
  },
  {
    slug: 'passaportes-mais-poderosos',
    title: 'Passaportes mais poderosos do mundo',
    category: 'Viagem',
    metric: 'Destinos acessíveis sem visto prévio',
    period: '21 de julho de 2026',
    source: 'Henley Passport Index',
    sourceUrl:
      'https://www.henleyglobal.com/newsroom/press-releases/henley-passport-index-20th-anniversary',
    note: 'A lista mostra as dez primeiras posições, incluindo todos os países empatados em cada colocação.',
    items: rankingItems(`
1|Singapura|192 destinos
2|Japão, Coreia do Sul e Emirados Árabes Unidos|188 destinos
3|Suécia|187 destinos
4|Bélgica, Dinamarca, Finlândia, França, Alemanha, Irlanda, Itália, Luxemburgo, Países Baixos, Noruega e Espanha|186 destinos
5|Áustria, Grécia, Malta, Portugal e Suíça|185 destinos
6|Hungria, Polônia e Reino Unido|184 destinos
7|Austrália, Canadá, Tchéquia, Letônia, Malásia, Nova Zelândia, Eslováquia e Eslovênia|183 destinos
8|Croácia e Estônia|182 destinos
9|Liechtenstein e Lituânia|181 destinos
10|Islândia e Estados Unidos|180 destinos`),
  },
  {
    slug: 'paises-mais-visitados',
    title: 'Países que mais recebem turistas',
    category: 'Viagem',
    metric: 'Chegadas internacionais',
    period: 'Ano de 2024',
    source: 'ONU Turismo',
    sourceUrl: 'https://www.untourism.int/un-tourism-world-tourism-barometer-data',
    note: 'Último ano completo com dados comparáveis para as dez primeiras posições.',
    items: rankingItems(`
1|França|102,0 mi
2|Espanha|93,8 mi
3|Estados Unidos|72,4 mi
4|Turquia|60,6 mi
5|Itália|57,8 mi
6|México|45,0 mi
7|Reino Unido|41,8 mi
8|Alemanha|37,5 mi
9|Japão|36,9 mi
10|Grécia|36,0 mi`),
  },
  {
    slug: 'melhores-universidades-mundo',
    title: 'Melhores universidades do mundo',
    category: 'Educação',
    metric: 'Nota geral, de 0 a 100',
    period: 'QS World University Rankings 2027',
    source: 'QS',
    sourceUrl: 'https://www.qs.com/insights/qs-world-university-rankings',
    note: 'Edição publicada em junho de 2026. Posições repetidas representam empates oficiais.',
    items: rankingItems(`
1|MIT|100,0
2|Imperial College London|99,2
2|Stanford University|99,2
4|University of Oxford|98,6
5|Harvard University|97,4
6|University of Cambridge|97,1
7|Caltech|96,6
8|ETH Zurich|96,3
8|UCL|96,3
10|National University of Singapore|96,2`),
  },
  {
    slug: 'maiores-paises-area-terrestre',
    title: 'Maiores países do mundo por área terrestre',
    category: 'Mundo',
    metric: 'Área terrestre',
    period: 'Último ano comum disponível: 2023',
    source: 'Banco Mundial / FAO',
    sourceUrl: 'https://data.worldbank.org/indicator/AG.LND.TOTL.K2',
    note: 'Área terrestre exclui águas interiores. Dados da FAO publicados pelo Banco Mundial.',
    items: rankingItems(`
1|Rússia|16.376.870 km²
2|China|9.388.210 km²
3|Estados Unidos|9.147.420 km²
4|Canadá|8.788.700 km²
5|Brasil|8.358.140 km²
6|Austrália|7.692.020 km²
7|Índia|2.973.190 km²
8|Argentina|2.736.690 km²
9|Cazaquistão|2.699.700 km²
10|Argélia|2.381.740 km²`),
  },
  {
    slug: 'cidades-mais-populosas-mundo',
    title: 'Cidades mais populosas do mundo',
    category: 'Mundo',
    metric: 'População estimada da área urbana harmonizada',
    period: '1º de julho de 2025',
    source: 'ONU',
    sourceUrl:
      'https://population.un.org/wup/assets/Publications/undesa_pd_2025_wup2025_summary_of_results_final.pdf',
    note: 'A ONU usa a metodologia harmonizada Degree of Urbanization, baseada em densidade e continuidade urbana. Valores arredondados.',
    items: rankingItems(`
1|Jacarta|41,9 mi de habitantes
2|Daca|36,6 mi de habitantes
3|Tóquio|33,4 mi de habitantes
4|Nova Délhi|30,2 mi de habitantes
5|Xangai|29,6 mi de habitantes
6|Guangzhou|27,6 mi de habitantes
7|Cairo|25,6 mi de habitantes
8|Manila|24,7 mi de habitantes
9|Calcutá|22,5 mi de habitantes
10|Seul|22,5 mi de habitantes`),
  },
  {
    slug: 'montanhas-mais-altas-mundo',
    title: 'Montanhas mais altas do mundo',
    category: 'Mundo',
    metric: 'Altitude do cume acima do nível do mar',
    period: 'Altitudes de referência consultadas em 8 de setembro de 2026',
    source: '8000ers.com',
    sourceUrl: 'https://www.8000ers.com/cms/en/8000ers-mainmenu-205.html',
    note: 'Classificação por altitude entre os 14 picos principais acima de 8.000 metros. Medições podem variar alguns metros conforme o levantamento.',
    items: rankingItems(`
1|Monte Everest|8.848,86 m
2|K2|8.611 m
3|Kangchenjunga|8.586 m
4|Lhotse|8.516 m
5|Makalu|8.485 m
6|Cho Oyu|8.188 m
7|Dhaulagiri I|8.167 m
8|Manaslu|8.163 m
9|Nanga Parbat|8.126 m
10|Annapurna I|8.091 m`),
  },
  {
    slug: 'maiores-ilhas-mundo',
    title: 'Maiores ilhas do mundo',
    category: 'Mundo',
    metric: 'Área da ilha',
    period: 'Dados geoespaciais de 2026',
    source: 'USGS, Esri e UNEP-WCMC via Wikipedia',
    sourceUrl: 'https://en.wikipedia.org/wiki/List_of_islands_by_area',
    note: 'A Austrália é tratada como continente e não entra na lista. Áreas calculadas com dados geoespaciais e arredondadas ao km².',
    items: rankingItems(`
1|Groenlândia|2.108.459 km²
2|Nova Guiné|773.751 km²
3|Bornéu|723.154 km²
4|Madagascar|592.521 km²
5|Ilha de Baffin|507.205 km²
6|Sumatra|428.134 km²
7|Honshu|228.296 km²
8|Ilha Victoria|219.191 km²
9|Grã-Bretanha|218.635 km²
10|Ilha Ellesmere|197.790 km²`),
  },
  {
    slug: 'paises-mais-patrimonios-mundiais-unesco',
    title: 'Países com mais patrimônios mundiais da UNESCO',
    category: 'Mundo',
    metric: 'Bens inscritos na Lista do Patrimônio Mundial',
    period: 'Após a 48ª sessão do Comitê, em julho de 2026',
    source: 'UNESCO',
    sourceUrl: 'https://whc.unesco.org/en/list/',
    note: 'Contagem oficial por Estado Parte. Bens transnacionais aparecem na contagem de cada país participante.',
    items: rankingItems(`
1|Itália|62 bens
2|China|61 bens
3|França|56 bens
4|Alemanha|55 bens
5|Espanha|50 bens
6|Índia|45 bens
7|México|36 bens
8|Reino Unido|35 bens
9|Rússia|33 bens
10|Irã|30 bens`),
  },
  {
    slug: 'maiores-bilheterias-historia',
    title: 'Filmes de maior bilheteria da história',
    category: 'Cinema',
    metric: 'Bilheteria mundial acumulada',
    period: '7 de setembro de 2026',
    source: 'Box Office Mojo',
    sourceUrl: 'https://www.boxofficemojo.com/chart/ww_top_lifetime_gross/',
    note: 'Valores mundiais nominais, sem correção pela inflação.',
    items: rankingItems(`
1|Avatar|US$ 2,924 bi
2|Avengers: Endgame|US$ 2,799 bi
3|Spider-Man: Brand New Day|US$ 2,408 bi
4|Avatar: The Way of Water|US$ 2,334 bi
5|Ne Zha 2|US$ 2,271 bi
6|Titanic|US$ 2,265 bi
7|Star Wars: The Force Awakens|US$ 2,071 bi
8|Avengers: Infinity War|US$ 2,052 bi
9|Spider-Man: No Way Home|US$ 1,921 bi
10|Zootopia 2|US$ 1,867 bi`),
  },
  {
    slug: 'filmes-mais-bem-avaliados-imdb',
    title: 'Filmes mais bem avaliados no IMDb',
    category: 'Cinema',
    metric: 'Nota ponderada dos usuários',
    period: '6 de setembro de 2026',
    source: 'IMDb',
    sourceUrl: 'https://www.imdb.com/chart/top/',
    note: 'Notas de 0 a 10 calculadas pelo IMDb com uma fórmula ponderada e atualizadas continuamente.',
    items: rankingItems(`
1|Um Sonho de Liberdade|9,3/10
2|O Poderoso Chefão|9,2/10
3|Batman: O Cavaleiro das Trevas|9,1/10
4|O Poderoso Chefão: Parte II|9,0/10
5|O Senhor dos Anéis: O Retorno do Rei|9,0/10
6|12 Homens e uma Sentença|9,0/10
7|A Lista de Schindler|9,0/10
8|O Senhor dos Anéis: A Sociedade do Anel|8,9/10
9|Pulp Fiction|8,8/10
10|O Senhor dos Anéis: As Duas Torres|8,8/10`),
  },
  {
    slug: 'melhores-culinarias-mundo',
    title: 'Melhores culinárias do mundo',
    category: 'Gastronomia',
    metric: 'Nota média dos pratos avaliados',
    period: 'Edição 2025/2026',
    source: 'TasteAtlas',
    sourceUrl: 'https://www.tasteatlas.com/best/cuisines',
    note: 'Resultado calculado a partir das avaliações válidas dos pratos associados a cada culinária.',
    items: rankingItems(`
1|Italiana|4,64/5
2|Grega|4,60/5
3|Peruana|4,54/5
4|Portuguesa|4,53/5
5|Espanhola|4,53/5
6|Japonesa|4,49/5
7|Turca|4,49/5
8|Chinesa|4,48/5
9|Francesa|4,48/5
10|Indonésia|4,48/5`),
  },
  {
    slug: 'melhores-restaurantes-mundo',
    title: 'Melhores restaurantes do mundo',
    category: 'Gastronomia',
    metric: 'Pontuação La Liste, de 0 a 100',
    period: 'Edição de 2026',
    source: 'La Liste',
    sourceUrl: 'https://www.laliste.com/lists/top-1000-restaurants',
    note: 'Os dez restaurantes atingiram 99,5 pontos e dividem oficialmente a primeira posição.',
    items: rankingItems(`
1|Cheval Blanc by Peter Knogl — Basileia|99,5
1|Da Vittorio — Brusaporto|99,5
1|Guy Savoy — Paris|99,5
1|Le Bernardin — Nova York|99,5
1|Martín Berasategui — Lasarte-Oria|99,5
1|Schwarzwaldstube — Baiersbronn|99,5
1|SingleThread — Healdsburg|99,5
1|Robuchon au Dôme — Macau|99,5
1|Matsukawa — Tóquio|99,5
1|Lung King Heen — Hong Kong|99,5`),
  },
  {
    slug: 'maiores-colecoes-estranhas-guinness',
    title: 'Coleções estranhas gigantescas registradas pelo Guinness',
    category: 'Mundo',
    metric: 'Quantidade de itens distintos oficialmente verificados',
    period: 'Registros verificados entre 2004 e 2025',
    source: 'Guinness World Records',
    sourceUrl: 'https://www.guinnessworldrecords.com/news/collections',
    note: 'Seleção editorial de dez coleções inusitadas, ordenadas pela última quantidade publicada pelo Guinness em cada categoria. As coleções podem ter crescido depois da verificação.',
    items: rankingItems(`
1|Guardanapos|125.866 itens
2|Marcadores de livro|103.009 itens
3|Objetos relacionados a gatos|21.321 itens
4|Porta-ovos|15.485 itens
5|Placas de “Não Perturbe”|11.570 itens
6|Dados de jogo|11.097 itens
7|Copos de dose|9.670 itens
8|Tijolos|8.882 itens
9|Sacos para enjoo de avião|6.290 itens
10|Patos de borracha|5.631 itens`),
  },
  {
    slug: 'estados-americanos-mais-relatos-ovnis',
    title: 'Estados americanos com mais relatos de OVNIs',
    category: 'Mundo',
    metric: 'Quantidade de relatos registrados no banco de dados',
    period: 'Contagem acumulada consultada em 8 de setembro de 2026',
    source: 'National UFO Reporting Center (NUFORC)',
    sourceUrl: 'https://nuforc.org/ndx/?id=loc',
    note: 'Contagens acumuladas de relatos enviados ao NUFORC por localização. São observações autodeclaradas e não significam ocorrências extraterrestres verificadas.',
    items: rankingItems(`
1|Califórnia|17.384 relatos
2|Flórida|9.012 relatos
3|Washington|7.708 relatos
4|Texas|6.827 relatos
5|Nova York|6.443 relatos
6|Pensilvânia|5.462 relatos
7|Arizona|5.415 relatos
8|Ohio|4.800 relatos
9|Illinois|4.570 relatos
10|Carolina do Norte|3.975 relatos`),
  },
  {
    slug: 'estados-americanos-mais-relatos-bigfoot',
    title: 'Estados americanos com mais relatos de Bigfoot',
    category: 'Mundo',
    metric: 'Quantidade de relatos publicados no banco de dados',
    period: 'Contagem acumulada consultada em 8 de setembro de 2026',
    source: 'Bigfoot Field Researchers Organization (BFRO)',
    sourceUrl: 'https://www.bfro.net/gdb/',
    note: 'Os números contam relatos catalogados e publicados pelo BFRO. Eles registram o que foi reportado e não comprovam a existência de Bigfoot.',
    items: rankingItems(`
1|Washington|732 relatos
2|Califórnia|471 relatos
3|Flórida|348 relatos
4|Ohio|335 relatos
5|Illinois|305 relatos
6|Texas|264 relatos
7|Oregon|262 relatos
8|Michigan|227 relatos
9|Missouri|168 relatos
10|Geórgia|147 relatos`),
  },
  {
    slug: 'animais-que-mais-dormem',
    title: 'Animais que passam mais horas do dia dormindo',
    category: 'Mundo',
    metric: 'Média de horas de sono por dia',
    period: 'Tabela acadêmica consultada em 8 de setembro de 2026',
    source: 'University of Washington — Neuroscience for Kids',
    sourceUrl: 'https://faculty.washington.edu/chudler/chasleep.html',
    note: 'Ranking dos animais não humanos reunidos na tabela da Universidade de Washington, adaptada de fontes científicas. As médias podem variar entre indivíduos e condições de observação.',
    items: rankingItems(`
1|Morcego-marrom|19,9 horas
2|Gambá-norte-americano|19,4 horas
3|Tatu-canastra|18,1 horas
4|Píton|18,0 horas
5|Macaco-da-noite|17,0 horas
6|Tigre|15,8 horas
6|Musaranho-arborícola|15,8 horas
8|Esquilo|14,9 horas
9|Sapo-ocidental|14,6 horas
10|Furão|14,5 horas`),
  },
  {
    slug: 'paises-mais-consomem-macarrao-instantaneo',
    title: 'Países e regiões que mais consomem macarrão instantâneo',
    category: 'Gastronomia',
    metric: 'Demanda anual estimada de porções',
    period: '2025',
    source: 'World Instant Noodles Association (WINA)',
    sourceUrl: 'https://instantnoodles.org/en/noodles/demand/table/',
    note: 'Estimativas anuais da WINA, apresentadas em milhões de porções. China e Hong Kong aparecem juntas na tabela original; os números podem ser revisados.',
    items: rankingItems(`
1|China e Hong Kong|43.268 milhões de porções
2|Indonésia|14.540 milhões de porções
3|Índia|9.601 milhões de porções
4|Vietnã|8.231 milhões de porções
5|Japão|5.952 milhões de porções
6|Estados Unidos|5.227 milhões de porções
7|Filipinas|4.337 milhões de porções
8|Tailândia|4.195 milhões de porções
9|Coreia do Sul|4.061 milhões de porções
10|Nigéria|3.115 milhões de porções`),
  },
  {
    slug: 'formatos-ovni-mais-relatados',
    title: 'Formatos de OVNI mais relatados',
    category: 'Mundo',
    metric: 'Quantidade de relatos classificados por formato',
    period: 'Contagem acumulada consultada em 8 de setembro de 2026',
    source: 'National UFO Reporting Center (NUFORC)',
    sourceUrl: 'https://nuforc.org/ndx/?id=shape',
    note: 'As categorias reproduzem descrições dadas por testemunhas. Foram excluídos “outro”, “desconhecido” e “não especificado”; os relatos não significam eventos extraterrestres verificados.',
    items: rankingItems(`
1|Luz|29.408 relatos
2|Círculo|16.193 relatos
3|Triângulo|14.404 relatos
4|Bola de fogo|10.203 relatos
5|Disco|9.644 relatos
6|Orbe|8.391 relatos
7|Esfera|8.336 relatos
8|Oval|6.959 relatos
9|Formação|5.210 relatos
10|Forma variável|4.719 relatos`),
  },
  {
    slug: 'paises-acreditavam-alienigenas-disfarcados-humanos',
    title: 'Países onde mais gente acreditava em alienígenas disfarçados de humanos',
    category: 'Mundo',
    metric: 'Parcela dos entrevistados que concordou com a afirmação',
    period: 'Pesquisa realizada entre novembro de 2009 e janeiro de 2010',
    source: 'Ipsos / Reuters',
    sourceUrl:
      'https://www.ipsos.com/en-us/one-five-20-global-citizens-believe-alien-beings-have-come-down-earth-and-walk-amongst-us-our',
    note: 'Pesquisa histórica on-line com 24.077 adultos de 22 países. O ranking mede a crença dos entrevistados naquela época, não a existência de alienígenas entre humanos.',
    items: rankingItems(`
1|Índia|45%
2|China|42%
3|Japão|29%
4|Coreia do Sul|27%
5|Itália|25%
6|Estados Unidos|24%
6|Brasil|24%
8|Austrália|23%
9|Rússia|21%
9|Espanha|21%`),
  },
  {
    slug: 'maiores-bandas-rock-todos-tempos',
    title: 'Maiores bandas de rock de todos os tempos',
    category: 'Música',
    metric: 'Pontuação acumulada por posição nos rankings',
    period: 'Síntese editorial concluída em 8 de setembro de 2026',
    source: 'Ranking Topo',
    sourceUrl: 'https://somostopo.com.br/rankings',
    topoRanking: true,
    note: 'Ranking Topo criado pela soma das posições em rankings editoriais publicados por veículos de mídia. Em cada lista, o 1º lugar recebeu 10 pontos, o 2º recebeu 9 e assim por diante até 1 ponto para o 10º.',
    items: rankingItems(`
1|The Beatles|93 pontos
2|Led Zeppelin|71 pontos
3|The Rolling Stones|62 pontos
4|Queen|52 pontos
5|Pink Floyd|49 pontos
6|The Who|26 pontos
7|AC/DC|16 pontos
8|Fleetwood Mac|16 pontos
9|Black Sabbath|10 pontos
10|Nirvana|9 pontos`),
  },
  {
    slug: 'maiores-idolos-pop-todos-tempos',
    title: 'Maiores ídolos do pop de todos os tempos',
    category: 'Música',
    metric: 'Pontuação acumulada por posição nos rankings',
    period: 'Síntese editorial concluída em 8 de setembro de 2026',
    source: 'Ranking Topo',
    sourceUrl: 'https://somostopo.com.br/rankings',
    topoRanking: true,
    note: 'Ranking Topo calculado pela soma das posições em rankings editoriais comparáveis. O 1º lugar recebeu 10 pontos, o 2º recebeu 9 e assim por diante. Rankings baseados em votação popular aberta não entraram no cálculo.',
    items: rankingItems(`
1|The Beatles|40 pontos
2|Elton John|33 pontos
3|Michael Jackson|31 pontos
4|The Rolling Stones|27 pontos
5|Prince|21 pontos
6|Elvis Presley|20 pontos
7|Madonna|19 pontos
8|Whitney Houston|17 pontos
9|Bob Dylan|15 pontos
10|Frank Sinatra|10 pontos`),
  },
  {
    slug: 'maiores-guitarristas-todos-tempos',
    title: 'Maiores guitarristas de todos os tempos',
    category: 'Música',
    metric: 'Pontuação acumulada por posição nos rankings',
    period: 'Síntese editorial concluída em 8 de setembro de 2026',
    source: 'Ranking Topo',
    sourceUrl: 'https://somostopo.com.br/rankings',
    topoRanking: true,
    note: 'Ranking Topo calculado pela soma das posições em listas editoriais ou de especialistas. Enquetes abertas foram excluídas; empates foram resolvidos pela recorrência e pela melhor posição individual.',
    items: rankingItems(`
1|Jimi Hendrix|60 pontos
2|Jimmy Page|41 pontos
3|Chuck Berry|39 pontos
4|Eddie Van Halen|36 pontos
5|Eric Clapton|27 pontos
6|Jeff Beck|24 pontos
7|B.B. King|14 pontos
8|Sister Rosetta Tharpe|14 pontos
9|Tony Iommi|12 pontos
10|Robert Johnson|8 pontos`),
  },
  {
    slug: 'menores-paises-area-terrestre',
    title: 'Menores países do mundo por área terrestre',
    category: 'Mundo',
    metric: 'Área terrestre, sem águas interiores',
    period: 'Edição final publicada em janeiro de 2026',
    source: 'CIA World Factbook — edição final arquivada',
    sourceUrl: 'https://github.com/factbook/cache.factbook.json',
    note: 'Foram considerados apenas Estados soberanos. A ordem usa a área terrestre informada pelo Factbook, sem incluir águas interiores.',
    items: rankingItems(`
1|Cidade do Vaticano|0,44 km²
2|Mônaco|2 km²
3|Nauru|21 km²
4|Tuvalu|26 km²
5|San Marino|61 km²
6|Liechtenstein|160 km²
7|Ilhas Marshall|181 km²
8|São Cristóvão e Névis|261 km²
9|Maldivas|298 km²
10|Malta|316 km²`),
  },
  {
    slug: 'paises-menos-populosos',
    title: 'Países menos populosos do mundo',
    category: 'Mundo',
    metric: 'Estimativa de população total',
    period: 'Estimativas de 2024 e 2025 da edição final',
    source: 'CIA World Factbook — edição final arquivada',
    sourceUrl: 'https://github.com/factbook/cache.factbook.json',
    note: 'Foram considerados apenas Estados soberanos. Cada número preserva o ano da estimativa disponível na edição final do Factbook; por isso, o recorte combina valores de 2024 e 2025.',
    items: rankingItems(`
1|Cidade do Vaticano|1.000 habitantes (2024)
2|Nauru|9.930 habitantes (2025)
3|Tuvalu|11.824 habitantes (2025)
4|Palau|21.947 habitantes (2025)
5|Mônaco|32.047 habitantes (2025)
6|San Marino|35.291 habitantes (2025)
7|Liechtenstein|40.547 habitantes (2025)
8|São Cristóvão e Névis|55.434 habitantes (2025)
9|Dominica|74.661 habitantes (2024)
10|Ilhas Marshall|82.011 habitantes (2024)`),
  },
  {
    slug: 'paises-menor-densidade-populacional',
    title: 'Países com menor densidade populacional',
    category: 'Mundo',
    metric: 'Habitantes por quilômetro quadrado de terra',
    period: 'Populações de 2024–2025 e áreas da edição final',
    source: 'CIA World Factbook — edição final arquivada',
    sourceUrl: 'https://github.com/factbook/cache.factbook.json',
    note: 'Cálculo editorial feito ao dividir a estimativa populacional pela área terrestre do mesmo Factbook. Só entram Estados soberanos; resultados arredondados para duas casas decimais.',
    items: rankingItems(`
1|Mongólia|2,11 hab./km²
2|Namíbia|3,47 hab./km²
3|Austrália|3,58 hab./km²
4|Islândia|3,63 hab./km²
5|Guiana|4,03 hab./km²
6|Líbia|4,18 hab./km²
7|Suriname|4,19 hab./km²
8|Canadá|4,31 hab./km²
9|Botsuana|4,45 hab./km²
10|Mauritânia|5,05 hab./km²`),
  },
  {
    slug: 'paises-menores-litorais',
    title: 'Países com os menores litorais do mundo',
    category: 'Mundo',
    metric: 'Comprimento informado da linha de costa',
    period: 'Edição final publicada em janeiro de 2026',
    source: 'CIA World Factbook — edição final arquivada',
    sourceUrl: 'https://github.com/factbook/cache.factbook.json',
    note: 'Países sem litoral foram excluídos. Medições de costa variam conforme a escala e o método — o chamado paradoxo do litoral —, então a lista reproduz um único padrão de fonte.',
    items: rankingItems(`
1|Mônaco|4,1 km
2|Bósnia e Herzegovina|20 km
3|Tuvalu|24 km
4|Jordânia|26 km
5|Nauru|30 km
6|República Democrática do Congo|37 km
7|Eslovênia|46,6 km
8|Togo|56 km
9|Iraque|58 km
10|Bélgica|66,5 km`),
  },
  {
    slug: 'paises-pontos-mais-altos-menos-elevados',
    title: 'Países com os pontos mais altos de menor altitude',
    category: 'Mundo',
    metric: 'Altitude do ponto mais elevado do território',
    period: 'Edição final publicada em janeiro de 2026',
    source: 'CIA World Factbook — edição final arquivada',
    sourceUrl: 'https://github.com/factbook/cache.factbook.json',
    note: 'Foram considerados apenas Estados soberanos e o ponto nacional mais alto registrado pelo Factbook. Maldivas e Tuvalu dividem a primeira posição.',
    items: rankingItems(`
1|Maldivas|5 m
1|Tuvalu|5 m
3|Ilhas Marshall|14 m
4|Gâmbia|63 m
5|Bahamas|64 m
6|Nauru|70 m
7|Cidade do Vaticano|78 m
8|Kiribati|81 m
9|Catar|103 m
10|Bahrein|135 m`),
  },
  {
    slug: 'pequenos-estados-insulares-mais-remotos-mercados',
    title: 'Pequenos Estados insulares mais remotos dos mercados',
    category: 'Mundo',
    metric: 'Índice de afastamento dos mercados mundiais',
    period: '2021',
    source: 'UNDP SIDS Data Platform',
    sourceUrl:
      'https://sids.data.undp.org/development-indicators/key-mvi-ldc-REM-Index/recentValue/bars',
    note: 'O índice calcula a distância média aos mercados mundiais ponderada pelo comércio: quanto maior o valor, maior o afastamento. Não é a distância em linha reta ao país mais próximo.',
    items: rankingItems(`
1|Tonga|93,15 pontos
2|Fiji|91,28 pontos
3|Vanuatu|89,71 pontos
4|Samoa|88,74 pontos
5|Tuvalu|87,84 pontos
6|Ilhas Salomão|84,26 pontos
7|Kiribati|82,84 pontos
8|Nauru|82,33 pontos
9|Ilhas Marshall|79,88 pontos
10|Papua-Nova Guiné|78,92 pontos`),
  },
  {
    slug: 'mamiferos-mais-leves-pantheria',
    title: 'Mamíferos mais leves na base PanTHERIA',
    category: 'Mundo',
    metric: 'Massa corporal adulta média',
    period: 'PanTHERIA 1.0, publicada em 2009',
    source: 'PanTHERIA',
    sourceUrl: 'https://esapubs.org/archive/ecol/E090/184/metadata.htm',
    note: 'Ranking entre as espécies com massa adulta positiva registrada na PanTHERIA. Os nomes científicos, a taxonomia e as medidas refletem a versão histórica da base.',
    items: rankingItems(`
1|Craseonycteris thonglongyai|1,96 g
2|Kerivoula minuta|2,03 g
3|Suncus etruscus|2,26 g
4|Sorex minutissimus|2,46 g
5|Suncus madagascariensis|2,47 g
6|Crocidura lusitania|2,48 g
7|Crocidura planiceps|2,50 g
8|Pipistrellus nanulus|2,51 g
9|Sorex nanus|2,57 g
10|Sorex arizonae|2,70 g`),
  },
  {
    slug: 'aves-mais-leves-amniota',
    title: 'Aves mais leves na base Amniota',
    category: 'Mundo',
    metric: 'Mediana da massa corporal adulta',
    period: 'Base publicada em 2015',
    source: 'Amniota life-history database',
    sourceUrl: 'https://esapubs.org/archive/ecol/E096/269/',
    note: 'A base consolida valores publicados e usa a mediana da massa adulta por espécie. O ranking considera as aves com medida disponível e preserva os nomes científicos e comuns da versão original.',
    items: rankingItems(`
1|Thaumastura cora — Peruvian Sheartail|1,900 g
1|Mellisuga helenae — Bee Hummingbird|1,900 g
3|Phaethornis ruber — Reddish Hermit|2,150 g
4|Selasphorus scintilla — Scintillant Hummingbird|2,200 g
4|Tilmatura dupontii — Sparkling-tailed Woodstar|2,200 g
4|Phaethornis stuarti — White-browed Hermit|2,200 g
4|Mellisuga minima — Vervain Hummingbird|2,200 g
8|Atthis heloisa — Bumblebee Hummingbird|2,275 g
9|Myrtis fanny — Purple-collared Woodstar|2,300 g
9|Phaethornis griseogularis — Grey-chinned Hermit|2,300 g`),
  },
  {
    slug: 'peixes-menor-comprimento-maximo-fishbase',
    title: 'Peixes com menor comprimento máximo no FishBase',
    category: 'Mundo',
    metric: 'Maior comprimento-padrão registrado',
    period: 'Snapshot FishBase de junho de 2026',
    source: 'FishBase',
    sourceUrl: 'https://www.fishbase.se/',
    note: 'SL significa comprimento-padrão, do focinho à base da nadadeira caudal. A ordem usa o maior valor disponível entre os campos por sexo; registros podem mudar com novas revisões da base.',
    items: rankingItems(`
1|Aspasmichthys alorensis|0,82 cm SL
2|Schindleria brevipinguis|0,84 cm SL
3|Eviota deminuta|0,87 cm SL
4|Schindleria nana|0,90 cm SL
5|Leptophilypnion pusillus|0,91 cm SL
6|Leptophilypnion fittkaui|0,95 cm SL
7|Eviota samota|0,96 cm SL
8|Eviota amphipora|0,98 cm SL
9|Acanthoplesiops naka|0,99 cm SL
9|Eviota shibukawai|0,99 cm SL`),
  },
  {
    slug: 'racas-caes-menor-altura-maxima-akc',
    title: 'Raças de cães com menor altura máxima no AKC',
    category: 'Mundo',
    metric: 'Limite superior da faixa de altura adulta',
    period: 'Catálogo consultado em 8 de setembro de 2026',
    source: 'American Kennel Club (AKC)',
    sourceUrl: 'https://www.akc.org/dog-breeds/',
    note: 'Foram comparados os perfis de raças reconhecidas exibidos no catálogo. A ordem usa a altura máxima; empates são resolvidos pela mínima e depois alfabeticamente. Dachshund reúne as variedades miniatura e padrão.',
    items: rankingItems(`
1|Pomeranian|15,2–17,8 cm (máx. 17,8 cm)
2|Chihuahua|12,7–20,3 cm (máx. 20,3 cm)
3|Yorkshire Terrier|17,8–20,3 cm (máx. 20,3 cm)
4|Dachshund|12,7–22,9 cm (máx. 22,9 cm)
5|Pekingese|15,2–22,9 cm (máx. 22,9 cm)
6|Maltese|17,8–22,9 cm (máx. 22,9 cm)
7|Brussels Griffon|17,8–25,4 cm (máx. 25,4 cm)
8|English Toy Spaniel|22,9–25,4 cm (máx. 25,4 cm)
9|Norfolk Terrier|22,9–25,4 cm (máx. 25,4 cm)
10|Silky Terrier|22,9–25,4 cm (máx. 25,4 cm)`),
  },
  ...EXPANDED_DISCOVER_RANKINGS,
  ...CONSUMPTION_DISCOVER_RANKINGS,
  ...SPEED_DISCOVER_RANKINGS,
]);

export function discoverRankingBySlug(slug) {
  return DISCOVER_RANKINGS.find((ranking) => ranking.slug === String(slug || '')) || null;
}

export function discoverCategoryBySlug(slug) {
  return DISCOVER_CATEGORIES.find((category) => category.slug === String(slug || '')) || null;
}

export function discoverRankingsForCategory(slug) {
  const category = discoverCategoryBySlug(slug);
  if (!category || category.slug === 'todos') return DISCOVER_RANKINGS;
  return DISCOVER_RANKINGS.filter((ranking) =>
    category.sourceCategories.includes(ranking.category),
  );
}
