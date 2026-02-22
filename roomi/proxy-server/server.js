var express = require("express");
var cors = require("cors");
var fetch = require("node-fetch");
var app = express();

app.use(cors());
app.use(express.json());

var ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || "";
var REPLICATE_KEY = process.env.REPLICATE_API_KEY || "";

// Health check
app.get("/", function(req, res) {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ============================================================
// Claude AI 채팅
// ============================================================
app.post("/api/chat", function(req, res) {
  if (!ANTHROPIC_KEY) return res.status(500).json({ error: "ANTHROPIC_API_KEY not set" });

  fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(req.body),
  })
  .then(function(r) { return r.json(); })
  .then(function(data) { res.json(data); })
  .catch(function(err) { res.status(500).json({ error: err.message }); });
});

// ============================================================
// Replicate 이미지 생성
// ============================================================
app.post("/api/image", function(req, res) {
  if (!REPLICATE_KEY) return res.status(500).json({ error: "REPLICATE_API_KEY not set" });

  var prompt = req.body.prompt;
  console.log("이미지 생성:", prompt.substring(0, 60) + "...");

  fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + REPLICATE_KEY,
      "Prefer": "wait",
    },
    body: JSON.stringify({
      version: "5599ed30703defd1d160a25a63321b4dec97101d98b4674bcc56e41f62f35637",
      input: { prompt: prompt, num_outputs: 4, aspect_ratio: "1:1", output_format: "webp", output_quality: 80 },
    }),
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    if (data.output && data.output.length > 0) {
      res.json({ images: data.output, imageUrl: data.output[0] });
    } else if (data.error) {
      res.json({ error: data.error });
    } else {
      res.json({ error: "Unexpected response" });
    }
  })
  .catch(function(err) { res.status(500).json({ error: err.message }); });
});

// ============================================================
// Replicate BGM 생성
// ============================================================
app.post("/api/bgm", function(req, res) {
  if (!REPLICATE_KEY) return res.status(500).json({ error: "REPLICATE_API_KEY not set" });

  var mood = req.body.mood || "lo-fi chill";
  console.log("BGM 생성:", mood);

  fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + REPLICATE_KEY,
      "Prefer": "wait",
    },
    body: JSON.stringify({
      version: "671ac645ce5e552cc63a54a2bbff63fcf798043ac68f86b6588b0a8a5e7e4e29",
      input: { prompt: mood + " background music, 30 seconds, loopable", duration: 15 },
    }),
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    if (data.output) {
      res.json({ audioUrl: data.output });
    } else if (data.error) {
      res.json({ error: data.error });
    } else {
      res.json({ error: "Unexpected response" });
    }
  })
  .catch(function(err) { res.status(500).json({ error: err.message }); });
});

var PORT = process.env.PORT || 3001;
app.listen(PORT, function() {
  console.log("Roomi 프록시 서버 실행 중: port " + PORT);
  console.log("Anthropic:", ANTHROPIC_KEY ? "✅ 설정됨" : "❌ 미설정");
  console.log("Replicate:", REPLICATE_KEY ? "✅ 설정됨" : "❌ 미설정");
});
