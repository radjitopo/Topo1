const BASE_URL = 'https://somostopo.com.br';
const CONTACT_EMAIL = 'conta@somostopo.com.br';
const UPDATED_AT = '22 de agosto de 2026';

const pages = {
  sobre: {
    title: 'Sobre o TOPO',
    description:
      'Conheça a proposta, os princípios e a história do TOPO, o site onde tudo vira ranking.',
    kicker: 'Sobre o TOPO',
    headline: 'A internet já tem opinião. O TOPO dá forma a ela.',
    lead: 'O TOPO é um lugar para descobrir preferências, defender escolhas e acompanhar disputas que mudam com a participação da comunidade.',
    content: `
      <section class="legalSection wide">
        <h2>O que é o TOPO</h2>
        <p>O TOPO é uma plataforma brasileira de rankings participativos. Reunimos temas de cultura, comida, lugares, esporte, comportamento, produtos e cotidiano para que cada pessoa possa votar, comparar e descobrir novas referências.</p>
        <p>Nosso slogan resume a ideia: <strong>tudo vira ranking</strong>. Uma lista nunca é tratada como definitiva. Ela é um retrato das escolhas da comunidade naquele momento.</p>
      </section>
      <section class="legalSection">
        <h2>Por que existimos</h2>
        <p>A internet está cheia de listas prontas, avaliações isoladas e opiniões espalhadas. O TOPO transforma essa conversa em uma disputa clara, aberta e fácil de acompanhar.</p>
      </section>
      <section class="legalSection">
        <h2>O que um ranking significa</h2>
        <p>Os resultados representam preferência popular dentro da nossa comunidade. Não são pesquisa científica, auditoria, certificação ou garantia de qualidade. Em temas importantes, consulte também fontes técnicas e especializadas.</p>
      </section>
      <section class="legalSection">
        <h2>Independência do resultado</h2>
        <p>Marcas e estabelecimentos poderão anunciar no TOPO, mas não poderão comprar votos, pontos ou posição numerada. Toda publicidade será identificada e separada do resultado da comunidade.</p>
      </section>
      <section class="legalSection">
        <h2>Um produto em evolução</h2>
        <p>O TOPO está em fase beta. Novas categorias, perfis, ferramentas e formatos serão lançados aos poucos. Correções editoriais e técnicas fazem parte desse processo.</p>
      </section>
      <section class="legalSection wide legalCallout">
        <h2>Quer falar com a gente?</h2>
        <p>Sugestões, críticas e boas ideias são bem-vindas.</p>
        <a class="legalAction" href="/contato">Fale com o TOPO →</a>
      </section>`,
  },
  'como-funciona': {
    title: 'Como funciona',
    description: 'Entenda como os votos, a pontuação e a ordem dos rankings do TOPO funcionam.',
    kicker: 'Transparência',
    headline: 'O ranking muda com você.',
    lead: 'Os resultados mostram a preferência da comunidade naquele momento — não uma verdade definitiva nem uma pesquisa científica.',
    content: `
      <section class="legalSection wide">
        <h2>Como um ranking é formado</h2>
        <div class="methodStep"><b>1</b><div><strong>A lista começa</strong><p>A equipe do TOPO seleciona o tema e as opções. Alguns rankings podem estrear com uma ordem editorial inicial para que a disputa não comece vazia.</p></div></div>
        <div class="methodStep"><b>2</b><div><strong>A comunidade vota</strong><p>A seta para cima soma um ponto. A seta para baixo tira um ponto. Para quem já conquistou essa regalia, tocar novamente na mesma seta ativa o voto duplo; o terceiro toque volta ao voto simples. Escolher a seta oposta troca a direção.</p></div></div>
        <div class="methodStep"><b>3</b><div><strong>A ordem se atualiza</strong><p>As opções aparecem da maior para a menor pontuação. Em caso de empate, a ordem original funciona como desempate até que novos votos mudem a disputa.</p></div></div>
      </section>
      <section class="legalSection">
        <h2>Limites de voto</h2>
        <ul><li>Até 20 opções avaliadas em cada ranking.</li><li>Até 30 votos sem cadastro; depois, pedimos acesso por e-mail.</li><li>Um voto ativo por opção e por pessoa ou dispositivo vinculado.</li><li>Votos duplos são liberados conforme a participação e valem dois pontos.</li><li>O Top 10 aparece primeiro; o ranking completo pode ser aberto logo abaixo.</li></ul>
      </section>
      <section class="legalSection">
        <h2>Busca e descoberta</h2>
        <p>A busca considera títulos, categorias, opções e variações de singular, plural e acentos. Na área “Todos”, rankings novos, relevantes e ainda não votados podem aparecer primeiro para cada pessoa.</p>
      </section>
      <section class="legalSection">
        <h2>Comentários</h2>
        <p>Em rankings com comentários abertos, pessoas cadastradas podem explicar suas escolhas. Comentários não alteram a pontuação e devem seguir as <a href="/regras">Regras da comunidade</a>.</p>
      </section>
      <section class="legalSection">
        <h2>Integridade</h2>
        <p>Limites de voto e identificadores de conta ou dispositivo ajudam a reduzir duplicidade. Atividade automatizada, coordenada ou destinada a manipular resultados poderá ser revista e removida.</p>
      </section>
      <section class="legalSection">
        <h2>Negócios e patrocínio</h2>
        <p>Publicidade, destaque ou conteúdo patrocinado serão identificados. Pagamento não altera voto, pontuação nem posição no ranking.</p>
      </section>
      <section class="legalSection wide">
        <h2>Erros e correções</h2>
        <p>Encontrou nome incorreto, opção repetida ou informação desatualizada? <a href="/contato">Avise a equipe</a>. Correções editoriais podem ser feitas sem alterar artificialmente a vontade da comunidade.</p>
      </section>`,
  },
  imprensa: {
    title: 'Imprensa',
    description:
      'Informações essenciais sobre o TOPO para imprensa, criadores e parceiros editoriais.',
    kicker: 'Imprensa',
    headline: 'O TOPO em poucas palavras.',
    lead: 'Informações para jornalistas, veículos, pesquisadores, criadores e parceiros que desejam conhecer ou citar o projeto.',
    content: `
      <section class="legalSection wide">
        <h2>Apresentação</h2>
        <p>O TOPO é uma plataforma brasileira de rankings participativos. A comunidade usa votos positivos e negativos para movimentar listas de cultura, gastronomia, lugares, esporte, comportamento, produtos e cotidiano.</p>
        <p>A marca utiliza o slogan <strong>“Tudo vira ranking”</strong> e está em fase beta desde 2026.</p>
      </section>
      <section class="legalSection">
        <h2>Dados rápidos</h2>
        <ul><li>Nome: TOPO.</li><li>Endereço digital: somostopo.com.br.</li><li>Formato: rankings abertos à participação.</li><li>Base: Brasil, com primeiros rankings locais em Florianópolis, Balneário Camboriú, São Paulo e Rio de Janeiro.</li></ul>
      </section>
      <section class="legalSection">
        <h2>Uso de resultados</h2>
        <p>Resultados podem ser citados com data de consulta, nome completo do ranking e link para a página correspondente. Como as posições mudam, recomendamos não apresentar o resultado como pesquisa científica ou avaliação técnica.</p>
      </section>
      <section class="legalSection">
        <h2>Marca e imagens</h2>
        <p>Para solicitar logo, imagens em alta resolução ou autorização para uso editorial da identidade do TOPO, entre em contato antes da publicação.</p>
      </section>
      <section class="legalSection">
        <h2>Entrevistas e informações</h2>
        <p>Envie o nome do veículo ou projeto, assunto, formato e prazo. Responderemos conforme a disponibilidade da equipe.</p>
        <a class="legalAction" href="mailto:${CONTACT_EMAIL}?subject=Imprensa%20-%20TOPO">Contato de imprensa →</a>
      </section>`,
  },
  anuncie: {
    title: 'Anuncie no TOPO',
    description: 'Conheça os princípios para publicidade, parcerias e presença de marcas no TOPO.',
    kicker: 'Publicidade e parcerias',
    headline: 'Marcas entram na conversa, não no resultado.',
    lead: 'O TOPO está preparando formatos comerciais para aproximar negócios de públicos interessados sem vender posições nem interferir nos votos.',
    content: `
      <section class="legalSection wide legalCallout">
        <h2>Nosso princípio</h2>
        <p>Publicidade pode financiar conteúdo, tecnologia e expansão. O que ela não pode fazer é comprar legitimidade. Anúncios serão identificados e permanecerão separados da ordem criada pela comunidade.</p>
      </section>
      <section class="legalSection">
        <h2>O que poderá existir</h2>
        <ul><li>Publicidade identificada por categoria ou cidade.</li><li>Conteúdo de marca claramente sinalizado.</li><li>Páginas informativas para negócios.</li><li>Projetos especiais e rankings patrocinados com regras transparentes.</li></ul>
      </section>
      <section class="legalSection">
        <h2>O que não vendemos</h2>
        <ul><li>Votos positivos ou negativos.</li><li>Posição numerada.</li><li>Remoção de crítica legítima.</li><li>Acesso a dados pessoais individualizados dos usuários.</li></ul>
      </section>
      <section class="legalSection">
        <h2>Topo Business</h2>
        <p>A futura área Topo Business reunirá rankings locais e comerciais, como restaurantes, hotéis, cafés e serviços. A experiência poderá ter identidade própria, mantendo a mesma independência de resultado.</p>
      </section>
      <section class="legalSection">
        <h2>Vamos conversar</h2>
        <p>Conte sobre sua empresa, cidade, público e ideia de parceria. As propostas serão avaliadas individualmente durante a fase beta.</p>
        <a class="legalAction" href="mailto:${CONTACT_EMAIL}?subject=Anuncie%20no%20TOPO">Apresentar uma proposta →</a>
      </section>`,
  },
  contato: {
    title: 'Fale conosco',
    description:
      'Entre em contato com a equipe do TOPO para dúvidas, sugestões, correções e parcerias.',
    kicker: 'Fale conosco',
    headline: 'Toda boa conversa pode mudar o TOPO.',
    lead: 'Use este canal para sugestões, dúvidas, correções editoriais, parcerias ou problemas com sua conta.',
    content: `
      <section class="legalSection wide contactPanel">
        <h2>Contato geral</h2>
        <p>Escreva para <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>. Para ajudar no atendimento, coloque no assunto o motivo da mensagem e inclua o link da página quando estiver falando de um ranking específico.</p>
        <a class="legalAction" href="mailto:${CONTACT_EMAIL}?subject=Contato%20pelo%20TOPO">Escrever para o TOPO →</a>
      </section>
      <section class="legalSection">
        <h2>Correção de ranking</h2>
        <p>Informe o nome do ranking, a opção que precisa ser corrigida e, quando possível, uma fonte confiável. Pedidos de correção não garantem mudança de posição ou pontuação.</p>
      </section>
      <section class="legalSection">
        <h2>Conta e privacidade</h2>
        <p>Use o mesmo e-mail vinculado à conta e nunca envie código de acesso, senha de outro serviço ou documento completo. Solicitações sobre dados pessoais serão tratadas conforme a <a href="/privacidade">Política de Privacidade</a>.</p>
      </section>
      <section class="legalSection">
        <h2>Denúncias</h2>
        <p>Conteúdo ofensivo, ilegal, fraudulento ou que exponha dados pessoais deve ser enviado pelo nosso <a href="/denuncie">canal de denúncias</a>.</p>
      </section>
      <section class="legalSection">
        <h2>Publicidade e imprensa</h2>
        <p>Para propostas comerciais, visite <a href="/anuncie">Anuncie no TOPO</a>. Para entrevistas e uso editorial da marca, consulte a página de <a href="/imprensa">Imprensa</a>.</p>
      </section>
      <section class="legalSection wide">
        <h2>Prazo de resposta</h2>
        <p>O TOPO ainda opera com uma equipe pequena. Lemos todas as mensagens, mas o tempo de resposta pode variar conforme o assunto e a quantidade de contatos.</p>
      </section>`,
  },
  denuncie: {
    title: 'Denuncie um conteúdo',
    description: 'Saiba como denunciar conteúdo, comentário, ranking ou uso indevido no TOPO.',
    kicker: 'Canal de denúncias',
    headline: 'Ajude a manter a disputa saudável.',
    lead: 'Denúncias ajudam a identificar abuso, ilegalidade, fraude, exposição indevida e violações das regras da comunidade.',
    content: `
      <section class="legalSection wide contactPanel">
        <h2>Como denunciar</h2>
        <p>Envie o link exato da página, descreva o conteúdo denunciado e explique o motivo. Se houver contexto ou prova relevante, inclua sem compartilhar dados pessoais desnecessários.</p>
        <a class="legalAction" href="mailto:${CONTACT_EMAIL}?subject=Den%C3%BAncia%20de%20conte%C3%BAdo%20-%20TOPO">Enviar denúncia →</a>
      </section>
      <section class="legalSection">
        <h2>O que pode ser denunciado</h2>
        <ul><li>Ameaça, assédio ou discurso de ódio.</li><li>Exposição de informações pessoais.</li><li>Conteúdo ilegal ou exploração de pessoas vulneráveis.</li><li>Spam, fraude, falsidade de identidade ou manipulação organizada.</li><li>Uso indevido de imagem, texto, marca ou obra protegida.</li></ul>
      </section>
      <section class="legalSection">
        <h2>O que acontece depois</h2>
        <p>A equipe poderá preservar registros, limitar a visibilidade, remover conteúdo, suspender contas ou pedir informações adicionais. A análise considera contexto, legislação e as <a href="/regras">Regras da comunidade</a>.</p>
      </section>
      <section class="legalSection">
        <h2>Direitos autorais</h2>
        <p>Pedidos de crédito ou remoção por direitos autorais devem incluir identificação do titular, obra protegida, localização do conteúdo e declaração de boa-fé. Veja as instruções completas em <a href="/direitos-autorais">Direitos autorais</a>.</p>
      </section>
      <section class="legalSection">
        <h2>Risco imediato</h2>
        <p>O TOPO não é um serviço de emergência. Em situações de risco imediato à vida ou à integridade de alguém, procure os serviços públicos de emergência ou as autoridades competentes.</p>
      </section>
      <section class="legalSection wide">
        <h2>Privacidade da denúncia</h2>
        <p>Tratamos os dados recebidos de forma restrita e compatível com a análise. Informações poderão ser preservadas ou compartilhadas quando necessário para cumprir obrigação legal, proteger direitos ou cooperar com autoridades competentes.</p>
      </section>`,
  },
  regras: {
    title: 'Regras da comunidade',
    description:
      'Conheça as regras de participação, comentários e convivência da comunidade do TOPO.',
    kicker: 'Comunidade',
    headline: 'Discorde à vontade. Ataque ideias, não pessoas.',
    lead: 'O TOPO existe para opiniões diferentes conviverem. A disputa pode ser divertida, intensa e até surpreendente — sem virar abuso.',
    content: `
      <section class="legalSection wide legalCallout">
        <h2>A regra mais importante</h2>
        <p>Vote com autenticidade e converse com respeito. Não transforme discordância sobre comida, música, política cultural, esporte ou qualquer outro tema em perseguição pessoal.</p>
      </section>
      <section class="legalSection">
        <h2>Não é permitido</h2>
        <ul><li>Ameaçar, assediar, humilhar ou incentivar violência.</li><li>Atacar pessoas por raça, origem, religião, gênero, orientação sexual, deficiência ou outra característica protegida.</li><li>Publicar dados pessoais ou conversas privadas sem autorização.</li><li>Fazer spam, propaganda disfarçada ou fraude.</li><li>Usar robôs, contas múltiplas ou campanhas coordenadas para manipular resultados.</li></ul>
      </section>
      <section class="legalSection">
        <h2>Crítica e opinião</h2>
        <p>Críticas firmes são permitidas. Prefira falar da experiência, da obra, do produto ou do serviço. Evite acusações de crime, fraude ou conduta grave sem base verificável.</p>
      </section>
      <section class="legalSection">
        <h2>Comentários e nomes</h2>
        <p>Não se passe por outra pessoa, empresa ou instituição. Comentários devem ter relação com o ranking e não podem ser usados para divulgar links repetitivos, golpes ou contato comercial não solicitado.</p>
      </section>
      <section class="legalSection">
        <h2>Moderação</h2>
        <p>Conteúdo pode ser limitado ou removido. Contas podem receber aviso, restrição ou suspensão conforme gravidade, reincidência, risco e obrigação legal. Nem toda decisão será anunciada publicamente.</p>
      </section>
      <section class="legalSection wide">
        <h2>Viu algo fora das regras?</h2>
        <p>Não amplifique o problema. Copie o link e use o <a href="/denuncie">canal de denúncias</a>. Se a questão for apenas uma divergência de gosto, deixe seu voto falar.</p>
      </section>`,
  },
  seguranca: {
    title: 'Segurança e privacidade',
    description:
      'Conheça as práticas de segurança do TOPO e saiba como proteger sua conta e reportar problemas.',
    kicker: 'Segurança',
    headline: 'Proteção também precisa estar no topo.',
    lead: 'Segurança é um processo contínuo. Esta página reúne cuidados para sua conta, seus dados e o reporte responsável de falhas.',
    content: `
      <section class="legalSection">
        <h2>Proteja seu acesso</h2>
        <ul><li>O TOPO envia código de acesso por e-mail e não pede que você compartilhe esse código.</li><li>Proteja a conta de e-mail usada no cadastro.</li><li>Saia da conta ao usar aparelho compartilhado.</li><li>Desconfie de mensagens prometendo votos, posições ou benefícios em nome do TOPO.</li></ul>
      </section>
      <section class="legalSection">
        <h2>O que fazemos</h2>
        <p>Utilizamos conexão criptografada, controles de acesso, fornecedores especializados, limites contra abuso e registros técnicos necessários para investigar falhas e proteger o serviço.</p>
      </section>
      <section class="legalSection">
        <h2>Reporte uma falha</h2>
        <p>Encontrou uma possível vulnerabilidade? Envie descrição clara, endereço afetado, passos para reprodução e impacto percebido. Não inclua dados pessoais de terceiros além do indispensável.</p>
        <a class="legalAction" href="mailto:${CONTACT_EMAIL}?subject=Seguran%C3%A7a%20-%20TOPO">Comunicar problema de segurança →</a>
      </section>
      <section class="legalSection">
        <h2>Divulgação responsável</h2>
        <p>Não explore a falha além do necessário para demonstrá-la, não interrompa o serviço, não acesse contas alheias e não divulgue detalhes antes de termos oportunidade razoável de investigar e corrigir.</p>
      </section>
      <section class="legalSection wide">
        <h2>Dados pessoais</h2>
        <p>Para saber quais dados usamos, por que usamos e como exercer seus direitos, consulte a <a href="/privacidade">Política de Privacidade</a> e a <a href="/cookies">Política de Cookies</a>.</p>
      </section>`,
  },
  privacidade: {
    title: 'Política de Privacidade',
    description:
      'Saiba quais dados o TOPO utiliza, para quais finalidades e como exercer seus direitos de privacidade.',
    kicker: 'Privacidade',
    headline: 'Seus dados não entram em disputa.',
    lead: 'Esta política explica, em linguagem simples, como o TOPO trata informações para manter votos, contas, comentários e segurança funcionando.',
    content: `
      <section class="legalSection wide">
        <h2>Quem é responsável</h2>
        <p>O TOPO, responsável pelo site somostopo.com.br, controla o tratamento descrito nesta política. Solicitações relacionadas a dados pessoais podem ser enviadas para <a href="mailto:${CONTACT_EMAIL}?subject=Privacidade%20-%20TOPO">${CONTACT_EMAIL}</a>.</p>
      </section>
      <section class="legalSection">
        <h2>Dados que podemos tratar</h2>
        <ul><li>Identificador aleatório do dispositivo salvo no navegador.</li><li>Votos, rankings acessados, comentários e horários de interação.</li><li>Nome e e-mail quando uma conta é criada.</li><li>Mensagens enviadas aos canais de contato e denúncia.</li><li>Dados técnicos, como endereço IP, navegador, registros de segurança e falhas.</li></ul>
      </section>
      <section class="legalSection">
        <h2>Por que usamos</h2>
        <ul><li>Registrar, recuperar e limitar votos.</li><li>Autenticar contas e manter sessões.</li><li>Publicar comentários escolhidos pelo usuário.</li><li>Recomendar rankings e melhorar a experiência.</li><li>Prevenir fraude, abuso e incidentes de segurança.</li><li>Cumprir obrigações legais e proteger direitos.</li></ul>
      </section>
      <section class="legalSection">
        <h2>Bases e escolhas</h2>
        <p>Dependendo da finalidade, o tratamento poderá ser necessário para executar o serviço solicitado, cumprir obrigação legal, exercer direitos, atender interesse legítimo de segurança e melhoria ou respeitar uma escolha de consentimento.</p>
      </section>
      <section class="legalSection">
        <h2>O que fica público</h2>
        <p>Pontuações agregadas são públicas. Ao comentar, o nome exibido, a opção escolhida e o texto também podem ficar visíveis. E-mail, código de acesso e identificadores técnicos não são publicados.</p>
      </section>
      <section class="legalSection">
        <h2>Fornecedores</h2>
        <p>Dados podem passar por fornecedores de hospedagem, banco de dados, autenticação, segurança e e-mail, na medida necessária para prestar o serviço. Alguns poderão processar informações fora do Brasil sob mecanismos de proteção aplicáveis.</p>
      </section>
      <section class="legalSection">
        <h2>Venda e publicidade</h2>
        <p>Não vendemos dados pessoais individualizados. Se no futuro usarmos tecnologias publicitárias ou analíticas não essenciais, esta política e as opções de cookies serão atualizadas.</p>
      </section>
      <section class="legalSection">
        <h2>Retenção</h2>
        <p>Guardamos informações pelo tempo necessário para as finalidades descritas, funcionamento da conta, integridade dos rankings, prevenção de fraude e cumprimento de obrigações. Dados podem ser anonimizados ou eliminados quando deixam de ser necessários.</p>
      </section>
      <section class="legalSection">
        <h2>Seus direitos</h2>
        <p>Você pode solicitar confirmação, acesso, correção, portabilidade quando aplicável, informação sobre compartilhamento, revisão de decisões automatizadas, oposição, anonimização, bloqueio ou eliminação nos casos previstos em lei.</p>
      </section>
      <section class="legalSection">
        <h2>Crianças e adolescentes</h2>
        <p>O TOPO não foi desenhado para coletar intencionalmente dados sensíveis de crianças. Responsáveis podem solicitar análise e remoção de informações relacionadas a menores pelo canal de privacidade.</p>
      </section>
      <section class="legalSection">
        <h2>Segurança</h2>
        <p>Adotamos medidas proporcionais ao estágio do produto, mas nenhum serviço é totalmente imune a incidentes. Saiba mais em <a href="/seguranca">Segurança e privacidade</a>.</p>
      </section>
      <section class="legalSection wide">
        <h2>Como exercer seus direitos</h2>
        <p>Escreva para <a href="mailto:${CONTACT_EMAIL}?subject=Direitos%20de%20dados%20-%20TOPO">${CONTACT_EMAIL}</a> usando, quando possível, o mesmo e-mail da conta. Poderemos pedir informações mínimas para confirmar a identidade e proteger seus dados.</p>
        <p class="legalFine">Referências: <a href="https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados-1/direito-dos-titulares" target="_blank" rel="noopener noreferrer">direitos dos titulares na ANPD</a> e <a href="https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm" target="_blank" rel="noopener noreferrer">Lei Geral de Proteção de Dados</a>.</p>
      </section>`,
  },
  termos: {
    title: 'Termos de Uso',
    description: 'Conheça as regras para usar, votar, comentar e participar do TOPO.',
    kicker: 'Termos de uso',
    headline: 'Uma disputa boa precisa de regras claras.',
    lead: 'Ao acessar ou utilizar o TOPO, você concorda em participar de forma autêntica e respeitosa e reconhece que o serviço está em fase beta.',
    content: `
      <section class="legalSection">
        <h2>Natureza dos rankings</h2>
        <p>Resultados refletem opiniões e interações da comunidade. Não representam avaliação técnica, certificação, pesquisa científica ou garantia de qualidade, segurança, disponibilidade ou adequação.</p>
      </section>
      <section class="legalSection">
        <h2>Participação</h2>
        <p>Você não deve usar automação, contas múltiplas, identidades falsas, compra de interação ou qualquer método destinado a manipular votos, comentários ou resultados.</p>
      </section>
      <section class="legalSection">
        <h2>Conta e acesso</h2>
        <p>O acesso pode ser feito por código enviado ao e-mail informado. Você é responsável por proteger esse e-mail, sua sessão e seu dispositivo. Informe imediatamente qualquer uso não autorizado.</p>
      </section>
      <section class="legalSection">
        <h2>Conteúdo do usuário</h2>
        <p>Você mantém os direitos sobre o que publica e concede ao TOPO autorização não exclusiva, gratuita e limitada para hospedar, exibir, moderar e distribuir esse conteúdo dentro do serviço e de suas divulgações relacionadas.</p>
      </section>
      <section class="legalSection">
        <h2>Comentários e convivência</h2>
        <p>Não publique conteúdo ilegal, ameaçador, discriminatório, fraudulento, enganoso, publicitário, invasivo de privacidade ou que viole direitos de terceiros. Consulte as <a href="/regras">Regras da comunidade</a>.</p>
      </section>
      <section class="legalSection">
        <h2>Listas e correções</h2>
        <p>O TOPO pode criar, corrigir, unir, pausar, reorganizar editorialmente ou remover rankings e opções para manter relevância, segurança e integridade. Correção editorial não significa compra de posição.</p>
      </section>
      <section class="legalSection">
        <h2>Publicidade</h2>
        <p>Publicidade e conteúdo patrocinado serão identificados. Pagamentos não poderão comprar votos, pontos ou posição numerada. Condições comerciais específicas poderão ter regras complementares.</p>
      </section>
      <section class="legalSection">
        <h2>Moderação e suspensão</h2>
        <p>Podemos limitar recursos, remover conteúdo, invalidar interações ou suspender acesso em caso de violação, risco, fraude, obrigação legal ou proteção da comunidade.</p>
      </section>
      <section class="legalSection">
        <h2>Disponibilidade</h2>
        <p>Funções podem ser alteradas ou interrompidas para manutenção, segurança ou evolução. Durante a fase beta, não garantimos operação ininterrupta nem preservação permanente de todo conteúdo.</p>
      </section>
      <section class="legalSection">
        <h2>Responsabilidade</h2>
        <p>Na medida permitida pela legislação, o TOPO não responde por decisões tomadas exclusivamente com base em rankings, conteúdo de usuários, indisponibilidade temporária ou páginas externas acessadas por links.</p>
      </section>
      <section class="legalSection">
        <h2>Privacidade e propriedade intelectual</h2>
        <p>O tratamento de dados está na <a href="/privacidade">Política de Privacidade</a>. Questões sobre obras, marcas e imagens estão em <a href="/direitos-autorais">Direitos autorais</a>.</p>
      </section>
      <section class="legalSection">
        <h2>Legislação e direitos</h2>
        <p>Estes termos são interpretados conforme a legislação brasileira, sem afastar direitos obrigatórios de consumidores, titulares de dados ou outras pessoas protegidas por lei.</p>
      </section>
      <section class="legalSection wide">
        <h2>Contato e alterações</h2>
        <p>Dúvidas podem ser enviadas para <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>. Mudanças importantes serão publicadas nesta página com nova data de atualização.</p>
      </section>`,
  },
  cookies: {
    title: 'Política de Cookies',
    description:
      'Entenda quais cookies e tecnologias locais o TOPO utiliza e como gerenciar suas preferências.',
    kicker: 'Cookies e armazenamento local',
    headline: 'Pequenos arquivos, explicação sem migalhas.',
    lead: 'Cookies e tecnologias semelhantes ajudam o TOPO a lembrar seu acesso, seus votos e algumas preferências do aparelho.',
    content: `
      <section class="legalSection wide">
        <h2>O que são</h2>
        <p>Cookies são pequenos arquivos enviados ao navegador. O armazenamento local cumpre função semelhante, guardando informações no próprio aparelho. Essas tecnologias podem ser próprias do TOPO ou dos fornecedores necessários para operar o serviço.</p>
      </section>
      <section class="legalSection">
        <h2>O que usamos hoje</h2>
        <ul><li>Identificador aleatório do dispositivo para registrar votos e reduzir duplicidade.</li><li>Informações de sessão para manter a conta conectada com segurança.</li><li>Preferências locais, como avisos já vistos e seleção de conteúdo exibido.</li><li>Registros técnicos de segurança e funcionamento mantidos pela infraestrutura.</li></ul>
      </section>
      <section class="legalSection">
        <h2>Cookies essenciais</h2>
        <p>São necessários para autenticação, segurança, limites de voto e funções pedidas pelo usuário. Bloqueá-los pode impedir login, recuperação de votos e outras partes do site.</p>
      </section>
      <section class="legalSection">
        <h2>Publicidade e análise</h2>
        <p>Na versão atual, o TOPO não utiliza cookies próprios de publicidade comportamental. Se ferramentas analíticas ou publicitárias não essenciais forem adotadas, esta página e os controles de preferência serão atualizados.</p>
      </section>
      <section class="legalSection">
        <h2>Como gerenciar</h2>
        <p>Seu navegador permite visualizar, apagar ou bloquear cookies e dados locais. A limpeza pode desconectar a conta, reiniciar preferências e impedir o reconhecimento de votos feitos sem cadastro naquele aparelho.</p>
      </section>
      <section class="legalSection wide">
        <h2>Dúvidas</h2>
        <p>Para informações sobre dados pessoais, consulte a <a href="/privacidade">Política de Privacidade</a> ou escreva para <a href="mailto:${CONTACT_EMAIL}?subject=Cookies%20e%20privacidade%20-%20TOPO">${CONTACT_EMAIL}</a>.</p>
        <p class="legalFine">Referência: <a href="https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia_orientativo_cookies_e_protecao_de_dados_pessoais" target="_blank" rel="noopener noreferrer">Guia de Cookies e Proteção de Dados Pessoais da ANPD</a>.</p>
      </section>`,
  },
  'direitos-autorais': {
    title: 'Direitos autorais',
    description:
      'Entenda como o TOPO trata propriedade intelectual e pedidos de crédito ou remoção de conteúdo.',
    kicker: 'Propriedade intelectual',
    headline: 'Criação merece crédito e respeito.',
    lead: 'O TOPO respeita direitos autorais, marcas, imagem e outros direitos de propriedade intelectual e oferece um canal para análise de pedidos.',
    content: `
      <section class="legalSection">
        <h2>Conteúdo do TOPO</h2>
        <p>Marca, identidade visual, textos editoriais, organização e código do TOPO são protegidos conforme a legislação aplicável. O uso além de citação, compartilhamento comum ou autorização expressa pode exigir permissão.</p>
      </section>
      <section class="legalSection">
        <h2>Conteúdo de terceiros</h2>
        <p>Nomes de obras, marcas, pessoas e estabelecimentos são usados para identificar os temas dos rankings. Imagens, textos ou marcas de terceiros permanecem sujeitos aos direitos de seus titulares.</p>
      </section>
      <section class="legalSection">
        <h2>Conteúdo enviado pelo usuário</h2>
        <p>Quem publica um comentário declara possuir direito para fazê-lo e não deve copiar obra protegida de terceiros sem autorização ou fundamento legal.</p>
      </section>
      <section class="legalSection">
        <h2>Pedido de crédito ou remoção</h2>
        <p>Informe seu nome e contato, identifique a obra, explique sua relação com os direitos, envie o endereço exato do conteúdo e descreva a providência solicitada. Declarações falsas podem causar prejuízos e responsabilização.</p>
        <a class="legalAction" href="mailto:${CONTACT_EMAIL}?subject=Direitos%20autorais%20-%20TOPO">Enviar solicitação →</a>
      </section>
      <section class="legalSection">
        <h2>Análise</h2>
        <p>Podemos pedir documentos ou contexto adicional, limitar preventivamente o acesso, corrigir crédito, substituir imagem ou remover conteúdo. Também poderemos ouvir a pessoa que publicou o material quando apropriado.</p>
      </section>
      <section class="legalSection wide">
        <h2>Compartilhar rankings</h2>
        <p>Você pode compartilhar links e pequenos trechos com crédito e sem alterar o sentido. Para reprodução comercial ampla, banco de dados, uso de marca ou republicação sistemática, solicite autorização.</p>
        <p class="legalFine">Referência: <a href="https://www.planalto.gov.br/ccivil_03/leis/l9610.htm" target="_blank" rel="noopener noreferrer">Lei nº 9.610/1998</a>.</p>
      </section>`,
  },
};

