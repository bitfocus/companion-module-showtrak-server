import type ModuleInstance from './main.js'
import { FREEKIOSK_COMMANDS, type CommandResult, type ViewMode } from '@showtrak/server-sdk'

type SlugOpts = { slug: string }
type ScriptOpts = { slug: string; scriptSlug: string; confirm: boolean }
type EventOpts = { slug: string; eventSlug: string; confirm: boolean }
type ConfirmOnly = { confirm: boolean }
type KioskOpts = { commandId: string; value: string; confirm: boolean }

export type ActionsSchema = {
	// Wake-on-LAN
	wol_all: { options: ConfirmOnly }
	wol_client: { options: SlugOpts & ConfirmOnly }
	wol_group: { options: SlugOpts & ConfirmOnly }
	wol_tag: { options: SlugOpts & ConfirmOnly }
	// Scripts
	script_all: { options: { scriptSlug: string; confirm: boolean } }
	script_client: { options: ScriptOpts }
	script_group: { options: ScriptOpts }
	script_tag: { options: ScriptOpts }
	// Integrated events
	event_all: { options: { eventSlug: string; confirm: boolean } }
	event_client: { options: EventOpts }
	event_group: { options: EventOpts }
	event_tag: { options: EventOpts }
	// Alerts
	alerts_on: { options: Record<string, never> }
	alerts_off: { options: Record<string, never> }
	alerts_toggle: { options: Record<string, never> }
	// Mode
	mode_show: { options: Record<string, never> }
	mode_edit: { options: Record<string, never> }
	mode_toggle: { options: Record<string, never> }
	// Identify
	identify_client: { options: SlugOpts & { state: string } }
	// Monitoring check actions
	monitor_action: { options: SlugOpts & { method: string; actionId: string; value: string; confirm: boolean } }
	// FreeKiosk terminals
	freekiosk_terminal: { options: SlugOpts & KioskOpts }
	freekiosk_group: { options: SlugOpts & KioskOpts }
	freekiosk_tag: { options: SlugOpts & KioskOpts }
	freekiosk_all: { options: KioskOpts }
	// Dummy clients
	dummy_heartbeat: { options: SlugOpts }
	// Execution panel
	executions_retry_failed: { options: ConfirmOnly }
	executions_clear: { options: Record<string, never> }
	// Client-list layout
	view_set: { options: { view: string } }
	view_toggle_compact: { options: Record<string, never> }
	// Modals (desktop app only)
	modal_open_client: { options: SlugOpts }
	modal_close_all: { options: Record<string, never> }
	// Misc
	save_show: { options: Record<string, never> }
	// Shutdown
	shutdown_server: { options: ConfirmOnly }
	shutdown_server_force: { options: ConfirmOnly }
}

// useVariables enables expression mode on the field, so a slug can also come from
// a (button-local or global) variable — which is how the tile presets let you
// enter the slug just once. A literal slug still works unchanged.
const slug = { id: 'slug', type: 'textinput', label: 'Slug', default: '', useVariables: true } as const
const scriptSlug = {
	id: 'scriptSlug',
	type: 'textinput',
	label: 'Script slug',
	default: '',
	useVariables: true,
} as const
const eventSlug = {
	id: 'eventSlug',
	type: 'textinput',
	label: 'Event slug',
	default: '',
	useVariables: true,
} as const
const confirm = {
	id: 'confirm',
	type: 'checkbox',
	label: 'Require press-to-confirm (5s timeout)',
	default: false,
} as const

// FreeKiosk commands from the SDK's catalog. allowCustom keeps a command the
// server gains after this module was built sendable by its ID; the server checks
// every one against its own allowlist regardless.
const kioskCommand = {
	id: 'commandId',
	type: 'dropdown',
	label: 'Command',
	default: 'screen.on',
	allowCustom: true,
	choices: FREEKIOSK_COMMANDS.map((Command) => ({
		id: Command.ID,
		label: Command.Value
			? `${Command.Group}: ${Command.Label} (${Command.Value.Min}-${Command.Value.Max})`
			: `${Command.Group}: ${Command.Label}`,
	})),
} as const
const kioskValue = {
	id: 'value',
	type: 'textinput',
	label: 'Value (Brightness and Volume only, 0-100)',
	default: '',
	useVariables: true,
} as const

// An optional free-text option as a string: blank when unset. A number (from an
// expression) is kept; anything else is not a value an action can send.
function optionText(value: unknown): string {
	if (typeof value === 'string') return value
	if (typeof value === 'number' && Number.isFinite(value)) return String(value)
	return ''
}

const VIEW_CHOICES: { id: ViewMode; label: string }[] = [
	{ id: 'grid', label: 'Grid' },
	{ id: 'compact', label: 'Compact' },
	{ id: 'list', label: 'List' },
]

