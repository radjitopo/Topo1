# TOPO

Site brasileiro de rankings comunitários. A pessoa pode votar para cima ou para baixo, usar votos duplos conquistados no perfil, escolher um nome público, comentar e sugerir novos rankings.

## Arquitetura

- `index.html`, `app.js` e `style.css`: interface pública sem framework.
- `api.js`: API HTTP de catálogo, votos, perfil, comentários, sugestões e moderação.
- `page.js`: HTML inicial rastreável, metadados e dados estruturados de Home, categorias, cidades e rankings.
- `seo-taxonomy.js`: URLs e taxonomia canônica usada pelas páginas e pelo sitemap.
- `institutional.js`: páginas institucionais e legais.
- `sitemap.js`: sitemap gerado a partir dos rankings ativos, categorias e coleções locais.
- `editorial-*.js`: conteúdo editorial carregado pelas páginas de ranking.
- `migrations/` e `scripts/`: alterações reproduzíveis do banco Neon.
- `test/`: testes de contrato, conteúdo, interface e integrações opcionais.

Produção usa Vercel Functions, Neon Postgres, Clerk para acesso por código de e-mail e Resend para avisos de moderação.

## Desenvolvimento

Requisitos: Node.js 20 ou superior e uma URL de conexão do Neon.

```bash
npm install
cp .env.example .env.local
set -a && source .env.local && set +a
npm run dev
```

O servidor local abre em `http://127.0.0.1:4173`.

## Qualidade

```bash
npm test             # testes rápidos, sem alterar o banco
npm run check        # valida a sintaxe dos arquivos principais
npm run format:check # confere o padrão de formatação
npm run validate     # executa todas as verificações acima
```

Os testes de integração usam `DATABASE_URL` e criam somente dados temporários, removidos ao final:

```bash
npm run test:api
npm run test:comments
```

## Banco de dados

As funções de produção não criam nem alteram tabelas durante uma requisição. O esquema deve ser aplicado antes da publicação:

```bash
npm run db:comments
npm run db:clerk
npm run db:notifications
npm run db:profile-names
npm run db:suggestions
npm run db:ranking-editor
```

As migrações são idempotentes. Nunca coloque credenciais reais no repositório; use variáveis locais e as configurações protegidas da Vercel.

## Publicação

`vercel.json` contém as rotas, arquivos estáticos e cabeçalhos de segurança. Antes de publicar, execute `npm run validate` e valide os fluxos de Home, ranking, voto, login e perfil em uma implantação de teste.
