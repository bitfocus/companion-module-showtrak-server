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

**Client telemetry variables** adds IP, CPU, RAM, uptime and warning variables
for every client. Switch it off on very large rigs to keep the variable list
short.

### Server versions

Everything works with any ShowTrak Server that has the SDK / Integration API.
The Identify, Monitor, FreeKiosk, Dummy, Executions and View actions need
**ShowTrak Server 3.34 or later**; an older server refuses them and the module
logs `Unknown command`. The Identify action needs ShowTrak Server 3.19 or later.

## Targeting by slug

Everything is addressed by **slug**, never internal UUIDs:

- **Clients / groups / tags** — their slug (Settings on the server). Monitors,
  dummy clients and FreeKiosk terminals share the client slug namespace.
- **Scripts** — the script slug (its folder ID in the Script Manager).
- **Events** — the integrated action ID declared by an integrated (SDK) client.
- **Monitor actions** — the check type and action ID, as listed in the server's
  OSC/API reference (e.g. `pjlink` and `power.on`, or `input.set` with a value).

Actions that take a slug also accept a `$(variable)`, so a preset's button-local
`slug` can drive every action and feedback on the button.

## Actions

Every action below with a target takes a **slug**. WOL, Script, Event, Monitor,
FreeKiosk, Retry and both Shutdown actions have a **Require press-to-confirm**
option — when on, the first press arms the button and a second press within 5
seconds runs it.

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

**Identify**

- **Identify: Client** — client slug; Start, Stop or Toggle the identify overlay
  on the client's screen. Works in Show mode.

**Monitors**

- **Monitor: Run check action** — monitor slug, check type, action and an
  optional value (fills the action's first setting).

**FreeKiosk terminals** — pick a command; Brightness and Volume take a value
(0–100)

- **FreeKiosk: Command a terminal** — terminal slug
- **FreeKiosk: Command every terminal in a group** — group slug
- **FreeKiosk: Command every terminal in a tag** — tag slug
- **FreeKiosk: Command every terminal**

**Dummy clients**

- **Dummy: Send heartbeat** — dummy slug. Run it from a trigger while the
  device the dummy stands for is healthy.

**Execution panel**

- **Executions: Retry failed** — runs every failed script and event again
- **Executions: Clear finished** — clears completed and failed rows

**View** — the client-list layout on the desktop and every Web UI browser

- **View: Set layout** — Grid, Compact or List
- **View: Toggle compact**

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
- **`client_status_is`** (boolean) — a client is Online / Degraded / Offline / Idle.
- **`client_identifying`** (boolean) — a client is showing its identify overlay.
- **`script_running`** (boolean) — a script or event is queued or running on all
  clients, a client, a group or a tag; optionally one script slug or event ID.
- **`script_failed`** (boolean) — the execution panel holds a failure for the
  same choice of scope, until it is retried or cleared.
- **`pending_adoption`** (boolean) — devices are waiting to be adopted.
- **`alert_raised`** (boolean) — an alert rule raised a ShowTrak alert within
  the last few seconds (you choose how many), optionally of one severity.

## Variables

- **`connection_state`** — current connection state.
- **`mode`** — server mode (`SHOW` / `EDIT`).
- **`alerts_enabled`** — `true` / `false`.
- **`clients_total`** — total clients.
- **`clients_online`** — clients online.
- **`clients_offline`** — clients offline.
- **`clients_degraded`** — clients degraded.
- **`executions_running`** / **`executions_completed`** / **`executions_failed`**
  / **`executions_retryable`** — the execution panel, counting scripts and
  events (not housekeeping such as script deployment).
- **`pending_adoption_count`** — devices waiting to be adopted.
- **`last_alert_title`** / **`last_alert_message`** / **`last_alert_severity`** /
  **`last_alert_time`** — the most recent ShowTrak alert.
- **`client_<slug>_status`** — per-client status (also covers monitoring targets, dummy clients and FreeKiosk terminals).
- **`client_<slug>_label`** — per-client label.
- **`client_<slug>_ip`**, **`client_<slug>_cpu`**, **`client_<slug>_ram`**,
  **`client_<slug>_uptime`**, **`client_<slug>_warnings`** — per-client
  telemetry (real clients only; CPU and RAM are whole percentages, blank while
  offline). Turned off by the **Client telemetry variables** setting.
- **`group_<slug>_status`** — per-group aggregate status.
- **`group_<slug>_label`** — per-group label.
- **`tag_<slug>_status`** — per-tag aggregate status.
- **`tag_<slug>_label`** — per-tag label.

## Presets

Grouped by target:

- **Utils** — server-wide controls (alerts, mode, close modals, save show,
  shutdown, retry failed / clear finished executions, view layout) and
  indicators for devices waiting to be adopted and the last alert.
- **Client** — status tile + WOL / Script / Event (instant and confirm) + script
  activity + Identify + Open modal.
- **Group** — status tile + WOL / Script / Event (instant and confirm) + script activity.
- **Tag** — status tile + WOL / Script / Event (instant and confirm) + script activity.
- **All** — status tile + WOL / Script / Event (instant and confirm) + script activity.
- **FreeKiosk** — terminal status + screen, wake, reload, brightness, beep and reboot.
- **Monitor** — monitor status + a check action.
- **Dummy** — dummy status + heartbeat.

Slugged presets ship with a button-local `slug` variable wired into every action
and feedback on the button.