function escapeHtml(value) {
  return String(value || '').replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character],
  );
}

function footerHtml() {
  return `<footer class="siteFooter">
    <div class="wrap siteFooterGrid">
      <div class="siteFooterIntro"><a class="siteFooterBrand" href="/" aria-label="TOPO — ir para a home"><img src="/logo-topo.svg" alt="TOPO" width="184" height="60"></a><p>Tudo vira ranking. Vote, descubra e mude a ordem.</p></div>
      <nav class="siteFooterColumn" aria-label="Sobre o TOPO"><strong>Sobre o TOPO</strong><a href="/sobre">Sobre nós</a><a href="/como-funciona">Como funciona</a><a href="/imprensa">Imprensa</a><a href="/anuncie">Anuncie no TOPO</a></nav>
      <nav class="siteFooterColumn" aria-label="Ajuda e segurança"><strong>Ajuda e segurança</strong><a href="/contato">Fale conosco</a><a href="/denuncie">Denuncie um conteúdo</a><a href="/regras">Regras da comunidade</a><a href="/seguranca">Segurança e privacidade</a></nav>
      <nav class="siteFooterColumn" aria-label="Informações legais"><strong>Legal</strong><a href="/termos">Termos de uso</a><a href="/privacidade">Política de privacidade</a><a href="/cookies">Política de cookies</a><a href="/direitos-autorais">Direitos autorais</a></nav>
    </div>
    <div class="wrap siteFooterBottom"><span>© 2026 TOPO — Tudo vira ranking.</span><span>Feito no Brasil.</span></div>
  </footer>`;
}

