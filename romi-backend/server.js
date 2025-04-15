const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();
const { OpenAI } = require('openai');

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
    console.error('❌ Error generating character:', error);
    res.status(500).json({ error: 'Failed to generate character' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
