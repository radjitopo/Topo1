import { rankingQuestion } from '../ranking-titles.js';

const LOCAL_PUBLIC_OPTION_COUNT = 20;

const images = {
  sushi:
    'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=1200&q=82',
  pizza:
    'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1200&q=82',
  burger:
    'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1200&q=82',
  bakery:
    'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1200&q=82',
  cafe: 'https://images.unsplash.com/photo-1561522983-385a76fbb4cb?auto=format&fit=crop&crop=entropy&w=1200&q=82',
  vegan:
    'https://images.unsplash.com/photo-1638328740227-1c4b1627614d?auto=format&fit=crop&crop=entropy&w=1200&q=82',
  buffet:
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=82',
  hotel:
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=82',
};

const editorialImages = {
  'sushi-floripa':
    'https://images.unsplash.com/photo-1628676825882-32c387815bdd?auto=format&fit=crop&w=1200&q=82',
  'sushi-bc':
    'https://images.unsplash.com/photo-1761314026068-f07ec1ce6e2b?auto=format&fit=crop&w=1200&q=82',
  'sushi-sp':
    'https://images.unsplash.com/photo-1696449241254-11cf7f18ce32?auto=format&fit=crop&w=1200&q=82',
  'sushi-rio':
    'https://images.unsplash.com/photo-1744360515510-db7bf0f6def8?auto=format&fit=crop&w=1200&q=82',
  'pizzarias-floripa':
    'https://images.unsplash.com/photo-1762631178753-ce2adae403f9?auto=format&fit=crop&w=1200&q=82',
  'pizza-bc':
    'https://images.unsplash.com/photo-1764705309243-c47cbc9792e4?auto=format&fit=crop&w=1200&q=82',
  'pizza-sp':
    'https://images.unsplash.com/photo-1691158440000-215d7326a258?auto=format&fit=crop&w=1200&q=82',
  'pizza-rio':
    'https://images.unsplash.com/photo-1769733338940-c406b721583f?auto=format&fit=crop&w=1200&q=82',
  'hamburguer-floripa':
    'https://images.unsplash.com/photo-1627824820493-8abb7748e830?auto=format&fit=crop&w=1200&q=82',
  'hamburguer-bc':
    'https://images.unsplash.com/photo-1669490883180-4632b4a075cc?auto=format&fit=crop&w=1200&q=82',
  'hamburguer-sp':
    'https://images.unsplash.com/photo-1761315413254-af7ca4929a1a?auto=format&fit=crop&w=1200&q=82',
  'hamburguer-rio':
    'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?auto=format&fit=crop&w=1200&q=82',
  'cafes-floripa':
    'https://images.unsplash.com/photo-1561522983-385a76fbb4cb?auto=format&fit=crop&crop=entropy&w=1200&q=82',
  'restaurantes-veganos-floripa':
    'https://images.unsplash.com/photo-1638328740227-1c4b1627614d?auto=format&fit=crop&crop=entropy&w=1200&q=82',
  'padarias-floripa':
    'https://images.unsplash.com/photo-1771160962771-00186d83364e?auto=format&fit=crop&w=1200&q=82',
  'padarias-bc':
    'https://images.unsplash.com/photo-1768733994507-ad69aee9638c?auto=format&fit=crop&w=1200&q=82',
  'padarias-sp':
    'https://images.unsplash.com/photo-1774669081553-4ef841520c05?auto=format&fit=crop&w=1200&q=82',
  'padarias-rio':
    'https://images.unsplash.com/photo-1763026337559-f1c5e980c539?auto=format&fit=crop&w=1200&q=82',
  'quilo-floripa':
    'https://images.unsplash.com/photo-1769638913559-c8c6984428fe?auto=format&fit=crop&w=1200&q=82',
  'quilo-bc':
    'https://images.unsplash.com/photo-1776267073555-cb8ddfa021fd?auto=format&fit=crop&w=1200&q=82',
  'quilo-sp':
    'https://images.unsplash.com/photo-1756066234736-9db92f9a80c8?auto=format&fit=crop&w=1200&q=82',
  'quilo-rio':
    'https://images.unsplash.com/photo-1742171046278-343caa08ecb2?auto=format&fit=crop&w=1200&q=82',
  'hoteis-floripa':
    'https://images.unsplash.com/photo-1776761604095-e8dd031864d7?auto=format&fit=crop&w=1200&q=82',
  'hoteis-bc':
    'https://images.unsplash.com/photo-1756115364101-bf3c2cba1029?auto=format&fit=crop&w=1200&q=82',
  'hoteis-sp':
    'https://images.unsplash.com/photo-1749829235925-2158ae75902d?auto=format&fit=crop&w=1200&q=82',
  'hoteis-rio':
    'https://images.unsplash.com/photo-1760942994028-faea27e67045?auto=format&fit=crop&w=1200&q=82',
  'modelos-glamourosas':
    'https://images.unsplash.com/photo-1777828828769-c8fe6bc61c8d?auto=format&fit=crop&w=1200&q=82',
  'celebridades-sexy':
    'https://images.unsplash.com/photo-1768609957005-ac7e89c26f99?auto=format&fit=crop&w=1200&q=82',
  'moda-polemica':
    'https://images.unsplash.com/photo-1771919383240-d0a30993fc38?auto=format&fit=crop&w=1200&q=82',
  'coisas-fora-moda':
    'https://images.unsplash.com/photo-1775224525008-96e54c7d06d9?auto=format&fit=crop&w=1200&q=82',
  'times-mundo':
    'https://images.unsplash.com/photo-1748112441590-48723d484a0d?auto=format&fit=crop&w=1200&q=82',
  'jogadoras-futebol':
    'https://images.unsplash.com/photo-1535506349729-56e253fac2b1?auto=format&fit=crop&crop=faces&w=1200&q=82',
  futebol:
    'https://images.unsplash.com/photo-1715801903345-f1a971f0f17b?auto=format&fit=crop&w=1200&q=82',
  'atores-acao':
    'https://images.unsplash.com/photo-1781127445188-3b05a9316dde?auto=format&fit=crop&w=1200&q=82',
  dramas:
    'https://images.unsplash.com/photo-1766844649143-af98d71e346b?auto=format&fit=crop&w=1200&q=82',
  filmes:
    'https://images.unsplash.com/photo-1770982726697-309881d78cc1?auto=format&fit=crop&w=1200&q=82',
  'discos-rock':
    'https://images.unsplash.com/photo-1587731556938-38755b4803a6?auto=format&fit=crop&w=1200&q=82',
  'musicas-beatles':
    'https://images.unsplash.com/photo-1772721693464-133e5e899072?auto=format&fit=crop&w=1200&q=82',
  'bandas-pagode':
    'https://images.unsplash.com/photo-1736184766006-377f3e9827a1?auto=format&fit=crop&w=1200&q=82',
  gororobas:
    'https://images.unsplash.com/photo-1669743851910-b7e19930c8a8?auto=format&fit=crop&w=1200&q=82',
  acompanhamentos:
    'https://images.unsplash.com/photo-1759753944580-893912e0c052?auto=format&fit=crop&w=1200&q=82',
  'ruas-incriveis':
    'https://images.unsplash.com/photo-1765893081244-959728140994?auto=format&fit=crop&w=1200&q=82',
  'jogos-celular':
    'https://images.unsplash.com/photo-1738830260465-6d1aead840f1?auto=format&fit=crop&w=1200&q=82',
  'grupos-kpop':
    'https://images.unsplash.com/photo-1760966362386-e1012dbc3657?auto=format&fit=crop&w=1200&q=82',
  'comfort-foods':
    'https://images.unsplash.com/photo-1667499989723-c4ab9549d63c?auto=format&fit=crop&crop=entropy&w=1200&q=82',
};

