## TASKS

- [ ] Install Markdown renderer stack (react-markdown, rehype-pretty-code, shiki) via pnpm
- [ ] Create ChatPanel parts: Composer, MessageList, TagTabs, ModelSelect
- [ ] Implement Composer with CodeMirror 6 (Markdown, placeholder, keymap, submit)
- [ ] Add slash-command completion stubs in Composer (e.g., /sql, /json, /explain)
- [ ] Implement MessageList renderer using react-markdown + rehype-pretty-code (Shiki)
- [ ] Wire ChatPanel state and placement logic (composer top vs bottom)
- [ ] Style with CSS Modules using theme tokens; sticky composer dock
- [ ] Seed sample messages for visual QA; remove once API/store is ready

## Chat Panel

### Purpose
Provides a focused conversational workspace for asking questions about a Postgres database and viewing the assistant’s responses. Prioritizes readability, low-contrast dark theme surfaces, and efficient composition.

### Look & feel
- **Theme**: Uses project tokens from `assets/styles` (dark by default; light via `[data-theme]`).
- **Surfaces**: Panel background `--surface-1`; interactive containers use `--surface-2` and inputs `--surface-3`.
- **Borders**: Subtle separators using `--border-primary`/`--border-secondary`.
- **Typography**: Body text `--text-base`; assistant content renders as Markdown via `.prose` for readable line-length and spacing.
- **Spacing**: Layout spacing uses `--space-*` tokens; radii use `--radius-*`; shadows use `--shadow-*`.

### Layout & structure
- A scrollable messages column.
- A **Composer** container (3 core rows + hidden footer) that:
  - Appears at the top when there’s no history (default state).
  - Sticks to the bottom of the panel after the first message (uses a sticky dock).
- Collapsed-state shows an icon-only control to expand the panel.

### Interactions & actions
- **Add/remove tags** in the Composer header row (clickable tag “tabs”).
- **Enter message** in the Editor row using **CodeMirror 6 (Markdown)**.
- **Choose model** from a small dropdown on the left of the Composer control row.
- **Send message** via the right-aligned send button (icon `icon-arrow-up`).
- **Keyboard**: Enter to send; Shift+Enter for newline. Slash-commands (`/sql`, `/json`, `/explain`) via CM6 completion.

### States & placement
- **Default (no messages)**: Composer displayed at the top; message list empty.
- **With history**: Messages stack chronologically; Composer docks to the bottom.
- **Collapsed**: Only a minimal icon is shown; click to expand.

### Message rendering rules
- **User message**: Appears within a contained “bubble-like” surface similar to the Composer container (lighter surface, subtle border and shadow).
- **Assistant response**: No bubble; just text on the panel background, rendered as Markdown via `react-markdown` + `rehype-pretty-code` (Shiki) for code-block highlighting.
- **Assistant preface**: Each response starts with `Thought for <time>` above the content.
- **Special syntax**: Assistant may return Markdown that includes JSON, SQL, or other specialized blocks. These should render correctly within `.prose` styles.

### Composer (3 rows + footer)
1) **Header row (tags)**: Clickable, tag-like tabs that toggle on/off.
2) **Editor row**: **CodeMirror 6** configured for Markdown with fenced code blocks, placeholder “Ask about your database…”.
3) **Controls row**: Left model dropdown; right send action button.
4) **Footer**: Present in markup but `display: none` for now (future system prompts/tool configuration, etc.).

### Accessibility
- Respect `:focus-visible` outlines and high-contrast icon/text tokens.
- Ensure buttons are keyboard operable; announce tags toggling state.
- Maintain readable line-length for `.prose` content (65ch max width).

### Theming tokens used (non-exhaustive)
- Surfaces: `--surface-1`, `--surface-2`, `--surface-3`
- Borders: `--border-primary`, `--border-secondary`, `--border-tertiary`
- Text: `--text-primary`, `--text-secondary`
- Spacing/radius: `--space-*`, `--radius-*`
- Motion/shadows: `--duration-*`, `--ease-standard`, `--shadow-*`

## Components

### `ChatPanel`
- Hosts the scrollable message list and the Composer.
- Handles placement logic: top Composer for empty state; sticky bottom dock when messages exist.
- Props: `{ collapsed: boolean; side?: 'left' | 'right' }`.

### `parts/MessageList`
- Renders linear stack of messages.
- User messages: contained surface (bubble-like) with border/shadow.
- Assistant messages: plain `.prose` text on panel background with a meta line `Thought for <time>`.
- Future: code/SQL blocks with copy-to-clipboard.

### `parts/Composer`
- Container with 3 rows + footer (hidden).
- Integrates `react-prosemirror` in the editor row (stubbed initially).
- Emits `onSend(text)` when user submits; manages model selection and active tags.

### `parts/TagTabs`
- Clickable tag-like chips representing user-added “tabs”.
- Toggling a tag changes its active appearance and updates query context.

### `parts/ModelSelect`
- Compact labeled `<select>` for available LLM models.
- Sits on the left of the Composer control row.

### `@Components/Icons` usage
- Icons are drawn from `public/sprites/icons.svg` via `<Icon name="..." />`.
- Send button uses `icon-arrow-up`.

### Data shape (temporary, for scaffolding)
```ts
type ChatRole = 'user' | 'assistant';
type ChatMessage = { id: string; role: ChatRole; content: string; createdAt: string };
```

> AIDEV-NOTE: The above shape is for scaffolding only; actual types should live under `src/types/` when integrating back-end and persistence.
