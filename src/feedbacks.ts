import { combineRgb } from '@companion-module/base'
import type ModuleInstance from './main.js'
import { StatusRgb } from '@showtrak/server-sdk'

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
}

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
