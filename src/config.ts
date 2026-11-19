import type { SomeCompanionConfigField } from '@companion-module/base'
import { DEFAULT_SERVER_PORT } from '@showtrak/server-sdk'

export type ModuleConfig = {
	host: string
	port: number
	/**
	 * Declare the per-client telemetry variables (IP, CPU, RAM, uptime,
	 * warnings). Absent in configs saved by 1.1 and earlier, which reads as on.
	 */
	telemetryVariables?: boolean
}

/** Whether the per-client telemetry variables are wanted (on unless switched off). */
export function TelemetryVariablesEnabled(config: ModuleConfig | undefined): boolean {
	return config?.telemetryVariables !== false
}

// The API key lives in the secrets store, not the config store: Companion reports
// the whole config object to the web UI, so anything sensitive belongs here.
export type ModuleSecrets = {
	apiKey: string
}

export function GetConfigFields(): SomeCompanionConfigField[] {
	return [
		{
			type: 'static-text',
			id: 'info',
			label: 'ShowTrak Server',
			width: 12,
			value:
				'Controls a ShowTrak Server over its WebSocket control API. Enter the server address, port and the SDK API key (Settings → SDK / Integration API on the server).',
		},
		{
			// No regex: the address may be an IPv4 literal, a hostname (including
			// mDNS names like `showtrak.local`) or an IPv6 literal — the SDK builds a
			// plain `http://<host>:<port>` URL, which accepts all three.
			type: 'textinput',
			id: 'host',
			label: 'Target IP or Hostname',
			width: 6,
			default: '',
		},
		{
			type: 'number',
			id: 'port',
			label: 'Target Port',
			width: 6,
			min: 1,
			max: 65535,
			default: DEFAULT_SERVER_PORT,
		},
		{
			type: 'secret-text',
			id: 'apiKey',
			label: 'SDK API Key',
			width: 12,
			default: '',
		},
		{
			type: 'checkbox',
			id: 'telemetryVariables',
			label: 'Client telemetry variables',
			tooltip:
				'Adds IP, CPU, RAM, uptime and warning variables for every client. Switch off on very large rigs to keep the variable list short.',
			width: 12,
			default: true,
		},
	]
}
