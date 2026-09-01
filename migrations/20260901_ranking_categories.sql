BEGIN;

UPDATE rankings
SET category = 'Compras'
WHERE category = 'Produtos';

UPDATE rankings
SET category = 'Viagens'
WHERE category IN ('Viagem', 'Brasil');

UPDATE rankings
SET category = 'Animais'
WHERE id IN ('dinossauros-irados', 'animais-superpoderes', 'animais-extintos');

UPDATE rankings
SET category = 'Futebol'
WHERE id IN (
  'futebol',
  'times-mundo',
  'jogadoras-futebol',
  'maiores-times-brasil',
  'melhores-jogadores-flamengo',
  'melhores-jogadores-corinthians',
  'melhores-jogadores-palmeiras',
  'melhores-jogadores-sao-paulo',
  'melhores-jogadores-santos',
  'melhores-jogadores-vasco',
  'melhores-jogadores-botafogo',
  'melhores-jogadores-gremio',
  'melhores-jogadores-internacional',
  'melhores-jogadores-atletico-mg',
  'melhores-jogadores-cruzeiro',
  'melhores-jogadores-bahia',
  'melhores-jogadores-sport',
  'melhores-jogadores-athletico-pr',
  'melhores-jogadores-coritiba',
  'melhores-jogadores-fortaleza',
  'melhores-jogadores-ceara',
  'melhores-jogadores-goias',
  'melhores-jogadores-vitoria',
  'melhores-jogadores-fluminense',
  'melhor-jogador-futebol-todos-tempos',
  'melhores-goleiros-historia',
  'melhores-zagueiros-historia',
  'melhores-laterais-historia',
  'melhores-meio-campistas-historia',
  'melhores-camisas-10-historia',
  'melhores-atacantes-historia',
  'melhores-tecnicos-futebol-historia'
);

COMMIT;