const legacyEditorialIds = [
  'modelos-glamourosas',
  'celebridades-sexy',
  'moda-polemica',
  'coisas-fora-moda',
  'times-mundo',
  'jogadoras-futebol',
  'futebol',
  'atores-acao',
  'dramas',
  'filmes',
  'discos-rock',
  'musicas-beatles',
  'bandas-pagode',
  'gororobas',
  'acompanhamentos',
  'ruas-incriveis',
  'jogos-celular',
  'grupos-kpop',
  'comfort-foods',
];

const ranking = (id, category, title, image, options) => ({
  id,
  category,
  title: rankingQuestion(id, title),
  image: editorialImages[id] || images[image],
  options: options.slice(0, LOCAL_PUBLIC_OPTION_COUNT),
});

const rankings = [
  ranking('sushi-floripa', 'Florianópolis', 'Onde está o melhor sushi de Florianópolis?', 'sushi', [
    'Nipô Sushi - Beiramar',
    'Nipô Sushi - Passeio Primavera',
    'Jun Kappô Sushi SC 401',
    'Jun Kappô Sushi Coqueiros',
    'Noma Sushi Rooftop',
    'Noma Sushi Jurerê',
    'Sattoru Sushi',
    'Casa Entre Mares',
    'Arquipélago Sushi Lounge',
    'Gatae Restaurante Japonês',
    'Nakaixa Sushi',
    'Black Sheep on The Roof',
    'SushiNami',
    'Gringo Sushi Bar',
    'Koniko',
    'A Casa do Sushi',
    'Kikoni Japafood',
    'Sushi Yama',
    'Okko Floripa',
    'Muramaki Sushi',
  ]),
  ranking(
    'pizzarias-floripa',
    'Florianópolis',
    'Qual pizzaria de Florianópolis você defenderia até o fim?',
    'pizza',
    [
      'Bere Birra Forneria',
      'Bibi Pizza',
      'Pizzaria Bel Mangio',
      'Forno Milano',
      "Leone's Forneria",
      'Artesano Pizza Bar',
      'Feito Pizzas e Massas',
      'El Padre Pizzaria',
      'Juca Pato Pizzaria',
      'Massa da Vila',
      "Pizzeria Elba D'Italia",
      'Don Zarichta Pizzaria Artesanal',
      'Papparella Pizzaria',
      'Pizzeria Il Cantuccio',
      'Santa Hora Pizzaria',
      'Livorno',
      'Volo Pizza',
      'Lenha & Oliva',
      'Basilico',
      'Salve! Pizza',
    ],
  ),
  ranking(
    'hamburguer-floripa',
    'Florianópolis',
    'Quem faz o hambúrguer mais absurdo de Florianópolis?',
    'burger',
    [
      "Uncle Joe's",
      'The Gringo Burguer',
      'El Padre Pizzas e Burgers',
      'Usina do Hambúrguer',
      'Beach Burger Jurerê',
      'Carne & Malte Burger Bar',
      'Vitrola Hamburgueria',
      'Âncora Sandubar',
      'Rock Burger',
      'Afonso Burgerbar',
      'OFF Burger',
      "Aly's Classic Burgers",
      'Grill Burger',
      'Time Out Hamburgueria',
      'Consagrado Burger',
      'Soul Brothers Burger',
      'Crunch Mama',
      'Cowboy Hamburgueria',
      'Palicone Hamburgueria',
      'Flame Burger',
    ],
  ),
  ranking(
    'padarias-floripa',
    'Florianópolis',
    'A padaria que faz Florianópolis acordar feliz',
    'bakery',
    [
      'O Padeiro de Sevilha',
      'Padaria Café François',
      'Floripão',
      'Padaria e Confeitaria Estrela',
      'Família Lorenzi Pães Artesanais',
      'Pão da Leli',
      'Padaria do Alemão',
      'Panificadora Padoka',
      'Paní Vida Sem Glúten',
      'Pães & Papos',
      'Vero Pães Artesanais',
      'Pão a Mão',
      'Padaria Vó Flor',
      'Padaria Pão e Sonhos',
      'Benvenuta Pães Especiais',
      'Paneteria Catarina',
      'Padaria Café Engelke Pães & Cia',
      'Ingleses Panificadora',
      'Kompaan Padaria Artesanal',
      'Santo Trigo Padaria & Cafeteria',
    ],
  ),
  ranking('cafes-floripa', 'Florianópolis', 'Qual é o melhor café de Florianópolis?', 'cafe', [
    'NKMB Coffee Co.',
    'Nas Ondas Café',
    'Leve Cafeína',
    'O Infiltrado',
    'Uma Origem Café',
    'NOSLEEP Cafés Especiais',
    'Metrô Cafés Especiais',
    'Messkla Cafeteria',
    'Café Cultura',
    'BrodDo',
    'Café Psiquê',
    'Family Coffee',
    'Pão da Leli',
    'Bombardelli Pâtisserie',
    'Padaria Café François',
    'O Padeiro de Sevilha',
    'Amoriko Brigaderia & Café',
    'Taipei Coffee House',
    'Um Tributo ao Café',
    'Streetme Coffee Floripa',
  ]),
  ranking(
    'restaurantes-veganos-floripa',
    'Florianópolis',
    'Qual é o melhor restaurante/lanchonete vegano ou vegetariano de Florianópolis?',
    'vegan',
    [
      'Ahimsa Burgers',
      'Desvio',
      'Espaço Nutrir — Lagoa',
      'Espaço Nutrir — Campeche',
      'Kulturas Restaurante',
      'Caapora',
      'Girassol Veg',
      'Mamma Veg — Estreito',
      'Mamma Veg — Córrego Grande',
      'Taboo Tiki Bar',
      'Canteiro Restaurante',
      'Tsan The',
      'KomTodos',
      'Porongo',
      'Kairú — Hamburgueria Vegetal',
      'Kairú — Cozinha Vegetal Autoral',
      'Libre Cozinha',
      'Refeitório Vegano',
      'Mandarina',
      'Cantina Ananda',
    ],
  ),
  ranking(
    'quilo-floripa',
    'Florianópolis',
    'Onde está o melhor almoço por quilo de Florianópolis?',
    'buffet',
    [
      'Central Restaurante',
      'Cozinha do Mercado São Jorge',
      'Quatro Estações Restaurante',
      'Art Gourmet Restaurante',
      'Trofi Restaurante',
      'Restaurante Flor de Sal',
      'Grillo Mex',
      'Casa Mendonça Restaurante & Grill',
      'Porto Restaurante',
      'Palladar Buffet',
      'Tratto Restaurante & Rotisseria',
      "Doca's Restaurante",
      'Restaurante Ilha dos Açores',
      'Frango do G',
      'Uliano Restaurante',
      'Oka Floripa',
      'Casa Roma',
      'Restaurante Genuínos',
      'Zilico Petanga',
      'Nutri Lanches',
    ],
  ),
  ranking(
    'hoteis-floripa',
    'Florianópolis',
    'Qual hotel entrega a melhor estadia em Florianópolis?',
    'hotel',
    [
      'LK Design Hotel Florianópolis',
      'Costão do Santinho Resort',
      'Hotel Boutique Quinta das Videiras',
      'Il Campanario Villaggio Resort',
      'Jurerê Beach Village',
      'Majestic Palace Hotel',
      'Novotel Florianópolis',
      'Blue Tree Premium Florianópolis',
      'Hotel Porto da Ilha',
      'Faial Prime Suites',
      'Pousada Ilha Faceira',
      'Hotel Porto Sol Beach',
      'Iate Hotel Florianópolis',
      'Hotel Torres da Cachoeira',
      'Brisamar Suite Hotel',
      'Costa Norte Ingleses Hotel',
      'Costa Norte Ponta das Canas Hotel',
      'Hotel Sete Ilhas',
      'Villas Jurerê Hotel Boutique',
      'Slaviero Baía Norte Florianópolis',
    ],
  ),

  ranking(
    'sushi-bc',
    'Balneário Camboriú',
    'Sushi em Balneário Camboriú: qual merece o topo?',
    'sushi',
    [
      'Yujin Temakeria',
      'Japón by Cleber',
      'Mity Sushi',
      'Koi Sushi',
      'Dhoo Sushi Lounge',
      'Brava Sushi',
      'Temaki Art',
      'Taj Bar',
      'Satō Sushi',
      'Amaya Sushi',
      'Karan Sushi',
      'Piva Sushi',
      'Magnus Sushi',
      'Ohana Sushi',
      'Xushi',
      'TOE Sushi Kaiten',
      'Mazeru Sushi',
      'Sushi Central',
      'Summit BC',
      'Unizushi',
    ],
  ),
  ranking(
    'pizza-bc',
    'Balneário Camboriú',
    'Qual pizzaria manda melhor em Balneário Camboriú?',
    'pizza',
    [
      'Pizza Bis',
      'Di Paroli Pizzaria e Bistrô',
      "A'Roma Pizzeria Artesanal",
      'Distretto Praia Brava',
      'Heróis da Pizza',
      'Pontocom Pizza',
      'Luna Bianca Pizzeria',
      'Buddies Pizza & Pasta',
      'Bacci Pizzeria',
      'Hippopotamus Pizzaria',
      'Village Pizza',
      'Pizza Deck',
      'Puppilo Pizza',
      'Pizza Hot',
      'New York Pizza',
      'Pizza Crush BC',
      'Quintal da Pizza',
      'Jacaré Vermelho',
      'Cia das Pizzas',
      'Vô Jacques',
    ],
  ),
  ranking(
    'hamburguer-bc',
    'Balneário Camboriú',
    'Quem faz o hambúrguer mais desejado de Balneário Camboriú?',
    'burger',
    [
      'Yor Burger',
      'Black Burguer',
      'Bestburguer',
      'General Pepper Hamburgers & Cia',
      "Bull's Burger & Beer",
      'Madero Grill',
      'Campano Campo Carne & Fogo',
      'Prosa Gastrobar',
      'Old School Sandwiches',
      'Madalena Burger',
      'Sétimo Selo',
      'The Big Texas',
      'Seu Zé Choperia e Hamburgueria',
      'Buffalo Bill Hamburgueria',
      'Oliva Burger',
      'Chico Burger',
      'The Boris The Burger',
      'Starv',
      'Alexandria Burger',
      'Resenha Restaurante',
    ],
  ),
  ranking(
    'padarias-bc',
    'Balneário Camboriú',
    'Qual padaria é parada obrigatória em Balneário Camboriú?',
    'bakery',
    [
      'Itapanni',
      'Montibeller Panificadora & Confeitaria',
      'Portus Padaria Artesanal',
      'ITALICUS Pane & Pasta',
      "Tuti's Pão",
      'Panificadora Trigos',
      'Benassi Panificadora & Café',
      'Oh My Bread! Padaria Artesanal',
      'Cafeteria Berna',
      'Criativa Padaria',
      'Prático Panificadora',
      'Graciola Confeitaria e Café',
      'Distretto Café',
      'Nossa Padaria BC',
      'Boutique do Pão de Ló BC',
      '440 Bebida Café',
      'Lisboa Café',
      'Blanger Café',
      'Momento Perfeito',
      'Sanno Cafeteria',
    ],
  ),
  ranking(
    'quilo-bc',
    'Balneário Camboriú',
    'Quem serve o melhor buffet por quilo de Balneário Camboriú?',
    'buffet',
    [
      'Aroma Gourmet',
      'Coisa Querida Restaurante',
      'Alquimia do Sabor',
      'Caza Restaurante',
      'Paladar Restaurante',
      'Bem Bom Restaurante',
      'Opção Light',
      'La Vita Restaurante',
      'Mundo Selvagem',
      'Ganesh Restaurante',
      "Mari's Restaurante",
      'Tempero & Sabor Restaurante',
      'Casa da Mamãe',
      'Coma Bem Restaurante',
      'Royal Mais Tempero Caseiro',
      'Drive Pizza BC - Buffet de Almoço',
      'Do Chico Restaurante',
      'Flora Natural Restaurante',
      'Restaurante Pingo',
      'Bellé Restaurante',
    ],
  ),
  ranking('hoteis-bc', 'Balneário Camboriú', 'O hotel dos sonhos em Balneário Camboriú', 'hotel', [
    'Felissimo Exclusive Hotel',
    'Refúgio do Estaleiro',
    'Infinity Blue Resort & Spa',
    'Mercure Camboriú',
    'Marambaia Hotel & Convenções',
    'Hotel Bella Camboriú',
    'Plaza Camboriú Hotel',
    'Brut by Slaviero Hotéis',
    'Reserva Praia Hotel',
    "Hotel D'Sintra",
    'Sibara Hotel Flat & Convenções',
    'Hotel Rieger',
    'Hotel Marimar The Place',
    'Hotel Geranium',
    'Hotel Rosenbrock',
    'Hotel Bhally',
    'Hotel Miramar',
    'Hotel Pires',
    'Ibis Styles Balneário Camboriú',
    'Ibis Budget Balneário Camboriú',
  ]),

  ranking('sushi-sp', 'São Paulo', 'Onde está o sushi imbatível de São Paulo?', 'sushi', [
    'Ryo Gastronomia',
    'Jun Sakamoto',
    'Kuro',
    'Kinoshita',
    'Aizomê',
    'Shin-Zushi',
    'Aoyama',
    'Nagayama',
    'Huto',
    'Kosushi',
    'Kan Suke',
    'Mori Ohta Sushi',
    'Sushi Kenzo',
    'Nakka Jardins',
    'Murakami',
    'Sushi Kiyo',
    'Manihi Sushi',
    'Makoto',
    'Jam Jardins',
    'Kinoshita Omakase',
  ]),
  ranking('pizza-sp', 'São Paulo', 'Qual pizzaria é a cara de São Paulo?', 'pizza', [
    'Leggera Pizza Napoletana',
    'Carlos Pizza',
    'Castelões',
    'Speranza',
    'Bráz Pizzaria',
    'Camelo',
    'Gattofiga Pizza Bar',
    "Paul's Boutique Pizza Shop",
    'Bráz Elettrica',
    'Napoli Centrale',
    'La Braciera',
    'A Pizza da Mooca',
    '1900 Pizzeria',
    'Veridiana',
    'Quintal do Bráz',
    'Divina Encrenca',
    'Vila Napoli',
    'La Crosta',
    "Nonna d'Amore",
    'Deveras Pizza',
  ]),
  ranking('hamburguer-sp', 'São Paulo', 'Quem faz o melhor hambúrguer de São Paulo?', 'burger', [
    'Z Deli',
    'Holy Burger',
    'Hambúrguer do Seu Oswaldo',
    'Osnir Hamburguer',
    'Pão com Carne',
    'Buzina Burgers',
    'Guarita Burger',
    'Patties',
    'Chop & Cheese',
    'A Poderosa',
    'Firedoor Burger',
    'Koburger',
    'T.T. Burger',
    'Bullguer',
    'Big Kahuna Burger',
    'Meats',
    'Chico Hamburger',
    'Cão Véio',
    'Cabana Burger',
    'Tradi',
  ]),
  ranking('padarias-sp', 'São Paulo', 'Qual padaria paulistana merece o topo?', 'bakery', [
    'Lida Padaria',
    'Fabrique Pão e Café',
    'Julice Boulangère',
    'Padoca do Maní',
    'Basilicata',
    'Italianinha',
    'Marie Marie Bakery',
    'Árvore do Pão',
    'Bakehaus',
    'Pra Lá de Bom',
    'Bella Paulista',
    'Galeria dos Pães',
    'St. Etienne',
    'Dona Deôla',
    'Santiago Padaria Artesanal',
    'Cepam',
    'Santa Tereza',
    'Le Blé',
    'Merci Boulangerie',
    'Benjamin A Padaria',
  ]),
  ranking(
    'quilo-sp',
    'São Paulo',
    'O restaurante por quilo mais caprichado de São Paulo',
    'buffet',
    [
      'Manai Gastronomia',
      'Ripa na Brasa',
      'Ráscal',
      'Tanka',
      'Recanto Vegetariano',
      'Casarão Aurora',
      'Alcachofra Natural',
      'Boamesa Leopoldina',
      'Odon',
      'Au Gratin Restaurante',
      'Quero Quilo',
      '7 Grill Restaurante',
      'Feijão & Cia',
      'Estilo Restaurante',
      'Loreto Restaurante Grill & Chopp',
      'Blaubart',
      'RAMO Gastronomia',
      'Free Port',
      'Dinda Sabores',
      'Aroma e Sabor',
    ],
  ),
  ranking('hoteis-sp', 'São Paulo', 'Qual é o melhor hotel de São Paulo?', 'hotel', [
    'Rosewood São Paulo',
    'Palácio Tangará',
    'Hotel Unique',
    'Hotel Fasano São Paulo',
    'Emiliano São Paulo',
    'Tivoli Mofarrej São Paulo',
    'Renaissance São Paulo Hotel',
    'Grand Hyatt São Paulo',
    'JW Marriott Hotel São Paulo',
    "L'Hotel PortoBay São Paulo",
    'InterContinental São Paulo',
    'Hilton São Paulo Morumbi',
    'W São Paulo',
    'The Westin São Paulo',
    'Pulso Hotel Faria Lima',
    'Meliá Jardim Europa',
    'Pullman São Paulo Ibirapuera',
    'Laghetto Stilo São Paulo',
    'Grand Mercure São Paulo Itaim Bibi',
    'Sheraton São Paulo WTC Hotel',
  ]),

  ranking('sushi-rio', 'Rio de Janeiro', 'Onde está o sushi mais delicioso do Rio?', 'sushi', [
    'Azumi',
    'Canoa Sushi Bar',
    'Casa Ueda',
    'Gurumê',
    'Haru Sushi Bar',
    'Miako',
    'Mitsubá',
    'Naga',
    'Peixoto Sushi',
    'San Omakase',
    'Shiso',
    'Suibi',
    'Sushi Leblon',
    'Sushi Vaz',
    'Xian Rio',
    'Yumê',
    'Manekineko',
    'Benkei',
    'Minimok',
    'Sushimar',
  ]),
  ranking('pizza-rio', 'Rio de Janeiro', 'Qual pizzaria faz a pizza campeã do Rio?', 'pizza', [
    'Ferro e Farinha',
    'Bento Pizzeria',
    'Capricciosa',
    'Coltivi',
    'Ella Pizzaria',
    'Piccola Fattoria',
    'Domenica Pizzaria Artesanal',
    'Bráz Pizzaria',
    'Oggi Pizza Napoletana',
    'Broto',
    'Fatchia',
    'Mamma Jamma',
    'Eccellenza Pizzeria',
    'Zagga Pizza Bar',
    'Pizzaria Del Turista',
    'Gino Ristorante',
    'Sìsì',
    'Pizzaria Camelo',
    'Pizzaria Guanabara',
    'Stalos',
  ]),
  ranking('hamburguer-rio', 'Rio de Janeiro', 'Quem faz o melhor hambúrguer do Rio?', 'burger', [
    'Encarnado Burger',
    'Clan BBQ',
    'Alvoroço Parrilla',
    'Beco do Hambúrguer',
    'Bucaneiros',
    'Bullguer',
    'Cortés Asador',
    'Curadoria',
    'Ducadu',
    'Extouro',
    'Fat Guys',
    'Guigos Burguer',
    'HOB Hamburgueria',
    'Malta Beef Club',
    'Meatz Burger',
    'Ogro Steaks',
    'TJ Burguer',
    'T.T. Burger',
    'Três Gordos',
    'Jopras Sandwich & Burger',
  ]),
  ranking('padarias-rio', 'Rio de Janeiro', 'A melhor padaria do Rio: qual é a sua?', 'bakery', [
    'The Slow Bakery',
    'Araucária Pães Artesanais',
    'Talho Capixaba',
    'La Bicyclette',
    'Padaria e Confeitaria Ipanema',
    'João Padeiro & Co.',
    'Alva Padaria Artesanal',
    'Dianna Bakery',
    'D.O.C. Bakery',
    'Artesanos Bakery',
    'Artigrano',
    'Farro',
    'Le Dépanneur',
    'Nema',
    'Pão & Companhia',
    'Empório Farinha Pura',
    'Panificação Atlântica',
    'Confeitaria Colombo',
    'Empório Jardim',
    'Grano & Farina',
  ]),
  ranking('quilo-rio', 'Rio de Janeiro', 'Qual restaurante por quilo reina no Rio?', 'buffet', [
    'Celeiro',
    'Kilograma',
    'Couve Flor',
    'Frontera',
    'Aipo & Aipim',
    'Dona Vegana',
    'Temperarte',
    'Brasa Gourmet',
    'Elias Gourmet',
    'Kilo Mania',
    'Espaço Grill',
    'Arte Grill',
    '20 e 20 Restaurante',
    'Mariam Restaurante',
    'Oklahoma',
    'Cardamomo Restaurante',
    'Dos Santos Restaurante',
    'Nanquim',
    'Mel Gastronomia',
    'Linox',
  ]),
  ranking(
    'hoteis-rio',
    'Rio de Janeiro',
    'Qual hotel entrega a melhor experiência no Rio?',
    'hotel',
    [
      'Copacabana Palace, A Belmond Hotel',
      'Hotel Fasano Rio de Janeiro',
      'Emiliano Rio',
      'Fairmont Rio de Janeiro Copacabana',
      'Santa Teresa Hotel RJ - MGallery',
      'Grand Hyatt Rio de Janeiro',
      'Sheraton Grand Rio Hotel & Resort',
      'Miramar by Windsor Copacabana',
      'JW Marriott Hotel Rio de Janeiro',
      'Hilton Rio de Janeiro Copacabana',
      'Windsor Barra Hotel',
      'Windsor Marapendi',
      'Hilton Barra Rio de Janeiro',
      'Janeiro Hotel',
      'Yoo2 Rio de Janeiro',
      'Vila Santa Teresa',
      'Hotel Arpoador',
      'Mama Ruisa Boutique Hotel',
      'Villa Paranaguá Hotel & Spa',
      'La Suite by Dussol',
    ],
  ),
];

