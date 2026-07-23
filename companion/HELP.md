# ShowTrak Server

Control and monitor a **ShowTrak Server** instance in real time over its
WebSocket control API.

## Connection

Configure the connection with:

- **Target IP or Hostname** — the address of the machine running ShowTrak Server.
  An IP address, a hostname (including `.local` names) or an IPv6 literal all work.
- **Target Port** — the server port (default `3000`).
- **SDK API Key** — copy this from the server: **Settings → SDK / Integration
  API → SDK API Key**. The key is required; the connection is refused without a
  matching key. It is held in Companion's secrets store, so it is not included
  when you export a configuration.

The connection status is reflected in the module status and the `connected`
feedback / `connection_state` variable.

## Targeting by slug

Everything is addressed by **slug**, never internal UUIDs:

- **Clients / groups / tags** — their slug (Settings on the server).
- **Scripts** — the script slug (its folder ID in the Script Manager).
- **Events** — the integrated action ID declared by an integrated (SDK) client.

## Presets

Presets are grouped by target: **Utils** (server-wide controls) first, then one
section per scope — **Client**, **Group**, **Tag** and **All** — each carrying a
status tile plus Wake-on-LAN / Script / Event in instant and confirm variants.

- **Client Tile** — shows a client's live status colour and label, and **opens
  that client's modal on the ShowTrak desktop app when pressed**. Every
  preset ships with a local `slug` variable already wired into its actions to make programming easier.
- **Group / Tag / All Tile** — aggregate status colour + label for that scope.
  Group and Tag tiles use the same button-local `slug`; the All tile needs no slug.
- **Script / Event / Wake-on-LAN** buttons run on a client, group, tag, or all.
  Each has a **(confirm)** variant that arms on the first press (turning orange)
  and executes on a second press within 5 seconds, auto-cancelling otherwise.

## Feedbacks & variables

- `client_status` (advanced) — tile colour + label from a client slug.
- `group_status` (advanced) — aggregate group colour + label.
- `mode_is`, `alerts_enabled`, `connected`, `pending_confirm` — boolean styling.
- Variables: `connection_state`, `mode`, `alerts_enabled`, client counts, and per
  client `client_<slug>_status` / `client_<slug>_label`.

## Notes

- **The modal actions** are fire-and-forget commands to the server UI — they have
  no live feedback.
- **Shutdown ShowTrak Server** closes the server itself, not a client. Both
  variants ship with press-to-confirm enabled by default; the plain variant can
  still be stopped by an unsaved-changes or show-mode prompt on the desktop,
  while the **force** variant closes regardless. Leave confirm on.
- **Modal: Open client** and **Modal: Close all** only affect the ShowTrak
  **desktop app** window. Browsers on the Web UI ignore them, so a Companion
  press never yanks a modal open (or shut) on someone else's screen.
- **Save show** saves to the current show file, will open a Save-As dialog on the server if no file is set yet or if unable to write to the show file
