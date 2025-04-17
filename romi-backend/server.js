const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();
const { OpenAI } = require('openai');
const admin = require('firebase-admin');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const app = express();
app.use(cors());
app.use(express.json());

// 🔹 Firebase 초기화
admin.initializeApp();
const db = getFirestore();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ✅ 1. 캐릭터 생성 API
app.post('/generate-character', async (req, res) => {
  const { name, personality, speechStyles, spaceStyle, appearance } = req.body;

  try {
    // 1. AI 메시지 생성
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an AI character assistant who creates warm and friendly greetings.',
        },
        {
          role: 'user',
          content: `Generate a welcoming message for the user from a character with the following traits:
- Name: ${name}
- Personality: ${personality}
- Speech Style: ${speechStyles.join(', ')}
- Space Style: ${spaceStyle}
- Appearance: ${appearance}

The message should be warm, friendly, and about 3–4 sentences long. Respond only in English.`,
        },
      ],
    });

    const message = completion.choices[0].message.content;
    console.log('✅ AI message:', message);

    // 2. 이미지 생성
    const imagePrompt = `${appearance} in ${spaceStyle}`;
    const imageResponse = await openai.images.generate({
      model: 'dall-e-3',
      prompt: imagePrompt,
      n: 1,
      size: '1024x1024',
    });

    const imageUrl = imageResponse.data[0]?.url;
    console.log('✅ Image URL:', imageUrl);

    // 3. 이미지 다운로드 → base64 인코딩
    const imageFetch = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const base64Image = Buffer.from(imageFetch.data, 'binary').toString('base64');

    // 4. 클라이언트로 전송
    res.json({
      aiMessage: message,
      imageBase64: base64Image,
    });

  } catch (error) {
    console.error('❌ Error generating character:', error?.response?.data || error.message);
    res.status(500).json({ error: 'Failed to generate character' });
  }
});

// ✅ 2. AI 채팅 + 기억 요약 저장 API
app.post('/chat', async (req, res) => {
  const { userId, messages } = req.body;

  if (!userId || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Missing userId or messages' });
  }

  try {
    // 1. AI 응답 생성
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages,
    });

    const reply = completion.choices[0].message.content;
    console.log('💬 AI reply:', reply);

    // 2. 마지막 유저 메시지 요약 시도
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')?.content;
    let memorySummary = null;

    if (lastUserMessage) {
      const memoryResponse = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are a memory extractor that summarizes important personal facts from a user message.' },
          { role: 'user', content: `Extract key personal memory from this message: "${lastUserMessage}". If none, say 'none'.` },
        ],
      });

      const summary = memoryResponse.choices[0].message.content.trim();
      if (summary.toLowerCase() !== 'none') {
        memorySummary = summary;

        await db.collection('user_memory').doc(userId).set({
          memories: FieldValue.arrayUnion(summary),
          updatedAt: new Date().toISOString(),
        }, { merge: true });

        console.log('🧠 Saved memory:', memorySummary);
      }
    }

    res.json({ reply, savedMemory: memorySummary });
  } catch (error) {
    console.error('❌ Error during chat + memory:', error?.response?.data || error.message);
    res.status(500).json({ error: 'Failed to generate chat reply or memory' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
