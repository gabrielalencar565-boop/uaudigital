# Modelos de e-mail do Fluxo

Cole cada arquivo em: Supabase > Authentication > Emails > Templates (aba de cada modelo), no campo de conteúdo
(modo "Source"), e ajuste o campo **Subject** (assunto) como abaixo.

| Modelo no Supabase   | Arquivo                      | Assunto                                  |
|----------------------|------------------------------|------------------------------------------|
| Confirm sign up      | confirmacao-cadastro.html    | Bem-vindo ao Fluxo! Confirme seu e-mail  |
| Invite user          | convite.html                 | Você foi convidado para o Fluxo          |
| Reset password       | recuperar-senha.html         | Redefina sua senha do Fluxo              |
| Magic link           | link-de-acesso.html          | Seu link de acesso ao Fluxo              |
| Change email address | troca-de-email.html          | Confirme a troca de e-mail no Fluxo      |
| Reauthentication     | codigo-de-confirmacao.html   | Seu código de confirmação do Fluxo       |

A logo vem de https://appfluxo.app.br/branding/email-logo.png (arquivo em public/branding): só aparece depois que o
site com esse arquivo for publicado.

As variáveis `{{ .ConfirmationURL }}`, `{{ .Email }}`, `{{ .NewEmail }}` e `{{ .Token }}` são do Supabase; não apague.
