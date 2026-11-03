# Save the Date — nossa história, nosso café, nosso para sempre

Convite estático em HTML, CSS e JavaScript. O envio de respostas usa Supabase quando configurado. Sem credenciais, o formulário informa que não é possível salvar; nenhum RSVP é guardado no navegador.

## Arquivos

- `index.html`, `styles.css`, `app.js`: convite, estilos responsivos e formulário.
- `privacidade.html`: aviso de privacidade acessível antes do envio da resposta.
- `assets/coffee-branch.svg`: ramo vetorial de café feito para a composição.
- `assets/Logo_Casal.jpeg`: identidade visual usada também como favicon das páginas.
- `assets/WhatsApp Video 2026-11-02 at 20.40.58.mp4`: vídeo atualmente em destaque.
- `assets/Save the Date_ Nosso Café Para Sempre.png`: imagem de referência e pôster do vídeo.
- `supabase-config.js`: URL e chave publicável compartilhadas pelo site e painel.
- `admin.html`, `admin.css`, `admin.js`: painel privado, busca, filtros e CSV.
- `supabase-schema.sql`: esquema, políticas de acesso, registro de consentimento e retenção.
- `supabase/migrations/20261103040000_rsvp_mobile_phone.sql`: adiciona o celular obrigatório e exige o aviso de privacidade v2 nas novas respostas.
- `supabase/migrations/20261103050000_rsvp_international_phone.sql`: aceita números internacionais de 7 a 15 dígitos.

## Referência visual e vídeo

A imagem de referência está em `assets/Save the Date_ Nosso Café Para Sempre.png`. O convite segue a composição vertical dela com papel creme quente, ramos e frutos nos cantos, grãos como ornamento, título em Lobster Two, conteúdo em Barlow Condensed, vídeo horizontal amplo e botões arredondados. O vídeo não usa thumbnail; ele abre com os controles nativos do navegador.

O vídeo atual é `assets/WhatsApp Video 2026-11-02 at 20.40.58.mp4` (MP4/H.264, 720 × 1280, 30 fps, cerca de 6,7 MB). O player começa a pré-carregar o arquivo antes da reprodução para reduzir travamentos em hospedagens que não oferecem streaming por intervalos. Para trocá-lo, substitua esse arquivo mantendo o nome, ou coloque o novo MP4 em `assets/` e edite o atributo `src` do `<source>` em `index.html`.

## Supabase — configuração necessária

URL e chave publicável do projeto já estão preenchidas em `supabase-config.js`. O convite é público; somente as contas do casal podem consultar as respostas. As migrations em `supabase/migrations/` registram consentimentos, validam o celular e reforçam as políticas:

1. A integração Supabase/GitHub deve acompanhar a raiz (`.`) e aplicar migrations na branch de produção `main`. Se ela não executar a nova migration, cole o conteúdo atualizado de `supabase-schema.sql` no SQL Editor. Não digite o nome do arquivo no editor.
2. Crie/convide as duas contas em **Authentication → Users** com os e-mails cadastrados na migration.
3. Nunca use `service_role` ou chave `secret` no navegador; `supabase-config.js` contém somente a chave publicável.

O formulário grava nome completo, celular em formato internacional ou local (até 15 dígitos), resposta, presença e nome do cônjuge, nomes e idades dos filhos, versão do aviso e consentimentos com data. O celular é usado somente para contato sobre o convite e a organização do evento. Não oferece acompanhantes extras e não coleta mensagens livres. Para menores de 18 anos, exige a declaração e autorização de pai, mãe ou responsável legal. Convidados podem inserir respostas válidas; somente sessões autenticadas cujo e-mail conste em `admin_emails` podem consultar confirmações. O banco agenda a exclusão das respostas a partir de 28/06/2027, 30 dias após o evento. Não abra as permissões do banco nem habilite consulta pública.

## Executar localmente

Com Python 3:

```bash
cd ~/Desktop/projects/save-the-date
python3 preview_server.py
```

Abra `http://127.0.0.1:8000` para o convite e `http://127.0.0.1:8000/admin.html` para o painel. O servidor local aceita solicitações de intervalos de bytes para reprodução e busca no vídeo. Ele escuta apenas em `127.0.0.1`. Para parar, use `Ctrl+C` no terminal.

O envio online e o painel exigem que o SQL tenha sido aplicado e que as duas contas autorizadas existam.

## Publicação

`dist/` é gerado para o pacote estático e ignorado pelo Git. O convite fica acessível sem login; o painel (`admin.html`) continua protegido por autenticação Supabase e RLS.
