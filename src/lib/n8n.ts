import { supabase } from '@/lib/supabase';

const N8N_WEBHOOK_URLS = [
  'https://n8n.tudominio.com/webhook/dashboard-action',
  'https://v-ascendsolutions.app.n8n.cloud/webhook-test/dashboard-action',
] as const;

type N8nActionPayload = {
  email: string;
  user_uid: string;
  action: string;
};

export async function triggerN8nAction(action: string): Promise<Response> {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    throw new Error(error.message);
  }

  const user = data.user;
  if (!user) {
    throw new Error('Usuario no autenticado');
  }

  const email = user.email;
  if (!email) {
    throw new Error('El usuario no tiene email');
  }

  const payload: N8nActionPayload = {
    email,
    user_uid: user.id,
    action,
  };

  let lastError: unknown;

  for (const url of N8N_WEBHOOK_URLS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        lastError = new Error(`n8n respondió con ${res.status}`);
        continue;
      }

      return res;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('No se pudo contactar con n8n');
}
