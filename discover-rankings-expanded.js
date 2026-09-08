function rankingItems(block) {
  return block
    .trim()
    .split('\n')
    .map((line) => {
      const [rank, name, value] = line.split('|');
      return { rank, name, value };
    });
}

export const EXPANDED_DISCOVER_RANKINGS = Object.freeze([
  {
    slug: 'estados-mais-populosos-brasil',
    title: 'Estados mais populosos do Brasil',
    category: 'Brasil',
    metric: 'População residente estimada',
    period: 'Estimativa para 1º de julho de 2026',
    source: 'IBGE',
    sourceUrl:
      'https://ftp.ibge.gov.br/Estimativas_de_Populacao/Estimativas_2026/estimativa_dou_2026.pdf',
    note: 'Estimativa oficial de população, e não uma contagem censitária. O Distrito Federal não aparece entre as dez maiores populações.',
    items: rankingItems(`
1|São Paulo|46.179.008 habitantes
2|Minas Gerais|21.460.311 habitantes
3|Rio de Janeiro|17.225.410 habitantes
4|Bahia|14.889.472 habitantes
5|Paraná|11.952.456 habitantes
6|Rio Grande do Sul|11.233.317 habitantes
7|Pernambuco|9.583.176 habitantes
8|Ceará|9.302.211 habitantes
9|Pará|8.756.324 habitantes
10|Santa Catarina|8.312.759 habitantes`),
  },
  {
    slug: 'estados-maior-pib-brasil',
    title: 'Estados com maior PIB do Brasil',
    category: 'Brasil',
    metric: 'Produto Interno Bruto nominal',
    period: 'Contas Regionais de 2023, publicadas em novembro de 2025',
    source: 'IBGE',
    sourceUrl:
      'https://agenciadenoticias.ibge.gov.br/agencia-noticias/2012-agencia-de-noticias/noticias/45142-pib-cresce-em-todos-os-27-estados-do-pais-em-2023',
    note: 'Valores correntes e arredondados. O Distrito Federal é contado como unidade da federação na mesma comparação.',
    items: rankingItems(`
1|São Paulo|R$ 3,445 tri
2|Rio de Janeiro|R$ 1,173 tri
3|Minas Gerais|R$ 972,0 bi
4|Paraná|R$ 670,9 bi
5|Rio Grande do Sul|R$ 650,1 bi
6|Santa Catarina|R$ 513,4 bi
7|Bahia|R$ 431,0 bi
8|Distrito Federal|R$ 365,7 bi
9|Goiás|R$ 336,7 bi
10|Mato Grosso|R$ 273,0 bi`),
  },
  {
    slug: 'maiores-estados-brasil-area',
    title: 'Maiores estados do Brasil por área',
    category: 'Brasil',
    metric: 'Área territorial',
    period: 'Quadro territorial vigente em 30 de abril de 2025',
    source: 'IBGE',
    sourceUrl:
      'https://www.ibge.gov.br/geociencias/organizacao-do-territorio/estrutura-territorial/15761-areas-dos-municipios.html',
    note: 'Áreas arredondadas ao quilômetro quadrado conforme a atualização territorial divulgada pelo IBGE em 2026.',
    items: rankingItems(`
1|Amazonas|1.558.704 km²
2|Pará|1.245.832 km²
3|Mato Grosso|903.208 km²
4|Minas Gerais|586.514 km²
5|Bahia|564.764 km²
6|Mato Grosso do Sul|357.142 km²
7|Goiás|340.243 km²
8|Maranhão|329.651 km²
9|Rio Grande do Sul|281.707 km²
10|Tocantins|277.424 km²`),
  },
  {
    slug: 'unidades-federativas-maior-expectativa-vida',
    title: 'Unidades federativas com maior expectativa de vida',
    category: 'Brasil',
    metric: 'Expectativa de vida ao nascer, ambos os sexos',
    period: 'Estimativas do IBGE para 2024',
    source: 'IBGE',
    sourceUrl:
      'https://www.ibge.gov.br/estatisticas/sociais/populacao/9109-projecao-da-populacao.html',
    note: 'Indicador em anos para ambos os sexos. O Distrito Federal é uma unidade da federação e, por isso, integra a lista.',
    items: rankingItems(`
1|Santa Catarina|81,16 anos
2|Espírito Santo|80,20 anos
3|São Paulo|79,93 anos
4|Distrito Federal|79,89 anos
5|Rio Grande do Sul|79,69 anos
6|Paraná|79,20 anos
7|Minas Gerais|79,01 anos
8|Rio de Janeiro|78,25 anos
9|Mato Grosso do Sul|77,38 anos
10|Rio Grande do Norte|77,26 anos`),
  },
  {
    slug: 'series-mais-bem-avaliadas-imdb',
    title: 'Séries mais bem avaliadas no IMDb',
    category: 'Cinema',
    metric: 'Nota ponderada dos usuários',
    period: 'Consulta em 8 de setembro de 2026',
    source: 'IMDb',
    sourceUrl: 'https://www.imdb.com/chart/toptv/',
    note: 'O IMDb usa uma fórmula ponderada e não apenas a média simples. Notas exibidas com uma casa decimal podem parecer empatadas sem alterar a ordem interna.',
    items: rankingItems(`
1|Breaking Bad|9,5/10
2|Planet Earth II|9,4/10
3|Planet Earth|9,4/10
4|Band of Brothers|9,4/10
5|Chernobyl|9,3/10
6|Avatar: The Last Airbender|9,3/10
7|The Wire|9,3/10
8|The Sopranos|9,2/10
9|Blue Planet II|9,3/10
10|Cosmos: A Spacetime Odyssey|9,3/10`),
  },
  {
    slug: 'filmes-com-mais-oscars',
    title: 'Filmes com mais Oscars',
    category: 'Cinema',
    metric: 'Prêmios competitivos conquistados',
    period: 'Até a cerimônia de 2026',
    source: 'Academy Awards Records',
    sourceUrl: 'https://en.wikipedia.org/wiki/List_of_Academy_Award_records',
    note: 'Empates mantêm a mesma posição. No corte de oito vitórias, entram três filmes para completar dez títulos.',
    items: rankingItems(`
1|Ben-Hur|11 Oscars
1|Titanic|11 Oscars
1|O Senhor dos Anéis: O Retorno do Rei|11 Oscars
4|Amor, Sublime Amor|10 Oscars
5|Gigi|9 Oscars
5|O Último Imperador|9 Oscars
5|O Paciente Inglês|9 Oscars
8|E o Vento Levou|8 Oscars
8|A Um Passo da Eternidade|8 Oscars
8|Sindicato de Ladrões|8 Oscars`),
  },
  {
    slug: 'programas-com-mais-emmys',
    title: 'Séries e programas com mais Emmys',
    category: 'Cinema',
    metric: 'Prêmios Primetime e Creative Arts conquistados',
    period: 'Após a 77ª edição, em 2025',
    source: 'TVLine',
    sourceUrl: 'https://www.tvline.com/2165745/tv-shows-most-emmy-wins/',
    note: 'Soma os Emmys do Primetime e do Creative Arts atribuídos a cada programa. Empates recebem a mesma posição.',
    items: rankingItems(`
1|Saturday Night Live|93 Emmys
2|Game of Thrones|59 Emmys
3|Frasier|37 Emmys
3|The Simpsons|37 Emmys
5|Last Week Tonight with John Oliver|32 Emmys
6|RuPaul’s Drag Race|29 Emmys
6|The Mary Tyler Moore Show|29 Emmys
8|Cheers|28 Emmys
9|The West Wing|26 Emmys
9|Hill Street Blues|26 Emmys`),
  },
  {
    slug: 'franquias-maior-bilheteria',
    title: 'Franquias de cinema com maior bilheteria',
    category: 'Cinema',
    metric: 'Bilheteria mundial nominal acumulada',
    period: 'Consulta em 8 de setembro de 2026',
    source: 'The Numbers e Box Office Mojo',
    sourceUrl:
      'https://en.wikipedia.org/wiki/List_of_highest-grossing_films#Highest-grossing_franchises_and_film_series',
    note: 'Valores mundiais sem correção pela inflação. Universos compartilhados e subfranquias podem se sobrepor, seguindo a classificação da fonte.',
    items: rankingItems(`
1|Universo Cinematográfico Marvel|~US$ 34,895 bi
2|Spider-Man|~US$ 13,562 bi
3|Star Wars|~US$ 10,749 bi
4|Mundo Bruxo|~US$ 9,656 bi
5|James Bond|~US$ 7,837 bi
6|Avengers|~US$ 7,767 bi
7|X-Men|~US$ 7,422 bi
8|Velozes e Furiosos|~US$ 7,339 bi
9|Universo Estendido DC|~US$ 7,198 bi
10|Batman|~US$ 7,053 bi`),
  },
  {
    slug: 'animacoes-maior-bilheteria',
    title: 'Animações de maior bilheteria da história',
    category: 'Cinema',
    metric: 'Bilheteria mundial nominal',
    period: 'Consulta em 8 de setembro de 2026',
    source: 'Box Office Mojo e The Numbers',
    sourceUrl: 'https://en.wikipedia.org/wiki/List_of_highest-grossing_animated_films',
    note: 'Valores aproximados, sem correção pela inflação. O Rei Leão de 2019 é classificado pela fonte como animação computadorizada.',
    items: rankingItems(`
1|Ne Zha 2|~US$ 2,216 bi
2|Zootopia 2|~US$ 1,870 bi
3|Divertida Mente 2|~US$ 1,699 bi
4|O Rei Leão — 2019|~US$ 1,662 bi
5|Frozen II|~US$ 1,452 bi
6|Super Mario Bros. — O Filme|~US$ 1,361 bi
7|Frozen|~US$ 1,290 bi
8|Os Incríveis 2|~US$ 1,243 bi
9|Minions|~US$ 1,159 bi
10|Toy Story 4|~US$ 1,074 bi`),
  },
  {
    slug: 'filmes-brasileiros-maior-publico',
    title: 'Filmes brasileiros com maior público nos cinemas',
    category: 'Cinema',
    metric: 'Ingressos vendidos no Brasil',
    period: 'Público acumulado desde 1970; consulta em setembro de 2026',
    source: 'Ancine e Filme B',
    sourceUrl:
      'https://pt.wikipedia.org/wiki/Lista_de_filmes_brasileiros_com_mais_de_um_milh%C3%A3o_de_espectadores',
    note: 'Série histórica de público no circuito brasileiro. Registros anteriores a 1970 são incompletos; o valor de Ainda Estou Aqui é aproximado.',
    items: rankingItems(`
1|Nada a Perder|12.184.373 espectadores
2|Minha Mãe É uma Peça 3|11.608.254 espectadores
3|Os Dez Mandamentos|11.305.479 espectadores
4|Tropa de Elite 2|11.146.723 espectadores
5|Dona Flor e Seus Dois Maridos|10.735.524 espectadores
6|Minha Mãe É uma Peça 2|9.307.612 espectadores
7|A Dama do Lotação|6.509.134 espectadores
8|Nada a Perder 2|6.193.133 espectadores
9|Se Eu Fosse Você 2|6.137.345 espectadores
10|Ainda Estou Aqui|~5.834.000 espectadores`),
  },
  {
    slug: 'musicas-mais-ouvidas-spotify-mundo',
    title: 'Músicas mais ouvidas da história do Spotify',
    category: 'Música',
    metric: 'Reproduções globais acumuladas',
    period: 'Consulta em 8 de setembro de 2026',
    source: 'Spotify Charts e Kworb',
    sourceUrl: 'https://en.wikipedia.org/wiki/List_of_Spotify_streaming_records',
    note: 'Contagens aproximadas e em mudança diária. O símbolo ~ indica valores arredondados na data da consulta.',
    items: rankingItems(`
1|Blinding Lights — The Weeknd|~5,578 bi
2|Shape of You — Ed Sheeran|~5,083 bi
3|Sweater Weather — The Neighbourhood|~4,857 bi
4|Starboy — The Weeknd e Daft Punk|~4,740 bi
5|As It Was — Harry Styles|~4,610 bi
6|One Dance — Drake, Wizkid e Kyla|~4,451 bi
7|Sunflower — Post Malone e Swae Lee|~4,440 bi
8|Someone You Loved — Lewis Capaldi|~4,428 bi
9|Perfect — Ed Sheeran|~4,100 bi
10|Stay — The Kid Laroi e Justin Bieber|~4,065 bi`),
  },
  {
    slug: 'albuns-mais-ouvidos-spotify',
    title: 'Álbuns mais ouvidos da história do Spotify',
    category: 'Música',
    metric: 'Posição por reproduções globais acumuladas',
    period: 'Spotify 20, dados divulgados em abril de 2026',
    source: 'Spotify',
    sourceUrl:
      'https://newsroom.spotify.com/2026-04-23/spotify-20-most-streamed-music-podcasts-audiobooks/',
    note: 'O Spotify publicou a ordem oficial de seus primeiros 20 anos, mas não divulgou o total acumulado de reproduções de cada álbum.',
    items: rankingItems(`
1|Un Verano Sin Ti — Bad Bunny|1º lugar
2|Starboy — The Weeknd|2º lugar
3|÷ (Deluxe) — Ed Sheeran|3º lugar
4|SOUR — Olivia Rodrigo|4º lugar
5|After Hours — The Weeknd|5º lugar
6|SOS — SZA|6º lugar
7|Hollywood’s Bleeding — Post Malone|7º lugar
8|Lover — Taylor Swift|8º lugar
9|AM — Arctic Monkeys|9º lugar
10|When We All Fall Asleep, Where Do We Go? — Billie Eilish|10º lugar`),
  },
  {
    slug: 'artistas-com-mais-grammys',
    title: 'Artistas com mais Grammys',
    category: 'Música',
    metric: 'Prêmios Grammy competitivos',
    period: 'Até a cerimônia de 2026',
    source: 'Recording Academy',
    sourceUrl: 'https://en.wikipedia.org/wiki/Grammy_Award_milestones',
    note: 'Considera prêmios competitivos creditados pela Recording Academy. Empates recebem a mesma posição.',
    items: rankingItems(`
1|Beyoncé|35 Grammys
2|Georg Solti|31 Grammys
3|Chick Corea|29 Grammys
4|Quincy Jones|28 Grammys
5|Alison Krauss|27 Grammys
5|Kendrick Lamar|27 Grammys
5|John Williams|27 Grammys
8|Pierre Boulez|26 Grammys
9|Vladimir Horowitz|25 Grammys
9|Stevie Wonder|25 Grammys`),
  },
  {
    slug: 'artistas-mais-numero-um-billboard',
    title: 'Artistas com mais músicas em primeiro lugar na Billboard',
    category: 'Música',
    metric: 'Singles que chegaram ao número 1 da Hot 100',
    period: 'Até setembro de 2026',
    source: 'Billboard',
    sourceUrl: 'https://www.billboard.com/lists/artists-most-number-one-hits-all-time-hot-100/',
    note: 'Segue as regras de crédito da Billboard Hot 100. Participações contam quando o artista é oficialmente creditado na faixa.',
    items: rankingItems(`
1|The Beatles|20 músicas
2|Mariah Carey|19 músicas
3|Taylor Swift|15 músicas
4|Drake|14 músicas
4|Rihanna|14 músicas
6|Michael Jackson|13 músicas
7|The Supremes|12 músicas
7|Madonna|12 músicas
9|Whitney Houston|11 músicas
9|Janet Jackson|11 músicas`),
  },
  {
    slug: 'turnes-maior-bilheteria',
    title: 'Turnês de maior bilheteria da história',
    category: 'Música',
    metric: 'Bilheteria nominal acumulada',
    period: 'Consulta em 8 de setembro de 2026',
    source: 'Billboard Boxscore e Pollstar',
    sourceUrl: 'https://en.wikipedia.org/wiki/List_of_highest-grossing_concert_tours',
    note: 'Valores sem correção pela inflação. Turnês ainda em andamento ou com relatórios parciais aparecem com valores aproximados.',
    items: rankingItems(`
1|The Eras Tour — Taylor Swift|US$ 2,078 bi
2|Music of the Spheres World Tour — Coldplay|~US$ 1,524 bi
3|Farewell Yellow Brick Road — Elton John|US$ 939,1 mi
4|Mathematics Tour — Ed Sheeran|~US$ 875,7 mi
5|The ÷ Tour — Ed Sheeran|US$ 776,2 mi
6|U2 360° Tour — U2|US$ 736,4 mi
7|2023–2025 Tour — Bruce Springsteen|~US$ 729,7 mi
8|After Hours til Dawn Tour — The Weeknd|~US$ 693,3 mi
9|Love on Tour — Harry Styles|US$ 617,3 mi
10|Summer Carnival — Pink|US$ 584,7 mi`),
  },
  {
    slug: 'videoclipes-mais-vistos-youtube',
    title: 'Videoclipes mais vistos no YouTube',
    category: 'Música',
    metric: 'Visualizações acumuladas',
    period: '13 de julho de 2026',
    source: 'YouTube via RouteNote',
    sourceUrl: 'https://routenote.com/blog/most-viewed-music-videos/',
    note: 'A lista considera videoclipes musicais completos. As contagens são aproximadas e continuam mudando diariamente.',
    items: rankingItems(`
1|Despacito — Luis Fonsi e Daddy Yankee|~9,07 bi
2|See You Again — Wiz Khalifa e Charlie Puth|~7,03 bi
3|Shape of You — Ed Sheeran|~6,76 bi
4|Axel F — Crazy Frog|~6,03 bi
5|Gangnam Style — PSY|~5,99 bi
6|Uptown Funk — Mark Ronson e Bruno Mars|~5,85 bi
7|Dame Tu Cosita — El Chombo|~5,54 bi
8|Waka Waka — Shakira|~4,64 bi
9|Counting Stars — OneRepublic|~4,46 bi
10|Sugar — Maroon 5|~4,40 bi`),
  },
  {
    slug: 'artistas-brasileiros-mais-latin-grammys',
    title: 'Artistas brasileiros com mais Latin Grammys',
    category: 'Música',
    metric: 'Prêmios Latin Grammy competitivos',
    period: 'Até a 26ª edição, em 2025',
    source: 'Latin Recording Academy',
    sourceUrl: 'https://www.latingrammy.com/en/artists/caetano-veloso-23182/',
    note: 'Compilação dos perfis oficiais de artistas. Créditos compartilhados contam quando a Academia registra o artista como vencedor; empates mantêm a mesma posição.',
    items: rankingItems(`
1|Caetano Veloso|12 Latin Grammys
2|Maria Rita|8 Latin Grammys
3|Lenine|7 Latin Grammys
4|Gilberto Gil|6 Latin Grammys
5|Hamilton de Holanda|5 Latin Grammys
5|Marisa Monte|5 Latin Grammys
7|Ivan Lins|4 Latin Grammys
7|Liniker|4 Latin Grammys
7|Roberto Carlos|4 Latin Grammys
7|Chico Buarque|4 Latin Grammys`),
  },
  {
    slug: 'bandas-rock-mais-ouvintes-spotify',
    title: 'Bandas de rock mais ouvidas no Spotify',
    category: 'Música',
    metric: 'Ouvintes mensais',
    period: 'Consulta em 8 de setembro de 2026',
    source: 'Spotify via Soundcharts',
    sourceUrl: 'https://soundcharts.com/en/artists/spotify-monthly-listeners/genre/rock',
    note: 'Recorte de bandas e grupos classificados como rock pela fonte; artistas solo foram excluídos. Números arredondados e sujeitos a mudança diária.',
    items: rankingItems(`
1|Coldplay|~94 mi
2|Maroon 5|~81 mi
3|Linkin Park|~57 mi
4|Arctic Monkeys|~56 mi
5|Imagine Dragons|~54 mi
6|Fleetwood Mac|~52 mi
7|OneRepublic|~49 mi
8|Queen|~48 mi
8|Red Hot Chili Peppers|~48 mi
10|The Neighbourhood|~47 mi`),
  },
  {
    slug: 'musicas-mais-semanas-numero-um-billboard',
    title: 'Músicas com mais semanas em primeiro lugar na Billboard',
    category: 'Música',
    metric: 'Semanas no número 1 da Hot 100',
    period: 'Parada datada de 5 de setembro de 2026',
    source: 'Billboard',
    sourceUrl: 'https://www.billboard.com/lists/hot-100-number-1-songs-on-top-longest/',
    note: 'Há outras músicas empatadas com 14 semanas. O corte mostra três delas para manter a lista em dez faixas.',
    items: rankingItems(`
1|All I Want for Christmas Is You — Mariah Carey|22 semanas
2|Choosin’ Texas — Ella Langley|20 semanas
3|Old Town Road — Lil Nas X e Billy Ray Cyrus|19 semanas
3|A Bar Song (Tipsy) — Shaboozey|19 semanas
5|One Sweet Day — Mariah Carey e Boyz II Men|16 semanas
5|Despacito — Luis Fonsi, Daddy Yankee e Justin Bieber|16 semanas
7|As It Was — Harry Styles|15 semanas
8|I Will Always Love You — Whitney Houston|14 semanas
8|I’ll Make Love to You — Boyz II Men|14 semanas
8|Macarena — Los del Río|14 semanas`),
  },
  {
    slug: 'sites-mais-acessados-mundo',
    title: 'Sites mais acessados do mundo',
    category: 'Internet',
    metric: 'Posição por tráfego total estimado',
    period: 'Agosto de 2026',
    source: 'Similarweb',
    sourceUrl: 'https://www.similarweb.com/top-websites/',
    note: 'Estimativa de tráfego em computadores e dispositivos móveis. Serviços sem site público comparável ou tráfego mensurável podem não aparecer.',
    items: rankingItems(`
1|Google|1º lugar
2|YouTube|2º lugar
3|Facebook|3º lugar
4|Instagram|4º lugar
5|ChatGPT|5º lugar
6|X|6º lugar
7|Reddit|7º lugar
8|WhatsApp|8º lugar
9|Wikipedia|9º lugar
10|Yahoo|10º lugar`),
  },
  {
    slug: 'redes-sociais-mais-usuarios',
    title: 'Redes sociais com mais usuários no mundo',
    category: 'Internet',
    metric: 'Usuários ativos mensais',
    period: 'Dados disponíveis em 2026',
    source: 'Relatórios das plataformas via Skillademia',
    sourceUrl: 'https://www.skillademia.com/statistics/most-popular-social-media-platforms/',
    note: 'Valores aproximados, divulgados em datas diferentes e com definições próprias de usuário ativo. Plataformas empatadas mantêm a mesma posição.',
    items: rankingItems(`
1|Facebook|~3,07 bi
2|Instagram|~3,00 bi
2|WhatsApp|~3,00 bi
4|YouTube|~2,50 bi
5|TikTok|~1,90 bi
6|WeChat|~1,41 bi
7|Facebook Messenger|~1,00 bi
7|Telegram|~1,00 bi
9|Snapchat|~956 mi
10|Reddit|~850 mi`),
  },
  {
    slug: 'apps-mais-baixados-mundo',
    title: 'Aplicativos mais baixados do mundo',
    category: 'Tecnologia',
    metric: 'Downloads mensais estimados',
    period: 'Outubro de 2025',
    source: 'Appfigures via Backlinko',
    sourceUrl: 'https://backlinko.com/most-popular-apps',
    note: 'Estimativas combinadas da App Store e do Google Play, incluindo versões Lite quando a fonte as agrega. Empates mantêm a mesma posição.',
    items: rankingItems(`
1|Instagram|~52 mi
2|TikTok|~42 mi
3|Facebook|~36 mi
3|WhatsApp|~36 mi
3|Temu|~36 mi
6|Threads|~33 mi
7|ChatGPT|~32 mi
8|Telegram|~24 mi
9|CapCut|~23 mi
10|Meesho|~21 mi`),
  },
  {
    slug: 'fabricantes-smartphones-maior-participacao',
    title: 'Fabricantes de smartphones com maior participação global',
    category: 'Tecnologia',
    metric: 'Participação nos embarques mundiais',
    period: 'Ano de 2025',
    source: 'Omdia',
    sourceUrl:
      'https://www.linkedin.com/posts/runar-bjorhovde_who-where-the-top-10-smartphone-makers-in-activity-7422621809944215553-50SW',
    note: 'Participações arredondadas; por isso marcas com o mesmo percentual podem ter posições diferentes. OPPO inclui OnePlus, vivo inclui iQOO e Transsion reúne Tecno, Infinix e itel.',
    items: rankingItems(`
1|Apple|~19%
2|Samsung|~19%
3|Xiaomi|~13%
4|vivo|~8%
5|OPPO|~8%
6|Transsion|~8%
7|Honor|~6%
8|Lenovo / Motorola|~5%
9|Huawei|~4%
10|realme|~3%`),
  },
  {
    slug: 'versoes-sistemas-operacionais-mais-usadas',
    title: 'Versões de sistemas operacionais mais usadas',
    category: 'Tecnologia',
    metric: 'Participação nas páginas vistas',
    period: 'Agosto de 2026',
    source: 'Statcounter Global Stats',
    sourceUrl: 'https://gs.statcounter.com/os-market-share/all/worldwide/',
    note: 'Mede páginas vistas na rede da Statcounter em computadores, celulares e tablets. A categoria “desconhecido” foi retirada; macOS e OS X seguem a nomenclatura técnica da fonte.',
    items: rankingItems(`
1|Android|34,01%
2|iOS|16,85%
3|Windows 11|16,12%
4|Windows 10|7,08%
5|macOS|5,62%
6|OS X|4,31%
7|Linux|3,28%
8|Chrome OS|0,58%
9|Windows 7|0,22%
10|Windows XP|0,03%`),
  },
  {
    slug: 'navegadores-mais-usados',
    title: 'Navegadores mais usados no mundo',
    category: 'Tecnologia',
    metric: 'Participação nas páginas vistas',
    period: 'Agosto de 2026',
    source: 'Statcounter Global Stats',
    sourceUrl: 'https://gs.statcounter.com/browser-market-share',
    note: 'Participação estimada com base em páginas vistas em computadores, celulares e tablets na rede de medição da Statcounter.',
    items: rankingItems(`
1|Chrome|69,30%
2|Safari|15,92%
3|Edge|5,37%
4|Firefox|2,98%
5|Samsung Internet|2,02%
6|Opera|1,93%
7|UC Browser|0,62%
8|Brave|0,57%
9|Yandex Browser|0,28%
10|Android Browser|0,24%`),
  },
  {
    slug: 'linguagens-programacao-mais-populares',
    title: 'Linguagens de programação mais populares',
    category: 'Tecnologia',
    metric: 'Posição no índice TIOBE',
    period: 'Setembro de 2026',
    source: 'TIOBE Index',
    sourceUrl: 'https://www.tiobe.com/tiobe-index/',
    note: 'O índice mede presença em resultados de busca, cursos, profissionais e fornecedores. Não representa diretamente linhas de código nem preferência de desenvolvedores.',
    items: rankingItems(`
1|Python|1º lugar
2|C|2º lugar
3|C++|3º lugar
4|Java|4º lugar
5|C#|5º lugar
6|JavaScript|6º lugar
7|Visual Basic|7º lugar
8|SQL|8º lugar
9|R|9º lugar
10|Rust|10º lugar`),
  },
  {
    slug: 'supercomputadores-mais-rapidos',
    title: 'Supercomputadores mais rápidos do mundo',
    category: 'Tecnologia',
    metric: 'Desempenho no benchmark HPL Rmax',
    period: 'TOP500 de junho de 2026',
    source: 'TOP500',
    sourceUrl: 'https://top500.org/lists/top500/list/2026/06/',
    note: 'Desempenho medido em petaflops no benchmark Linpack de alta performance. Valores com ~ foram arredondados a partir da lista oficial.',
    items: rankingItems(`
1|LineShine|2.198,4 PFLOPS
2|El Capitan|~1.809 PFLOPS
3|Frontier|~1.353 PFLOPS
4|Aurora|~1.012 PFLOPS
5|JUPITER Booster|~1.000 PFLOPS
6|Eagle|~561,2 PFLOPS
7|HPC6|~477,9 PFLOPS
8|Fugaku|442,0 PFLOPS
9|Alps|~435,0 PFLOPS
10|LUMI|379,7 PFLOPS`),
  },
  {
    slug: 'cidades-mais-visitadas-mundo',
    title: 'Cidades mais visitadas do mundo',
    category: 'Viagem',
    metric: 'Chegadas internacionais',
    period: 'Estimativas de 2025',
    source: 'Euromonitor International',
    sourceUrl: 'https://en.wikipedia.org/wiki/List_of_cities_by_international_visitors',
    note: 'Estimativas de chegadas internacionais, não de pessoas únicas. Um mesmo viajante pode gerar mais de uma chegada durante o ano.',
    items: rankingItems(`
1|Bangkok, Tailândia|~30,3 mi
2|Hong Kong|~23,2 mi
3|Londres, Reino Unido|~22,7 mi
4|Macau|~20,4 mi
5|Istambul, Turquia|~19,7 mi
6|Dubai, Emirados Árabes Unidos|~19,5 mi
7|Meca, Arábia Saudita|~18,7 mi
8|Antália, Turquia|~18,6 mi
9|Paris, França|~18,3 mi
10|Kuala Lumpur, Malásia|~17,3 mi`),
  },
  {
    slug: 'aeroportos-mais-movimentados-mundo',
    title: 'Aeroportos mais movimentados do mundo',
    category: 'Viagem',
    metric: 'Total de passageiros',
    period: 'Resultados preliminares de 2025',
    source: 'Airports Council International',
    sourceUrl:
      'https://aci.aero/2026/04/14/worlds-busiest-airports-revealed-in-latest-global-rankings/',
    note: 'Soma passageiros embarcados, desembarcados e em conexão direta conforme o padrão do ACI.',
    items: rankingItems(`
1|Atlanta — ATL|106.302.208 passageiros
2|Dubai — DXB|95.192.160 passageiros
3|Tóquio Haneda — HND|91.679.814 passageiros
4|Dallas/Fort Worth — DFW|85.660.127 passageiros
5|Xangai Pudong — PVG|84.994.227 passageiros
6|Chicago O’Hare — ORD|84.814.099 passageiros
7|Londres Heathrow — LHR|84.482.126 passageiros
8|Istambul — IST|84.437.710 passageiros
9|Guangzhou Baiyun — CAN|83.582.952 passageiros
10|Denver — DEN|82.427.962 passageiros`),
  },
  {
    slug: 'melhores-companhias-aereas',
    title: 'Melhores companhias aéreas do mundo',
    category: 'Viagem',
    metric: 'Posição no World Airline Awards',
    period: 'Edição de 2025, a mais recente concluída',
    source: 'Skytrax',
    sourceUrl: 'https://www.worldairlineawards.com/',
    note: 'Ranking baseado na pesquisa global de satisfação de passageiros da Skytrax. A edição de 2026 estava marcada para 18 de setembro e ainda não havia sido publicada na data desta atualização.',
    items: rankingItems(`
1|Qatar Airways|1º lugar
2|Singapore Airlines|2º lugar
3|Cathay Pacific Airways|3º lugar
4|Emirates|4º lugar
5|ANA All Nippon Airways|5º lugar
6|Turkish Airlines|6º lugar
7|Korean Air|7º lugar
8|Air France|8º lugar
9|Japan Airlines|9º lugar
10|Hainan Airlines|10º lugar`),
  },
  {
    slug: 'melhores-aeroportos-mundo',
    title: 'Melhores aeroportos do mundo',
    category: 'Viagem',
    metric: 'Posição no World Airport Awards',
    period: 'Edição de 2026',
    source: 'Skytrax',
    sourceUrl: 'https://www.worldairportawards.com/worlds-top-100-airports-2026/',
    note: 'Resultado de pesquisa de satisfação realizada com viajantes entre agosto de 2025 e fevereiro de 2026. Hamad International retirou-se da premiação nesta edição.',
    items: rankingItems(`
1|Singapore Changi|1º lugar
2|Seoul Incheon|2º lugar
3|Tokyo Haneda|3º lugar
4|Hong Kong International|4º lugar
5|Tokyo Narita|5º lugar
6|Paris Charles de Gaulle|6º lugar
7|Rome Fiumicino|7º lugar
8|Istanbul Airport|8º lugar
9|Munich Airport|9º lugar
10|Vancouver International|10º lugar`),
  },
  {
    slug: 'melhores-praias-mundo',
    title: 'Melhores praias do mundo',
    category: 'Viagem',
    metric: 'Posição na lista The World’s 50 Best Beaches',
    period: 'Edição de 2026',
    source: 'The World’s 50 Best Beaches',
    sourceUrl: 'https://worlds50beaches.com/top-50-worlds-best-beaches/',
    note: 'Seleção editorial baseada nos votos de especialistas e embaixadores de viagem; não é uma medição objetiva de qualidade.',
    items: rankingItems(`
1|Entalula Beach — Filipinas|1º lugar
2|Fteri Beach — Grécia|2º lugar
3|Wharton Beach — Austrália|3º lugar
4|Nosy Iranja — Madagascar|4º lugar
5|Mamanuca Beach — Fiji|5º lugar
6|Shoal Bay East — Anguilla|6º lugar
7|Dhigurah — Maldivas|7º lugar
8|Playa Balandra — México|8º lugar
9|Koh Rong — Camboja|9º lugar
10|Donald Duck Bay — Tailândia|10º lugar`),
  },
  {
    slug: 'parques-tematicos-mais-visitados',
    title: 'Parques temáticos mais visitados do mundo',
    category: 'Viagem',
    metric: 'Visitas anuais estimadas',
    period: 'Global Experience Index 2024',
    source: 'TEA e AECOM',
    sourceUrl: 'https://roar-assets-auto.rbl.ms/files/87311/Global%20Experience%20Index%202024.pdf',
    note: 'Estimativas de público produzidas pela Themed Entertainment Association e pela AECOM para parques individuais.',
    items: rankingItems(`
1|Magic Kingdom — Estados Unidos|17,836 mi
2|Disneyland Park — Estados Unidos|17,337 mi
3|Universal Studios Japan — Japão|16,000 mi
4|Tokyo Disneyland — Japão|15,104 mi
5|Shanghai Disneyland — China|14,700 mi
6|Chimelong Ocean Kingdom — China|12,628 mi
7|Tokyo DisneySea — Japão|12,441 mi
8|Epcot — Estados Unidos|12,133 mi
9|Disney’s Hollywood Studios — Estados Unidos|10,333 mi
10|Disneyland Paris — França|10,214 mi`),
  },
  {
    slug: 'paises-maior-receita-turismo',
    title: 'Países com maior receita do turismo internacional',
    category: 'Viagem',
    metric: 'Receitas de turismo internacional',
    period: 'Ano de 2024',
    source: 'UN Tourism',
    sourceUrl: 'https://en.wikipedia.org/wiki/World_Tourism_rankings',
    note: 'Receitas em dólares correntes obtidas de visitantes internacionais. O ano de 2024 é o último com dez países comparáveis na mesma tabela.',
    items: rankingItems(`
1|Estados Unidos|US$ 215,0 bi
2|Espanha|US$ 106,5 bi
3|Reino Unido|US$ 84,5 bi
4|França|US$ 77,1 bi
5|Itália|US$ 58,7 bi
6|Emirados Árabes Unidos|US$ 57,0 bi
7|Turquia|US$ 56,3 bi
8|Japão|US$ 54,7 bi
9|Austrália|US$ 52,0 bi
10|Canadá|US$ 51,4 bi`),
  },
  {
    slug: 'destinos-internacionais-mais-procurados-brasileiros',
    title: 'Destinos internacionais mais procurados por brasileiros',
    category: 'Viagem',
    metric: 'Posição entre as buscas de voos no KAYAK',
    period: 'Verão de 2025–2026',
    source: 'KAYAK via Times Brasil',
    sourceUrl:
      'https://timesbrasil.com.br/brasil/destinos-internacionais-mais-procurados-brasileiros-2025/',
    note: 'Ordem baseada no volume de buscas de voos feitas no Brasil para o verão. A fonte não divulgou o número absoluto de consultas.',
    items: rankingItems(`
1|Orlando, Estados Unidos|1º lugar
2|Miami, Estados Unidos|2º lugar
3|Lisboa, Portugal|3º lugar
4|Madri, Espanha|4º lugar
5|Paris, França|5º lugar
6|Buenos Aires, Argentina|6º lugar
7|Nova York, Estados Unidos|7º lugar
8|Roma, Itália|8º lugar
9|Santiago, Chile|9º lugar
10|Londres, Reino Unido|10º lugar`),
  },
  {
    slug: 'melhores-pizzarias-mundo',
    title: 'Melhores pizzarias do mundo',
    category: 'Gastronomia',
    metric: 'Posição no 50 Top Pizza World',
    period: 'Edição de 2025',
    source: '50 Top Pizza',
    sourceUrl: 'https://www.50toppizza.it/press-50-top-pizza-world-2025/',
    note: 'Ranking editorial elaborado por inspetores anônimos. Empates oficiais conservam a mesma posição; dez estabelecimentos ocupam as oito primeiras posições.',
    items: rankingItems(`
1|Una Pizza Napoletana — Nova York|1º lugar
1|I Masanielli — Francesco Martucci — Caserta|1º lugar
2|The Pizza Bar on 38th — Tóquio|2º lugar
3|Leggera Pizza Napoletana — São Paulo|3º lugar
4|Confine — Milão|4º lugar
4|Diego Vitagliano Pizzeria — Nápoles|4º lugar
5|Napoli on the Road — Londres|5º lugar
6|Seu Pizza Illuminati — Roma|6º lugar
7|I Tigli — San Bonifacio|7º lugar
8|Baldoria — Madri|8º lugar`),
  },
  {
    slug: 'melhores-bares-mundo',
    title: 'Melhores bares do mundo',
    category: 'Gastronomia',
    metric: 'Posição no The World’s 50 Best Bars',
    period: 'Edição de 2025',
    source: 'The World’s 50 Best Bars',
    sourceUrl: 'https://www.worlds50bestbars.com/list/1-50',
    note: 'Lista formada pelos votos confidenciais de mais de 800 especialistas internacionais em bebidas e hospitalidade.',
    items: rankingItems(`
1|Bar Leone — Hong Kong|1º lugar
2|Handshake Speakeasy — Cidade do México|2º lugar
3|Sips — Barcelona|3º lugar
4|Paradiso — Barcelona|4º lugar
5|Tayēr + Elementary — Londres|5º lugar
6|Connaught Bar — Londres|6º lugar
7|Moebius Milano — Milão|7º lugar
8|Line — Atenas|8º lugar
9|Jigger & Pony — Singapura|9º lugar
10|Tres Monos — Buenos Aires|10º lugar`),
  },
  {
    slug: 'paises-mais-restaurantes-uma-estrela-michelin',
    title: 'Países com mais restaurantes de uma estrela Michelin',
    category: 'Gastronomia',
    metric: 'Restaurantes com uma estrela',
    period: 'Guias disponíveis em 5 de fevereiro de 2026',
    source: 'Michelin via Statbase',
    sourceUrl: 'https://statbase.org/datasets/retail/number-of-restaurants-with-michelin-stars/',
    note: 'A cobertura do Guia Michelin não é mundial e as edições locais são publicadas em datas diferentes. A contagem considera somente restaurantes com exatamente uma estrela.',
    items: rankingItems(`
1|França|552 restaurantes
2|Itália|341 restaurantes
3|Alemanha|275 restaurantes
4|Japão|273 restaurantes
5|Espanha|251 restaurantes
6|Estados Unidos|224 restaurantes
7|Reino Unido|160 restaurantes
8|China continental|116 restaurantes
9|Suíça|111 restaurantes
10|Bélgica|104 restaurantes`),
  },
  {
    slug: 'cidades-mais-restaurantes-michelin',
    title: 'Cidades com mais restaurantes estrelados Michelin',
    category: 'Gastronomia',
    metric: 'Posição na compilação internacional',
    period: 'Lista publicada em 8 de outubro de 2025',
    source: 'Times of India',
    sourceUrl:
      'https://timesofindia.indiatimes.com/life-style/food-news/top-10-michelin-starred-cities-around-the-world/photostory/124376151.cms',
    note: 'A compilação usa as edições locais então disponíveis do Guia Michelin. Como calendários e limites urbanos variam, a posição é mais comparável que uma soma global única.',
    items: rankingItems(`
1|Tóquio, Japão|1º lugar
2|Paris, França|2º lugar
3|Kyoto, Japão|3º lugar
4|Osaka, Japão|4º lugar
5|Nova York, Estados Unidos|5º lugar
6|Londres, Reino Unido|6º lugar
7|Hong Kong|7º lugar
8|Singapura|8º lugar
9|Xangai, China|9º lugar
10|Seul, Coreia do Sul|10º lugar`),
  },
  {
    slug: 'melhores-pratos-mundo',
    title: 'Melhores pratos do mundo',
    category: 'Gastronomia',
    metric: 'Nota dos usuários do TasteAtlas',
    period: 'TasteAtlas Awards 2025–2026',
    source: 'TasteAtlas',
    sourceUrl: 'https://www.tasteatlas.com/best/dishes',
    note: 'Notas do público filtradas pelo TasteAtlas para reduzir votos de bots e nacionalismo gastronômico. A própria fonte diz que o resultado não deve ser tratado como conclusão definitiva.',
    items: rankingItems(`
1|Vori-vori — Paraguai|4,64/5
2|Pizza Napoletana — Itália|4,58/5
3|Tajarin al tartufo bianco d’Alba — Itália|4,52/5
4|Sate kambing — Indonésia|4,52/5
5|Oltu cağ kebabı — Turquia|4,51/5
6|Kontosouvli — Grécia|4,51/5
7|Arroz tapado — Peru|4,50/5
8|Komplet lepinja — Sérvia|4,50/5
9|Quesabirria — México|4,49/5
10|Pappardelle al cinghiale — Itália|4,47/5`),
  },
  {
    slug: 'melhores-comidas-de-rua',
    title: 'Melhores comidas de rua do mundo',
    category: 'Gastronomia',
    metric: 'Nota dos usuários do TasteAtlas',
    period: 'Consulta em 15 de agosto de 2026',
    source: 'TasteAtlas',
    sourceUrl: 'https://www.tasteatlas.com/best-rated-street-foods-in-the-world',
    note: 'Avaliações do público filtradas pela plataforma. Notas arredondadas podem produzir empates aparentes, mantendo-se a ordem calculada pelo TasteAtlas.',
    items: rankingItems(`
1|Karantika — Argélia|4,6/5
2|Kontosouvli — Grécia|4,6/5
3|Sate kambing — Indonésia|4,5/5
4|Quesabirria — México|4,5/5
5|Guotie — China|4,5/5
6|Ta’ameya — Egito|4,5/5
7|Bánh mì heo quay — Vietnã|4,5/5
8|Anticuchos de corazón — Peru|4,5/5
9|Siu mei — China|4,4/5
10|Amritsari kulcha — Índia|4,4/5`),
  },
  {
    slug: 'melhores-queijos-mundo',
    title: 'Melhores queijos do mundo',
    category: 'Gastronomia',
    metric: 'Nota dos usuários do TasteAtlas',
    period: 'Consulta em 2 de setembro de 2026',
    source: 'TasteAtlas',
    sourceUrl: 'https://www.tasteatlas.com/best-rated-cheeses-in-the-world',
    note: 'Avaliações do público filtradas pela plataforma. Notas exibidas com uma casa decimal podem parecer empatadas sem alterar a ordem calculada.',
    items: rankingItems(`
1|Graviera Naxou — Grécia|4,6/5
2|Parmigiano Reggiano — Itália|4,6/5
3|Queijo de Azeitão — Portugal|4,6/5
4|Mozzarella di Bufala Campana — Itália|4,5/5
5|Queijo Serra da Estrela — Portugal|4,5/5
6|Graviera Kritis — Grécia|4,5/5
7|Pecorino Sardo — Itália|4,5/5
8|Kefalograviera — Grécia|4,4/5
9|Burrata — Itália|4,4/5
10|Saint-Félicien — França|4,4/5`),
  },
  {
    slug: 'melhores-sobremesas-mundo',
    title: 'Melhores sobremesas do mundo',
    category: 'Gastronomia',
    metric: 'Nota dos usuários do TasteAtlas',
    period: 'Consulta em 15 de agosto de 2026',
    source: 'TasteAtlas',
    sourceUrl: 'https://www.tasteatlas.com/best-rated-desserts-in-the-world',
    note: 'Avaliações do público filtradas pela plataforma. Notas arredondadas podem produzir empates aparentes, mantendo-se a ordem calculada pelo TasteAtlas.',
    items: rankingItems(`
1|Pastel de Belém — Portugal|4,6/5
2|Pastel de nata — Portugal|4,5/5
3|Antakya künefesi — Turquia|4,5/5
4|Clotted cream ice cream — Reino Unido|4,5/5
5|Gelato al pistacchio — Itália|4,5/5
6|Strudel Trentino — Itália|4,5/5
7|Fıstıklı sarma — Turquia|4,4/5
8|Tembleque — Porto Rico|4,4/5
9|Gaziantep baklavası — Turquia|4,4/5
10|Crêpes sucrées — França|4,4/5`),
  },
]);
