import { hashPassword } from 'better-auth/crypto'

let password = ''
for await (const chunk of process.stdin) password += chunk
password = password.replace(/\r?\n$/, '')
if (password.length < 12 || password.length > 128) {
  process.stderr.write('Password must be 12 to 128 characters.\n')
  process.exitCode = 1
} else {
  process.stdout.write(await hashPassword(password))
}
