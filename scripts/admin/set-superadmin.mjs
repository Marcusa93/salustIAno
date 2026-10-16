// Marca (o desmarca) una cuenta como superadmin: `app_metadata.superadmin`
// en Supabase Auth. Ese campo solo se puede escribir con la secret key, así
// que nadie puede dárselo a sí mismo desde la app. Qué habilita: ver
// src/lib/family-permissions.ts y decisions/0015-superadmin.md.
//
// Uso:
//   node --env-file=.env.local scripts/admin/set-superadmin.mjs <email o user id>
//   node --env-file=.env.local scripts/admin/set-superadmin.mjs <email o user id> --off

import { createClient } from '@supabase/supabase-js';

const [who, flag] = process.argv.slice(2);
if (!who) {
  console.error('Uso: scripts/admin/set-superadmin.mjs <email o user id> [--off]');
  process.exit(1);
}
const enable = flag !== '--off';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY (¿--env-file=.env.local?).');
  process.exit(1);
}
const supabase = createClient(url, secret, { auth: { persistSession: false } });

async function findUser(idOrEmail) {
  if (/^[0-9a-f-]{36}$/i.test(idOrEmail)) {
    const { data, error } = await supabase.auth.admin.getUserById(idOrEmail);
    if (error) throw error;
    return data.user;
  }
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === idOrEmail.toLowerCase());
    if (found || data.users.length < 200) return found ?? null;
  }
}

const user = await findUser(who);
if (!user) {
  console.error(`No encontré una cuenta para "${who}".`);
  process.exit(1);
}

const { error } = await supabase.auth.admin.updateUserById(user.id, {
  app_metadata: { ...user.app_metadata, superadmin: enable },
});
if (error) throw error;

console.info(`${user.email}: superadmin ${enable ? 'activado' : 'desactivado'}.`);
