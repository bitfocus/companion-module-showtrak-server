import { combineRgb } from '@companion-module/base'
import type ModuleInstance from './main.js'
import { CLIENT_STATUSES, StatusRgb } from '@showtrak/server-sdk'
import { EXECUTION_SCOPE_CHOICES, ExecutionsInScope, ParseExecutionScope } from './executions.js'

type ExecutionScopeOpts = { scope: string; slug: string; actionSlug: string }

// The longest an "alert raised" feedback can be asked to stay lit, in seconds.
export const MAX_ALERT_HOLD_SECONDS = 600

export type FeedbacksSchema = {
	client_status: {
		type: 'advanced'
		options: { slug: string }
	}
	group_status: {
		type: 'advanced'
		options: { slug: string }
	}
	tag_status: {
		type: 'advanced'
		options: { slug: string }
	}
	all_status: {
		type: 'advanced'
		options: Record<string, never>
	}
	mode_is: {
		type: 'boolean'
		options: { mode: string }
	}
	alerts_enabled: {
		type: 'boolean'
		options: Record<string, never>
	}
	connected: {
		type: 'boolean'
		options: Record<string, never>
	}
	pending_confirm: {
		type: 'boolean'
		options: Record<string, never>
	}
	client_status_is: {
		type: 'boolean'
		options: { slug: string; status: string }
	}
	client_identifying: {
		type: 'boolean'
		options: { slug: string }
	}
	script_running: {
		type: 'boolean'
		options: ExecutionScopeOpts
	}
	script_failed: {
		type: 'boolean'
		options: ExecutionScopeOpts
	}
	pending_adoption: {
		type: 'boolean'
		options: Record<string, never>
	}
	alert_raised: {
		type: 'boolean'
		options: { seconds: number; severity: string }
	}
}

// The scope / slug / script fields the two execution feedbacks share.
const executionScopeOptions = [
	{
		id: 'scope',
		type: 'dropdown',
		label: 'Scope',
		default: 'all',
		choices: EXECUTION_SCOPE_CHOICES,
	},
	{
		id: 'slug',
		type: 'textinput',
		label: 'Client / group / tag slug (not used for All clients)',
		default: '',
		useVariables: true,
	},
	{
		id: 'actionSlug',
		type: 'textinput',
		label: 'Script slug or event ID (blank for any)',
		default: '',
		useVariables: true,
	},
] as const

function rgb(status: ReturnType<ModuleInstance['control']['getClientStatus']>): number {
	const [r, g, b] = StatusRgb(status ?? 'OFFLINE')
	return combineRgb(r, g, b)
}

