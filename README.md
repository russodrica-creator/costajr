# Portal Costa Júnior

Portal interno da Costa Júnior Engenharia e Construções.

## Módulo Novos Negócios: funil de compradores de terrenos

Controle dos interessados nos terrenos à venda em Mairinque/SP, do primeiro contato (Facebook, OLX, VivaReal, Zap, Instagram…) até a venda.

| Tela | Para que serve |
|---|---|
| **Painel** | Interessados ativos, retornos atrasados, visitas, propostas, vendas e **qual canal traz compradores** |
| **Funil de compradores** | Quadro por etapa: arraste o cartão para mudar de etapa |
| **Interessados** | Lista com busca e filtros, cadastro completo, histórico de contatos e exportação para Excel |
| **Terrenos** | Cadastro dos lotes (área, preço, R$/m², condições, situação) e interessados em cada um |
| **Mensagens prontas** | Textos para responder anúncios e Direct. Dentro do interessado, saem preenchidos com nome e dados do terreno |
| **Backup e exportação** | CSV para Excel e backup completo em arquivo |

Etapas do funil: Novo contato → Em conversa → Qualificado → Visita agendada → Proposta → Negociação → Vendido / Perdido (com motivo).

WhatsApp só aparece para quem **pediu ou autorizou** o contato (campo no cadastro), em linha com a LGPD.

## Como usar

O portal é um site estático (HTML, CSS e JavaScript, sem instalação).

- **Para testar:** abra `index.html` no navegador.
- **Para publicar:** no GitHub, *Settings › Pages › Deploy from a branch › main / (root)*. O endereço fica `https://<usuario>.github.io/costajr/`.

### Modo local × banco compartilhado

Sem configuração, o portal roda em **modo local**: os dados ficam só no navegador de quem usa. Faça backups em *Backup e exportação*.

Para a equipe trabalhar junta, com os mesmos dados e login:

1. Crie um projeto gratuito em [supabase.com](https://supabase.com).
2. Em *SQL Editor*, rode o arquivo [`supabase/schema.sql`](supabase/schema.sql).
3. Em *Authentication › Sign In / Providers*, **desative "Allow new users to sign up"** e crie os usuários da equipe em *Authentication › Users › Add user*.
4. Em *Project Settings › API*, copie a **Project URL** e a chave **anon public** para o `config.js`.
5. Se já usava o modo local: baixe o backup antes e restaure depois de entrar.

A chave *anon* pode ficar no código: sem login, o banco não entrega nada (RLS). Nunca coloque a chave *service_role* aqui.

## Estrutura

```
index.html            casca do portal (menu, modal)
config.js             configuração do Supabase (opcional)
assets/css/styles.css identidade visual (vermelho #C41E3A + cinza #5B5F6B)
assets/js/store.js    dados: modo local ou Supabase
assets/js/app.js      telas do módulo Novos Negócios
supabase/schema.sql   tabelas e permissões do banco
```
