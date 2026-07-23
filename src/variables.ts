import type { CompanionVariableDefinitions } from '@companion-module/base'
import type ModuleInstance from './main.js'

// Static variables plus an open-ended set of per-entity variables keyed by slug
// (client_<slug>_status / client_<slug>_label), declared dynamically as entities
// appear. "Entity" here means any addressable target — real clients, monitoring
// targets and dummy clients all share one slug namespace and are surfaced through
// the SDK client list, so they all get status/label vars and feed the summary
// counts. The `client_` prefix is kept for every type so variable ids stay stable.
// The index signature admits those dynamic names.
export type VariablesSchema = {
	connection_state: string
	mode: string
	alerts_enabled: string
	clients_total: string
	clients_online: string
	clients_offline: string
	clients_degraded: string
} & Record<string, string>

// Companion variable ids must be [a-zA-Z0-9_-]; slugs already satisfy this
// (SLUG_PATTERN is [A-Za-z0-9_-]), so they drop in unchanged.
function statusVar(slug: string): string {
	return `client_${slug}_status`
}
function labelVar(slug: string): string {
	return `client_${slug}_label`
}

// Human-readable entity-type word for a variable's display name.
function typeLabel(type: string): string {
	if (type === 'monitor') return 'Monitor'
	if (type === 'dummy') return 'Dummy'
	return 'Client'
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
	}
	for (const client of self.control.getAllClients()) {
		if (!client.Slug) continue
		const kind = typeLabel(client.Type)
		defs[statusVar(client.Slug)] = { name: `${kind} "${client.Slug}" status` }
		defs[labelVar(client.Slug)] = { name: `${kind} "${client.Slug}" label` }
	}
	self.setVariableDefinitions(defs)
}

export function RefreshVariableValues(self: ModuleInstance): void {
	const clients = self.control.getAllClients()
	let online = 0
	let offline = 0
	let degraded = 0
	const values: Record<string, string> = {}
	for (const client of clients) {
		if (!client.Slug) continue
		const status = self.control.getClientStatus(client.Slug) ?? 'OFFLINE'
		if (status === 'ONLINE') online++
		else if (status === 'DEGRADED') degraded++
		else if (status === 'OFFLINE') offline++
		values[statusVar(client.Slug)] = status
		values[labelVar(client.Slug)] = self.control.getClientLabel(client.Slug) ?? client.Slug
	}
	values.connection_state = self.control.getState()
	values.mode = self.control.getMode()
	values.alerts_enabled = self.control.getAlertsEnabled() ? 'true' : 'false'
	values.clients_total = String(clients.length)
	values.clients_online = String(online)
	values.clients_offline = String(offline)
	values.clients_degraded = String(degraded)
	self.setVariableValues(values)
}
