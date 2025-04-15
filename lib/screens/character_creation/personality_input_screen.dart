import 'package:flutter/material.dart';
import 'package:romi_app/theme/colors.dart';
import 'space_style_input_screen.dart';

class PersonalityInputScreen extends StatefulWidget {
  final String characterName;

  const PersonalityInputScreen({super.key, required this.characterName});

  @override
  State<PersonalityInputScreen> createState() => _PersonalityInputScreenState();
}

class _PersonalityInputScreenState extends State<PersonalityInputScreen> {
  final TextEditingController _personalityController = TextEditingController();
  final TextEditingController _speechExampleController = TextEditingController();
  final List<String> _speechExamples = [];

  final List<String> _examplePersonalities = [
    "Kind and always listens patiently.",
    "Playful with a sharp sense of humor.",
    "Wise and calm, like a mentor.",
    "Energetic and full of curiosity.",
  ];

  void _addSpeechExample() {
    final example = _speechExampleController.text.trim();
    if (example.isNotEmpty && _speechExamples.length < 5) {
      setState(() {
        _speechExamples.add(example);
        _speechExampleController.clear();
      });
    }
  }

  void _removeSpeechExample(int index) {
    setState(() {
      _speechExamples.removeAt(index);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16),
          child: Column(
            children: [
              const SizedBox(height: 24),
              Center(
                child: Text(
                  "Describe Your ROMI's Personality",
                  style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: AppColors.slateNavy),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                "What kind of friend will your AI be?",
                style: TextStyle(fontSize: 16, color: Colors.grey[700]),
              ),
              const SizedBox(height: 28),

              /// Personality 예시 태그
              Wrap(
                spacing: 8,
                runSpacing: 8,
                alignment: WrapAlignment.center,
                children: _examplePersonalities.map((example) {
                  return GestureDetector(
                    onTap: () => setState(() => _personalityController.text = example),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        color: AppColors.iceBlue.withOpacity(0.3),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(example, style: const TextStyle(fontSize: 14)),
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 28),

              /// Personality 입력
              TextField(
                controller: _personalityController,
                maxLines: 3,
                decoration: InputDecoration(
                  labelText: "Personality Description",
                  hintText: "e.g., Calm and thoughtful like a wise old friend...",
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),

              const SizedBox(height: 32),

              /// 말투 예시 입력
              Align(
                alignment: Alignment.centerLeft,
                child: Text("Speech Style Examples (max 5)",
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.slateNavy)),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _speechExampleController,
                      decoration: const InputDecoration(
                        hintText: "e.g., 'Hey there! What’s up?'",
                        border: OutlineInputBorder(),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  ElevatedButton(
                    onPressed: _speechExamples.length < 5 ? _addSpeechExample : null,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.slateNavy,
                      foregroundColor: Colors.white,
                    ),
                    child: const Text("Add"),
                  ),
                ],
              ),

              /// 예시 리스트 출력
              const SizedBox(height: 12),
              Column(
                children: _speechExamples.asMap().entries.map((entry) {
                  int index = entry.key;
                  String text = entry.value;
                  return ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(text),
                    trailing: IconButton(
                      icon: const Icon(Icons.delete_outline),
                      onPressed: () => _removeSpeechExample(index),
                    ),
                  );
                }).toList(),
              ),

              const Spacer(),

              /// 다음 페이지 이동 버튼
              ElevatedButton(
                onPressed: () {
                  final personality = _personalityController.text.trim();
                  if (personality.isNotEmpty) {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (context) => SpaceStyleInputScreen(
                          name: widget.characterName,
                          personality: personality,
                          speechStyles: _speechExamples,
                        ),
                      ),
                    );
                  }
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.slateNavy,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 36, vertical: 14),
                ),
                child: const Text('Next'),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}
