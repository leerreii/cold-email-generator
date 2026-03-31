require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Groq = require('groq-sdk');

const app = express();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.use(cors());
app.use(express.json());

// Лимит запросов - защита от спама
const requests = {};
app.use((req, res, next) => {
  const ip = req.ip;
  const now = Date.now();
  if (!requests[ip]) requests[ip] = [];
  requests[ip] = requests[ip].filter(t => now - t < 86400000);
  if (requests[ip].length >= 5) {
    return res.status(429).json({ error: 'Лимит 5 запросов в день' });
  }
  requests[ip].push(now);
  next();
});

app.post('/generate', async (req, res) => {
    const { company, offer, language } = req.body;
  if (!company || !offer) {
    return res.status(400).json({ error: 'Заполни все поля' });
  }

  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{
        role: 'user',
        content: `Write a short cold email for a company called ${company}. My offer: ${offer}. ${language === 'ru' ? 'Write in Russian.' : 'Write in English.'} Be professional and persuasive.`
      }]
    });
    res.json({ email: response.choices[0].message.content });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.listen(3000, () => console.log('Сервер запущен на порту 3000'));