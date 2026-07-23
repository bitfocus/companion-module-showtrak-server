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

Actions that take a slug also accept a `$(variable)`, so a preset's button-local
`slug` can drive every action and feedback on the button.

## Actions

Every action below with a target takes a **slug**. WOL, Script, Event and both
Shutdown actions have a **Require press-to-confirm** option — when on, the first
press arms the button and a second press within 5 seconds runs it.

**Wake-on-LAN**

- **Wake-on-LAN: All clients**
- **Wake-on-LAN: Client** — client slug
- **Wake-on-LAN: Group** — group slug
- **Wake-on-LAN: Tag** — tag slug

**Scripts** — take a script slug

- **Script: Run on all clients**
- **Script: Run on client** — client slug
- **Script: Run on group** — group slug
- **Script: Run on tag** — tag slug

**Integrated events** — take an event slug

- **Event: Run on all integrated clients**
- **Event: Run on client** — client slug
- **Event: Run on group** — group slug
- **Event: Run on tag** — tag slug

**Alerts**

- **Alerts: Turn on**
- **Alerts: Turn off**
- **Alerts: Toggle**

**Mode**

- **Mode: Enter Show**
- **Mode: Enter Edit**
- **Mode: Toggle**

**Modals**

- **Modal: Open client** — client slug
- **Modal: Close all**

**Server**

- **Save show file**
- **Shutdown ShowTrak Server** — confirm on by default
- **Shutdown ShowTrak Server (force, skips prompts)** — confirm on by default

## Feedbacks

- **`client_status`** (advanced) — tile colour + label for a client slug.
- **`group_status`** (advanced) — aggregate colour + label for a group slug.
- **`tag_status`** (advanced) — aggregate colour + label for a tag slug.
- **`all_status`** (advanced) — aggregate colour across every client.
- **`mode_is`** (boolean) — server is in the selected mode (Show / Edit).
- **`alerts_enabled`** (boolean) — alert actions are enabled.
- **`connected`** (boolean) — connected to the server.
- **`pending_confirm`** (boolean) — a confirm action on this button is armed.

## Variables

- **`connection_state`** — current connection state.
- **`mode`** — server mode (`SHOW` / `EDIT`).
- **`alerts_enabled`** — `true` / `false`.
- **`clients_total`** — total clients.
- **`clients_online`** — clients online.
- **`clients_offline`** — clients offline.
- **`clients_degraded`** — clients degraded.
- **`client_<slug>_status`** — per-client status (also covers monitors and dummies).
- **`client_<slug>_label`** — per-client label.
- **`group_<slug>_status`** — per-group aggregate status.
- **`group_<slug>_label`** — per-group label.
- **`tag_<slug>_status`** — per-tag aggregate status.
- **`tag_<slug>_label`** — per-tag label.

## Presets

Grouped by target:

- **Utils** — server-wide controls (alerts, mode, close modals, save show, shutdown).
- **Client** — status tile + WOL / Script / Event (instant and confirm) + Open modal.
- **Group** — status tile + WOL / Script / Event (instant and confirm).
- **Tag** — status tile + WOL / Script / Event (instant and confirm).
- **All** — status tile + WOL / Script / Event (instant and confirm).

Slugged presets ship with a button-local `slug` variable wired into every action
and feedback on the button.
