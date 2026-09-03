import { readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const writeMode = process.argv.includes('--write');
const targetCount = 20;
const minimumUsableCount = 5;
const veganCategoryLabel = 'Restaurante/lanchonete vegano/vegetariano';
const baseCatalogRevision = '06a155cc5df656273cd17f27c63a39f0888afa95';
const execFileAsync = promisify(execFile);

const recheckedCitySlugs = [
  'guarulhos',
  'campinas',
  'sao-luis',
  'maceio',
  'campo-grande',
  'sao-goncalo',
  'teresina',
];

const [
  { stdout: baseCatalogJson },
  audit,
  veganFloripaRefresh,
  cafesFloripaRefresh,
  localOptionExclusions,
  ...recheckedCities
] = await Promise.all([
  execFileAsync('git', ['show', `${baseCatalogRevision}:data/local-catalog.json`], {
    maxBuffer: 16 * 1024 * 1024,
  }),
  readFile(new URL('../data/local-audit-candidates-2026-09.json', import.meta.url), 'utf8').then(
    JSON.parse,
  ),
  readFile(new URL('../data/vegan-floripa-refresh.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('../data/cafes-floripa-refresh.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('../data/local-option-exclusions.json', import.meta.url), 'utf8').then(
    JSON.parse,
  ),
  ...recheckedCitySlugs.map((citySlug) =>
    readFile(
      new URL(`../data/local-audit-recheck-${citySlug}-2026-09.json`, import.meta.url),
      'utf8',
    ).then(JSON.parse),
  ),
]);

const catalog = JSON.parse(baseCatalogJson);

const recheckedByCity = new Map(
  recheckedCitySlugs.map((citySlug, index) => [citySlug, recheckedCities[index]]),
);

const categoryQueries = {
  restaurants: 'melhores restaurantes',
  pizza: 'melhores pizzarias',
  burger: 'melhores hamburguerias',
  sushi: 'melhores restaurantes japoneses sushi',
  cafe: 'melhores cafeterias cafés especiais',
  bar: 'melhores bares',
  beauty: 'melhores salões de beleza',
  barber: 'melhores barbearias',
  gym: 'melhores academias',
  pet: 'melhores pet shops',
  italian: 'melhores restaurantes italianos',
  bakery: 'melhores padarias',
  buffet: 'melhores restaurantes por quilo self service',
  vegan: 'melhores restaurantes veganos vegetarianos',
  thrift: 'melhores brechós',
};

const sourceRegistry = {
  google_maps: {
    name: 'Google Maps',
    url: 'https://www.google.com/maps',
    use: 'operação atual, município, nota e volume de avaliações',
  },
  openstreetmap: {
    name: 'OpenStreetMap e Nominatim',
    url: 'https://www.openstreetmap.org/',
    use: 'catálogo-base, categoria e localização',
  },
  tripadvisor: {
    name: 'Tripadvisor Brasil',
    url: 'https://www.tripadvisor.com.br/',
    use: 'recorrência, avaliações e listas por especialidade',
  },
  happycow: {
    name: 'HappyCow',
    url: 'https://www.happycow.net/south_america/brazil/',
    use: 'validação de estabelecimentos veganos e vegetarianos',
  },
  veganizze: {
    name: 'Veganizze',
    url: 'https://veganizze.com.br/',
    use: 'diretório brasileiro de negócios veganos, vegetarianos e especializados',
  },
  michelin: {
    name: 'Guia Michelin Brasil',
    url: 'https://guide.michelin.com/br/pt_BR',
    use: 'restaurantes de São Paulo e Rio de Janeiro',
  },
  folha: {
    name: 'O Melhor de São Paulo / Folha',
    url: 'https://www1.folha.uol.com.br/o-melhor-de-sao-paulo/',
    use: 'vencedores de gastronomia de São Paulo em 2026',
  },
  exame_casual: {
    name: 'EXAME Casual',
    url: 'https://exame.com/casual/',
    use: 'seleções gastronômicas brasileiras de 2026',
  },
  local_guides: {
    name: 'Guias e imprensa local',
    url: 'https://www.google.com/search?q=guias+locais+gastronomia+brasil',
    use: 'representatividade local e checagem editorial',
  },
  veja_rio_2026: {
    name: 'VEJA Rio Comer & Beber 2026/2027',
    url: 'https://vejario.abril.com.br/comer-e-beber/os-melhores-hamburgueres-do-rio/',
    use: 'seleção atual de hamburguerias do Rio de Janeiro',
  },
  exame_salvador_2026: {
    name: 'EXAME Casual — melhores restaurantes de Salvador 2026',
    url: 'https://exame.com/casual/os-melhores-restaurantes-de-salvador-em-2026-segundo-a-casual-exame/',
    use: 'seleção editorial atual de restaurantes de Salvador',
  },
  sao_goncalo_2026: {
    name: 'O São Gonçalo — restaurantes mais bem avaliados em 2026',
    url: 'https://www.osaogoncalo.com.br/geral/177663/10-melhores-restaurantes-de-sao-goncalo-para-levar-o-paizao-no-dia-dos-pais-segundo-plataforma-de-avaliacoes',
    use: 'operação e recorrência local de restaurantes em São Gonçalo',
  },
  clickpb_burger_2025: {
    name: 'ClickPB — hamburguerias paraibanas no ranking nacional',
    url: 'https://www.clickpb.com.br/economia/ranking-hamburguer-jp.html',
    use: 'destaques locais de hambúrguer em João Pessoa',
  },
  tripadvisor_joao_pessoa: {
    name: 'Tripadvisor — restaurantes de João Pessoa',
    url: 'https://www.tripadvisor.com.br/Restaurants-g303428-Joao_Pessoa_State_of_Paraiba.html',
    use: 'recorrência e avaliações de restaurantes em João Pessoa',
  },
  agenda_carioca_2026: {
    name: 'Agenda Carioca — Dia do Hambúrguer 2026',
    url: 'https://agendacarioca.com.br/dia-do-hamburguer-onde-comer-os-melhores-do-rio/',
    use: 'seleção atual de hambúrgueres do Rio de Janeiro',
  },
  veja_rio_italianos_2026: {
    name: 'VEJA Rio — restaurantes italianos',
    url: 'https://vejario.abril.com.br/culinarias/italianos/',
    use: 'seleção atual de restaurantes italianos do Rio de Janeiro',
  },
  brasilia_local_guides: {
    name: 'Guias atuais de Brasília',
    url: 'https://www.sabornarua.com/blog/self-service-barato-em-brasilia',
    use: 'checagem de academias e restaurantes por quilo em Brasília',
  },
  correio_salvador_2026: {
    name: 'Correio — gastronomia de Salvador',
    url: 'https://www.correio24horas.com.br/salvador/pizzaria-de-salvador-e-eleita-a-segunda-melhor-do-brasil-em-ranking-nacional-0826',
    use: 'premiações atuais de pizzarias e hamburguerias de Salvador',
  },
  acritica_manaus_2025: {
    name: 'A Crítica — moda circular em Manaus',
    url: 'https://www.acritica.com/entretenimento/moda-circular-se-consolida-em-manaus-confira-brechos-1.362810',
    use: 'seleção local de brechós em operação',
  },
  curitiba_guides_2026: {
    name: 'Guias e Prefeitura de Curitiba',
    url: 'https://www.curitiba.pr.gov.br/noticias/rua-riachuelo-se-reinventa-com-a-chegada-de-novos-comercios-e-espacos-culturais-da-prefeitura-de-curitiba/80094',
    use: 'academias e brechós em operação em Curitiba',
  },
  tripadvisor_guarulhos: {
    name: 'Tripadvisor — restaurantes italianos de Guarulhos',
    url: 'https://www.tripadvisor.com.br/Restaurants-g303611-c26-Guarulhos_State_of_Sao_Paulo.html',
    use: 'recorrência e avaliações por especialidade em Guarulhos',
  },
  sao_goncalo_brechos: {
    name: 'Meu Brechó — São Gonçalo',
    url: 'https://meubrecho.app/cidade/sao-goncalo/',
    use: 'diretório local de brechós em São Gonçalo',
  },
  wscom_joao_pessoa_2026: {
    name: 'WSCOM — moda circular em João Pessoa',
    url: 'https://wscom.com.br/destaque/destaque-especial/2026/07/18/brechos-joao-pessoa-consumo-consciente-moda-sustentavel/',
    use: 'checagem atual de brechós em João Pessoa',
  },
};

const editorial = {
  sp: {
    restaurants: [
      'Tuju',
      'Evvai',
      'Maní',
      'Tordesilhas',
      'D.O.M.',
      'A Casa do Porco',
      'Mocotó',
      'Corrutela',
      'Murakami',
      'Kuro',
      'Fame Osteria',
      'Ryo Gastronomia',
    ],
    pet: [
      'Cobasi',
      'Petz',
      'Petbrinka',
      'BIRD Pet Shop & Avicultura',
      'Smartpet',
      "Amaro's Bichos Pet Shop",
      'Dog World',
      'Consulado da Ração',
      'Pet Boutique Town',
      'Animalle',
      'Pet Shop Zampe',
      'Novopet',
      'Metrópole Pet Shop e Clínica Veterinária',
      'África Pet',
      'La Vie Pet',
      'GoApp.pet',
      "Dog's Day",
      'Pet Jardim',
      'Mundo Zoo',
      'Pet Center Fiore',
      'Nalim Pet Shop',
      'Breeds',
    ],
    buffet: [
      'Restaurante Nandemoyá',
      'Athenas Self Service',
      'Tanka Restaurante',
      'B,min Restaurante',
      'Praça São Lourenço',
    ],
  },
  rio: {
    restaurants: [
      'Lasai',
      'Oteque',
      'Oro',
      'Mee',
      'Ristorante Hotel Cipriani',
      'Casa 201',
      'Marine Restô',
      'Marius Degustare',
      'Braseiro da Gávea',
      'Zazá Bistrô Tropical',
      'Quitéria',
      'Xian',
      'Hachiko',
      'Giuseppe Grill',
    ],
    burger: ['Valhalla Burguer & Bier', 'Doc 605', 'Encarnado Burger'],
    italian: ['Ristorante Hotel Cipriani', 'Padella Trattoria'],
    barber: ["Domett's Barber Shop"],
  },
  brasilia: {
    restaurants: [
      'Nonna Augusta Trattoria',
      'Mangai',
      'Sallva',
      'Authoral',
      'Taypá',
      'Universal Diner',
      'Dom Francisco',
      'New Koto',
      'Tarso Restaurante',
      'Chard',
    ],
    pet: ['Pet Focinho', "Lilla's Pet Shop", 'Pet dos Cães', 'Animalerie Petcare'],
    barber: ['DonJeff Barbearia'],
    italian: ['Piselli Brasília'],
    gym: ['World Gym Brasília', 'Academia Halteres', 'Runway Fitness Center'],
    buffet: ['Taioba Restaurante', 'Fogão de Pedra'],
    vegan: [
      'Apetit Natural',
      'Supren Verda',
      'Kundalini do Cerrado',
      'Faz Bem — Casa Vegana',
      'Villa Vegana',
      'Cannelle',
      'Aflora Gastrobar',
      'Casinha Café',
      'A Tribo Restaurante',
      'Açougue Vegano',
      'Ateliê Vegan Brasília',
      'Catioro Food',
      'Chá de Anita',
      'Girassol Alimentação Saudável',
      "Green's Restaurante Natural",
      'Dona Helena',
      'Boa Saúde Vegetariano',
      'Nutri Vida',
      'Amor à Natureza',
      'The Plant',
    ],
    thrift: ['Brechó Tudo Lindo'],
  },
  fortaleza: {
    restaurants: [
      'Mestre Sussa',
      'Illa Mare',
      'Balcone',
      'Allêz',
      'Carbone Steakhouse',
      'Santa Grelha',
      'Villa Restaurante',
      'Raiz Cozinha Brasileira',
      'Giz Cozinha Boêmia',
      'Moleskine Gastrobar',
      'Carneiro do Ordones',
      'Caravaggio Cucina e Vino',
      "L'Ô Restaurante",
      'Misaki',
    ],
    gym: ['Porão Academia', 'AYO Fitness Club', 'Bluefit', 'Mix Academia', 'Alifit Academia'],
    cafe: ['Matinha Brunch & Café', 'Brigaderia 85'],
    italian: ['DOC — Cucina, Pizza & Vino'],
    vegan: [
      'Mandir Restaurante Vegano',
      'Pachamama Cultural',
      'GOVEGAN Delivery',
      'Sabor Alternativo',
      'Culinária da Lu',
    ],
  },
  salvador: {
    restaurants: ['Boia'],
    pizza: ["Forneria Alfredo'Ro"],
    burger: ['Muu Hamburgueria', 'Jamil Burgers', 'Tchê Burguer'],
  },
  'belo-horizonte': {
    restaurants: [
      'Xapuri',
      'Glouton',
      'Pacato',
      'Ninita',
      'Birosca S2',
      'Cozinha Tupis',
      'Nuúu Restaurante',
      'Moema Bar e Cozinha',
      'Casa Cheia',
      'Florestal',
      'Okinaki',
      'La Macelleria Lourdes',
    ],
    vegan: [
      'Botequim Vegano',
      'Casa Umbigo',
      'Public House Veg',
      'Camaradería Gastrobar',
      'Mona Café',
    ],
  },
  manaus: {
    thrift: ['Organikos', 'Dulcis Brechó'],
    vegan: [
      'Salgados Veganos Manaus',
      'Restaurante Mesa Verde',
      'Edi Sabor Natural',
      'Dr. Sushi Veg',
      'Casa da Pamonha',
      'Casa da Vovó Manu',
      'Chikara Veg Manaus',
      'Sabor Único Restaurante Natural',
      'Hueg',
      'MALIBU MAO',
      'Don Veg Manaus',
      'Erva Doce Vegana',
      'GoVegan Delivery Manaus',
    ],
  },
  curitiba: {
    restaurants: [
      'Manu',
      'DUQ Gastronomia',
      'Bobardí',
      'QCeviche!',
      "C' La Vie",
      'The Ox Room Steakhouse',
      'Barolo Trattoria',
      'Hai Yo',
      'Nuu Nikkei',
      'Bar do Alemão',
      'Poco Tapas',
      'Mercearia Fantinato',
    ],
    vegan: ['GreenGo Vegetariano', 'Maki Vegan Café', 'VegannA Café e Bistrô', 'Espaço Vegano'],
    bakery: ['Saint Claire Bakery & Café'],
    gym: ['Swimex Academia', 'Overall Fitness Gym', 'Academia Go Fitness'],
    thrift: [
      'Circoollar',
      'Flor de Laranjeira Brechó & Arte',
      'Brechó Riachuelo',
      'Mundo Avesso Brechó',
    ],
  },
  recife: {
    beauty: ['A Maison Hair'],
  },
  goiania: {
    vegan: [
      'Veggie Sushi Home',
      'Frô do Cerrado Bar',
      'Topá Bar',
      'Goodimais da Conta',
      'Cogourmet Cogumelos',
      'Toca da Onça',
    ],
  },
  'sao-luis': {
    vegan: [
      "Gafanhoto's",
      'Restaurante Vegetariano Estilo Saudável',
      'Árvore da Vida',
      'Bendita Pizza Artesanal',
      'Cozinha Ancestral',
      'Restaurante Vegetariano Naturista',
      'Veganëra',
      'Estação Vegana',
      'Cozinha da VegAna',
      'Alquimia — Comida Vegana',
      'Navegano Cozinha Vegana',
      'Green Land Restaurante Vegetariano e Vegano',
    ],
    thrift: ['Brechó da Lulu'],
  },
  maceio: {
    buffet: ['Galeteria Parmegianno Pajuçara'],
    vegan: [
      'Ser-Afim',
      'Veggo',
      'Moa Cozinha Natural',
      'Lis de Flor',
      'Ramburgui',
      'Amaná',
      'Casa de Mãinha Jaraguá',
      'Cheiro da Terra',
      'Harri',
      'Saudável Sabor',
      'Natureza Viva',
      'In Natura Fit Food',
      'Amanita Veg',
      'Morada Cozinha Vegana',
      'Lanches Veg',
      'No Meat Burger',
      'Vegan Sabores',
      'Rama Café',
    ],
  },
  'campo-grande': {
    pet: ['Maranatha Pet Shop'],
    vegan: [
      'Broto de Bambu',
      'Trevo Veggie',
      'Mais que Salada',
      'Floral Green Vegan',
      'Las Vegg',
      'ArtVeg',
      "Adelli's Vegan Food",
      'Life Love Vegan',
      'Café & Colher Restaurante Vegano',
    ],
  },
  guarulhos: {
    italian: [
      'Vino Vinho',
      'Forneria Presidente',
      'Botticelli Vinhos e Restaurante',
      'Prima Pasta Restaurante',
    ],
    vegan: [
      'Mistura Vegana Delivery',
      'Bróclinhos Hamburgueria Vegana',
      'Mesa Verde',
      'Dona Barriguda Vegan',
      'Salgados Rango Bentô',
    ],
  },
  campinas: {
    thrift: ['Pretérito Perfeito Loja & Brechó', 'Brechó Eu Quero'],
  },
  'sao-goncalo': {
    restaurants: ['Restaurante Mizuki'],
    thrift: ['Brechó Las Chicas', 'Mix Moda Brechó'],
    vegan: [
      'Sta Planta Veg',
      'Carol Coxinhas',
      'Jaca Real',
      'Semente Doceria Vegana',
      'Bolin Confeitaria',
      'Lov Café SG',
      'Vaca Profana',
      'Veg Lótus',
    ],
  },
  teresina: {
    bakery: ['Padaria Evolução'],
    vegan: [
      'Maniva — Comida da Terra',
      'Brócoli',
      'Veggie Teresina',
      'Nutri Doces',
      'Gula Verde',
      'Flor da Vida Teresina',
    ],
  },
  'joao-pessoa': {
    restaurants: [
      'Mangai',
      'Bar do Cuscuz',
      'The W Restaurante',
      'Nau Frutos do Mar',
      'Gulliver Mar',
      'Cozinha Roccia',
      'Tábua de Carne',
      'Camarada Camarão',
      'Casa do Bacalhau',
      'Adega do Alfredo',
      'Estaleiro Restaurante',
      'Tartuferia Savitar',
      "John's Grill",
      'Quintal Restô',
      'Citron Restaurante Bar',
      'Canoa dos Camarões',
    ],
    pizza: [
      "Sapore D'Italia",
      'Fascino Medieval',
      'Famiglia Muccini',
      'Original Forno a Lenha',
      'Cipriano Pizza & Panino',
      'Santa Pizza Praia',
      'Pizza Mestre',
      'Marguerutti Pizzaria',
    ],
    burger: [
      '083 Burger',
      "Brother's Burger JP",
      'Home Burger',
      "Navarro's",
      'HDO Hambúrguer de Origem',
      'Tartaruga Burguer',
      'Grill Burger',
    ],
    sushi: [
      'Ryori João Pessoa',
      'Mitt Sushi Bar',
      'HAO',
      'Ippon',
      'Kanpai',
      'Rizu Sushi',
      'Sushi Bessa',
      'Hashi',
      'Sakê Temakeria',
      'Mister Sushi',
    ],
    cafe: [
      'Oliva Cafeteria',
      'Kingdom Coffee',
      'Abô Botânica & Café',
      '283 Café',
      'Pâmela Gourmet',
      'Mun Café',
      'Bistrô 17',
      'Livraria do Luiz — Café',
      'Cafeína Cafeteria',
      'DM Caffè',
      "Bricktop's Coffee",
      'Café Jardim',
      "D'Avellar Bakery",
      'Emporio Cookies',
      'Padoca do Cicico',
      'Reserve Garden',
      'NUN Café',
      'Bari Café',
    ],
    bar: [
      'Giramundo',
      'Bar do Cuscuz',
      'Velho Chico',
      'Quiosque Tubarão',
      'Barzin',
      'Convívio Bar',
      'Donana Pub',
      'Cachaçaria Philipéia',
      'Emporium 42',
      "Gringo's Bar",
      'After Pub',
      'Barril 21',
      'Boteco do Bata',
      'Rocks JP',
      'Laranja Mecânica',
      'Beer Time',
      'Paralelo PB',
      'Doris Prime',
      'Grilos Bar',
      'Skybar',
    ],
    beauty: [
      'Nathally Guedes Studio',
      'Studio R',
      'Gilvan Cabeleireiros',
      'Hugo Perez',
      'Prime Cabeleireiros',
    ],
    barber: [
      'Alpha Barber Shop',
      'Mo Cabelin',
      'Barbearia Oficial JP',
      'Bro Barbearia',
      'Sky Barbearia',
      'Palace Barbearia',
    ],
    gym: [
      'Prodígio Academia',
      'Bluefit',
      'Allp Fit',
      'Peu Vale Fitness',
      'Academia Gaviões',
      'G+ Academia',
      'Millenium Gym Muscle',
      'CheckPoint Centro de Treinamento',
      'LoopFit Academia',
      'Academia MasterFit',
      'Soulfit JP',
      'Impulse Fitness Center',
      'Bull Dog Academia',
    ],
    pet: [
      'Casa dos Criadores',
      'Pet Shop Cristo Redentor',
      'Pet Valentina',
      'Gino Pet',
      'Nutrivet',
      'Xuxucão Pet Shop',
      'Petz',
    ],
    italian: [
      'Casa Nonna',
      'Tartuferia Savitar',
      'Orama Rooftop',
      "Sapore D'Italia",
      "Al'mar Cucina",
      'Buongustaio Ristorante',
      'Tramice Ristorante',
      'IOCÁ — Casa & Massa',
      'Appetito Trattoria',
      'Famiglia Muccini',
      'Fascino Medieval',
    ],
    bakery: [
      'Visse Café e Comida Regional',
      'Padaria Bonfim',
      'Panificadora Eldorado Prime',
      'Padaria Unipão',
      'Panificadora Divina Misericórdia',
      "D'Avellar Bakery",
      'Panificadora Linos',
      'Padaria São Paulo',
      'Padaria e Confeitaria Roma',
      'Pão & Companhia',
      'Pão Sabor',
      'Panificadora Mendes',
      'Panificadora Divina II',
    ],
    buffet: [
      'Dom Carlos Restaurante',
      'Restaurante Maré Alta',
      'Porto Restaurante',
      'Cannelle Restaurante',
      'Domani Restaurante',
      'Deck Gourmet',
      'Jardim Restaurante',
      'Cozinha de Jampa',
      'Oxe Restaurante e Pizzaria',
      'Palace Grill',
    ],
    vegan: [
      'Casa de Nara',
      'Papoula Culinária Saudável',
      'Karranka Veg',
      'Natureba',
      'Abô Botânica e Café',
      'Baguete da Villa',
      'Beco Mágico',
      'Bendita Cozinha',
      'Oca',
      'Restaurante Flamboyant',
      'Bistrô Mariwô',
      'Delaine',
      'Levíssimo',
      'Marioca Alimentação Saudável',
      'DNA Natural / Bendita',
      'Cozinha e Confeitaria da Tsu',
      'Pé de Fruta Manaíra',
      'Divino Burgers Vegetarianos',
      'Natureba',
      'Baguete da Villa',
    ],
    thrift: [
      'Brechó Volver',
      'Brechó da Lulucinha',
      'Brechó da Lurdinha',
      'Peça Rara João Pessoa',
      'Desapega que a Vida Carrega',
    ],
  },
};

const conciseAliases = [
  [/^(?:academia\s+)?smart\s*fit\b.*$/i, 'Smart Fit'],
  [/^(?:academia\s+)?bio\s+ritmo\b.*$/i, 'Bio Ritmo'],
  [/^bodytech\b.*$/i, 'Bodytech'],
  [/^bluefit\b.*$/i, 'Bluefit'],
  [/^selfit\b.*$/i, 'Selfit'],
  [/^greenlife\b.*$/i, 'Greenlife Academias'],
  [/^cobasi\b.*$/i, 'Cobasi'],
  [/^(?:mundo pet\s+)?cobasi\b.*$/i, 'Cobasi'],
  [/^petz\b.*$/i, 'Petz'],
  [/^petland\b.*$/i, 'Petland'],
  [/^pecorino\b.*$/i, 'Pecorino'],
  [/^(?:restaurante\s+)?abbraccio\b.*$/i, 'Abbraccio'],
  [/^la braciera pizzaria\b.*$/i, 'La Braciera Pizzaria'],
  [/^bráz pizzaria\b.*$/i, 'Bráz Pizzaria'],
  [/^manai gastronomia\b.*$/i, 'Manai Gastronomia'],
  [/^(?:restaurante\s+)?aipo\s*(?:&|e)\s*aipim\b.*$/i, 'Aipo & Aipim'],
  [/^mangai\b.*$/i, 'Mangai'],
  [/^(?:restaurante\s+)?edi sabor natural\b.*$/i, 'Edi Sabor Natural'],
  [/^broto de bambu\b.*$/i, 'Broto de Bambu'],
  [/^las vegg\b.*$/i, 'Las Vegg'],
  [/^carol coxinhas\b.*$/i, 'Carol Coxinhas'],
  [/^restaurante viva a vida\b.*$/i, 'Restaurante Viva a Vida'],
  [/^the war barbearia moema\b.*$/i, 'The War Barbearia Moema'],
  [/^castanho caf[eé](?:\s|$).*$/i, 'Castanho Café'],
  [/^studio j21\b.*$/i, 'Studio J21'],
  [/^cinco estrelas casa de p[aã]es\b.*$/i, 'Cinco Estrelas Casa de Pães'],
  [/^barber shop old cut\b.*$/i, 'Barber Shop Old Cut'],
  [/^spazio das loiras\b.*$/i, 'Spazio das Loiras'],
  [/^cantina piacenza\b.*$/i, 'Cantina Piacenza'],
  [/^miss pet petshop\b.*$/i, 'Miss Pet Petshop'],
  [/^p[aã]o de minas padaria\b.*$/i, 'Pão de Minas Padaria'],
  [/^sal[aã]o de beleza cabeleireiro centro de curitiba donzelas\b.*$/i, 'Donzelas & Barbudos'],
  [/^casa chacon emp[oó]rio e restaurante\b.*$/i, 'Casa Chacon Empório e Restaurante'],
  [/^sal[aã]o de beleza tok a mais\b.*$/i, 'Salão de Beleza Tok a Mais'],
  [/^sax coffee\s*&\s*more\b.*$/i, 'Sax Coffee & More'],
  [/^rep[uú]blica da sa[uú]de\b.*$/i, 'República da Saúde'],
  [/^br barbearia dr\.? freitas\b.*$/i, 'BR Barbearia Dr. Freitas'],
  [/^general prime burger\b.*$/i, 'General Prime Burger'],
  [/^the coffee shop nescaf[eé] t3\b.*$/i, 'The Coffee Shop Nescafé T3'],
  [/^the coffee shop nescaf[eé] leste\b.*$/i, 'The Coffee Shop Nescafé Leste'],
  [/^turquesa beleza\s*&\s*bem estar\b.*$/i, 'Turquesa Beleza & Bem Estar'],
  [/^entre n[oó]s:\s*brech[oó](?:\s|,|$).*$/i, 'Entre Nós Brechó'],
  [/^drakkar barber club\b.*$/i, 'Drakkar Barber Club'],
  [/^sal[aã]o de beleza senhorita\s*&\s*bem estar\b.*$/i, 'Senhorita & Bem Estar'],
];

const softExclusions = {
  restaurants: [
    /b(?:u|ou)rg(?:er|uer) king/i,
    /mcdonald/i,
    /outback/i,
    /domino/i,
    /pizza hut/i,
    /giraffas/i,
    /habib'?s/i,
    /subway/i,
    /\bkfc\b/i,
    /casa bauducco/i,
    /coco bambu/i,
    /rei do mate/i,
    /spoleto/i,
    /johnny rockets/i,
  ],
  pizza: [/domino/i, /pizza hut/i],
  burger: [
    /b(?:u|ou)rg(?:er|uer) king/i,
    /mcdonald/i,
    /johnny rockets/i,
    /\bbob'?s\b/i,
    /madero/i,
    /jeronimo/i,
  ],
  cafe: [/rei do mate/i, /havanna/i, /bacio di latte/i, /starbucks/i, /casa bauducco/i],
  italian: [/spoleto/i, /domino/i, /pizza hut/i, /olive garden/i, /pecorino/i, /abbraccio/i],
  bakery: [/casa bauducco/i, /sodiê/i, /fábrica de bolos/i],
};

const hardCategoryExclusions = {
  sushi: [
    /coco bambu/i,
    /fogo campeiro/i,
    /churrascaria/i,
    /pizzaria/i,
    /hamburg/i,
    /burger/i,
    /trattoria/i,
    /osteria/i,
    /cantina italiana/i,
  ],
  italian: [
    /coco bambu/i,
    /\bsushi\b/i,
    /japon[eê]s/i,
    /culin[aá]ria oriental/i,
    /\bryori\b/i,
    /boteco do manolo/i,
    /santa grelha/i,
  ],
};

const invalidExact = new Set(
  [
    'vegano',
    'alimentação saudável',
    'self service',
    'restaurante self service à vontade',
    'shopping jk',
    'comida oriental',
    'restaurante japonês e asiático em meireles fortaleza',
    'são paulo sp',
    'curitiba pr',
    'fortaleza ce',
    'brasília df',
    'pinheiros sp',
    'desativado',
    'restaurante',
    'bar',
    'café',
    'cafeteria',
    'academia',
    'pet shop',
    'barbearia',
    'salão de beleza',
    'padaria',
    'pizzaria',
    'hamburgueria',
    'hambúrgueria',
    'hamburguer',
    'hambúrguer',
    'burger',
    'burguer',
    'brechó',
    'buffet',
    'sushi guarulhos',
    'hamburgueria curitiba',
    'academia maceió',
  ].map(normalize),
);

const wrongCityMarkers = {
  sp: ['São Bernardo do Campo', 'Santo André', 'Osasco', 'Barueri', 'Guarulhos'],
  rio: ['Niterói', 'São Gonçalo', 'Duque de Caxias'],
  fortaleza: ['Caucaia'],
  'belo-horizonte': ['Contagem'],
  recife: ['Olinda', 'Jaboatão'],
  goiania: ['Aparecida de Goiânia'],
  belem: ['Ananindeua'],
  'porto-alegre': ['Canoas'],
  campinas: ['Valinhos'],
  'sao-goncalo': ['Niterói', 'Itaboraí'],
  'joao-pessoa': ['Cabedelo'],
};

function normalize(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function cleanLabel(value) {
  let label = String(value)
    .replace(/\p{Extended_Pictographic}|\uFE0F/gu, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .trim();

  for (const [pattern, replacement] of conciseAliases) {
    if (pattern.test(label)) return replacement;
  }

  label = label.replace(/\s+\|\s+.*$/, '');
  label = label.replace(
    /:\s+(?:restaurante|carnes|culinária|feijoada|massa|risoto|pizza|milk shake|café|loja|ração|menu executivo)\b.*$/i,
    '',
  );
  label = label.replace(/\s+\|\s+(?:unidade|shopping|loja|vila|asa|centro)\b.*$/i, '');
  label = label.replace(
    /\s+-\s+(?:unidade|shopping|loja|barbearia,|corte de cabelo|restaurante italiano em|pizza napoletana\s+-)\b.*$/i,
    '',
  );
  label = label.replace(
    /\s+[–-]\s+(?:barbearia|barba|corte|salão|cabeleireiro|especialista|musculação|tudo para|avenida|rua|restaurante|emagrecimento|medicamentos|clínica veterinária)\b.*$/i,
    '',
  );
  label = label.replace(
    /\s+[–—-]\s+(?:caf[eé]|cafeteria|brunch|sal[aã]o|mechas|especialista|especializada?|academia|fit dance|muay thai|pet shop|banho|tosa|cl[ií]nica|moda|do b[aá]sico|p[aã]es|fermenta[cç][aã]o|comida|delivery)\b.*$/i,
    '',
  );
  label = label.replace(
    /\s+em\s+(?:s[aã]o paulo|rio de janeiro|bras[ií]lia|fortaleza|salvador|belo horizonte|manaus|curitiba|recife|goi[aâ]nia|bel[eé]m|porto alegre|guarulhos|campinas|s[aã]o lu[ií]s|macei[oó]|campo grande|s[aã]o gon[cç]alo|teresina|jo[aã]o pessoa)(?:\s+[A-Z]{2})?[,.]?$/i,
    '',
  );
  label = label.replace(/\s+(?:com roupas|sal[aã]o de beleza completo|especialista em)\b.*$/i, '');
  return label.trim();
}

function mapsCategoryMatches(row, categoryKey) {
  if (!row.primaryCategory) return true;
  const value = normalize(`${row.name} ${row.primaryCategory}`);
  const patterns = {
    restaurants:
      /restaurante|brasileira|italiana|portuguesa|mediterranea|asiatica|japonesa|bistro|churrasc|carne|bife|frutos do mar|arabe|bufe|lanchonete|pizza|hamburguer/,
    pizza: /pizza|pizzaria|forneria|italiana/,
    burger: /hamburg|burger|lanchonete/,
    sushi: /sushi|japonesa|japones|asiatica|ryori|temakeria|izakaya/,
    cafe: /cafe|cafeteria|coffee|espresso/,
    bar: /\bbar\b|bares|boteco|pub|cervej|chop|gastrobar/,
    beauty: /salao|beleza|cabeleir|beauty|hair|maquiagem/,
    barber: /barbearia|barber/,
    gym: /academia|fitness|crossfit|centro de treinamento|personal trainer|sala de fitness/,
    pet: /pet|veterin|racao|animais|animal|banho e tosa/,
    italian: /italiana|italiano|trattoria|osteria|cantina|ristorante|cucina|massas|pasta|forneria/,
    bakery: /padaria|panificadora|paneteria|bakery|pao|paes|confeitaria/,
    buffet: /bufe|buffet|self service|quilo/,
    vegan: /vegana|vegano|vegetariana|vegetariano|plant based/,
    thrift: /brecho|bazar|sebo/,
  };
  return patterns[categoryKey]?.test(value) ?? true;
}

function brandKey(label) {
  const normalized = normalize(label);
  if (/\b(?:vovo|grandma) zuzu\b/.test(normalized)) return 'vovo zuzu';
  if (/\be a s\b/.test(normalized)) return 'brecho e a s';
  if (/^ultra\b/.test(normalized)) return 'ultra academia';
  if (/\bacuas\b/.test(normalized)) return 'acuas fitness';
  if (/^karranka\s*veg\b/.test(normalized.replace(/\s+/g, ''))) return 'karranka veg';
  if (normalized === 'ideal' || normalized.includes('padaria ideal')) return 'padaria ideal';
  if (/^(?:bar municipal|municipal bar)/.test(normalized)) return 'bar municipal';
  if (/^vero\b/.test(normalized)) return 'vero';
  if (/^brecho da lu(?:a)?$/.test(normalized)) return 'brecho da lua';
  const known = [
    'smart fit',
    'bio ritmo',
    'bodytech',
    'bluefit',
    'selfit',
    'greenlife',
    'cobasi',
    'petz',
    'petland',
    'pecorino',
    'abbraccio',
    'la braciera',
    'braz pizzaria',
    'manai gastronomia',
    'aipo aipim',
    'mangai',
    'domino',
    'pizza hut',
    'burger king',
    'mcdonald',
    'outback',
    'madero',
    'jeronimo',
    'coco bambu',
    'camarada camarao',
    'a casa do porco',
    '1900 pizzeria',
    'tutti pizza',
    'geek bunker burger',
    'bullguer',
    'emilia borges',
    'dig for fashion',
    'pizzaria camelo',
    'lemax',
    'hachiko',
    'barbearia do ze',
    'new corpore',
    'parme',
    'pao companhia',
    'nonna augusta',
    'sallva',
    'fratello uno',
    'sky s burger',
    'nazo japanese',
    'unique athletic resort',
    'di petti',
    'don durica',
    'vignoli',
    'barney s burger',
    'barbearia varjota',
    'sushi ponta negra',
    'natural beauty',
    'ze barbeiro',
    'animale petshop',
    'padaria ideal',
    'padaria evandro',
    'cantina volpi',
    'rocca pizzaria',
    'cazolla gastro',
    'bravo burger',
    'red burger n bar',
    'zuuk',
    'soho',
    'coffeetown',
    'solange cafe',
    'almacen pepe',
    'xapuri',
    'ninita',
    'james burger',
    'nashy sushi',
    'seu elias',
    'pratique fitness',
    'domenico pizzeria',
    'boca do forno',
    'a granel',
    'splash pizza',
    'burgers burgers',
    'matsuri sushi',
    'cafe regional naiza',
    'belle femme',
    'roots tree',
    'companhia athletica',
    'ultra academia',
    'acuas fitness',
    'maskote pet',
    'lindopan',
    'pao de minas',
    'padaria lisboa',
    'peca rara',
    'barbearia the club',
    'ph d sports',
    'rei dos animais',
    'lellis trattoria',
    'janaino vegan',
    'pur luxe',
    'libelula brecho',
    'entre amigos o bode',
    'laca burguer',
    'burguer do no',
    'wayne s burger',
    'maverick garage',
    'a vida e bela cafe',
    'beerdock',
    'barbearia meu chefe',
    'emporio da barba',
    'confraternity of beard',
    'gym fit',
    'furetti cucina',
    'la tratoria',
    'famiglia giuliano',
    'brecho da torre',
    'casa sao paulo',
    'pirineus pizzaria',
    'flex fitness center',
    'age sport center',
    'chao nativo',
    'natural alimentos',
    'brecho bagatela',
    'sushi boulevard',
    'bar municipal',
    'four fit',
    'provet',
    'armazem 25',
    'mark hamburgueria',
    'action fit',
    'usina do corpo',
    'moinhos fitness',
    'famiglia facin',
    'la tasca',
    'cheirin bao',
    'the coffee shop nescafe',
    'delicia lanches cafe',
    'lord black',
    'academia gavioes',
    'vicino cucina',
    'vero parme',
    'olive garden',
    'casa sao bento',
    'divino fogao',
    'burguesinha brecho',
    'big jack',
    'bronco burger',
    'kazu sushi',
    'campinas fit',
    'famiglia gianni',
    'artesanalli',
    'duo bruschetteria',
    'dona fiica',
    'bella napoli',
    'bonsai',
    'haruki',
    'barbearia brother s',
    'terra zoo',
    'padaria sabor de minas',
    'chefranco',
    'amsterda rocha',
    'rei dog',
    'vero pasta',
    'parmegianno',
    'panetutti',
    'barber cartel',
    'pleno vigor',
    'dog in box',
    'brecho veste bem',
    'boteco do manolo',
    'rodo grill',
    'mamma mia pizzaria',
    'cafe valentina',
    'deu la deu',
    'pes patas',
    'academia bora',
    'bazar da pastora',
    'forno paulista',
    'sushimy',
    'mulher bonita',
    'maverick',
    'gordeixo s',
    'kanpai',
    'sake temakeria',
    'abo botanica',
    'padaria bonfim',
    'panificadora divina',
    'cannelle restaurante',
    'palace grill',
    'cozinha e confeitaria da tsu',
    'soul consciente',
  ];
  const match = known.find((candidate) => normalized.includes(candidate));
  if (match) return match;
  return normalized
    .replace(/\b(?:unidade|shopping|loja|centro|matriz|oficial)\b.*$/, '')
    .replace(/\b(?:asa norte|asa sul|zona norte|zona sul|zona leste|zona oeste)\b.*$/, '')
    .trim();
}

function isWrongCity(label, citySlug) {
  return (wrongCityMarkers[citySlug] ?? []).some((marker) =>
    normalize(label).includes(normalize(marker)),
  );
}

function isInvalid(label, citySlug) {
  if (!label || label.length < 2 || label.length > 110) return true;
  if (invalidExact.has(normalize(label))) return true;
  if (/^\(?\s*em breve\b|nova franquia|ser[aá] inaugurad[oa]/i.test(label)) return true;
  if (isWrongCity(label, citySlug)) return true;
  return false;
}

function isSoftExcluded(label, categoryKey) {
  return (softExclusions[categoryKey] ?? []).some((pattern) => pattern.test(label));
}

function isHardCategoryExcluded(label, categoryKey) {
  return (hardCategoryExclusions[categoryKey] ?? []).some((pattern) => pattern.test(label));
}

function sourceRefsFor(ranking) {
  const refs = ['google_maps', 'openstreetmap'];
  if (
    [
      'restaurants',
      'pizza',
      'burger',
      'sushi',
      'cafe',
      'bar',
      'italian',
      'bakery',
      'buffet',
    ].includes(ranking.localCategoryKey)
  ) {
    refs.push('tripadvisor', 'local_guides');
  }
  if (ranking.localCategoryKey === 'vegan') refs.push('happycow', 'veganizze', 'local_guides');
  if (ranking.citySlug === 'sp' && ranking.localCategoryKey === 'restaurants') {
    refs.push('michelin', 'folha', 'exame_casual');
  }
  if (ranking.citySlug === 'rio' && ranking.localCategoryKey === 'restaurants')
    refs.push('michelin');
  if (ranking.citySlug === 'rio' && ranking.localCategoryKey === 'burger')
    refs.push('veja_rio_2026', 'agenda_carioca_2026');
  if (ranking.citySlug === 'rio' && ranking.localCategoryKey === 'italian')
    refs.push('veja_rio_italianos_2026');
  if (ranking.citySlug === 'brasilia' && ['gym', 'buffet'].includes(ranking.localCategoryKey))
    refs.push('brasilia_local_guides');
  if (ranking.citySlug === 'salvador' && ranking.localCategoryKey === 'restaurants')
    refs.push('exame_salvador_2026');
  if (ranking.citySlug === 'salvador' && ['pizza', 'burger'].includes(ranking.localCategoryKey))
    refs.push('correio_salvador_2026');
  if (ranking.citySlug === 'manaus' && ranking.localCategoryKey === 'thrift')
    refs.push('acritica_manaus_2025');
  if (ranking.citySlug === 'curitiba' && ['gym', 'thrift'].includes(ranking.localCategoryKey))
    refs.push('curitiba_guides_2026');
  if (ranking.citySlug === 'guarulhos' && ranking.localCategoryKey === 'italian')
    refs.push('tripadvisor_guarulhos');
  if (ranking.citySlug === 'sao-goncalo' && ranking.localCategoryKey === 'restaurants')
    refs.push('sao_goncalo_2026');
  if (ranking.citySlug === 'sao-goncalo' && ranking.localCategoryKey === 'thrift')
    refs.push('sao_goncalo_brechos');
  if (ranking.citySlug === 'joao-pessoa' && ranking.localCategoryKey === 'restaurants')
    refs.push('tripadvisor_joao_pessoa');
  if (ranking.citySlug === 'joao-pessoa' && ranking.localCategoryKey === 'burger')
    refs.push('clickpb_burger_2025');
  if (ranking.citySlug === 'joao-pessoa' && ranking.localCategoryKey === 'thrift')
    refs.push('wscom_joao_pessoa_2026');
  return [...new Set(refs)];
}

function buildOptions(ranking) {
  if (ranking.localCategoryKey === 'sportsEvents') {
    return ranking.opts.map((option) => ({ label: option.label, source: 'existing_generic' }));
  }

  const pool = [];
  const editorialLabels = editorial[ranking.citySlug]?.[ranking.localCategoryKey] ?? [];
  editorialLabels.forEach((label, index) => {
    pool.push({ label, source: 'editorial', score: 30_000 - index });
  });

  const excludeVeganMaps =
    ranking.localCategoryKey === 'vegan' &&
    new Set(['manaus', 'guarulhos', 'sao-luis', 'sao-goncalo', 'teresina']).has(ranking.citySlug);
  const mapRows = excludeVeganMaps
    ? []
    : (recheckedByCity.get(ranking.citySlug)?.categories?.[ranking.localCategoryKey] ??
      audit.cities[ranking.citySlug]?.categories?.[ranking.localCategoryKey] ??
      []);
  mapRows.forEach((row, index) => {
    if (row.sponsored || !mapsCategoryMatches(row, ranking.localCategoryKey)) return;
    const quality = (row.rating ?? 0) * 10 + Math.log10((row.reviews ?? 0) + 1) * 4;
    pool.push({
      label: row.name,
      source: 'google_maps',
      score: 20_000 - index * 20 + quality,
      rating: row.rating,
      reviews: row.reviews,
    });
  });

  ranking.opts.forEach((option, index) => {
    pool.push({ label: option.label, source: 'openstreetmap', score: 10_000 - index });
  });

  const preferred = [];
  const seen = new Set();
  const excluded = new Set((localOptionExclusions[ranking.id] ?? []).map(normalize));

  for (const candidate of pool.sort((a, b) => b.score - a.score)) {
    const label = cleanLabel(candidate.label);
    const key = brandKey(label);
    if (
      !key ||
      seen.has(key) ||
      excluded.has(normalize(label)) ||
      isInvalid(label, ranking.citySlug) ||
      (candidate.source !== 'editorial' && isHardCategoryExcluded(label, ranking.localCategoryKey))
    )
      continue;
    seen.add(key);
    const selected = { ...candidate, label };
    if (candidate.source !== 'editorial' && isSoftExcluded(label, ranking.localCategoryKey))
      continue;
    preferred.push(selected);
  }

  const selected = preferred.slice(0, targetCount);
  return selected;
}

const targetRankings = catalog.filter((ranking) => ranking.city !== 'Florianópolis');
const curatedRankings = targetRankings.map((ranking) => {
  const selected = buildOptions(ranking);
  const question =
    ranking.localCategoryKey === 'vegan'
      ? `Qual é o melhor restaurante/lanchonete vegano ou vegetariano em ${ranking.city}?`
      : ranking.question;
  return {
    rankingId: ranking.id,
    city: ranking.city,
    citySlug: ranking.citySlug,
    state: ranking.state,
    categoryKey: ranking.localCategoryKey,
    categoryLabel:
      ranking.localCategoryKey === 'vegan' ? veganCategoryLabel : ranking.localCategory,
    question,
    sourceRefs: sourceRefsFor(ranking),
    researchQuery:
      ranking.localCategoryKey === 'sportsEvents'
        ? null
        : `${categoryQueries[ranking.localCategoryKey]} em ${ranking.city}, ${ranking.state}, Brasil`,
    options: selected.map(({ label }) => label),
    evidence: selected.map(({ label, source, rating = null, reviews = null }) => ({
      label,
      source,
      rating,
      reviews,
    })),
  };
});

const refresh = {
  reviewKey: 'local-launch-curation-2026-09-v2',
  reviewedAt: '2026-09-02',
  scope: {
    excludedCity: 'Florianópolis',
    cityCount: new Set(curatedRankings.map((ranking) => ranking.city)).size,
    rankingCount: curatedRankings.length,
    minimumOptionsPerRanking: minimumUsableCount,
    maximumOptionsPerRanking: targetCount,
    resetParticipation: true,
  },
  methodology: audit.methodology,
  sourceRegistry,
  rankings: curatedRankings,
};

const refreshedCatalog = catalog.map((ranking) => {
  const curated = curatedRankings.find((entry) => entry.rankingId === ranking.id);
  if (!curated) {
    if (ranking.id === veganFloripaRefresh.rankingId) {
      return {
        ...ranking,
        localCategory: veganCategoryLabel,
        question: veganFloripaRefresh.question,
        opts: veganFloripaRefresh.options.map((label, index) => ({
          label,
          position: index + 1,
          baseline_score: 0,
        })),
      };
    }
    if (ranking.id === cafesFloripaRefresh.rankingId) {
      return {
        ...ranking,
        question: cafesFloripaRefresh.question,
        opts: cafesFloripaRefresh.options.map((label, index) => ({
          label,
          position: index + 1,
          baseline_score: 0,
        })),
      };
    }
    return ranking.localCategoryKey === 'vegan'
      ? { ...ranking, localCategory: veganCategoryLabel }
      : ranking;
  }
  return {
    ...ranking,
    localCategory: curated.categoryLabel,
    question: curated.question,
    baseline_votes: 0,
    preserveExistingOptions: false,
    opts: curated.options.map((label, index) => ({
      label,
      position: index + 1,
      baseline_score: 0,
    })),
  };
});

const validation = {
  cities: refresh.scope.cityCount,
  rankings: curatedRankings.length,
  options: curatedRankings.reduce((total, ranking) => total + ranking.options.length, 0),
  duplicateRankings: curatedRankings.filter(
    (ranking) => new Set(ranking.options.map(normalize)).size !== ranking.options.length,
  ).length,
  wrongOptionCounts: curatedRankings.filter(
    (ranking) =>
      ranking.options.length < minimumUsableCount || ranking.options.length > targetCount,
  ).length,
  deficits: curatedRankings
    .filter((ranking) => ranking.options.length < targetCount)
    .map((ranking) => ({ rankingId: ranking.rankingId, options: ranking.options.length })),
};

if (
  validation.cities !== 20 ||
  validation.rankings !== 320 ||
  validation.duplicateRankings !== 0 ||
  validation.wrongOptionCounts !== 0
) {
  throw new Error(`Invalid launch curation: ${JSON.stringify(validation)}`);
}

if (writeMode) {
  await Promise.all([
    writeFile(
      new URL('../data/local-launch-curation-2026-09.json', import.meta.url),
      `${JSON.stringify(refresh, null, 2)}\n`,
    ),
    writeFile(
      new URL('../data/local-catalog.json', import.meta.url),
      `${JSON.stringify(refreshedCatalog)}\n`,
    ),
  ]);
}

console.log(JSON.stringify(validation, null, 2));
