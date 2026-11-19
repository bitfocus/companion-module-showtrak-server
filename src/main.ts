import { InstanceBase, InstanceStatus, type SomeCompanionConfigField } from '@companion-module/base'
import { GetConfigFields, type ModuleConfig, type ModuleSecrets } from './config.js'
import { UpdateVariableDefinitions, RefreshVariableValues, type VariablesSchema } from './variables.js'
import { UpgradeScripts } from './upgrades.js'
import { UpdateActions, type ActionsSchema } from './actions.js'
import { UpdateFeedbacks, MAX_ALERT_HOLD_SECONDS, type FeedbacksSchema } from './feedbacks.js'
import { UpdatePresets } from './presets.js'
import { ShowTrakControlClient, type CommandResult, type ShowTrakAlert } from '@showtrak/server-sdk'

type FeedbackId = keyof FeedbacksSchema

// How long a burst of server pushes is folded into one refresh. The SDK fires a
// change event per client update, several a second on a busy show; redrawing
// every variable and tile per event costs Companion far more than a tenth of a
// second of latency costs an operator.
const REFRESH_COALESCE_MS = 100

// Tile feedbacks that read a client's status, label or membership.
const CLIENT_FEEDBACKS: FeedbackId[] = [
	'client_status',
	'group_status',
	'tag_status',
	'all_status',
	'client_status_is',
	'client_identifying',
	// Group and tag scopes resolve their members from the client list.
	'script_running',
	'script_failed',
]

export type ModuleSchema = {
	config: ModuleConfig
	secrets: ModuleSecrets
	actions: ActionsSchema
	feedbacks: FeedbacksSchema
	variables: VariablesSchema
}

export { UpgradeScripts }

export default class ModuleInstance extends InstanceBase<ModuleSchema> {
	config!: ModuleConfig // Setup in init()
	secrets!: ModuleSecrets // Setup in init()

	// The live control-API client. All actions/feedbacks read and drive this.
	readonly control = new ShowTrakControlClient()

	// Actions currently armed for a confirm press. Keyed by `controlId:actionId`
	// (not controlId alone) so two confirmable actions on the same button arm and
	// fire independently — otherwise the first action's arming would satisfy the
	// second action's gate within the same press. Each entry holds the auto-timeout
	// that disarms it after ~5s.
	readonly confirmPending = new Map<string, ReturnType<typeof setTimeout>>()

	/** The most recent ShowTrak alert, with when it arrived (epoch ms). */
	lastAlert: (ShowTrakAlert & { At: number }) | null = null

	/** Variable values as last sent, so only changes go to Companion. See variables.ts. */
	readonly sentVariableValues = new Map<string, string | number>()
	/** The variable set as last declared, so it is re-declared only when it changes. */
	declaredVariablesKey = ''

	private refreshTimer: ReturnType<typeof setTimeout> | null = null
	private readonly pendingFeedbacks = new Set<FeedbackId>()
	private pendingVariables = false
	private alertTicker: ReturnType<typeof setInterval> | null = null

	constructor(internal: unknown) {
		super(internal)
	}

	async init(config: ModuleConfig, _isFirstInit: boolean, secrets: ModuleSecrets): Promise<void> {
		this.config = config
		this.secrets = secrets

		this.updateActions()
		this.updateFeedbacks()
		this.updatePresets()
		this.updateVariableDefinitions()

		this.wireControlEvents()
		// Seed the variables before connecting: nothing else populates them until a
		// server event arrives, so an unconfigured instance would render them empty.
		RefreshVariableValues(this)
		this.connect()
	}

	async destroy(): Promise<void> {
		for (const timer of this.confirmPending.values()) clearTimeout(timer)
		this.confirmPending.clear()
		if (this.refreshTimer) clearTimeout(this.refreshTimer)
		this.refreshTimer = null
		this.stopAlertTicker()
		this.control.disconnect()
	}

	async configUpdated(config: ModuleConfig, secrets: ModuleSecrets): Promise<void> {
		this.config = config
		this.secrets = secrets
		// The telemetry switch changes which variables exist.
		this.updateVariableDefinitions()
		RefreshVariableValues(this)
		this.connect()
	}

	getConfigFields(): SomeCompanionConfigField[] {
		return GetConfigFields()
	}

	private connect(): void {
		const apiKey = this.secrets?.apiKey ?? ''
		if (!this.config.host || !apiKey) {
			// Tear down first: disconnect() emits `stateChanged`, whose handler would
			// otherwise overwrite BadConfig with a bare Disconnected and lose the
			// explanation for anyone who cleared their config on a live connection.
			this.control.disconnect()
			this.updateStatus(InstanceStatus.BadConfig, 'Set the server address and SDK API key')
			return
		}
		this.updateStatus(InstanceStatus.Connecting)
		this.control.connect({
			host: this.config.host,
			port: this.config.port,
			apiKey,
		})
	}

