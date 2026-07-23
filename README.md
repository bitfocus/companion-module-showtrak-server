# companion-module-showtrak-server

Control and monitor a [ShowTrak](https://showtrak.co.uk) Server from Bitfocus
Companion, over the server's WebSocket control API.

Wake clients, run scripts, trigger integrated events, switch Show/Edit mode and
watch live client status on your Stream Deck — targeting a single client, a
group, a tag, or everything at once.

## Requirements

- **Bitfocus Companion 4.0** or newer.
- **ShowTrak Server** running and reachable from the machine Companion is on.

## Setup

### 1. Get the API key from ShowTrak Server

On the machine running ShowTrak Server:

1. Click the **gear icon** in the top navbar to open **Settings**.
2. Choose **SDK / Integration API** in the category list on the left.
3. Check that **SDK Control API** is switched on. It is on by default — if it is
   off, Companion's connection is refused with `SDK API is disabled`.
4. Copy the **SDK API Key** value. It is a 48-character hex string, generated
   automatically the first time the server boots.

There is no copy button — select the field contents and copy them manually. The
key is shown in plain text, so treat that screen as sensitive.

> Changing the key revokes every existing integration. If you ever need to roll
> it, edit the field (it auto-saves) and update each connected integration.

### 2. Find the server's address

The server listens on port **3000** by default, and the control API shares that
port with the Web UI — so if you can reach the Web UI, the port is right. The
port is not configurable.

The **Remote Access** section at the bottom of Settings lists the addresses the
server is reachable on, which is the easiest way to find the right IP.

### 3. Add the connection in Companion

In Companion, go to **Connections → Add connection**, search for
**ShowTrak Server**, and fill in:

| Field                     | Value                                                      |
| ------------------------- | ---------------------------------------------------------- |
| **Target IP or Hostname** | The server's address — IP, hostname, `.local` name or IPv6 |
| **Target Port**           | `3000` unless you know otherwise                           |
| **SDK API Key**           | The key you copied in step 1                               |

The connection goes green once the server accepts the key. The API key is held
in Companion's secrets store, so it is not included when you export a
configuration.

## Troubleshooting

| Symptom                                      | Cause                                                                                   |
| -------------------------------------------- | --------------------------------------------------------------------------------------- |
| Status: **Bad configuration**                | The address or API key is blank.                                                        |
| Connection log: `Unauthorized`               | The API key does not match the server's.                                                |
| Connection log: `SDK API key not configured` | The server's key field is empty — reopen Settings and let it regenerate.                |
| Connection log: `SDK API is disabled`        | Turn **SDK Control API** back on in the server's settings.                              |
| Connects, but buttons do nothing             | The `slug` is wrong or empty. Check it against the slug shown in the server's settings. |
| Tile stays grey                              | No client matches that slug yet — the tile greys out when the slug resolves to nothing. |

Actions are addressed by **slug**, never by internal UUID.

## Documentation

[HELP.md](./companion/HELP.md) is the full reference — every action, feedback,
variable and preset, plus notes on the confirm gate and the desktop-only modal
actions. It is also what Companion shows in the module's help panel.

## Development

Executing a `yarn` command should perform all necessary steps to develop the module, if it does not then follow the steps below.

The module can be built once with `yarn build`. This should be enough to get the module to be loadable by companion.

While developing the module, by using `yarn dev` the compiler will be run in watch mode to recompile the files on change.

The control API client itself lives in the separate
[@showtrak/server-sdk](https://www.npmjs.com/package/@showtrak/server-sdk)
package — protocol changes belong there, not in this module.
