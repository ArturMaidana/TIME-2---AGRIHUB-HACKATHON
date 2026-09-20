import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthService } from '../server/services/auth-service.js';
import { ChatService } from '../server/services/chat-service.js';
import { ReclamacaoModel } from '../server/models/reclamacao-model.js';
import { SupervisorAnalyticsService } from '../server/services/supervisor-analytics-service.js';

test('login em branco cria um pseudônimo novo e incremental, sem senha', async () => {
  const first = await AuthService.authenticate({ type: 'FUNCIONARIO', code: '' });
  const second = await AuthService.authenticate({ type: 'FUNCIONARIO', code: '' });
  assert.equal(first.role, 'FUNCIONARIO');
  assert.match(first.code, /^anonimo_\d+$/);
  assert.match(second.code, /^anonimo_\d+$/);
  assert.notEqual(first.code, second.code);
});

test('login com código existente retoma o mesmo pseudônimo (sem criar outro)', async () => {
  const created = await AuthService.authenticate({ type: 'FUNCIONARIO', code: '' });
  const resumed = await AuthService.authenticate({ type: 'FUNCIONARIO', code: created.code });
  assert.equal(resumed.role, 'FUNCIONARIO');
  assert.equal(resumed.code, created.code);
  assert.equal(resumed.name, created.name);
});

test('código de funcionário inexistente não autentica', async () => {
  const result = await AuthService.authenticate({ type: 'FUNCIONARIO', code: 'anonimo_9999999' });
  assert.equal(result, null);
});

test('envia reclamação/sugestão e aparece na lista pessoal do pseudônimo', async () => {
  const auth = await AuthService.authenticate({ type: 'FUNCIONARIO', code: '' });
  const usuarioId = await resolveUsuarioId(auth.code);
  const enviado = await ChatService.enviar('u1', usuarioId, {
    setorId: 's1', tipo: 'RECLAMACAO', mensagem: 'Muito calor no setor hoje.',
  });
  assert.equal(enviado.ok, true);

  const minhasMensagens = await ChatService.minhasMensagens(usuarioId);
  assert.equal(minhasMensagens.length, 1);
  assert.equal(minhasMensagens[0].mensagem, 'Muito calor no setor hoje.');
  assert.equal(minhasMensagens[0].status, 'ABERTO');
});

test('rejeita tipo inválido e mensagem vazia', async () => {
  const auth = await AuthService.authenticate({ type: 'FUNCIONARIO', code: '' });
  const usuarioId = await resolveUsuarioId(auth.code);
  const tipoInvalido = await ChatService.enviar('u1', usuarioId, { setorId: 's1', tipo: 'ELOGIO', mensagem: 'oi' });
  assert.equal(tipoInvalido.ok, false);
  const vazia = await ChatService.enviar('u1', usuarioId, { setorId: 's1', tipo: 'SUGESTAO', mensagem: '   ' });
  assert.equal(vazia.ok, false);
});

test('supervisor vê a notificação escopada por setor e consegue responder', async () => {
  const auth = await AuthService.authenticate({ type: 'FUNCIONARIO', code: '' });
  const usuarioId = await resolveUsuarioId(auth.code);
  await ChatService.enviar('u1', usuarioId, { setorId: 's2', tipo: 'SUGESTAO', mensagem: 'Trocar o ventilador do setor.' });

  const notificacoes = await SupervisorAnalyticsService.notificacoes({ unidadeId: 'u1', setorIds: ['s2'], status: 'ABERTO' });
  const minha = notificacoes.find((item) => item.mensagem === 'Trocar o ventilador do setor.');
  assert.ok(minha, 'a notificação deveria aparecer escopada pelo setor s2');
  assert.equal(minha.setor_nome, 'Embalagem secundária');

  const atualizado = await SupervisorAnalyticsService.atualizarNotificacao({
    unidadeId: 'u1', id: minha.id, status: 'TRATADO', resposta: 'Ventilador trocado, obrigado pela sugestão!',
  });
  assert.equal(atualizado.ok, true);

  const minhasMensagens = await ReclamacaoModel.listByUsuario(usuarioId);
  const respondida = minhasMensagens.find((item) => item.id === minha.id);
  assert.equal(respondida.status, 'TRATADO');
  assert.equal(respondida.resposta_supervisor, 'Ventilador trocado, obrigado pela sugestão!');
});

async function resolveUsuarioId(code) {
  const { queryOne } = await import('../server/config/database.js');
  const row = await queryOne('SELECT id FROM users WHERE code = $1', [code]);
  return row.id;
}
