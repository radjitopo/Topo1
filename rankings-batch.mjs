const existingRankings = [
  ['acompanhamentos', 'Qual acompanhamento rouba a cena?'],
  ['comidas-apimentadas', 'Qual comida apimentada exige mais coragem?'],
  ['marcas-esportivas', 'Qual marca esportiva tem mais estilo?'],
  ['bandas-pagode', 'Quem manda no pagode?'],
  ['pizzarias-floripa', 'Qual pizzaria de Florianópolis você defenderia até o fim?'],
  ['times-mundo', 'Qual é o melhor time de futebol do mundo?'],
  ['celebridades-fofas', 'Qual é a celebridade mais fofa?'],
  ['celebridades-sexy', 'Quem é a celebridade mais sexy?'],
  ['temperos', 'Qual tempero muda tudo?'],
  ['pintores', 'Pintores que mudaram a história da arte'],
  ['guitarristas', 'Guitarristas que parecem de outro planeta'],
  ['atores-acao', 'Quem é a maior estrela do cinema de ação?'],
  ['padarias-floripa', 'Padarias de Floripa que valem acordar cedo'],
  ['paes', 'Qual é o pão mais gostoso de todos?'],
  ['sushi-floripa', 'Onde comer o melhor sushi de Floripa?'],
  ['sushi-sp', 'Onde comer o melhor sushi de São Paulo?'],
  ['pizza-sp', 'Onde está a melhor pizza de São Paulo?'],
  ['refrigerantes', 'Qual refrigerante é imbatível?'],
  ['videogames-consoles', 'Consoles que marcaram gerações'],
  ['modelos-glamourosas', 'Top models que fizeram história']
];