export function UpdateActions(self: ModuleInstance): void {
	// Simple fire-and-forget action.
	const simple = (exec: () => Promise<CommandResult>) => async () => self.logResult(await exec())
	// Confirmable action: reads the `confirm` option from the event, and gates on
	// `controlId:id` so each action instance on a button arms separately.
	const confirmable =
		(exec: (o: Record<string, unknown>) => Promise<CommandResult>) =>
		async (event: { id: string; controlId: string; options: Record<string, unknown> }) =>
			self.runConfirmable(`${event.controlId}:${event.id}`, !!event.options.confirm, async () => exec(event.options))

	self.setActionDefinitions({
		// --- Wake-on-LAN ---
		wol_all: {
			name: 'Wake-on-LAN: All clients',
			options: [confirm],
			callback: confirmable(async () => self.control.wolAll()),
		},
		wol_client: {
			name: 'Wake-on-LAN: Client',
			options: [{ ...slug, label: 'Client slug' }, confirm],
			callback: confirmable(async (o) => self.control.wolClient(String(o.slug))),
		},
		wol_group: {
			name: 'Wake-on-LAN: Group',
			options: [{ ...slug, label: 'Group slug' }, confirm],
			callback: confirmable(async (o) => self.control.wolGroup(String(o.slug))),
		},
		wol_tag: {
			name: 'Wake-on-LAN: Tag',
			options: [{ ...slug, label: 'Tag slug' }, confirm],
			callback: confirmable(async (o) => self.control.wolTag(String(o.slug))),
		},

		// --- Scripts (by script slug) ---
		script_all: {
			name: 'Script: Run on all clients',
			options: [scriptSlug, confirm],
			callback: confirmable(async (o) => self.control.runScriptOnAll(String(o.scriptSlug))),
		},
		script_client: {
			name: 'Script: Run on client',
			options: [{ ...slug, label: 'Client slug' }, scriptSlug, confirm],
			callback: confirmable(async (o) => self.control.runScriptOnClient(String(o.slug), String(o.scriptSlug))),
		},
		script_group: {
			name: 'Script: Run on group',
			options: [{ ...slug, label: 'Group slug' }, scriptSlug, confirm],
			callback: confirmable(async (o) => self.control.runScriptOnGroup(String(o.slug), String(o.scriptSlug))),
		},
		script_tag: {
			name: 'Script: Run on tag',
			options: [{ ...slug, label: 'Tag slug' }, scriptSlug, confirm],
			callback: confirmable(async (o) => self.control.runScriptOnTag(String(o.slug), String(o.scriptSlug))),
		},

		// --- Integrated events ---
		event_all: {
			name: 'Event: Run on all integrated clients',
			options: [eventSlug, confirm],
			callback: confirmable(async (o) => self.control.triggerEventOnAll(String(o.eventSlug))),
		},
		event_client: {
			name: 'Event: Run on client',
			options: [{ ...slug, label: 'Client slug' }, eventSlug, confirm],
			callback: confirmable(async (o) => self.control.triggerEventOnClient(String(o.slug), String(o.eventSlug))),
		},
		event_group: {
			name: 'Event: Run on group',
			options: [{ ...slug, label: 'Group slug' }, eventSlug, confirm],
			callback: confirmable(async (o) => self.control.triggerEventOnGroup(String(o.slug), String(o.eventSlug))),
		},
		event_tag: {
			name: 'Event: Run on tag',
			options: [{ ...slug, label: 'Tag slug' }, eventSlug, confirm],
			callback: confirmable(async (o) => self.control.triggerEventOnTag(String(o.slug), String(o.eventSlug))),
		},

		// --- Alerts ---
		alerts_on: { name: 'Alerts: Turn on', options: [], callback: simple(async () => self.control.alertsOn()) },
		alerts_off: { name: 'Alerts: Turn off', options: [], callback: simple(async () => self.control.alertsOff()) },
		alerts_toggle: {
			name: 'Alerts: Toggle',
			options: [],
			callback: simple(async () => self.control.alertsToggle()),
		},

		// --- Mode ---
		mode_show: { name: 'Mode: Enter Show', options: [], callback: simple(async () => self.control.enterShowMode()) },
		mode_edit: { name: 'Mode: Enter Edit', options: [], callback: simple(async () => self.control.enterEditMode()) },
		mode_toggle: { name: 'Mode: Toggle', options: [], callback: simple(async () => self.control.toggleMode()) },

		// --- Identify ---
		// Flashes an overlay on the client's own screen. Safe in Show mode: it
		// changes nothing, and finding a machine in a rack is a show-time job.
		identify_client: {
			name: 'Identify: Client',
			options: [
				{ ...slug, label: 'Client slug' },
				{
					id: 'state',
					type: 'dropdown',
					label: 'Identify',
					default: 'toggle',
					choices: [
						{ id: 'on', label: 'Start' },
						{ id: 'off', label: 'Stop' },
						{ id: 'toggle', label: 'Toggle' },
					],
				},
			],
			callback: async (e) => {
				const Slug = String(e.options.slug)
				const State = String(e.options.state)
				const Start = State === 'on' || (State === 'toggle' && !self.control.getClient(Slug)?.Identifying)
				self.logResult(await (Start ? self.control.identify(Slug) : self.control.stopIdentify(Slug)))
			},
		},

		// --- Monitoring check actions ---
		// The same verbs as the server's OSC /API/Monitor/<slug>/<method>/<action>
		// routes; the server's OSC/API reference lists every method and action.
		monitor_action: {
			name: 'Monitor: Run check action',
			description: 'Runs a device action on a monitor, e.g. method "pjlink", action "power.on".',
			options: [
				{ ...slug, label: 'Monitor slug' },
				{
					id: 'method',
					type: 'textinput',
					label: 'Check type (method), e.g. pjlink',
					default: '',
					useVariables: true,
				},
				{
					id: 'actionId',
					type: 'textinput',
					label: 'Action, e.g. power.on or input.set',
					default: '',
					useVariables: true,
				},
				{
					id: 'value',
					type: 'textinput',
					label: "Value (for actions that take one; fills the action's first setting)",
					default: '',
					useVariables: true,
				},
				confirm,
			],
			callback: confirmable(async (o) =>
				self.control.runActionOnMonitor(
					String(o.slug),
					String(o.method).trim(),
					String(o.actionId).trim(),
					optionText(o.value),
				),
			),
		},

		// --- FreeKiosk terminals ---
		freekiosk_terminal: {
			name: 'FreeKiosk: Command a terminal',
			options: [{ ...slug, label: 'Terminal slug' }, kioskCommand, kioskValue, confirm],
			callback: confirmable(async (o) =>
				self.control.runFreeKioskCommandOnTerminal(String(o.slug), String(o.commandId), optionText(o.value)),
			),
		},
		freekiosk_group: {
			name: 'FreeKiosk: Command every terminal in a group',
			options: [{ ...slug, label: 'Group slug' }, kioskCommand, kioskValue, confirm],
			callback: confirmable(async (o) =>
				self.control.runFreeKioskCommandOnGroup(String(o.slug), String(o.commandId), optionText(o.value)),
			),
		},
		freekiosk_tag: {
			name: 'FreeKiosk: Command every terminal in a tag',
			options: [{ ...slug, label: 'Tag slug' }, kioskCommand, kioskValue, confirm],
			callback: confirmable(async (o) =>
				self.control.runFreeKioskCommandOnTag(String(o.slug), String(o.commandId), optionText(o.value)),
			),
		},
		freekiosk_all: {
			name: 'FreeKiosk: Command every terminal',
			options: [kioskCommand, kioskValue, confirm],
			callback: confirmable(async (o) =>
				self.control.runFreeKioskCommandOnAll(String(o.commandId), optionText(o.value)),
			),
		},

		// --- Dummy clients ---
		// For a device Companion can see but ShowTrak cannot: send this from a
		// trigger while the device is healthy, and the dummy reads online.
		dummy_heartbeat: {
			name: 'Dummy: Send heartbeat',
			options: [{ ...slug, label: 'Dummy slug' }],
			callback: async (e) => self.logResult(await self.control.sendDummyHeartbeat(String(e.options.slug))),
		},

		// --- Execution panel ---
		executions_retry_failed: {
			name: 'Executions: Retry failed',
			description: 'Runs every failed script and integrated event in the execution panel again.',
			options: [confirm],
			callback: confirmable(async () => self.control.retryFailedExecutions()),
		},
		executions_clear: {
			name: 'Executions: Clear finished',
			description: 'Clears completed and failed rows from the execution panel. Anything still running stays.',
			options: [],
			callback: simple(async () => self.control.clearSettledExecutions()),
		},

		// --- Client-list layout (the desktop and every Web UI browser) ---
		view_set: {
			name: 'View: Set layout',
			options: [{ id: 'view', type: 'dropdown', label: 'Layout', default: 'grid', choices: VIEW_CHOICES }],
			callback: async (e) => {
				const View = VIEW_CHOICES.find((Choice) => Choice.id === e.options.view)?.id ?? 'grid'
				self.logResult(await self.control.setView(View))
			},
		},
		view_toggle_compact: {
			name: 'View: Toggle compact',
			options: [],
			callback: simple(async () => self.control.toggleView()),
		},

		// --- Modals (desktop app only; the ShowTrak web UI ignores these) ---
		modal_open_client: {
			name: 'Modal: Open client (desktop app only)',
			options: [{ ...slug, label: 'Client slug' }],
			callback: async (e) => self.logResult(await self.control.openClientModal(String(e.options.slug))),
		},
		modal_close_all: {
			name: 'Modal: Close all (desktop app only)',
			options: [],
			callback: simple(async () => self.control.closeAllModals()),
		},

		// --- Misc ---
		save_show: { name: 'Save show file', options: [], callback: simple(async () => self.control.saveShow()) },

		// --- Shutdown ---
		// Confirm defaults ON here: an accidental press closes the server mid-show.
		shutdown_server: {
			name: 'Shutdown ShowTrak Server',
			options: [{ ...confirm, default: true }],
			callback: confirmable(async () => self.control.shutdownServer()),
		},
		shutdown_server_force: {
			name: 'Shutdown ShowTrak Server (force, skips prompts)',
			options: [{ ...confirm, default: true }],
			callback: confirmable(async () => self.control.forceShutdownServer()),
		},
	})
}
