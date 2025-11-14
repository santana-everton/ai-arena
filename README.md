# MTGA Assistant (Electron + React)

Aplicativo desktop para observar o `output_log.txt` do *Magic: The Gathering Arena* (MTGA), interpretar eventos em tempo real e preparar ganchos para integrações de IA.

## Visão geral

- **Stack**: Electron + Node.js no processo principal, React + TypeScript no renderer, bundlado com Vite.
- **Watcher nativo**: o processo principal acompanha o arquivo de log (`output_log.txt`) usando `fs.watch` e envia linhas/eventos via IPC.
- **Parser incremental**: módulo `mtgaParser.ts` identifica padrões básicos (início de partida, turnos, vida, compras de carta) e é facilmente estensível.
- **UI focada**: duas colunas (log bruto + eventos interpretados) com estado global via hooks React.
- **Gancho IA**: botão “Enviar estado para IA” gera um snapshot simplificado pronto para ser enviado a um backend/LLM futuro.

## Estrutura de pastas

```
mtga-assistant/
├── electron/
│   ├── main.ts          # Processo principal do Electron
│   ├── preload.ts       # Exposição segura da API window.mtga
│   ├── config.ts        # Caminhos e canais IPC
│   ├── logWatcher.ts    # Tail do log do MTGA
│   └── mtgaParser.ts    # Interpretação básica das linhas
│
├── renderer/
│   ├── index.html
│   └── src/
│       ├── App.tsx
│       ├── components/
│       ├── state/
│       └── types/
│
├── public/              # Ícones e assets estáticos
├── package.json
├── tsconfig*.json
└── vite.config.ts
```

## Scripts

```bash
npm install        # instala dependências
npm run dev        # inicia Electron + Vite em modo desenvolvimento
npm run build      # gera dist do renderer + processos do Electron
npm run package    # (opcional) empacota com electron-builder
npm run preview    # pré-visualiza somente o renderer
```

> **Nota (Windows)**: `npm run package` cria symlinks temporários para as dependências de codesign. Ative o *Developer Mode* ou execute o terminal com privilégios elevados para evitar erros de permissão ao empacotar.

> Em modo dev, o Vite serve `renderer/` enquanto o plugin `vite-plugin-electron` faz o bundle de `electron/main.ts` e `preload.ts`.

## Fluxo de dados

1. `electron/logWatcher.ts` observa o arquivo padrão do MTGA (`%USERPROFILE%/AppData/LocalLow/Wizards Of The Coast/MTGA/output_log.txt`).
2. Cada alteração gera novas linhas → `main.ts` envia `mtga:log-line`.
3. As mesmas linhas passam por `parseLogLine` → eventos `mtga:event`.
4. O `preload` expõe `window.mtga` (`onLogLine`, `onEvent`, `onStatus`, `sendSnapshot`, `getLogPath`).
5. O React (`useLogsStore`) consome essas APIs e atualiza o estado da UI.
6. O botão “Enviar estado para IA” gera um snapshot `{ rawLines, events }` e envia via IPC (atualmente apenas loga no console do processo principal).

## Próximos passos sugeridos

- Tornar o caminho do log configurável (persistindo em `app.getPath('userData')`).
- Expandir o parser para cobrir JSON blobs do MTGA, decks e estado completo da partida.
- Persistir histórico de partidas e fornecer filtros/segmentação.
- Conectar o snapshot a um backend (Python ou Node) que normalize os dados antes de chamar uma IA.

---

Feito para experimentar rapidamente com insights do log do MTGA e preparar terreno para integrações de IA sem refatorações futuras.
