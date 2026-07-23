import { InstanceBase, InstanceStatus, type SomeCompanionConfigField } from '@companion-module/base'
import { GetConfigFields, type ModuleConfig, type ModuleSecrets } from './config.js'
import { UpdateVariableDefinitions, RefreshVariableValues, type VariablesSchema } from './variables.js'
import { UpgradeScripts } from './upgrades.js'
import { UpdateActions, type ActionsSchema } from './actions.js'
import { UpdateFeedbacks, type FeedbacksSchema } from './feedbacks.js'
import { UpdatePresets } from './presets.js'
import { ShowTrakControlClient, type CommandResult } from '@showtrak/server-sdk'

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
		this.control.disconnect()
	}

	async configUpdated(config: ModuleConfig, secrets: ModuleSecrets): Promise<void> {
		this.config = config
		this.secrets = secrets
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
			this.checkFeedbacks('connected')
			RefreshVariableValues(this)
		})
		this.control.on('error', (message) => this.log('warn', `Control API: ${message}`))
		this.control.on('clientsChanged', () => {
			// Client and group sets arrive together → (re)declare per-client and
			// per-group variables, then refresh values and the tile feedbacks that
			// read status/label by slug.
			this.updateVariableDefinitions()
			RefreshVariableValues(this)
			// Client status also rolls up into the group/tag/all aggregate tiles.
			this.checkFeedbacks('client_status', 'group_status', 'tag_status', 'all_status')
		})
		this.control.on('tagsChanged', () => {
			// A tag's membership (Scope) may have changed → (re)declare per-tag
			// variables, refresh their values, then repaint the tag tiles.
			this.updateVariableDefinitions()
			RefreshVariableValues(this)
			this.checkFeedbacks('tag_status')
		})
		this.control.on('modeChanged', () => {
			RefreshVariableValues(this)
			this.checkFeedbacks('mode_is')
		})
		this.control.on('alertsChanged', () => {
			RefreshVariableValues(this)
			this.checkFeedbacks('alerts_enabled')
		})
		this.control.on('scriptsChanged', () => RefreshVariableValues(this))
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
