import { combineRgb } from '@companion-module/base'
import type { ModuleSchema } from './main.js'
import type ModuleInstance from './main.js'
import type { CompanionPresetDefinitions, CompanionPresetSection } from '@companion-module/base'

const BLACK = combineRgb(0, 0, 0)
const WHITE = combineRgb(255, 255, 255)
const DARK = combineRgb(30, 30, 30)
const CONFIRM_BG = combineRgb(200, 120, 0)

// Category colours. Chosen mid-dark so WHITE button text stays legible, and
// applied by action type so an operator can find a control by its colour:
//   green  = enabled / active / positive     red   = disabled / negative
//   blue   = wake-on-LAN                     purple = run a script
//   teal   = integrated event               slate = neutral / mode / view / open
//   dark   = status-driven tiles
const GREEN = combineRgb(25, 95, 50)
const RED = combineRgb(115, 40, 40)
const BLUE = combineRgb(30, 80, 135)
const PURPLE = combineRgb(90, 55, 125)
const TEAL = combineRgb(0, 100, 100)
const SLATE = combineRgb(55, 62, 72)

// Single font size for every preset button face.
const FONT_SIZE = 14

type Presets = CompanionPresetDefinitions<ModuleSchema>
type Preset = NonNullable<Presets[string]>
type Action = Preset['steps'][number]['down'][number]
type Feedback = Preset['feedbacks'][number]
type LocalVariable = NonNullable<Preset['localVariables']>[number]

// Slugged presets carry a button-local `slug` variable that every action and
// feedback on the button reads, so the operator types the target once per button
// instead of once per field.
const SLUG_LOCAL: LocalVariable[] = [
	{
		variableName: 'slug',
		variableType: 'simple',
		headline: 'The client / group / tag slug this button targets',
		startupValue: '',
	},
]
const SLUG_REF = '$(local:slug)'

// Build a button preset. `title` is the single label shown on the button face;
// `bgcolor` is its category colour (see the palette above).
function button(
	presets: Presets,
	id: string,
	name: string,
	title: string,
	down: Action[],
	bgcolor = DARK,
	feedbacks: Feedback[] = [],
	localVariables: LocalVariable[] = [],
): string {
	presets[id] = {
		type: 'simple',
		name,
		style: {
			text: title,
			size: FONT_SIZE,
			color: WHITE,
			bgcolor,
			show_topbar: false,
		},
		steps: [{ down, up: [] }],
		feedbacks,
		...(localVariables.length ? { localVariables } : {}),
	}
	return id
}

// Build a down-action from a computed id/options. Templated scope ids (e.g.
// `wol_${s}`) widen to `string`, which TS can't line up with a single member of
// the discriminated ActionsSchema union, so we cast at this one boundary.
function act(actionId: string, options: Record<string, unknown>): Action {
	return { actionId, options } as unknown as Action
}

// The orange "awaiting confirm" overlay applied to every confirm-variant button.
const confirmFeedback: Feedback = {
	feedbackId: 'pending_confirm',
	options: {},
	style: { bgcolor: CONFIRM_BG, color: BLACK, text: 'Confirm?' },
}

// The scope matrix. Client / Group / Tag / All each get the same row of controls:
// a live status badge plus WOL / Script / Event in Instant + Confirm variants.
// `slugged` scopes take a target slug; `all` always targets every client, so its
// actions and status badge carry no slug.
type Scope = {
	id: 'client' | 'group' | 'tag' | 'all'
	name: string
	// The advanced feedback that paints the status badge for this scope.
	statusFeedbackId: 'client_status' | 'group_status' | 'tag_status' | 'all_status'
	// Whether this scope's actions/badge target a specific slug.
	slugged: boolean
}
const SCOPES: Scope[] = [
	{ id: 'client', name: 'Client', statusFeedbackId: 'client_status', slugged: true },
	{ id: 'group', name: 'Group', statusFeedbackId: 'group_status', slugged: true },
	{ id: 'tag', name: 'Tag', statusFeedbackId: 'tag_status', slugged: true },
	{ id: 'all', name: 'All', statusFeedbackId: 'all_status', slugged: false },
]

