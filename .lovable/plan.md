# Gerar link de recuperação para isacsbatista@icloud.com

## O que vou fazer

Chamar a API admin do backend (com a service role key, server-side via curl) no endpoint `/auth/v1/admin/generate_link` com:

- `type: "recovery"`
- `email: "isacsbatista@icloud.com"`
- `redirect_to: "https://uaudigital.lovable.app/auth?mode=reset"`

A resposta traz um `action_link` válido por ~1h. Vou colar esse link aqui no chat pra você mandar pro Izac (WhatsApp/Slack). Ele abre, define a nova senha em `/auth?mode=reset` e está resolvido.

## Importante

- O link é **single-use** e expira em 1 hora — quanto antes ele usar, melhor.
- Não vou alterar nenhum arquivo do projeto, só executar a chamada HTTP.
- Não modifica a senha atual até ele definir uma nova.

## Próximo passo opcional

Se quiser que isso vire um botão dentro do Admin ("Gerar link de reset" pra qualquer usuário), me avisa que eu monto numa próxima.