import { Injectable } from '@nestjs/common';
import { createConnection } from 'node:net';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { randomBytes } from 'node:crypto';
import { mailConfig } from '../../config/mail.config.js';

@Injectable()
export class MailService {
  async sendPasswordReset(recipient: string, token: string) {
    const config = mailConfig();
    const resetUrl = new URL(config.resetUrl);
    resetUrl.searchParams.set('token', token);

    const socket = createConnection({ host: config.host, port: config.port });
    socket.setTimeout(10_000, () => {
      socket.destroy(new Error('Tiempo de espera SMTP agotado'));
    });
    await once(socket, 'connect');
    // Tras conectar, readline detecta el cierre; este listener evita que un
    // error tardio del socket se convierta en una excepcion no controlada.
    socket.on('error', () => undefined);

    const reader = createInterface({ input: socket, crlfDelay: Infinity });
    const lines = reader[Symbol.asyncIterator]();
    const readResponse = async (expected: number) => {
      let response = '';
      while (true) {
        const next = await lines.next();
        if (next.done) throw new Error('El servidor SMTP cerro la conexion');
        response += `${next.value}\n`;
        const match = /^(\d{3})([ -])/.exec(next.value);
        if (!match || match[2] === '-') continue;
        const code = Number(match[1]);
        if (code !== expected)
          throw new Error(`Respuesta SMTP inesperada: ${response.trim()}`);
        return;
      }
    };
    const command = async (value: string, expected: number) => {
      socket.write(`${value}\r\n`);
      await readResponse(expected);
    };

    const safeRecipient = this.headerValue(recipient);
    const safeFrom = this.headerValue(config.from);
    const messageId = `${randomBytes(16).toString('hex')}@warmi.local`;
    const message = [
      `From: ${safeFrom}`,
      `To: ${safeRecipient}`,
      'Subject: Recuperacion de contrasena - Warmi',
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: <${messageId}>`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      'Solicitaste restablecer tu contrasena de Warmi.',
      '',
      `Abre este enlace: ${resetUrl.toString()}`,
      '',
      `El enlace expira en ${config.resetExpiresMinutes} minutos y solo puede usarse una vez.`,
      'Si no solicitaste el cambio, ignora este correo.',
    ]
      .map((line) => (line.startsWith('.') ? `.${line}` : line))
      .join('\r\n');

    try {
      await readResponse(220);
      await command('EHLO warmi.local', 250);
      await command(`MAIL FROM:<${safeFrom}>`, 250);
      await command(`RCPT TO:<${safeRecipient}>`, 250);
      await command('DATA', 354);
      socket.write(`${message}\r\n.\r\n`);
      await readResponse(250);
      await command('QUIT', 221);
    } finally {
      reader.close();
      socket.destroy();
    }
  }

  private headerValue(value: string) {
    if (!value || /[\r\n<>]/.test(value))
      throw new Error('Direccion de correo SMTP invalida');
    return value;
  }
}
