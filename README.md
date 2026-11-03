# Save the Date — nossa história, nosso café, nosso para sempre

Convite estático em HTML, CSS e JavaScript. O envio de respostas usa Supabase quando configurado. Sem credenciais, o formulário informa que não é possível salvar; nenhum RSVP é guardado no navegador.

## Arquivos

- `index.html`, `styles.css`, `app.js`: convite, estilos responsivos e formulário.
- `assets/coffee-branch.svg`: ramo vetorial de café feito para a composição.
- `assets/WhatsApp Video 2026-11-02 at 20.40.58.mp4`: vídeo atualmente em destaque.
- `assets/Save the Date_ Nosso Café Para Sempre.png`: imagem de referência e pôster do vídeo.
- `supabase-config.js`: URL e chave publicável compartilhadas pelo site e painel.
- `admin.html`, `admin.css`, `admin.js`: painel privado, busca, filtros e CSV.
- `supabase-schema.sql`: esquema e políticas de acesso.

## Referência visual e vídeo

A imagem de referência está em `assets/Save the Date_ Nosso Café Para Sempre.png`. O convite segue a composição vertical dela com papel creme quente, ramos e frutos nos cantos, grãos como ornamento, título em Lobster Two, conteúdo em Barlow Condensed, vídeo horizontal amplo e botões arredondados. O vídeo não usa thumbnail; ele abre com os controles nativos do navegador.

O vídeo atual é `assets/WhatsApp Video 2026-11-02 at 20.40.58.mp4` (MP4/H.264). Para trocá-lo, substitua esse arquivo mantendo o nome, ou coloque o novo MP4 em `assets/` e edite o atributo `src` do `<source>` em `index.html`.

## Supabase — configuração necessária

URL e chave publicável do projeto já estão preenchidas em `supabase-config.js`. Para ativar o envio online e liberar o painel somente para o casal:

1. O arquivo `supabase/migrations/20261102000000_wedding_rsvp.sql` contém o esquema, as políticas RLS e os dois e-mails autorizados. A integração do Supabase com GitHub precisa ter **Deploy to production** habilitado para aplicar migrations quando a branch de produção receber este arquivo. `supabase-schema.sql` é a cópia para aplicação manual no SQL Editor; não aplique os dois fluxos depois que a migration já tiver sido executada. O script remove campos antigos (`phone`, `companions`); faça backup se houver respostas importantes.
2. Crie/convide as duas contas em **Authentication → Users** com os mesmos e-mails cadastrados na migration.
3. A URL e a chave publicável já estão em `supabase-config.js`. Nunca use `service_role` ou chave secreta no navegador.

O formulário grava apenas nome da pessoa convidada, resposta, cônjuge opcional, filhos com nome e idade e observação opcional. Não oferece acompanhantes extras nem coleta telefone. Respostas públicas permitem apenas inserção. Somente sessões autenticadas cujo e-mail conste em `admin_emails` podem consultar confirmações; o painel é somente leitura. A constraint e a política RLS limitam cada RSVP à pessoa convidada, cônjuge e até 20 filhos. Não abra as permissões do banco nem habilite consulta pública.

## Executar localmente

Com Python 3:

```bash
cd ~/Desktop/projects/save-the-date
python3 preview_server.py
```

Abra `http://127.0.0.1:8000` para o convite e `http://127.0.0.1:8000/admin.html` para o painel. O servidor local aceita solicitações de intervalos de bytes para reprodução e busca no vídeo. Ele escuta apenas em `127.0.0.1`. Para parar, use `Ctrl+C` no terminal.

O envio online e o painel exigem que o SQL tenha sido aplicado e que as duas contas autorizadas existam. Nenhum deploy ou publicação foi feito.
