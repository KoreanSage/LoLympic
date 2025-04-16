import 'package:flutter/material.dart';
import 'package:romi_app/theme/colors.dart';
import 'preview_screen.dart';

class SpaceStyleInputScreen extends StatefulWidget {
  final String name;
  final String personality;
  final List<String> speechStyles;

  const SpaceStyleInputScreen({
    super.key,
    required this.name,
    required this.personality,
    required this.speechStyles,
  });

  @override
  State<SpaceStyleInputScreen> createState() => _SpaceStyleInputScreenState();
}

class _SpaceStyleInputScreenState extends State<SpaceStyleInputScreen> {
  final TextEditingController _spaceStyleController = TextEditingController();
  final TextEditingController _appearanceController = TextEditingController();

  final List<String> _exampleSpaces = [
    "A cozy wooden cabin in the snowy mountains.",
    "A dreamy galaxy filled with floating stars.",
    "A warm library filled with sunlight and old books.",
    "A minimalist white room with soft glowing lights.",
  ];

  final List<String> _exampleAppearances = [
    "A gentle old man with glasses and a warm smile.",
    "A curious cat with blue fur and glowing eyes.",
    "A futuristic robot with a holographic face.",
    "A floating jellyfish-like alien with sparkling lights.",
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 🔙 뒤로가기 버튼
              IconButton(
                icon: const Icon(Icons.arrow_back, color: AppColors.slateNavy),
                onPressed: () {
                  Navigator.pop(context); // <- personality_input_screen으로 돌아감
                },
              ),
              const SizedBox(height: 8),

              Text(
                'Character Space & Appearance',
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: AppColors.slateNavy,
                ),
              ),
              const SizedBox(height: 16),

              // Space Style
              Text(
                '🏡 Space Style (Where does your ROMI live?)',
                style: TextStyle(fontSize: 16, color: Colors.grey[800]),
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: _exampleSpaces.map((example) {
                  return GestureDetector(
                    onTap: () => setState(() => _spaceStyleController.text = example),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        color: AppColors.iceBlue.withOpacity(0.3),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(example, style: const TextStyle(fontSize: 13)),
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _spaceStyleController,
                maxLines: 2,
                decoration: InputDecoration(
                  labelText: "Describe your character's space",
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),

              const SizedBox(height: 24),

              // Appearance
              Text(
                '🧬 Appearance (What does your ROMI look like?)',
                style: TextStyle(fontSize: 16, color: Colors.grey[800]),
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: _exampleAppearances.map((example) {
                  return GestureDetector(
                    onTap: () => setState(() => _appearanceController.text = example),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        color: AppColors.iceBlue.withOpacity(0.3),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(example, style: const TextStyle(fontSize: 13)),
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _appearanceController,
                maxLines: 2,
                decoration: InputDecoration(
                  labelText: "Describe your character's appearance",
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),

              const Spacer(),

              Center(
                child: ElevatedButton(
                  onPressed: () {
                    final space = _spaceStyleController.text.trim();
                    final appearance = _appearanceController.text.trim();

                    if (space.isNotEmpty && appearance.isNotEmpty) {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => PreviewScreen(
                            name: widget.name,
                            personality: widget.personality,
                            speechStyles: widget.speechStyles,
                            spaceStyle: space,
                            appearance: appearance,
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
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}
