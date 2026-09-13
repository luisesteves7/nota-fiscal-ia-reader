# nota-fiscal-ia-reader

> 🚧 Em construção. README completo (com GIF de demo, badges, diagrama Mermaid
> e link de demo ao vivo) será finalizado na última etapa do projeto.

Leitor de notas fiscais com IA: upload de foto/PDF → extração estruturada via
Claude API → validação com Zod → histórico e dashboard no Supabase.

## Status

- [x] Estrutura do projeto (Next.js + TypeScript + Tailwind)
- [x] Schema do banco (Supabase + RLS)
- [x] Módulo de extração via Claude API + validação Zod
- [ ] Telas: upload, revisão, histórico
- [ ] Dashboard e extras
- [ ] Modo demo público
- [ ] README final + CI

## Rodando localmente (provisório)

```bash
npm install
cp .env.example .env.local   # preencha com suas chaves, veja o arquivo
npm run dev
```
