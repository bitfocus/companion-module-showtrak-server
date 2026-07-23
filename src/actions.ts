import type ModuleInstance from './main.js'
import type { CommandResult } from '@showtrak/server-sdk'

type SlugOpts = { slug: string }
type ScriptOpts = { slug: string; scriptSlug: string; confirm: boolean }
type EventOpts = { slug: string; eventSlug: string; confirm: boolean }
type ConfirmOnly = { confirm: boolean }

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
