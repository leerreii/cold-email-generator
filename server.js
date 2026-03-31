require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Groq = require('groq-sdk');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

app.use(cors());
app.use(express.json());

// Регистрация
app.post('/register', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email обязателен' });

  const { data, error } = await supabase
    .from('users')
    .insert([{ email }])
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return res.status(400).json({ error: 'Email уже зарегистрирован' });
    return res.status(500).json({ error: 'Ошибка сервера' });
  }

  res.json({ user: data });
});

// Вход
app.post('/login', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email обязателен' });

  const { data, error } = await supabase
    .from('users')
    .select()
    .eq('email', email)
    .single();

  if (error || !data) return res.status(404).json({ error: 'Пользователь не найден' });

  res.json({ user: data });
});

// Генерация
app.post('/generate', async (req, res) => {
  const { company, offer, language, email } = req.body;

  if (!company || !offer || !email) {
    return res.status(400).json({ error: 'Заполни все поля' });
  }

  // Проверяем пользователя
  const { data: user, error } = await supabase
    .from('users')
    .select()
    .eq('email', email)
    .single();

  if (error || !user) return res.status(404).json({ error: 'Пользователь не найден' });

  if (user.generations_left <= 0 && !user.is_paid) {
    return res.status(403).json({ error: 'Лимит исчерпан. Купи подписку.' });
  }

  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{
        role: 'user',
        content: `Write a short cold email for a company called ${company}. My offer: ${offer}. ${language === 'ru' ? 'Write in Russian.' : 'Write in English.'} Be professional and persuasive.`
      }]
    });

    // Уменьшаем счётчик если не платный
    if (!user.is_paid) {
      await supabase
        .from('users')
        .update({ generations_left: user.generations_left - 1 })
        .eq('email', email);
    }

    res.json({ 
      email: response.choices[0].message.content,
      generations_left: user.is_paid ? 'unlimited' : user.generations_left - 1
    });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.listen(3000, () => console.log('Сервер запущен на порту 3000'));