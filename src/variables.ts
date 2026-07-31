import type { CompanionVariableDefinitions } from '@companion-module/base'
import type ModuleInstance from './main.js'

// Static variables plus an open-ended set of per-entity variables keyed by slug,
// declared dynamically as entities appear:
//   client_<slug>_status / client_<slug>_label
//   group_<slug>_status  / group_<slug>_label
//   tag_<slug>_status    / tag_<slug>_label
// For clients, "entity" means any addressable target — real clients, monitoring
// targets and dummy clients all share one slug namespace and are surfaced through
// the SDK client list, so they all get status/label vars and feed the summary
// counts. The `client_` prefix is kept for every such type so ids stay stable.
// Groups and tags are separate slug namespaces with their own prefixes. Group and
// tag status/label mirror the group_status / tag_status feedbacks. The index
// signature admits all these dynamic names.
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
function statusVar(prefix: string, slug: string): string {
	return `${prefix}_${slug}_status`
}
function labelVar(prefix: string, slug: string): string {
	return `${prefix}_${slug}_label`
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
		defs[statusVar('client', client.Slug)] = { name: `${kind} "${client.Slug}" status` }
		defs[labelVar('client', client.Slug)] = { name: `${kind} "${client.Slug}" label` }
	}
	for (const group of self.control.getGroups()) {
		if (!group.Slug) continue
		defs[statusVar('group', group.Slug)] = { name: `Group "${group.Slug}" status` }
		defs[labelVar('group', group.Slug)] = { name: `Group "${group.Slug}" label` }
	}
	for (const tag of self.control.getTags()) {
		if (!tag.Slug) continue
		defs[statusVar('tag', tag.Slug)] = { name: `Tag "${tag.Slug}" status` }
		defs[labelVar('tag', tag.Slug)] = { name: `Tag "${tag.Slug}" label` }
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
		values[statusVar('client', client.Slug)] = status
		values[labelVar('client', client.Slug)] = self.control.getClientLabel(client.Slug) ?? client.Slug
	}
	for (const group of self.control.getGroups()) {
		if (!group.Slug) continue
		values[statusVar('group', group.Slug)] = self.control.getGroupStatus(group.Slug) ?? 'OFFLINE'
		values[labelVar('group', group.Slug)] = group.Title ?? group.Slug
	}
	for (const tag of self.control.getTags()) {
		if (!tag.Slug) continue
		values[statusVar('tag', tag.Slug)] = self.control.getTagStatus(tag.Slug) ?? 'OFFLINE'
		values[labelVar('tag', tag.Slug)] = tag.Slug
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