export function UpdatePresets(self: ModuleInstance): void {
	const presets: Presets = {}

	// Presets are grouped by their target: server-wide Utils first, then one
	// section per scope (Client / Group / Tag / All).
	const structure: CompanionPresetSection[] = []

	// --- Utils ---------------------------------------------------------------
	buildUtils(presets, self.label)
	structure.push({
		id: 'utils',
		name: 'Utils',
		description: 'Server-wide controls that are not tied to a specific client/group/tag.',
		definitions: [
			'alerts_toggle',
			'mode_show',
			'mode_edit',
			'mode_toggle',
			'modal_close_all',
			'save_show',
			'shutdown_server',
			'shutdown_server_force',
			'executions_retry_failed',
			'executions_clear',
			'view_grid',
			'view_compact',
			'view_list',
			'pending_adoption',
			'alert_raised',
		],
	})

	// --- Scope rows ----------------------------------------------------------
	// Slugged scopes point every action and feedback at the button-local `slug`
	// variable, so the operator fills it in once on the button rather than in each
	// field. A literal slug or any other $(variable) still works if typed over it.
	// The status feedback replaces text + background with the live aggregate, so
	// DARK is only the placeholder shown before the first status arrives (or while
	// no slug is set).
	for (const scope of SCOPES) {
		const s = scope.id
		// Slugged scopes carry the local-variable slug reference; `all` omits it.
		const slugOpt = scope.slugged ? { slug: SLUG_REF } : {}
		const localVars = scope.slugged ? SLUG_LOCAL : []
		const defs: string[] = []

		// Status badge -------------------------------------------------------
		const tileId = `tile_${s}`
		// Cast past the discriminated union: statusFeedbackId is a widened union of
		// the four feedback ids, which TS can't line up with a single member here.
		const statusFeedback = {
			feedbackId: scope.statusFeedbackId,
			options: slugOpt,
		} as unknown as Feedback
		// The Client tile doubles as its own Open button: pressing it opens that
		// client's modal on the ShowTrak desktop app. The other scopes have no
		// equivalent modal, so their tiles stay display-only.
		const tileDown: Action[] = s === 'client' ? [act('modal_open_client', { slug: SLUG_REF })] : []
		button(presets, tileId, `${scope.name} Status`, scope.name, tileDown, DARK, [statusFeedback], localVars)
		defs.push(tileId)

		// Wake-on-LAN --------------------------------------------------------
		button(
			presets,
			`wol_${s}`,
			`WOL ${scope.name}`,
			'WOL\n(Instant)',
			[act(`wol_${s}`, { ...slugOpt, confirm: false })],
			BLUE,
			[],
			localVars,
		)
		button(
			presets,
			`wol_${s}_confirm`,
			`WOL ${scope.name} (confirm)`,
			'WOL\n(Confirm)',
			[act(`wol_${s}`, { ...slugOpt, confirm: true })],
			BLUE,
			[confirmFeedback],
			localVars,
		)
		defs.push(`wol_${s}`, `wol_${s}_confirm`)

		// Scripts ------------------------------------------------------------
		button(
			presets,
			`script_${s}`,
			`Script ${scope.name}`,
			'Script\n(Instant)',
			[act(`script_${s}`, { ...slugOpt, scriptSlug: '', confirm: false })],
			PURPLE,
			[],
			localVars,
		)
		button(
			presets,
			`script_${s}_confirm`,
			`Script ${scope.name} (confirm)`,
			'Script\n(Confirm)',
			[act(`script_${s}`, { ...slugOpt, scriptSlug: '', confirm: true })],
			PURPLE,
			[confirmFeedback],
			localVars,
		)
		defs.push(`script_${s}`, `script_${s}_confirm`)

		// Integrated events --------------------------------------------------
		button(
			presets,
			`event_${s}`,
			`Event ${scope.name}`,
			'Event\n(Instant)',
			[act(`event_${s}`, { ...slugOpt, eventSlug: '', confirm: false })],
			TEAL,
			[],
			localVars,
		)
		button(
			presets,
			`event_${s}_confirm`,
			`Event ${scope.name} (confirm)`,
			'Event\n(Confirm)',
			[act(`event_${s}`, { ...slugOpt, eventSlug: '', confirm: true })],
			TEAL,
			[confirmFeedback],
			localVars,
		)
		defs.push(`event_${s}`, `event_${s}_confirm`)

		// Script activity ----------------------------------------------------
		// Display-only: blue while any script or event is running on the scope,
		// red while the execution panel holds a failure for it.
		const execOpts = { scope: s, slug: scope.slugged ? SLUG_REF : '', actionSlug: '' }
		button(
			presets,
			`exec_status_${s}`,
			`Script activity ${scope.name}`,
			'Scripts',
			[],
			DARK,
			[
				{ feedbackId: 'script_failed', options: execOpts, style: { bgcolor: RED, color: WHITE } },
				{ feedbackId: 'script_running', options: execOpts, style: { bgcolor: BLUE, color: WHITE } },
			],
			localVars,
		)
		defs.push(`exec_status_${s}`)

		// Client only: Identify and the Open button, placed last so the row lines
		// up with the other scopes and the odd ones out sit at the end.
		if (s === 'client') {
			button(
				presets,
				'identify_client',
				'Identify client (toggle)',
				'Identify',
				[act('identify_client', { slug: SLUG_REF, state: 'toggle' })],
				SLATE,
				[{ feedbackId: 'client_identifying', options: { slug: SLUG_REF }, style: { bgcolor: BLUE, color: WHITE } }],
				localVars,
			)
			defs.push('identify_client')
			button(
				presets,
				'modal_open_client',
				'Open client modal (desktop app only)',
				'Open',
				[{ actionId: 'modal_open_client', options: { slug: SLUG_REF } }],
				SLATE,
				[],
				localVars,
			)
			defs.push('modal_open_client')
		}

		structure.push({
			id: s,
			name: scope.name,
			description: scope.slugged
				? `Status badge + actions for a single ${scope.name.toLowerCase()}. Set the button's local "slug" variable to choose the target.`
				: 'Status badge + actions that target every client.',
			definitions: defs,
		})
	}

	// --- Device sections -------------------------------------------------------
	structure.push(buildFreeKiosk(presets))
	structure.push(buildMonitor(presets))
	structure.push(buildDummy(presets))

	self.setPresetDefinitions(structure, presets)
}