const newRankings = [
  {
    id: 'lugares-date', category: 'Diversão',
    title: 'Onde levar alguém para um date inesquecível?',
    image: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=82',
    options: ['Restaurante intimista', 'Piquenique no parque', 'Praia no pôr do sol', 'Café charmoso', 'Bar de vinhos', 'Cinema de rua', 'Mirante com vista', 'Museu ou exposição', 'Show ao vivo', 'Feira gastronômica', 'Passeio de barco', 'Trilha leve', 'Livraria com café', 'Aula de culinária a dois', 'Boliche', 'Karaokê', 'Sorveteria', 'Jantar feito em casa', 'Parque de diversões', 'Observação de estrelas']
  },
  {
    id: 'empregos-sonho', category: 'Diversão',
    title: 'Se dinheiro não fosse problema, qual seria seu trabalho dos sonhos?',
    image: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=82',
    options: ['Fotógrafo de viagem', 'Chef de cozinha', 'Músico', 'Jogador de futebol', 'Piloto de avião', 'Astronauta', 'Veterinário', 'Biólogo marinho', 'Designer de games', 'Escritor', 'Diretor de cinema', 'Empreendedor', 'Guia de turismo', 'Sommelier', 'Artista plástico', 'Criador de conteúdo', 'Professor universitário', 'Cientista', 'Diplomata', 'Arquiteto']
  },
  {
    id: 'ruas-incriveis', category: 'Viagem',
    title: 'Ruas que todo mundo deveria conhecer',
    image: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=1200&q=82',
    options: ['Champs-Élysées — Paris', 'La Rambla — Barcelona', 'Broadway — Nova York', 'Abbey Road — Londres', 'Avenida Paulista — São Paulo', 'Ocean Drive — Miami', 'Oxford Street — Londres', 'Takeshita Street — Tóquio', 'Rua Augusta — São Paulo', 'Rua das Pedras — Búzios', 'Caminito — Buenos Aires', 'Lombard Street — São Francisco', 'Bourbon Street — Nova Orleans', 'Shibuya Center-gai — Tóquio', 'Nanjing Road — Xangai', 'İstiklal Caddesi — Istambul', 'Strøget — Copenhague', 'Via del Corso — Roma', 'Rua XV de Novembro — Curitiba', 'Nevsky Prospekt — São Petersburgo']
  },
  {
    id: 'animais-venenosos', category: 'Animais',
    title: 'Animais venenosos que dão mais medo',
    image: 'https://images.unsplash.com/photo-1531386151447-fd76ad50012f?auto=format&fit=crop&w=1200&q=82',
    options: ['Vespa-do-mar', 'Taipan-do-interior', 'Polvo-de-anéis-azuis', 'Rã-dardo-dourada', 'Peixe-pedra', 'Cobra-real', 'Mamba-negra', 'Aranha-armadeira', 'Escorpião-amarelo', 'Caracol-cone', 'Monstro-de-gila', 'Cascavel', 'Jararaca', 'Viúva-negra', 'Aranha-marrom', 'Dragão-de-komodo', 'Ornitorrinco macho', 'Peixe-leão', 'Centopeia-gigante', 'Abelha-africanizada']
  },
  {
    id: 'piores-empregos', category: 'Diversão',
    title: 'Trabalhos que ninguém merece',
    image: 'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=1200&q=82',
    options: ['Telemarketing de cobrança', 'Limpador de fossa', 'Provador de ração animal', 'Inspetor de esgoto', 'Limpador de cena de crime', 'Desentupidor profissional', 'Testador de odores', 'Minerador subterrâneo', 'Pescador em alto-mar', 'Trabalhador de plataforma petrolífera', 'Entregador debaixo de chuva', 'Motorista preso no trânsito', 'Segurança de boate', 'Atendimento de reclamações', 'Separador de lixo', 'Limpador de banheiro público', 'Cobrador de dívidas', 'Mascote de parque no verão', 'Lavador de janelas de arranha-céu', 'Controlador de pragas']
  },
  {
    id: 'discos-rock', category: 'Música',
    title: 'Discos de rock para ouvir antes de morrer',
    image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1200&q=82',
    options: ['Abbey Road — The Beatles', 'The Dark Side of the Moon — Pink Floyd', 'Led Zeppelin IV — Led Zeppelin', 'Nevermind — Nirvana', 'The Wall — Pink Floyd', 'London Calling — The Clash', 'Back in Black — AC/DC', 'Appetite for Destruction — Guns N’ Roses', 'OK Computer — Radiohead', 'Sgt. Pepper’s Lonely Hearts Club Band — The Beatles', 'Are You Experienced — The Jimi Hendrix Experience', 'Paranoid — Black Sabbath', 'Exile on Main St. — The Rolling Stones', 'Rumours — Fleetwood Mac', 'The Joshua Tree — U2', 'Ten — Pearl Jam', 'Californication — Red Hot Chili Peppers', 'Cabeça Dinossauro — Titãs', 'Dois — Legião Urbana', 'Da Lama ao Caos — Nação Zumbi']
  },
  {
    id: 'artes-marciais', category: 'Esporte',
    title: 'Qual arte marcial é a mais impressionante?',
    image: 'https://images.unsplash.com/photo-1555597673-b21d5c935865?auto=format&fit=crop&w=1200&q=82',
    options: ['Jiu-jítsu brasileiro', 'Muay thai', 'Judô', 'Karatê', 'Taekwondo', 'Boxe', 'Kickboxing', 'MMA', 'Kung fu', 'Krav magá', 'Capoeira', 'Aikidô', 'Wrestling', 'Sambo', 'Kendô', 'Hapkidô', 'Jiu-jítsu japonês', 'Wing chun', 'Sanda', 'Eskrima']
  },
  {
    id: 'roupas-voltar-moda', category: 'Moda',
    title: 'Peças do passado que deveriam voltar à moda',
    image: 'https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=1200&q=82',
    options: ['Jaqueta varsity', 'Calça boca de sino', 'Colete jeans', 'Jardineira', 'Suspensórios', 'Chapéu bucket', 'Corta-vento colorido', 'Camiseta tie-dye', 'Saia plissada', 'Cardigan oversized', 'Macacão', 'Paletó de veludo', 'Calça cargo', 'Camisa bowling', 'Bandana', 'Saia balonê', 'Polaina', 'Jaqueta bomber', 'Vestido chemise', 'Tênis de cano alto']
  },
  {
    id: 'coisas-fora-moda', category: 'Diversão',
    title: 'O que merece continuar fora de moda?',
    image: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&q=82',
    options: ['Toque polifônico', 'Orkut', 'MSN Messenger', 'Locadora de vídeo', 'Álbum de fotos impresso', 'Câmera digital compacta', 'Telefone fixo', 'Máquina de escrever', 'Pager', 'Fita cassete', 'CD gravado', 'DVD', 'Enciclopédia em volumes', 'Orelhão', 'Carta manuscrita', 'Discman', 'Tamagotchi', 'Lan house', 'Fax', 'Cheque']
  },
  {
    id: 'moda-polemica', category: 'Moda',
    title: 'O tribunal da moda: pochete, saruel e outras polêmicas',
    image: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&q=82',
    options: ['Pochete', 'Calça saruel', 'Calça de cintura baixíssima', 'Ombreira gigante', 'Meia com sandália', 'Camisa com gola V profunda', 'Calça rasgada demais', 'Legging estampada', 'Suspensório sem paletó', 'Boné trucker', 'Bermuda cargo', 'Camisa de cetim', 'Gravata finíssima', 'Agasalho de veludo', 'Calça capri', 'Saia sobre calça', 'Bolero', 'Gola rolê sem manga', 'Colete sem camisa', 'Animal print da cabeça aos pés']
  },
  {
    id: 'sapatos-polemicos', category: 'Moda',
    title: 'Sapatos que dividem opiniões',
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=82',
    options: ['Crocs', 'Bota Ugg', 'Vibram FiveFingers', 'Tênis plataforma', 'Tamanco holandês', 'Sandália gladiadora', 'Chinelo slide com meia', 'Sneaker wedge', 'Bota cowboy branca', 'Melissa transparente', 'Mule peludo', 'Sapatilha de bico redondo', 'Clog de madeira', 'Mocassim tratorado', 'Dad sneaker', 'Bota acima do joelho', 'Sandália fisherman', 'Tênis com salto embutido', 'Oxford colorido', 'Chinelo nuvem']
  },
  {
    id: 'musicas-beatles', category: 'Música',
    title: 'Qual é a melhor música dos Beatles?',
    image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1200&q=82',
    options: ['A Day in the Life', 'Here Comes the Sun', 'Hey Jude', 'Let It Be', 'Something', 'Yesterday', 'Come Together', 'Strawberry Fields Forever', 'While My Guitar Gently Weeps', 'In My Life', 'Eleanor Rigby', 'Blackbird', 'Help!', 'All You Need Is Love', 'I Want to Hold Your Hand', 'Across the Universe', 'Penny Lane', 'Lucy in the Sky with Diamonds', 'Norwegian Wood', 'Dear Prudence']
  },
  {
    id: 'esportes-radicais', category: 'Esporte',
    title: 'Esportes para quem não conhece o medo',
    image: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1200&q=82',
    options: ['BASE jump', 'Wingsuit', 'Escalada free solo', 'Surfe de ondas gigantes', 'Paraquedismo', 'Bungee jumping', 'Mountain bike downhill', 'Motocross freestyle', 'Rali', 'Rafting classe V', 'Mergulho em cavernas', 'Highline', 'Salto de penhasco', 'Escalada no gelo', 'Volcano boarding', 'Parkour', 'Kitesurf', 'Snowboard big air', 'Skate vertical', 'Apneia profunda']
  },
  {
    id: 'comfort-foods', category: 'Comida',
    title: 'Comidas que abraçam por dentro',
    image: 'https://images.unsplash.com/photo-1667499989723-c4ab9549d63c?auto=format&fit=crop&crop=entropy&w=1200&q=82',
    options: ['Lasanha', 'Arroz e feijão', 'Pão de queijo', 'Strogonoff', 'Pizza', 'Chocolate quente', 'Bolo de cenoura', 'Canja', 'Polenta cremosa', 'Miojo', 'Queijo-quente', 'Escondidinho', 'Feijoada', 'Panqueca', 'Mingau', 'Batata frita', 'Purê de batata', 'Sopa caseira', 'Macarrão com queijo', 'Brigadeiro']
  },
  {
    id: 'drinks-classicos', category: 'Comida',
    title: 'Clássicos do bar: qual drink vence?',
    image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=1200&q=82',
    options: ['Old Fashioned', 'Negroni', 'Dry Martini', 'Mojito', 'Margarita', 'Manhattan', 'Moscow Mule', 'Daiquiri', 'Caipirinha', 'Bloody Mary', 'Whiskey Sour', 'Cosmopolitan', 'Piña Colada', 'Aperol Spritz', 'Gin-tônica', 'Mai Tai', 'Tom Collins', 'French 75', 'Boulevardier', 'Cuba Libre']
  },
  {
    id: 'gororobas', category: 'Comida',
    title: 'Feias, misturadas e deliciosas: as melhores gororobas',
    image: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=82',
    options: ['Mexidão de arroz, feijão e farofa', 'Strogonoff com a batata palha misturada', 'Miojo com ovo', 'Purê de batata com feijão', 'Banana amassada com aveia', 'Pão com ovo e ketchup', 'Macarrão com salsicha', 'Arroz com ovo frito', 'Arroz com sobras de churrasco', 'Sopa de sobras', 'Polenta com molho e feijão', 'Pizza amanhecida com café', 'Farofa com tudo', 'Sanduíche de tudo que tem na geladeira', 'Mexidão mineiro', 'Yakisoba improvisado', 'Risoto de geladeira', 'Carne moída com purê', 'Macarrão com feijão', 'Batata palha com requeijão']
  },
  {
    id: 'plantas-dificeis', category: 'Plantas',
    title: 'Plantas que testam a paciência de qualquer um',
    image: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=1200&q=82',
    options: ['Calathea orbifolia', 'Avenca', 'Ficus lyrata', 'Gardênia', 'Bonsai', 'Orquídea', 'Planta-carnívora', 'Cróton', 'Alocásia', 'Maranta', 'Azaleia', 'Lavanda', 'Alecrim em vaso', 'Aphelandra', 'Ciclame', 'Cafeeiro', 'Samambaia-americana', 'Begônia maculata', 'Rosa-miniatura', 'Fitônia']
  },
  {
    id: 'jogadoras-futebol', category: 'Esporte',
    title: 'Quem é a maior jogadora da história do futebol?',
    image: 'https://images.unsplash.com/photo-1535506349729-56e253fac2b1?auto=format&fit=crop&crop=faces&w=1200&q=82',
    options: ['Marta', 'Mia Hamm', 'Birgit Prinz', 'Michelle Akers', 'Abby Wambach', 'Homare Sawa', 'Sun Wen', 'Christine Sinclair', 'Carli Lloyd', 'Megan Rapinoe', 'Alexia Putellas', 'Aitana Bonmatí', 'Ada Hegerberg', 'Sam Kerr', 'Formiga', 'Sissi', 'Cristiane', 'Wendie Renard', 'Kelly Smith', 'Nadine Angerer']
  },
  {
    id: 'dramas', category: 'Cinema',
    title: 'Qual drama fez você chorar de verdade?',
    image: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1200&q=82',
    options: ['Um Sonho de Liberdade', 'A Lista de Schindler', 'Forrest Gump', 'Titanic', 'À Espera de um Milagre', 'Um Estranho no Ninho', 'Cidade de Deus', 'Central do Brasil', 'Cinema Paradiso', 'A Vida é Bela', 'Moonlight', 'Parasita', 'Manchester à Beira-Mar', 'História de um Casamento', 'Nasce Uma Estrela', '12 Anos de Escravidão', 'Sociedade dos Poetas Mortos', 'O Pianista', 'À Procura da Felicidade', 'O Segredo de Brokeback Mountain']
  },
  {
    id: 'grupos-kpop', category: 'Música',
    title: 'Qual grupo de K-pop domina o mundo?',
    image: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1200&q=82',
    options: ['BTS', 'BLACKPINK', 'Stray Kids', 'TWICE', 'SEVENTEEN', 'EXO', 'BIGBANG', 'Girls’ Generation', 'SHINee', 'Red Velvet', 'aespa', 'ENHYPEN', 'TOMORROW X TOGETHER', 'ATEEZ', 'LE SSERAFIM', 'NMIXX', 'ITZY', 'IVE', 'BABYMONSTER', '(G)I-DLE']
  },
  {
    id: 'animes', category: 'Diversão',
    title: 'Animes que todo mundo deveria assistir',
    image: 'https://images.unsplash.com/photo-1612036782180-6f0b6cd846fe?auto=format&fit=crop&w=1200&q=82',
    options: ['Fullmetal Alchemist: Brotherhood', 'Attack on Titan', 'One Piece', 'Naruto', 'Dragon Ball Z', 'Death Note', 'Hunter x Hunter', 'Demon Slayer', 'Jujutsu Kaisen', 'Cowboy Bebop', 'Neon Genesis Evangelion', 'Steins;Gate', 'Monster', 'Vinland Saga', 'Frieren', 'My Hero Academia', 'Sailor Moon', 'Bleach', 'Code Geass', 'JoJo’s Bizarre Adventure']
  },
  {
    id: 'influencers-brasil', category: 'Diversão',
    title: 'Quem realmente influencia o Brasil?',
    image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=82',
    options: ['Whindersson Nunes', 'Felipe Neto', 'Virginia Fonseca', 'Carlinhos Maia', 'Gkay', 'Juliette', 'Camila Coutinho', 'Bianca Andrade (Boca Rosa)', 'Mari Maria', 'Nath Finanças', 'Joel Jota', 'Toguro', 'Pedro Pacífico (Bookster)', 'Chef Ju Lima', 'Maira Gomez (Cunhaporanga)', 'Mari Krüger', 'Casimiro Miguel', 'Luva de Pedreiro', 'Pequena Lo', 'Tata Estaniecki']
  },
  {
    id: 'jogos-celular', category: 'Tecnologia',
    title: 'Jogos de celular impossíveis de largar',
    image: 'https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?auto=format&fit=crop&w=1200&q=82',
    options: ['Roblox', 'Free Fire', 'Block Blast!', 'Candy Crush Saga', 'Subway Surfers', 'Clash Royale', 'Brawl Stars', 'Honor of Kings', 'Pokémon GO', 'Mobile Legends: Bang Bang', 'Call of Duty: Mobile', 'PUBG Mobile', 'Royal Match', 'MONOPOLY GO!', 'Stumble Guys', 'Genshin Impact', 'Coin Master', 'Among Us', 'Minecraft', '8 Ball Pool']
  }
];