const escapeSql = (value) => String(value).replaceAll("'", "''");
const q = (value) => `'${escapeSql(value)}'`;

function validate() {
  if (rankings.length !== 26) {
    throw new Error(`O lote tem ${rankings.length} rankings; deveria ter 26.`);
  }

  const ids = rankings.map((item) => item.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error('Há IDs de ranking repetidos no lote.');
  }

  if (new Set(legacyEditorialIds).size !== legacyEditorialIds.length) {
    throw new Error('Há IDs repetidos na atualização editorial antiga.');
  }

  for (const id of legacyEditorialIds) {
    if (!editorialImages[id]) {
      throw new Error(`${id} não tem imagem editorial válida.`);
    }
  }

  for (const item of rankings) {
    if (!item.image) throw new Error(`${item.id} não tem imagem válida.`);
    if (item.options.length !== LOCAL_PUBLIC_OPTION_COUNT) {
      throw new Error(
        `${item.id} tem ${item.options.length} opções; o ranking local precisa começar com ${LOCAL_PUBLIC_OPTION_COUNT}.`,
      );
    }
    if (new Set(item.options).size !== item.options.length) {
      throw new Error(`${item.id} tem opções repetidas.`);
    }
    if (item.options.some((label) => !label.trim())) {
      throw new Error(`${item.id} tem opção vazia.`);
    }
  }
}