function renderPage(slug, page) {
  const title = `${page.title} — TOPO`;
  const canonical = `${BASE_URL}/${slug}`;
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(page.description)}">
<link rel="canonical" href="${escapeHtml(canonical)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta property="og:locale" content="pt_BR"><meta property="og:type" content="website"><meta property="og:site_name" content="TOPO">
<meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(page.description)}"><meta property="og:url" content="${escapeHtml(canonical)}"><meta property="og:image" content="${BASE_URL}/og-topo.png">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(title)}"><meta name="twitter:description" content="${escapeHtml(page.description)}"><meta name="twitter:image" content="${BASE_URL}/og-topo.png">
<meta name="theme-color" content="#4a0790">
<link rel="icon" href="/topo-mark.svg" type="image/svg+xml">
<link rel="stylesheet" href="/style.css?v=20260824-8">
<link rel="stylesheet" href="/pop-electric.css?v=20260824-6">
</head>
<body class="legalShell popElectric">
<header class="legalTop"><div class="wrap"><a class="logo" href="/" aria-label="TOPO — ir para a home"><img src="/logo-topo.svg" alt="TOPO" width="184" height="60"></a><a class="legalBack" href="/">← Voltar aos rankings</a></div></header>
<main class="wrap legalPage">
  <div class="legalKicker">${escapeHtml(page.kicker)}</div>
  <h1>${escapeHtml(page.headline)}</h1>
  <p class="legalLead">${escapeHtml(page.lead)}</p>
  <span class="legalUpdated">Atualizado em ${UPDATED_AT}</span>
  <div class="legalGrid">${page.content}</div>
  <p class="legalReviewNote">Esta é uma versão inicial para a fase beta do TOPO e poderá ser revisada conforme o serviço evoluir.</p>
</main>
${footerHtml()}
</body>
</html>`;
}

export default function handler(req, res) {
  const rawSlug = Array.isArray(req.query?.slug) ? req.query.slug[0] : req.query?.slug;
  const slug = String(rawSlug || '')
    .replace(/^\/+|\/+$/g, '')
    .toLowerCase();
  const page = pages[slug];
  if (!page) {
    res.setHeader('Location', '/');
    return res.status(302).end();
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).send(renderPage(slug, page));
}

export { pages, footerHtml, renderPage };
