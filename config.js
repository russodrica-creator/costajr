// Configuração do portal.
//
// Sem Supabase configurado, o portal funciona em "modo local": os dados ficam
// salvos só no navegador de quem está usando (use Backup e exportação para não perder).
//
// Para a equipe toda ver os mesmos dados, crie um projeto no Supabase, rode
// supabase/schema.sql e preencha os dois campos abaixo (veja o README).
// A chave "anon" é pública por natureza; quem protege os dados é o login + RLS.
window.PORTAL_CONFIG = {
  supabaseUrl: "",      // ex.: "https://abcdefgh.supabase.co"
  supabaseAnonKey: "",  // Project Settings > API > anon public
};
