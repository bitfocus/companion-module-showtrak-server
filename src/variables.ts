import type { CompanionVariableDefinitions } from '@companion-module/base'
import { SummariseExecutions, type ClientView } from '@showtrak/server-sdk'
import type ModuleInstance from './main.js'
import { TelemetryVariablesEnabled } from './config.js'

// Static variables plus an open-ended set of per-entity variables keyed by slug,
// declared dynamically as entities appear:
//   client_<slug>_status / client_<slug>_label
//   group_<slug>_status  / group_<slug>_label
//   tag_<slug>_status    / tag_<slug>_label
// For clients, "entity" means any addressable target — real clients, monitoring
// targets, dummy clients and FreeKiosk terminals all share one slug namespace
// and are surfaced through the SDK client list, so they all get status/label
// vars and feed the summary counts. The `client_` prefix is kept for every such
// type so ids stay stable. Groups and tags are separate slug namespaces with
// their own prefixes. Group and tag status/label mirror the group_status /
// tag_status feedbacks.
//
// Real clients (Type 'client') also get telemetry variables, unless switched off
// in the connection config: client_<slug>_ip / _cpu / _ram / _uptime /
// _warnings. Monitors, dummies and terminals carry no telemetry, so declaring
// those for them would only add variables that are always blank.
//
// The index signature admits all these dynamic names.
export type VariablesSchema = {
	connection_state: string
	mode: string
	alerts_enabled: string
	clients_total: string
	clients_online: string
	clients_offline: string
	clients_degraded: string
	executions_running: string
	executions_completed: string
	executions_failed: string
	executions_retryable: string
	pending_adoption_count: string
	last_alert_title: string
	last_alert_message: string
	last_alert_severity: string
	last_alert_time: string
} & Record<string, string | number>

// Companion variable ids must be [a-zA-Z0-9_-]; slugs already satisfy this
// (SLUG_PATTERN is [A-Za-z0-9_-]), so they drop in unchanged.
function entityVar(prefix: string, slug: string, field: string): string {
	return `${prefix}_${slug}_${field}`
}

// Human-readable entity-type word for a variable's display name.
const TYPE_LABELS: Record<string, string> = {
	client: 'Client',
	monitor: 'Monitor',
	dummy: 'Dummy',
	freekiosk: 'FreeKiosk',
}

/**
 * The display word for an entity type.
 *
 * An unrecognised type is title-cased from the wire value rather than falling
 * back to "Client". A server newer than this module will push entity types it
 * has never heard of, and labelling a kiosk or whatever comes next as a Client
 * is wrong, where "Freekiosk" is merely unpolished — and it still tells the
 * operator what they are looking at.
 */
function typeLabel(type: string): string {
	const Known = TYPE_LABELS[type]
	if (Known) return Known
	const Raw = String(type || '').trim()
	return Raw ? Raw.charAt(0).toUpperCase() + Raw.slice(1) : 'Client'
}

/** Per-client telemetry variables: [field, display name]. */
const TELEMETRY_FIELDS: [string, string][] = [
	['ip', 'IP address'],
	['cpu', 'CPU %'],
	['ram', 'RAM %'],
	['uptime', 'uptime'],
	['warnings', 'warnings'],
]

function hasTelemetry(self: ModuleInstance, client: ClientView): boolean {
	return client.Type === 'client' && TelemetryVariablesEnabled(self.config)
}

export function UpdateVariableDefinitions(self: ModuleInstance): void {
	const defs: CompanionVariableDefinitions<VariablesSchema> = {
		connection_state: { name: 'Connection state' },
		mode: { name: 'Server mode (SHOW/EDIT)' },
		alerts_enabled: { name: 'Alert actions enabled' },
		clients_total: { name: 'Clients: total' },
		clients_online: { name: 'Clients: online' },
		clients_offline: { name: 'Clients: offline' },
		clients_degraded: { name: 'Clients: degraded' },
		executions_running: { name: 'Executions: running or queued' },
		executions_completed: { name: 'Executions: completed' },
		executions_failed: { name: 'Executions: failed' },
		executions_retryable: { name: 'Executions: failed and retryable' },
		pending_adoption_count: { name: 'Devices waiting to be adopted' },
		last_alert_title: { name: 'Last alert: title' },
		last_alert_message: { name: 'Last alert: message' },
		last_alert_severity: { name: 'Last alert: severity (info/success/warning/error)' },
		last_alert_time: { name: 'Last alert: time (HH:MM:SS)' },
	}
	// What the declared set depends on. Re-declaring is the expensive half of a
	// refresh (Companion rebuilds its variable list), and a client update almost
	// never adds or removes an entity, so it is skipped unless this changes.
	const KeyParts: string[] = [TelemetryVariablesEnabled(self.config) ? 't' : '']
	for (const client of self.control.getAllClients()) {
		if (!client.Slug) continue
		const kind = typeLabel(client.Type)
		KeyParts.push(`c:${client.Slug}:${client.Type}`)
		defs[entityVar('client', client.Slug, 'status')] = { name: `${kind} "${client.Slug}" status` }
		defs[entityVar('client', client.Slug, 'label')] = { name: `${kind} "${client.Slug}" label` }
		if (!hasTelemetry(self, client)) continue
		for (const [Field, Name] of TELEMETRY_FIELDS) {
			defs[entityVar('client', client.Slug, Field)] = { name: `${kind} "${client.Slug}" ${Name}` }
		}
	}
	for (const group of self.control.getGroups()) {
		if (!group.Slug) continue
		KeyParts.push(`g:${group.Slug}`)
		defs[entityVar('group', group.Slug, 'status')] = { name: `Group "${group.Slug}" status` }
		defs[entityVar('group', group.Slug, 'label')] = { name: `Group "${group.Slug}" label` }
	}
	for (const tag of self.control.getTags()) {
		if (!tag.Slug) continue
		KeyParts.push(`t:${tag.Slug}`)
		defs[entityVar('tag', tag.Slug, 'status')] = { name: `Tag "${tag.Slug}" status` }
		defs[entityVar('tag', tag.Slug, 'label')] = { name: `Tag "${tag.Slug}" label` }
	}
	const Key = KeyParts.join('\n')
	if (Key === self.declaredVariablesKey) return
	self.declaredVariablesKey = Key
	self.setVariableDefinitions(defs)
	// Send every value again after a re-declaration rather than trusting the
	// cache: the values Companion holds for a re-declared set are not ours to
	// assume.
	self.sentVariableValues.clear()
}