	// Subscribe once to the client's change events; these survive reconnects.
	//
	// Every handler goes through scheduleRefresh rather than redrawing on the
	// spot: one coalesced pass re-declares variables if the entity set changed,
	// sends only the values that did, and re-checks each affected feedback once.
	private wireControlEvents(): void {
		this.control.on('stateChanged', (state) => {
			switch (state) {
				case 'connected':
					this.updateStatus(InstanceStatus.Ok)
					break
				case 'connecting':
					this.updateStatus(InstanceStatus.Connecting)
					break
				case 'error':
					this.updateStatus(InstanceStatus.ConnectionFailure)
					break
				default:
					this.updateStatus(InstanceStatus.Disconnected)
			}
			this.scheduleRefresh(['connected'])
		})
		this.control.on('error', (message) => this.log('warn', `Control API: ${message}`))
		// Client and group sets arrive together. Client status also rolls up into
		// the group/tag/all aggregate tiles.
		this.control.on('clientsChanged', () => this.scheduleRefresh(CLIENT_FEEDBACKS))
		// A tag's membership (Scope) may have changed.
		this.control.on('tagsChanged', () => this.scheduleRefresh(['tag_status', 'script_running', 'script_failed']))
		this.control.on('modeChanged', () => this.scheduleRefresh(['mode_is']))
		this.control.on('alertsChanged', () => this.scheduleRefresh(['alerts_enabled']))
		this.control.on('scriptsChanged', () => this.scheduleRefresh([]))
		this.control.on('scriptExecutionsChanged', () => this.scheduleRefresh(['script_running', 'script_failed']))
		this.control.on('pendingAdoptionChanged', () => this.scheduleRefresh(['pending_adoption']))
		this.control.on('alert', (alert) => {
			this.lastAlert = { ...alert, At: Date.now() }
			this.startAlertTicker()
			this.scheduleRefresh(['alert_raised'])
		})
	}

	/**
	 * Queue a variable refresh and a re-check of these feedbacks, folding a burst
	 * of server pushes into one pass. See REFRESH_COALESCE_MS.
	 */
	scheduleRefresh(feedbacks: FeedbackId[], variables = true): void {
		for (const Id of feedbacks) this.pendingFeedbacks.add(Id)
		if (variables) this.pendingVariables = true
		if (this.refreshTimer) return
		this.refreshTimer = setTimeout(() => this.flushRefresh(), REFRESH_COALESCE_MS)
	}

	private flushRefresh(): void {
		this.refreshTimer = null
		if (this.pendingVariables) {
			this.pendingVariables = false
			this.updateVariableDefinitions()
			RefreshVariableValues(this)
		}
		const Ids = [...this.pendingFeedbacks]
		this.pendingFeedbacks.clear()
		if (Ids.length) this.checkFeedbacks(Ids[0], ...Ids.slice(1))
	}

	// "Alert raised" holds for a number of seconds the operator chooses, so it has
	// to be re-checked as time passes, not only when something arrives. A one
	// second tick runs only while the last alert is recent enough to matter.
	private startAlertTicker(): void {
		if (this.alertTicker) return
		this.alertTicker = setInterval(() => {
			const Age = this.lastAlert ? Date.now() - this.lastAlert.At : Infinity
			this.checkFeedbacks('alert_raised')
			if (Age > MAX_ALERT_HOLD_SECONDS * 1000) this.stopAlertTicker()
		}, 1000)
	}

	private stopAlertTicker(): void {
		if (this.alertTicker) clearInterval(this.alertTicker)
		this.alertTicker = null
	}

	// Log a command's outcome (used by every action callback).
	logResult(result: CommandResult): void {
		if (!result.ok) this.log('warn', `ShowTrak command failed: ${result.detail}`)
	}

	/**
	 * Run an action, optionally behind a press-to-confirm gate that auto-times-out
	 * after 5s. When `confirm` is set, the first press arms the action (a
	 * `pending_confirm` feedback recolours the button) and the second press within
	 * the window actually executes.
	 *
	 * `key` is `controlId:actionId` — see `confirmPending`.
	 */
	async runConfirmable(key: string, confirm: boolean, exec: () => Promise<CommandResult>): Promise<void> {
		if (!confirm) {
			this.logResult(await exec())
			return
		}
		const armed = this.confirmPending.get(key)
		if (armed) {
			clearTimeout(armed)
			this.confirmPending.delete(key)
			this.checkFeedbacks('pending_confirm')
			this.logResult(await exec())
			return
		}
		const timer = setTimeout(() => {
			this.confirmPending.delete(key)
			this.checkFeedbacks('pending_confirm')
		}, 5000)
		this.confirmPending.set(key, timer)
		this.checkFeedbacks('pending_confirm')
	}

	// True while any action on the given button is armed for its confirm press.
	isConfirmPending(controlId: string): boolean {
		const prefix = `${controlId}:`
		for (const key of this.confirmPending.keys()) if (key.startsWith(prefix)) return true
		return false
	}

	updateActions(): void {
		UpdateActions(this)
	}

	updateFeedbacks(): void {
		UpdateFeedbacks(this)
	}

	updatePresets(): void {
		UpdatePresets(this)
	}

	updateVariableDefinitions(): void {
		UpdateVariableDefinitions(this)
	}
}
