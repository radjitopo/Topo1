function rankingItems(block) {
  return block
    .trim()
    .split('\n')
    .map((line) => {
      const [rank, name, value] = line.split('|');
      return { rank, name, value };
    });
}

export const SPEED_DISCOVER_RANKINGS = Object.freeze([
  {
    slug: 'homens-mais-rapidos-100-metros',
    title: 'Homens mais rápidos nos 100 metros',
    category: 'Velocidade',
    metric: 'Melhor tempo individual com vento regulamentar',
    period: 'Marcas homologadas consultadas em 10 de setembro de 2026',
    source: 'World Athletics',
    sourceUrl:
      'https://worldathletics.org/records/all-time-toplists/sprints/100-metres/outdoor/men/senior',
    note: 'Considera a melhor marca ao ar livre de cada atleta, com vento de até 2,0 m/s. Empates recebem a mesma posição; Ferdinand Omanyala e Oblique Seville dividem a décima linha com 9,77 s.',
    valueLabel: 'TEMPO',
    items: rankingItems(`
1|Usain Bolt|9,58 s
2|Tyson Gay|9,69 s
2|Yohan Blake|9,69 s
4|Asafa Powell|9,72 s
5|Justin Gatlin|9,74 s
6|Kishane Thompson|9,75 s
7|Christian Coleman|9,76 s
7|Trayvon Bromell|9,76 s
7|Fred Kerley|9,76 s
10|Ferdinand Omanyala e Oblique Seville|9,77 s cada`),
  },
  {
    slug: 'animais-maiores-velocidades-publicadas',
    title: 'Animais com as maiores velocidades publicadas',
    category: 'Velocidade',
    metric: 'Maior velocidade máxima citada para cada espécie',
    period: 'Compilação consultada em 10 de setembro de 2026',
    source: 'Estudos e registros zoológicos compilados',
    sourceUrl: 'https://en.wikipedia.org/wiki/Fastest_animals',
    note: 'A comparação reúne mergulho, voo horizontal e natação, modalidades que não são equivalentes. São máximas publicadas, não um teste controlado entre espécies; a estimativa do marlim-negro é especialmente incerta.',
    valueLabel: 'VELOCIDADE',
    items: rankingItems(`
1|Falcão-peregrino — mergulho|389 km/h
2|Águia-real — mergulho|até 320 km/h
3|Falcão-gerifalte — mergulho|209 km/h
4|Andorinhão-de-cauda-agulha — voo horizontal|169 km/h
5|Ógea-eurasiática — voo|160 km/h
5|Morcego-brasileiro-de-cauda-livre — voo horizontal|160 km/h
7|Fragata — voo|153 km/h
8|Pombo-comum — voo|148,9 km/h
9|Ganso-de-esporão — voo|142 km/h
10|Marlim-negro — natação|129 km/h`),
  },
  {
    slug: 'animais-marinhos-maiores-velocidades-publicadas',
    title: 'Animais marinhos com as maiores velocidades publicadas',
    category: 'Velocidade',
    metric: 'Maior velocidade máxima citada para cada espécie',
    period: 'Compilação consultada em 10 de setembro de 2026',
    source: 'Estudos e registros zoológicos compilados',
    sourceUrl: 'https://en.wikipedia.org/wiki/Fastest_animals#Fish',
    note: 'Velocidades máximas de animais marinhos são difíceis de medir em condições comparáveis. Os números de marlim-negro, agulhão-vela e peixe-espada são estimativas históricas contestadas; nos demais casos, foi usado o maior valor da faixa publicada.',
    valueLabel: 'VELOCIDADE',
    items: rankingItems(`
1|Marlim-negro|129 km/h
2|Agulhão-vela|109,19 km/h
3|Peixe-espada|97 km/h
4|Atum-amarelo|76 km/h
5|Tubarão-mako|72 km/h
6|Orca|56 km/h
7|Baleia-sei|até 55 km/h
8|Baleia-fin|até 50 km/h
9|Baleia-azul|até 48 km/h
10|Baleia-piloto|41 km/h`),
  },
  {
    slug: 'aeronaves-tripuladas-maiores-registros-velocidade',
    title: 'Aeronaves tripuladas com os maiores registros de velocidade',
    category: 'Velocidade',
    metric: 'Velocidade registrada em voo',
    period: 'Registros históricos consultados em 10 de setembro de 2026',
    source: 'FAI e registros aeronáuticos compilados',
    sourceUrl: 'https://en.wikipedia.org/wiki/List_of_flight_airspeed_records',
    note: 'Inclui o avião-foguete X-15 e os maiores registros da progressão oficial de aviões. Não entram espaçonaves em reentrada, veículos não tripulados, velocidades de projeto nem alegações não homologadas.',
    valueLabel: 'VELOCIDADE',
    items: rankingItems(`
1|North American X-15 — 1967|7.274 km/h
2|Lockheed SR-71 Blackbird — 1976|3.529,6 km/h
3|Lockheed YF-12A — 1965|3.331,5 km/h
4|Mikoyan-Gurevich Ye-166 — 1962|2.681 km/h
5|McDonnell-Douglas F4H-1F Phantom II — 1961|2.585,1 km/h
6|Convair F-106 Delta Dart — 1959|2.455,7 km/h
7|Mikoyan-Gurevich Ye-66 — 1959|2.388 km/h
8|Nord 1500 Griffon — 1959|2.320 km/h
9|Lockheed YF-104A Starfighter — 1958|2.259,538 km/h
10|McDonnell F-101A Voodoo — 1957|1.943,5 km/h`),
  },
  {
    slug: 'carros-producao-mais-rapidos-testes-reconhecidos',
    title: 'Carros de produção mais rápidos em testes reconhecidos',
    category: 'Velocidade',
    metric: 'Maior velocidade elegível na metodologia da fonte',
    period: 'Recordes e testes consultados em 10 de setembro de 2026',
    source: 'Guinness, verificadores e testes independentes compilados',
    sourceUrl: 'https://en.wikipedia.org/wiki/List_of_production_car_speed_records',
    note: 'A lista exige carro de rua produzido em série e uma medição aceita pela metodologia da fonte. Corridas só em uma direção ou com protótipo — como Yangwang U9 Xtreme e Bugatti Chiron Super Sport 300+ — ficam fora.',
    valueLabel: 'VELOCIDADE',
    items: rankingItems(`
1|SSC Tuatara — 2021|455,3 km/h
2|Koenigsegg Agera RS — 2017|447,19 km/h
3|Bugatti Veyron 16.4 Super Sport — 2010|431,072 km/h
4|SSC Ultimate Aero — 2007|412,22 km/h
5|Bugatti Veyron EB 16.4 — 2005|408,47 km/h
6|Dauer 962 Le Mans — medição de 1998|404,6 km/h
7|McLaren F1 — configuração de produção|356 km/h
8|RUF CTR — medição de 1988|342 km/h
9|Porsche 959 — medição de 1987|319 km/h
10|RUF BTR — 1983|305 km/h`),
  },
  {
    slug: 'maiores-recordes-velocidade-motocicletas',
    title: 'Maiores recordes terrestres de velocidade em motocicletas',
    category: 'Velocidade',
    metric: 'Média de duas passagens em sentidos opostos',
    period: 'Histórico oficial consultado em 10 de setembro de 2026',
    source: 'FIM e AMA — histórico compilado',
    sourceUrl: 'https://en.wikipedia.org/wiki/List_of_motorcycle_land-speed_records',
    note: 'São motocicletas especiais ou modificadas, sobretudo streamliners, e não modelos de produção. Cada linha é uma marca oficial; por isso a mesma máquina aparece novamente quando supera o próprio recorde.',
    valueLabel: 'VELOCIDADE',
    items: rankingItems(`
1|Ack Attack — Rocky Robinson, 2010|605,697 km/h
2|BUB Seven — Chris Carr, 2009|591,244 km/h
3|Ack Attack — Rocky Robinson, 2008|580,833 km/h
4|BUB Seven — Chris Carr, 2006|564,693 km/h
5|Ack Attack — Rocky Robinson, 2006|551,678 km/h
6|Easyriders — Dave Campos, 1990|518,450 km/h
7|Lightning Bolt — Don Vesco, 1978|509,757 km/h
8|Silver Bird — Don Vesco, 1975|487,515 km/h
9|Harley-Davidson Streamliner — Cal Rayborn, 1970|410,37 km/h
10|Big Red — Don Vesco, 1970|405,25 km/h`),
  },
  {
    slug: 'trens-passageiros-mais-rapidos-testes',
    title: 'Trens de passageiros mais rápidos em testes',
    category: 'Velocidade',
    metric: 'Maior velocidade registrada em teste',
    period: 'Registros consultados em 10 de setembro de 2026',
    source: 'Registros ferroviários e Guinness compilados',
    sourceUrl: 'https://en.wikipedia.org/wiki/List_of_speed_records_in_rail_transport',
    note: 'Inclui maglev, trens sobre rodas, protótipos e composições modificadas projetadas para passageiros. São picos de teste, não velocidades comerciais; aparece apenas a melhor marca de cada modelo ou composição.',
    valueLabel: 'VELOCIDADE',
    items: rankingItems(`
1|L0 Series — Japão, 2015|603 km/h
2|MLX01 — Japão, 2003|581 km/h
3|TGV POS 4402 / V150 — França, 2007|574,8 km/h
4|TGV Atlantique 325 — França, 1990|515,3 km/h
5|Transrapid SMT — China, 2003|501 km/h
6|CRH380BL — China, 2011|487,3 km/h
7|CRH380AL — China, 2010|486,1 km/h
8|CR400AF-J-0002 — China, 2023|453 km/h
9|Class 955 “300X” — Japão, 1996|443 km/h
10|Class 952/953 “STAR21” — Japão, 1993|425 km/h`),
  },
  {
    slug: 'maiores-recordes-mundiais-velocidade-agua',
    title: 'Maiores recordes mundiais de velocidade na água',
    category: 'Velocidade',
    metric: 'Velocidade média homologada',
    period: 'Histórico consultado em 10 de setembro de 2026',
    source: 'UIM — histórico do recorde mundial compilado',
    sourceUrl: 'https://en.wikipedia.org/wiki/List_of_water_speed_records',
    note: 'O recorde absoluto na água é homologado pela Union Internationale Motonautique. Cada linha representa uma marca oficial, geralmente a média de duas passagens; a mesma embarcação aparece quando melhora o próprio resultado.',
    valueLabel: 'VELOCIDADE',
    items: rankingItems(`
1|Spirit of Australia — Ken Warby, 1978|511,11 km/h
2|Spirit of Australia — Ken Warby, 1977|464,46 km/h
3|Hustler — Lee Taylor, 1967|459,02 km/h
4|Bluebird K7 — Donald Campbell, 1964|444,71 km/h
5|Bluebird K7 — Donald Campbell, 1959|418,99 km/h
6|Bluebird K7 — Donald Campbell, 1958|400,12 km/h
7|Bluebird K7 — Donald Campbell, 1957|384,75 km/h
8|Bluebird K7 — Donald Campbell, 1956|363,12 km/h
9|Bluebird K7 — Donald Campbell, novembro de 1955|347,94 km/h
10|Bluebird K7 — Donald Campbell, julho de 1955|325,60 km/h`),
  },
  {
    slug: 'montanhas-russas-aco-mais-rapidas-funcionamento',
    title: 'Montanhas-russas de aço mais rápidas em funcionamento',
    category: 'Velocidade',
    metric: 'Velocidade máxima anunciada',
    period: 'Situação consultada em 10 de setembro de 2026',
    source: 'Roller Coaster DataBase e registros compilados',
    sourceUrl: 'https://en.wikipedia.org/wiki/List_of_roller_coaster_rankings#Speed_rankings',
    note: 'Entram apenas montanhas-russas de aço operacionais na data da consulta. Projetos em construção e atrações marcadas como fora de operação foram excluídos; empates mantêm a mesma posição.',
    valueLabel: 'VELOCIDADE',
    items: rankingItems(`
1|Falcons Flight — Six Flags Qiddiya City|249,9 km/h
2|Formula Rossa — Ferrari World Abu Dhabi|240 km/h
3|Top Thrill 2 — Cedar Point|190 km/h
4|Red Force — Ferrari Land|179,9 km/h
5|Steel Dragon 2000 — Nagashima Spa Land|153 km/h
5|Fury 325 — Carowinds|153 km/h
7|Millennium Force — Cedar Point|150 km/h
8|Leviathan — Canada’s Wonderland|148 km/h
9|Orion — Kings Island|146 km/h
10|Pantherian — Kings Dominion|140 km/h`),
  },
  {
    slug: 'passagens-mais-rapidas-parker-solar-probe',
    title: 'Passagens mais rápidas da Parker Solar Probe',
    category: 'Velocidade',
    metric: 'Pico heliocêntrico aproximado no periélio',
    period: 'Passagens concluídas até 5 de setembro de 2026',
    source: 'NASA e Johns Hopkins Applied Physics Laboratory',
    sourceUrl: 'https://science.nasa.gov/mission/parker-solar-probe/',
    note: 'Todas as velocidades usam o mesmo referencial, em relação ao Sol. As oito passagens na órbita final empatam quando arredondadas e são ordenadas da mais recente para a mais antiga; assim evitamos comparar sondas medidas contra astros diferentes.',
    valueLabel: 'VELOCIDADE',
    items: rankingItems(`
1|29º periélio — 5 de setembro de 2026|~690.000 km/h
2|28º periélio — 8 de junho de 2026|~690.000 km/h
3|27º periélio — 11 de março de 2026|~690.000 km/h
4|26º periélio — 13 de dezembro de 2025|~690.000 km/h
5|25º periélio — 15 de setembro de 2025|~690.000 km/h
6|24º periélio — 19 de junho de 2025|~690.000 km/h
7|23º periélio — 22 de março de 2025|~690.000 km/h
8|22º periélio — 24 de dezembro de 2024|~690.000 km/h
9|21º periélio — 30 de setembro de 2024|~635.000 km/h
10|20º periélio — 30 de junho de 2024|~635.000 km/h`),
  },
]);
