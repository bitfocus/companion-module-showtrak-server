import type { ScriptExecutionView } from '@showtrak/server-sdk'
import type ModuleInstance from './main.js'

// Which script executions a feedback is about.
//
// The server keeps one execution panel for the whole show. A button cares about
// a slice of it: one client, a group, a tag or everything, and optionally one
// script or integrated event. These helpers cut that slice from the SDK's live
// execution list so the feedbacks stay one-liners.

export type ExecutionScope = 'all' | 'client' | 'group' | 'tag'

export const EXECUTION_SCOPE_CHOICES: { id: ExecutionScope; label: string }[] = [
	{ id: 'all', label: 'All clients' },
	{ id: 'client', label: 'Client' },
	{ id: 'group', label: 'Group' },
	{ id: 'tag', label: 'Tag' },
]

/** Name the server gives an integrated client's event when it runs as an execution. */
const EVENT_PREFIX = 'Integrated Event: '

/**
 * Executions an operator asked for: script runs and integrated-client events.
 * Housekeeping the server raises for itself (script deployment, Wake-on-LAN,
 * updates) is internal, and lighting a "running" button for it would mislead.
 */
function isOperatorExecution(execution: ScriptExecutionView): boolean {
	if (!execution.Internal) return true
	return typeof execution.Script?.Name === 'string' && execution.Script.Name.startsWith(EVENT_PREFIX)
}

/** Whether an execution ran this script slug or integrated event ID. Blank matches any. */
function matchesAction(execution: ScriptExecutionView, actionSlug: string): boolean {
	if (!actionSlug) return true
	if (!execution.Internal) return execution.Script?.ID === actionSlug
	return execution.Script?.Name === `${EVENT_PREFIX}${actionSlug}`
}

/** The UUIDs a scope covers, or null when its slug names nothing. */
function scopeUuids(self: ModuleInstance, scope: ExecutionScope, slug: string): Set<string> | null {
	if (scope === 'all') return null
	if (!slug) return new Set()
	if (scope === 'client') {
		const Client = self.control.getClient(slug)
		return new Set(Client ? [Client.UUID] : [])
	}
	if (scope === 'group') {
		const Group = self.control.getGroups().find((Candidate) => Candidate.Slug === slug)
		if (!Group) return new Set()
		return new Set(
			self.control
				.getAllClients()
				.filter((Client) => Client.GroupID != null && Number(Client.GroupID) === Number(Group.GroupID))
				.map((Client) => Client.UUID),
		)
	}
	return new Set(self.control.getTagMembers(slug).map((Client) => Client.UUID))
}

/** The operator's executions in a scope, optionally narrowed to one script or event. */
export function ExecutionsInScope(
	self: ModuleInstance,
	scope: ExecutionScope,
	slug: string,
	actionSlug = '',
): ScriptExecutionView[] {
	const Uuids = scopeUuids(self, scope, slug)
	return self.control
		.getScriptExecutions()
		.filter(
			(Execution) =>
				isOperatorExecution(Execution) &&
				matchesAction(Execution, actionSlug) &&
				(Uuids === null || (!!Execution.Client?.UUID && Uuids.has(Execution.Client.UUID))),
		)
}

export function ParseExecutionScope(value: unknown): ExecutionScope {
	return value === 'client' || value === 'group' || value === 'tag' ? value : 'all'
}
