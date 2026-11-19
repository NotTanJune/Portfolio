// Behind Cloudflare -> Heroku, req.ip resolves to a Cloudflare edge address shared by many visitors.
// Cloudflare puts the real visitor address in CF-Connecting-IP.
function clientIp(req) {
  const cfIp = typeof req.get === 'function' ? req.get('cf-connecting-ip') : undefined;
  return (cfIp && cfIp.trim()) || req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
}

module.exports = { clientIp };
