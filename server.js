import express from 'express';
import { GoogleGenAI } from '@google/genai';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '7mb' }));
const port = process.env.PORT || 3000;
const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

app.get('/', (_req, res) => res.json({ app: 'Solusi AI', status: 'online', provider: 'Google Gemini' }));

app.post('/api/chat', async (req, res) => {
  try {
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (!message && !req.body?.imageBase64) {
      return res.status(400).json({ error: 'Field message wajib diisi, atau kirim imageBase64.' });
    }
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY belum dikonfigurasi di environment backend.' });
    }
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const parts = [];
    if (message) parts.push({ text: message.slice(0, 30000) });
    if (req.body?.imageBase64) {
      const base64 = String(req.body.imageBase64);
      const mimeType = String(req.body.mimeType || 'image/jpeg');
      if (!new Set(['image/jpeg','image/png','image/webp']).has(mimeType)) {
        return res.status(400).json({ error: 'Gunakan gambar JPEG, PNG, atau WEBP.' });
      }
      if (base64.length > 5_500_000) return res.status(413).json({ error: 'Gambar terlalu besar.' });
      parts.push({ inlineData: { mimeType, data: base64 } });
    }
    const result = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts }],
      config: { systemInstruction: 'Anda adalah Solusi AI, asisten yang membantu dalam bahasa Indonesia. Untuk coding, jelaskan asumsi dan tampilkan kode relevan. Jangan mengaku telah menjalankan atau menguji kode jika belum. Jika informasi tidak cukup, tanyakan. Untuk gambar, jelaskan yang dapat diamati.' },
    });
    const reply = result.text || '';
    if (!reply.trim()) return res.status(502).json({ error: 'Model AI tidak mengembalikan teks. Coba lagi.' });
    return res.json({ reply });
  } catch (err) {
    console.error('Gemini request failed:', err?.status || '', err?.message || err);
    const status = Number(err?.status);
    if (status === 400) return res.status(400).json({ error: 'Permintaan ditolak Gemini (400). Periksa model, format input, dan parameter. Lihat log backend.' });
    if (status === 401 || status === 403) return res.status(502).json({ error: 'Autentikasi/izin Gemini gagal. Periksa GEMINI_API_KEY dan akses model.' });
    if (status === 429) return res.status(429).json({ error: 'Batas pemakaian Gemini tercapai. Periksa kuota.' });
    return res.status(502).json({ error: 'Layanan AI gagal merespons. Periksa log backend dan coba lagi.' });
  }
});
app.listen(port, () => console.log(`Solusi AI backend listening on ${port}; model=${model}`));
