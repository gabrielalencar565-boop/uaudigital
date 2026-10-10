// Turns the technical messages that come back from the database, the network and the edge functions into plain Portuguese.
// Messages that are already in Portuguese (written by the app itself) pass through untouched.

const RULES: { test: RegExp; text: (m: RegExpMatchArray) => string }[] = [
  { test: /last_admin/i, text: () => "Não dá para tirar o último administrador da agência. Nomeie outro administrador antes." },
  { test: /new row violates row-level security policy(?: for table "?([\w.]+)"?)?/i, text: () => "Você não tem permissão para fazer essa alteração." },
  { test: /permission denied|not authorized|insufficient[_ ]privilege|forbidden|sem permissão/i, text: () => "Você não tem permissão para fazer isso." },
  { test: /duplicate key value violates unique constraint/i, text: () => "Já existe um registro igual a esse." },
  { test: /violates foreign key constraint/i, text: () => "Esse item está ligado a outros dados e não pode ser alterado ou removido assim." },
  { test: /violates check constraint/i, text: () => "Algum valor informado não é aceito. Confira os campos e tente de novo." },
  { test: /null value in column "?([\w]+)"? .*violates not-null/i, text: () => "Falta preencher um campo obrigatório." },
  { test: /invalid input syntax for type (\w+)/i, text: () => "Algum valor informado está em formato inválido." },
  { test: /JWT expired|invalid (?:refresh )?token|refresh token not found|session (?:expired|not found)|not authenticated/i, text: () => "Sua sessão expirou. Entre de novo para continuar." },
  { test: /failed to fetch|networkerror|network request failed|load failed|err_internet|fetch failed/i, text: () => "Sem conexão com o servidor. Confira a internet e tente de novo." },
  { test: /statement timeout|canceling statement|timed? ?out|timeout/i, text: () => "A operação demorou demais. Tente de novo em instantes." },
  { test: /edge function returned a non-2xx status code/i, text: () => "O servidor recusou o pedido. Tente de novo em instantes." },
  { test: /rate limit|too many requests/i, text: () => "Muitas tentativas seguidas. Espere um pouco e tente de novo." },
  { test: /payload too large|file too large|exceeded the maximum allowed size/i, text: () => "O arquivo é grande demais." },
  { test: /row not found|no rows returned|the result contains 0 rows|PGRST116/i, text: () => "Não encontramos esse item. Ele pode ter sido removido." },
  { test: /already registered|user already exists/i, text: () => "Essa pessoa já tem cadastro." },
  { test: /invalid login credentials/i, text: () => "E-mail ou senha incorretos." },
  { test: /email not confirmed/i, text: () => "Confirme o seu e-mail antes de entrar." },
  { test: /password should be at least|weak password/i, text: () => "A senha é fraca demais. Use pelo menos 6 caracteres." },
  { test: /could not find the .* column|schema cache/i, text: () => "O sistema está se atualizando. Recarregue a página e tente de novo." },
  { test: /function .* does not exist|relation .* does not exist/i, text: () => "Esse recurso ainda não está disponível. Recarregue a página e tente de novo." },
];

/** Portuguese version of a technical error message (the original text is returned when nothing matches). */
export function friendlyError(message: string): string {
  for (const rule of RULES) {
    const m = message.match(rule.test);
    if (m) return rule.text(m);
  }
  return message;
}
