# Vatio widget

The chat widget for [Vatio](https://vatio.ai) agents: a bubble in the corner of
your site that opens a conversation with your agent. Preact inside a shadow
root, so it does not care which framework your page uses and your CSS does not
reach it.

You need a Vatio workspace and a **publishable key** (`vatpub_…`) that allows
your site's origin. How to create one is in the guide:
<https://vatio.ai/docs/channels/widget>.

## The quickest way

Building your app with Claude Code, Cursor or Codex? Let your coding agent do
all of this. In your app's project:

```bash
npx @vatio-ai/skills
```

Then, in Claude Code, `/vatio-init` creates the agent from your app, and
`/vatio-add-to-app` adds this widget to your web app with a token for development
and one for production (in Cursor or Codex, ask it to use those
skills). See [An AI chat for your web app or site](https://vatio.ai/docs/guides/ai-chat-widget-for-your-website).

## With a script tag

```html
<script async src="https://cdn.vatio.ai/v1/widget.js"
        data-workspace="your-workspace"
        data-token="vatpub_REPLACE_ME"></script>
```

## From your app's code

```bash
npm install @vatio-ai/widget
```

```ts
import { mountVatioWidget } from "@vatio-ai/widget";

const widget = mountVatioWidget({
  workspace: "your-workspace",
  token: "vatpub_REPLACE_ME",
});

// When someone signs in or out:
widget.identify(jwt); // or null
// When the page that showed it goes away:
widget.unmount();
```

In React, mount it in an effect and unmount it in the cleanup:

```tsx
useEffect(() => {
  const widget = mountVatioWidget({ workspace: "your-workspace", token: "vatpub_REPLACE_ME" });
  return () => widget.unmount();
}, []);
```

## Options

Every option is also a `data-*` attribute on the script tag (`replyStyle` is
`data-reply-style`). Anything you leave out comes from the workspace's own
settings (**Channels → Web widget** in the inbox), then from the built-in default.

| Option | |
|---|---|
| `workspace`, `token` | Required. |
| `baseUrl` | Where the Vatio API answers. Defaults to `https://vatio.ai`. |
| `visitorToken` | The signed-in visitor's JWT, signed by your backend. |
| `position` | `"left"` or `"right"`. |
| `scheme` | `"auto"`, `"light"` or `"dark"`. |
| `replyStyle` | `"stream"` or `"paced"`. |
| `title`, `about`, `greeting`, `locale`, `suggestions` | Copy on the panel. |
| `sessionScope` | Separate conversations per value, e.g. per signed-in account. |
| `eager` | Mount right away instead of when the page goes idle. |
| `theme` | `accent`, `accentInk`, `surface`, `ink`, `muted`, `line`, `radius`, `font`. |

Full reference: [vatio.ai/docs/channels/widget](https://vatio.ai/docs/channels/widget).

## Develop

```bash
npm install
npm run dev        # the widget against a fake agent, with hot reload
npm run build      # the script-tag bundle, dist/script/widget.js
npm run build:lib  # the npm package, dist/index.js + dist/index.d.ts
```

## Issues

Bugs and ideas go to [issues](https://github.com/vatio-ai/widget/issues). This
repository is a read-only mirror of the widget as it ships inside Vatio, so a
pull request cannot be merged here: open an issue describing the change instead.

The widget is MIT licensed. It talks to Vatio through
[`@vatio-ai/sdk`](https://www.npmjs.com/package/@vatio-ai/sdk), a dependency
with its own license.