// The client tile, reused by the device sections: monitors, dummies and
// FreeKiosk terminals share the client slug namespace, so client_status paints
// them too.
function deviceTile(presets: Presets, id: string, name: string, title: string): string {
	return button(
		presets,
		id,
		name,
		title,
		[],
		DARK,
		[{ feedbackId: 'client_status', options: { slug: SLUG_REF } }],
		SLUG_LOCAL,
	)
}

function buildFreeKiosk(presets: Presets): CompanionPresetSection {
	const defs = [deviceTile(presets, 'freekiosk_tile', 'FreeKiosk terminal status', 'Kiosk')]
	const commands: [string, string, string, string, number?][] = [
		['freekiosk_screen_on', 'Screen on', 'Screen\nOn', 'screen.on'],
		['freekiosk_screen_off', 'Screen off', 'Screen\nOff', 'screen.off'],
		['freekiosk_wake', 'Wake screen', 'Wake', 'wake'],
		['freekiosk_reload', 'Reload page', 'Reload', 'reload'],
		['freekiosk_brightness_100', 'Brightness 100%', 'Bright\n100%', 'brightness', 100],
		['freekiosk_brightness_30', 'Brightness 30%', 'Bright\n30%', 'brightness', 30],
		['freekiosk_beep', 'Beep (find the terminal)', 'Beep', 'audio.beep'],
	]
	for (const [id, name, title, commandId, value] of commands) {
		button(
			presets,
			id,
			`FreeKiosk: ${name}`,
			title,
			[
				act('freekiosk_terminal', {
					slug: SLUG_REF,
					commandId,
					value: value == null ? '' : String(value),
					confirm: false,
				}),
			],
			TEAL,
			[],
			SLUG_LOCAL,
		)
		defs.push(id)
	}
	button(
		presets,
		'freekiosk_reboot',
		'FreeKiosk: Reboot (confirm)',
		'Reboot',
		[act('freekiosk_terminal', { slug: SLUG_REF, commandId: 'reboot', value: '', confirm: true })],
		RED,
		[confirmFeedback],
		SLUG_LOCAL,
	)
	defs.push('freekiosk_reboot')
	return {
		id: 'freekiosk',
		name: 'FreeKiosk',
		description:
			'Status and commands for one FreeKiosk terminal. Set the button\'s local "slug" variable to the terminal\'s slug.',
		definitions: defs,
	}
}

function buildMonitor(presets: Presets): CompanionPresetSection {
	const defs = [deviceTile(presets, 'monitor_tile', 'Monitor status', 'Monitor')]
	button(
		presets,
		'monitor_action',
		'Monitor: Run check action',
		'Action',
		[act('monitor_action', { slug: SLUG_REF, method: '', actionId: '', value: '', confirm: false })],
		SLATE,
		[],
		SLUG_LOCAL,
	)
	defs.push('monitor_action')
	return {
		id: 'monitor',
		name: 'Monitor',
		description:
			'Status and a device action for one monitor. Set the button\'s local "slug" variable, then the action\'s check type and action (e.g. pjlink / power.on).',
		definitions: defs,
	}
}

function buildDummy(presets: Presets): CompanionPresetSection {
	const defs = [deviceTile(presets, 'dummy_tile', 'Dummy client status', 'Dummy')]
	button(
		presets,
		'dummy_heartbeat',
		'Dummy: Send heartbeat',
		'Heart\nbeat',
		[act('dummy_heartbeat', { slug: SLUG_REF })],
		GREEN,
		[],
		SLUG_LOCAL,
	)
	defs.push('dummy_heartbeat')
	return {
		id: 'dummy',
		name: 'Dummy',
		description:
			'Status and a heartbeat for one dummy client. Send the heartbeat from a trigger while the device it stands for is healthy.',
		definitions: defs,
	}
}

