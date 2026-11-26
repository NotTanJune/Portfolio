import { handleContact } from './contact.js';

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/contact' || pathname === '/api/contact/') {
      return handleContact(request, env);
    }
    return new Response('Not found', { status: 404 });
  },
};
