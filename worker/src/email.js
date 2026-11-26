export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[character]));
}

const EMAIL_FONT = "'Bricolage Grotesque', 'Avenir Next', 'Segoe UI', 'Trebuchet MS', sans-serif";

function metaRows({ ip, userAgent, formDuration, receivedAt }) {
  return [
    ['Time on form', `${Math.round(formDuration / 1000)}s`],
    ['Received', new Date(receivedAt).toUTCString()],
    ['IP address', ip],
    ['User agent', userAgent || 'Unknown'],
  ];
}

export function buildEmailSubject(subject) {
  return `Portfolio Contact: ${subject.trim().replace(/[\r\n]+/g, ' ')}`;
}

export function buildEmailText(fields) {
  const { name, subject, message } = fields;
  const meta = metaRows(fields).map(([label, value]) => `${label}: ${value}`).join('\n');
  return `${subject.trim()}\nFrom ${name.trim()} via your portfolio\n\n${message.trim()}\n\n${meta}\nVerified by Cloudflare Turnstile\n`;
}

export function buildEmailHtml(fields) {
  const { name, subject, message } = fields;
  const body = escapeHtml(message.trim()).replace(/\n/g, '<br>');
  const preview = escapeHtml(message.trim().replace(/\s+/g, ' ').slice(0, 140));
  const rows = metaRows(fields).map(([label, value]) => `
                <tr>
                  <td style="padding: 3px 16px 3px 0; white-space: nowrap; vertical-align: top; color: #57554c;">${label}</td>
                  <td style="padding: 3px 0; vertical-align: top; color: #2b2a26; word-break: break-word;">${escapeHtml(value)}</td>
                </tr>`).join('');

  return `
    <div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">${preview}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #dad7cd;">
      <tr>
        <td align="center" style="padding: 32px 12px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 560px; background-color: #f0efeb; border-radius: 12px; font-family: ${EMAIL_FONT};">
            <tr>
              <td style="padding: 36px 32px 28px;">
                <h1 style="margin: 0; font-size: 26px; line-height: 1.2; font-weight: 700; letter-spacing: -0.5px; color: #344e41;">${escapeHtml(subject.trim())}</h1>
                <p style="margin: 10px 0 0; font-size: 15px; line-height: 1.4; color: #57554c;">From <strong style="font-weight: 600; color: #3a5a40;">${escapeHtml(name.trim())}</strong> via your portfolio</p>
                <p style="margin: 28px 0 0; font-size: 17px; line-height: 1.6; color: #2b2a26;">${body}</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 0 32px;"><div style="height: 1px; line-height: 1px; font-size: 0; background-color: #d4d0c3;">&nbsp;</div></td>
            </tr>
            <tr>
              <td style="padding: 20px 32px 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="font-size: 13px; line-height: 1.5;">${rows}
                </table>
                <p style="margin: 16px 0 0; font-size: 13px; line-height: 1.5; color: #57554c;">Verified by Cloudflare Turnstile</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}