// Server-wide controls: these target the server itself, so none of them take a slug.
function buildUtils(presets: Presets, label: string): void {
	// --- Alerts --------------------------------------------------------------
	// alerts_toggle starts RED (disabled) and the alerts_enabled feedback repaints
	// it GREEN while alert actions are on, so the colour always reflects state.
	button(presets, 'alerts_toggle', 'Alerts toggle', 'Alerts', [{ actionId: 'alerts_toggle', options: {} }], RED, [
		{ feedbackId: 'alerts_enabled', options: {}, style: { bgcolor: GREEN, color: WHITE } },
	])

	// --- Mode ----------------------------------------------------------------
	// mode_show / mode_edit sit grey and turn GREEN via the mode_is feedback while
	// their mode is the active one, so the pair reads as a segmented indicator.
	button(presets, 'mode_show', 'Enter Show mode', 'Show\nMode', [{ actionId: 'mode_show', options: {} }], SLATE, [
		{ feedbackId: 'mode_is', options: { mode: 'SHOW' }, style: { bgcolor: GREEN, color: WHITE } },
	])
	button(presets, 'mode_edit', 'Enter Edit mode', 'Edit\nMode', [{ actionId: 'mode_edit', options: {} }], SLATE, [
		{ feedbackId: 'mode_is', options: { mode: 'EDIT' }, style: { bgcolor: GREEN, color: WHITE } },
	])
	button(presets, 'mode_toggle', 'Toggle Mode', 'Toggle\nMode', [{ actionId: 'mode_toggle', options: {} }], SLATE, [
		{ feedbackId: 'mode_is', options: { mode: 'EDIT' }, style: { bgcolor: combineRgb(0, 100, 200), color: WHITE } },
	])

	// --- Modals --------------------------------------------------------------
	// Desktop app only — the pairing for the per-client "Open" button.
	button(
		presets,
		'modal_close_all',
		'Close all modals',
		'Close\nModals',
		[{ actionId: 'modal_close_all', options: {} }],
		SLATE,
	)

	// --- Show control --------------------------------------------------------
	button(presets, 'save_show', 'Save show', 'Save\nShow', [{ actionId: 'save_show', options: {} }], GREEN)

	// --- Shutdown ------------------------------------------------------------
	// RED, and confirm-armed by default — these close the server, not a client.
	button(
		presets,
		'shutdown_server',
		'Shutdown server',
		'Shut\nDown',
		[act('shutdown_server', { confirm: true })],
		RED,
		[confirmFeedback],
	)
	button(
		presets,
		'shutdown_server_force',
		'Shutdown server (force)',
		'Force\nShut\nDown',
		[act('shutdown_server_force', { confirm: true })],
		RED,
		[confirmFeedback],
	)

	// --- Execution panel -----------------------------------------------------
	// Retry turns RED while anything has failed, so the button that fixes it is
	// the one that says so. Confirm-armed: it re-runs scripts across the show.
	button(
		presets,
		'executions_retry_failed',
		'Retry failed scripts',
		'Retry\nFailed',
		[act('executions_retry_failed', { confirm: true })],
		SLATE,
		[
			{
				feedbackId: 'script_failed',
				options: { scope: 'all', slug: '', actionSlug: '' },
				style: { bgcolor: RED, color: WHITE },
			},
			confirmFeedback,
		],
	)
	button(
		presets,
		'executions_clear',
		'Clear finished executions',
		'Clear\nFinished',
		[{ actionId: 'executions_clear', options: {} }],
		SLATE,
	)

	// --- View ----------------------------------------------------------------
	for (const [view, title] of [
		['grid', 'Grid'],
		['compact', 'Compact'],
		['list', 'List'],
	] as const) {
		button(presets, `view_${view}`, `View: ${title}`, `View\n${title}`, [act('view_set', { view })], SLATE)
	}

	// --- Indicators ----------------------------------------------------------
	// Display-only: orange while devices wait to be adopted, red for ten
	// seconds after an alert rule raises a ShowTrak alert.
	button(
		presets,
		'pending_adoption',
		'Devices waiting to be adopted',
		`Adopt\n$(${label}:pending_adoption_count)`,
		[],
		DARK,
		[{ feedbackId: 'pending_adoption', options: {}, style: { bgcolor: CONFIRM_BG, color: BLACK } }],
	)
	button(presets, 'alert_raised', 'Last alert', `Alert\n$(${label}:last_alert_time)`, [], DARK, [
		{ feedbackId: 'alert_raised', options: { seconds: 10, severity: 'any' }, style: { bgcolor: RED, color: WHITE } },
	])
}
