import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'

// The Cloudflare Vite plugin stages local dev vars beside the built Worker for preview.
// Never ship that file: production secrets are set through Wrangler's secret store.
await rm(resolve('dist/traderelaycity/.dev.vars'), { force: true })