const escapeSql = value => String(value).replaceAll("'", "''");
const q = value => `'${escapeSql(value)}'`;

function validate() {
  const ids = [...existingRankings.map(([id]) => id), ...newRankings.map(r => r.id)];
  if (new Set(ids).size !== ids.length) throw new Error('Há IDs repetidos no lote.');
  for (const ranking of newRankings) {
    if (ranking.options.length !== 20) {
      throw new Error(`${ranking.id} tem ${ranking.options.length} opções; deveria ter 20.`);
    }
    if (new Set(ranking.options).size !== ranking.options.length) {
      throw new Error(`${ranking.id} tem opções repetidas.`);
    }
  }
}

function sqlStatements() {
  validate();
  const titleCases = existingRankings.map(([id, title]) => `WHEN ${q(id)} THEN ${q(title)}`).join('\n');
  const existingIds = existingRankings.map(([id]) => q(id)).join(', ');
  const updateExisting = `UPDATE rankings\nSET question = CASE id\n${titleCases}\nELSE question END,\n    created_at = CASE WHEN is_active THEN created_at ELSE now() END,\n    is_active = true\nWHERE id IN (${existingIds});`;

  const rankingValues = newRankings.map((r, index) =>
    `(${q(r.id)}, ${q(r.category)}, ${q(r.title)}, ${q(r.image)}, 0, true, now() + interval '${index + 1} seconds')`
  ).join(',\n');
  const insertRankings = `INSERT INTO rankings (id, category, question, image_url, baseline_votes, is_active, created_at)\nVALUES\n${rankingValues}\nON CONFLICT (id) DO UPDATE SET\n  category = EXCLUDED.category,\n  question = EXCLUDED.question,\n  image_url = EXCLUDED.image_url,\n  is_active = true;`;

  const optionValues = newRankings.flatMap(r => r.options.map((label, index) =>
    `(${q(r.id)}, ${q(label)}, ${index + 1}, 0)`
  )).join(',\n');
  const insertOptions = `INSERT INTO ranking_options (ranking_id, label, position, baseline_score)\nVALUES\n${optionValues}\nON CONFLICT (ranking_id, position) DO UPDATE SET\n  label = EXCLUDED.label;`;

  return [updateExisting, insertRankings, insertOptions];
}

validate();

if (process.argv.includes('--sql')) {
  process.stdout.write(JSON.stringify(sqlStatements()));
} else {
  console.log(JSON.stringify({
    existingToUpdate: existingRankings.length,
    newToInsert: newRankings.length,
    newOptions: newRankings.reduce((sum, r) => sum + r.options.length, 0),
    ids: newRankings.map(r => r.id)
  }, null, 2));
}