export function UpdateFeedbacks(self: ModuleInstance): void {
	self.setFeedbackDefinitions({
		// The Client Tile heart: one slug drives both the tile background colour
		// (from live status) and the button text (the client's label).
		client_status: {
			name: 'Client Tile (status colour + label)',
			type: 'advanced',
			options: [{ id: 'slug', type: 'textinput', label: 'Client slug', default: '', useVariables: true }],
			callback: (feedback) => {
				const slug = String(feedback.options.slug || '')
				const client = self.control.getClient(slug)
				if (!client) return { bgcolor: combineRgb(40, 40, 40), text: slug || '?' }
				const status = self.control.getClientStatus(slug)
				return {
					bgcolor: rgb(status),
					text: self.control.getClientLabel(slug) ?? slug,
				}
			},
		},
		// Group Tile: aggregate group status colour + the group slug as the label.
		group_status: {
			name: 'Group Tile (status colour + label)',
			type: 'advanced',
			options: [{ id: 'slug', type: 'textinput', label: 'Group slug', default: '', useVariables: true }],
			callback: (feedback) => {
				const slug = String(feedback.options.slug || '')
				const status = self.control.getGroupStatus(slug)
				if (!status) return { bgcolor: combineRgb(40, 40, 40), text: slug || '?' }
				return { bgcolor: rgb(status), text: slug }
			},
		},
		// Tag Tile: aggregate status of the tag's dynamic membership + the tag slug
		// as the label. Membership is resolved client-side from the tag's Scope.
		tag_status: {
			name: 'Tag Tile (status colour + label)',
			type: 'advanced',
			options: [{ id: 'slug', type: 'textinput', label: 'Tag slug', default: '', useVariables: true }],
			callback: (feedback) => {
				const slug = String(feedback.options.slug || '')
				const status = self.control.getTagStatus(slug)
				if (!status) return { bgcolor: combineRgb(40, 40, 40), text: slug || '?' }
				return { bgcolor: rgb(status), text: slug }
			},
		},
		// All Tile: aggregate status across every client. No slug — it always
		// targets the whole workspace.
		all_status: {
			name: 'All Clients Tile (status colour)',
			type: 'advanced',
			options: [],
			callback: () => ({ bgcolor: rgb(self.control.getAllStatus()), text: 'All' }),
		},
		mode_is: {
			name: 'Server is in mode',
			type: 'boolean',
			defaultStyle: { bgcolor: combineRgb(0, 100, 200), color: combineRgb(255, 255, 255) },
			options: [
				{
					id: 'mode',
					type: 'dropdown',
					label: 'Mode',
					default: 'SHOW',
					choices: [
						{ id: 'SHOW', label: 'Show' },
						{ id: 'EDIT', label: 'Edit' },
					],
				},
			],
			callback: (feedback) => self.control.getMode() === String(feedback.options.mode),
		},
		alerts_enabled: {
			name: 'Alert actions enabled',
			type: 'boolean',
			defaultStyle: { bgcolor: combineRgb(0, 150, 0), color: combineRgb(255, 255, 255) },
			options: [],
			callback: () => self.control.getAlertsEnabled(),
		},
		connected: {
			name: 'Connected to server',
			type: 'boolean',
			defaultStyle: { bgcolor: combineRgb(0, 120, 0), color: combineRgb(255, 255, 255) },
			options: [],
			callback: () => self.control.isConnected(),
		},
		client_status_is: {
			name: 'Client status is',
			type: 'boolean',
			defaultStyle: { bgcolor: combineRgb(150, 90, 10), color: combineRgb(255, 255, 255) },
			options: [
				{ id: 'slug', type: 'textinput', label: 'Client slug', default: '', useVariables: true },
				{
					id: 'status',
					type: 'dropdown',
					label: 'Status',
					default: 'DEGRADED',
					choices: CLIENT_STATUSES.map((Status) => ({
						id: Status,
						label: Status.charAt(0) + Status.slice(1).toLowerCase(),
					})),
				},
			],
			callback: (feedback) => {
				const Slug = String(feedback.options.slug || '')
				// An unknown slug has no status, so it matches nothing.
				const Status = self.control.getClient(Slug) ? self.control.getClientStatus(Slug) : undefined
				return Status !== undefined && Status === String(feedback.options.status)
			},
		},
		client_identifying: {
			name: 'Client is identifying',
			type: 'boolean',
			defaultStyle: { bgcolor: combineRgb(0, 100, 200), color: combineRgb(255, 255, 255) },
			options: [{ id: 'slug', type: 'textinput', label: 'Client slug', default: '', useVariables: true }],
			callback: (feedback) => !!self.control.getClient(String(feedback.options.slug || ''))?.Identifying,
		},
		// Lit while a script or integrated event is queued or running on the
		// scope. Housekeeping (script deployment, Wake-on-LAN) does not count.
		script_running: {
			name: 'Script running',
			type: 'boolean',
			defaultStyle: { bgcolor: combineRgb(30, 80, 135), color: combineRgb(255, 255, 255) },
			options: [...executionScopeOptions],
			callback: (feedback) =>
				ExecutionsInScope(
					self,
					ParseExecutionScope(feedback.options.scope),
					String(feedback.options.slug || ''),
					String(feedback.options.actionSlug || '').trim(),
				).some((Execution) => Execution.Status === 'Pending'),
		},
		// Lit while the execution panel holds a failure for the scope, until it is
		// retried or cleared.
		script_failed: {
			name: 'Script failed',
			type: 'boolean',
			defaultStyle: { bgcolor: combineRgb(120, 25, 25), color: combineRgb(255, 255, 255) },
			options: [...executionScopeOptions],
			callback: (feedback) =>
				ExecutionsInScope(
					self,
					ParseExecutionScope(feedback.options.scope),
					String(feedback.options.slug || ''),
					String(feedback.options.actionSlug || '').trim(),
				).some((Execution) => Execution.Status === 'Failed'),
		},
		pending_adoption: {
			name: 'Devices waiting to be adopted',
			type: 'boolean',
			defaultStyle: { bgcolor: combineRgb(200, 120, 0), color: combineRgb(0, 0, 0) },
			options: [],
			callback: () => self.control.getPendingAdoption().length > 0,
		},
		// Lit for a while after an alert rule raises a ShowTrak alert.
		alert_raised: {
			name: 'Alert raised recently',
			type: 'boolean',
			defaultStyle: { bgcolor: combineRgb(200, 0, 0), color: combineRgb(255, 255, 255) },
			options: [
				{
					id: 'seconds',
					type: 'number',
					label: 'Stay lit for (seconds)',
					default: 10,
					min: 1,
					max: MAX_ALERT_HOLD_SECONDS,
				},
				{
					id: 'severity',
					type: 'dropdown',
					label: 'Severity',
					default: 'any',
					choices: [
						{ id: 'any', label: 'Any' },
						{ id: 'error', label: 'Error' },
						{ id: 'warning', label: 'Warning or error' },
						{ id: 'info', label: 'Info' },
						{ id: 'success', label: 'Success' },
					],
				},
			],
			callback: (feedback) => {
				const Alert = self.lastAlert
				if (!Alert) return false
				const Seconds = Math.min(Math.max(Number(feedback.options.seconds) || 0, 1), MAX_ALERT_HOLD_SECONDS)
				if (Date.now() - Alert.At > Seconds * 1000) return false
				const Wanted = String(feedback.options.severity || 'any')
				if (Wanted === 'any') return true
				if (Wanted === 'warning') return Alert.Severity === 'warning' || Alert.Severity === 'error'
				return Alert.Severity === Wanted
			},
		},
		// True while this button is armed and waiting for the confirm press.
		pending_confirm: {
			name: 'Awaiting confirm press',
			type: 'boolean',
			defaultStyle: { bgcolor: combineRgb(200, 120, 0), color: combineRgb(0, 0, 0) },
			options: [],
			callback: (feedback) => self.isConfirmPending(feedback.controlId),
		},
	})
}
