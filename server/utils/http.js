export function json(response, status, payload) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

export async function parseBody(request) {
  let raw = '';
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 50_000) throw new Error('PAYLOAD_TOO_LARGE');
  }
  return raw ? JSON.parse(raw) : {};
}

export function asyncController(controller) {
  return async (request, response, context) => {
    try {
      await controller(request, response, context);
    } catch (error) {
      console.error(error);
      json(response, error.message === 'PAYLOAD_TOO_LARGE' ? 413 : 500, {
        error: 'Não foi possível concluir a operação.',
      });
    }
  };
}
