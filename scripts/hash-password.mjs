import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { hash } from 'bcryptjs';

// No escribe en la base de datos ni muestra la contrasena en la terminal.
console.log('Contrasena (entrada oculta):');
const hiddenOutput = new Writable({
  write(_chunk, _encoding, callback) {
    callback();
  },
});
const input = createInterface({
  input: process.stdin,
  output: hiddenOutput,
  terminal: true,
});
try {
  const password = await input.question('');
  if (password.length < 12 || Buffer.byteLength(password, 'utf8') > 72)
    throw new Error('Usa al menos 12 caracteres y como maximo 72 bytes UTF-8');
  console.log(await hash(password, 12));
} finally {
  input.close();
}
