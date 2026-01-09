import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

/* ================== CONFIG ================== */

// ⚠️ ВСТАВЬ СЮДА ТОКЕН СВОЕГО БОТА
const BOT_TOKEN = '8275536453:AAE-2fiwUdbU_jDtPcQ1GLk5845b7Yv11Cw';

// Supabase
const SUPABASE_URL = 'https://izqmxiczwjxbahoaouvf.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_EkQDc050Y4kKpgDIwX1wpg_ocqt17El';

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY
);

/* ================== APP ================== */

const app = express();
app.use(cors());
app.use(bodyParser.json());

/* ================== TELEGRAM VERIFY ================== */

function verifyTelegramInitData(initData) {
  if (!initData) return false;

  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get('hash');
  urlParams.delete('hash');

  const dataCheckString = [...urlParams.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = crypto
    .createHash('sha256')
    .update(BOT_TOKEN)
    .digest();

  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  return calculatedHash === hash;
}

/* ================== API ================== */

app.post('/api/check-user', async (req, res) => {
  try {
    const { initData, user } = req.body;

    if (!initData || !user?.id) {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    // 🔐 ПРОВЕРКА TELEGRAM ПОДПИСИ
    const isValid = verifyTelegramInitData(initData);

    if (!isValid) {
      return res.status(403).json({ error: 'Telegram validation failed' });
    }

    const { id, first_name, last_name, username } = user;

    // 1️⃣ Проверяем пользователя
    const { data: existingUser, error: selectError } = await supabase
      .from('Users')
      .select('id')
      .eq('id', id)
      .single();

    if (selectError && selectError.code !== 'PGRST116') {
      console.error(selectError);
      return res.status(500).json({ error: 'Select error' });
    }

    if (existingUser) {
      return res.json({ status: 'exists' });
    }

    // 2️⃣ Вставляем нового
    const { error: insertError } = await supabase
      .from('Users')
      .insert([{
        id,
        firstname: first_name || '',
        lastname: last_name || '',
        idus: username ? `@${username}` : null
      }]);

    if (insertError) {
      console.error(insertError);
      return res.status(500).json({ error: 'Insert error' });
    }

    return res.json({ status: 'created' });

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/* ================== START ================== */

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Secure backend running on port ${PORT}`);
});