function sqlStatements() {
  validate();

  const rankingValues = rankings
    .map(
      (item, index) =>
        `(${q(item.id)}, ${q(item.category)}, ${q(item.title)}, ${q(item.image)}, 0, true, now() + interval '${index + 1} seconds')`,
    )
    .join(',\n');

  const upsertRankings = `INSERT INTO rankings (id, category, question, image_url, baseline_votes, is_active, created_at)\nVALUES\n${rankingValues}\nON CONFLICT (id) DO UPDATE SET\n  category = EXCLUDED.category,\n  question = EXCLUDED.question,\n  image_url = EXCLUDED.image_url,\n  is_active = true,\n  created_at = EXCLUDED.created_at;`;

  const optionValues = rankings
    .flatMap((item) =>
      item.options.map((label, index) => `(${q(item.id)}, ${q(label)}, ${index + 1}, 0)`),
    )
    .join(',\n');

  const upsertOptions = `INSERT INTO ranking_options (ranking_id, label, position, baseline_score)\nSELECT incoming.ranking_id, incoming.label, incoming.position, incoming.baseline_score\nFROM (VALUES\n${optionValues}\n) AS incoming(ranking_id, label, position, baseline_score)\nWHERE NOT EXISTS (\n  SELECT 1 FROM ranking_options existing\n  WHERE existing.ranking_id = incoming.ranking_id\n)\nON CONFLICT (ranking_id, position) DO UPDATE SET\n  label = EXCLUDED.label;`;

  const legacyImageValues = legacyEditorialIds
    .map((id) => `(${q(id)}, ${q(editorialImages[id])})`)
    .join(',\n');

  const updateLegacyImages = `UPDATE rankings AS ranking\nSET image_url = editorial.image_url\nFROM (VALUES\n${legacyImageValues}\n) AS editorial(id, image_url)\nWHERE ranking.id = editorial.id;`;

  return [upsertRankings, upsertOptions, updateLegacyImages];
}

validate();

if (process.argv.includes('--sql')) {
  process.stdout.write(JSON.stringify(sqlStatements()));
} else {
  console.log(
    JSON.stringify(
      {
        rankings: rankings.length,
        options: rankings.reduce((sum, item) => sum + item.options.length, 0),
        cities: [...new Set(rankings.map((item) => item.category))],
        ids: rankings.map((item) => item.id),
      },
      null,
      2,
    ),
  );
}
