import { generateEslintConfig } from '@companion-module/tools/eslint/config.mjs'

const base = await generateEslintConfig({
	enableTypescript: true,
})

export default [{ ignores: ['dist/**'] }, ...(Array.isArray(base) ? base : [base])]
