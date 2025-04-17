const functions = require("firebase-functions");
const {OpenAI} = require("openai");
const cors = require("cors")({origin: true}); // 모든 출처에서 접근 허용

const openai = new OpenAI({
  apiKey: functions.config().openai.key, // 환경변수로 관리
});

exports.generateChat = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const messages = req.body.messages;

      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: messages,
      });

      const reply = completion.choices[0].message.content;
      res.json({reply});
    } catch (error) {
      console.error("🔥 OpenAI Error:", error);
      res.status(500).send("AI 응답 생성 실패");
    }
  });
});