/** A whole-number percentage, or '' when the client is not reporting one. */
function percent(value: unknown): number | '' {
	const N = Number(value)
	return value === null || value === undefined || value === '' || !Number.isFinite(N) ? '' : Math.round(N)
}

function pad(n: number): string {
	return String(n).padStart(2, '0')
}

function clockTime(epochMs: number): string {
	const D = new Date(epochMs)
	return `${pad(D.getHours())}:${pad(D.getMinutes())}:${pad(D.getSeconds())}`
}

export function RefreshVariableValues(self: ModuleInstance): void {
	const clients = self.control.getAllClients()
	let online = 0
	let offline = 0
	let degraded = 0
	const values: Record<string, string | number> = {}
	for (const client of clients) {
		if (!client.Slug) continue
		const status = self.control.getClientStatus(client.Slug) ?? 'OFFLINE'
		if (status === 'ONLINE') online++
		else if (status === 'DEGRADED') degraded++
		else if (status === 'OFFLINE') offline++
		values[entityVar('client', client.Slug, 'status')] = status
		values[entityVar('client', client.Slug, 'label')] = self.control.getClientLabel(client.Slug) ?? client.Slug
		if (!hasTelemetry(self, client)) continue
		// Vitals are only present while a client is online; an offline client's
		// CPU reads blank rather than its last figure, which would look live.
		const Vitals = client.Online ? client.Vitals : null
		values[entityVar('client', client.Slug, 'ip')] = client.IP ?? ''
		values[entityVar('client', client.Slug, 'cpu')] = percent(Vitals?.CPU?.UsagePercentage)
		// Sent by the client as a string (toFixed(2)), hence the coercion.
		values[entityVar('client', client.Slug, 'ram')] = percent(Vitals?.Ram?.UsagePercentage)
		values[entityVar('client', client.Slug, 'uptime')] = Vitals?.Uptime?.Formatted ?? ''
		values[entityVar('client', client.Slug, 'warnings')] = (client.DegradedWarnings ?? []).join('; ')
	}
	for (const group of self.control.getGroups()) {
		if (!group.Slug) continue
		values[entityVar('group', group.Slug, 'status')] = self.control.getGroupStatus(group.Slug) ?? 'OFFLINE'
		values[entityVar('group', group.Slug, 'label')] = group.Title ?? group.Slug
	}
	for (const tag of self.control.getTags()) {
		if (!tag.Slug) continue
		values[entityVar('tag', tag.Slug, 'status')] = self.control.getTagStatus(tag.Slug) ?? 'OFFLINE'
		values[entityVar('tag', tag.Slug, 'label')] = tag.Slug
	}
	values.connection_state = self.control.getState()
	values.mode = self.control.getMode()
	values.alerts_enabled = self.control.getAlertsEnabled() ? 'true' : 'false'
	values.clients_total = String(clients.length)
	values.clients_online = String(online)
	values.clients_offline = String(offline)
	values.clients_degraded = String(degraded)

	const Executions = SummariseExecutions(self.control.getScriptExecutions())
	values.executions_running = String(Executions.Pending)
	values.executions_completed = String(Executions.Completed)
	values.executions_failed = String(Executions.Failed)
	values.executions_retryable = String(Executions.Retryable)
	values.pending_adoption_count = String(self.control.getPendingAdoption().length)

	const Alert = self.lastAlert
	values.last_alert_title = Alert?.Title ?? ''
	values.last_alert_message = Alert?.Message ?? ''
	values.last_alert_severity = Alert?.Severity ?? ''
	values.last_alert_time = Alert ? clockTime(Alert.At) : ''

	// Only what changed goes to Companion. With telemetry on, every heartbeat
	// moves a CPU figure somewhere, and resending the whole table for it would
	// cost Companion a full pass over every variable each time.
	const Changed: Record<string, string | number> = {}
	let Any = false
	for (const [Id, Value] of Object.entries(values)) {
		if (self.sentVariableValues.get(Id) === Value) continue
		self.sentVariableValues.set(Id, Value)
		Changed[Id] = Value
		Any = true
	}
	if (Any) self.setVariableValues(Changed)
}
