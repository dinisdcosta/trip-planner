# Travel OS V2 — Sprint 1

Versão funcional inicial para GitHub Pages.

## Funcionalidades

- Criar, abrir e apagar viagens.
- Timeline por data e hora.
- Eventos de voo, hotel, comboio, autocarro, restaurante, atividade, local, nota e outros.
- Código de reserva opcional.
- Local associado opcional.
- Vistas Timeline, Reservas e Locais.
- IndexedDB.
- Eliminação lógica com `deletedAt`.
- PWA e funcionamento offline.
- Interface responsiva.

## Publicar no GitHub Pages

1. Extrai o ZIP.
2. Coloca todos os ficheiros na raiz do repositório.
3. Faz commit e push para `main`.
4. Em `Settings → Pages`, escolhe `Deploy from a branch`.
5. Seleciona `main` e `/root`.

## Nota

Não abras diretamente com `file://`. Para testar localmente:

```bash
python -m http.server 8080
```

Depois abre `http://localhost:8080`.
