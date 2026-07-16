# Travel OS V2 — Parte 1

Fundação estática e offline-first para alojamento no GitHub Pages.

## Incluído

- HTML/CSS/JavaScript modular.
- IndexedDB como base de dados local.
- Store central simples.
- Service Worker e cache da app.
- Manifest PWA.
- Estado online/offline.
- Criação de uma viagem de teste.
- Sem dependências externas.

## Testar localmente

Os módulos ES e o Service Worker exigem HTTP. Não abras o `index.html` diretamente com `file://`.

Com Python:

```bash
python -m http.server 8080
```

Depois abre:

```text
http://localhost:8080
```

## Publicar no GitHub Pages

1. Cria um repositório.
2. Coloca estes ficheiros na raiz.
3. Faz commit e push.
4. Em **Settings → Pages**, escolhe **Deploy from a branch**.
5. Seleciona a branch `main` e a pasta `/root`.

## Próxima parte

Modelos de dados completos e CRUD de viagens/eventos com eliminação lógica (`deletedAt`).
