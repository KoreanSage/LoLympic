import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:romi_app/theme/colors.dart';
import 'package:romi_app/main_navigation.dart';

class IllustrationSelectScreen extends StatefulWidget {
  final String name;
  final String personality;
  final List<String> speechStyles;
  final String spaceStyle;
  final String appearance;

  const IllustrationSelectScreen({
    super.key,
    required this.name,
    required this.personality,
    required this.speechStyles,
    required this.spaceStyle,
    required this.appearance,
  });

  @override
  State<IllustrationSelectScreen> createState() => _IllustrationSelectScreenState();
}

class _IllustrationSelectScreenState extends State<IllustrationSelectScreen> {
  XFile? _selectedXFile;
  Uint8List? _imageBytes;

  Future<void> _pickImage() async {
    final pickedFile = await ImagePicker().pickImage(source: ImageSource.gallery);
    if (pickedFile != null) {
      final bytes = await pickedFile.readAsBytes();
      setState(() {
        _selectedXFile = pickedFile;
        _imageBytes = bytes;
      });
    }
  }

  String generateInitialPrompt({
    required String name,
    required String personality,
    required List<String> speechStyles,
    required String spaceStyle,
    required String appearance,
  }) {
    final speech = speechStyles.isNotEmpty ? speechStyles.join(', ') : "neutral tone";
    return '''
You are now "$name", an AI character created by the user.
- Personality: $personality
- Speech Style: $speech
- Appearance: $appearance
- Lives in: $spaceStyle

Respond to the user in a way that reflects your personality and environment.
Keep your style consistent and emotionally supportive.
''';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Select Profile Image'),
        backgroundColor: Colors.white,
        foregroundColor: AppColors.slateNavy,
        elevation: 0,
      ),
      body: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          children: [
            const Text(
              'Upload your character’s profile image',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 20),
            GestureDetector(
              onTap: _pickImage,
              child: Container(
                height: 200,
                width: 200,
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.grey),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: _imageBytes != null
                    ? ClipRRect(
                        borderRadius: BorderRadius.circular(10),
                        child: Image.memory(_imageBytes!, fit: BoxFit.cover),
                      )
                    : const Center(child: Text('Tap to select image')),
              ),
            ),
            const SizedBox(height: 10),
            if (_selectedXFile != null)
              Text(
                '📸 Image selected!',
                style: TextStyle(color: AppColors.slateNavy, fontSize: 14),
              ),
            const SizedBox(height: 30),
            ElevatedButton(
              onPressed: _selectedXFile != null
                  ? () {
                      // 캐릭터 프롬프트 생성
                      final prompt = generateInitialPrompt(
                        name: widget.name,
                        personality: widget.personality,
                        speechStyles: widget.speechStyles,
                        spaceStyle: widget.spaceStyle,
                        appearance: widget.appearance,
                      );

                      debugPrint("✅ Character Created!");
                      debugPrint("Name: ${widget.name}");
                      debugPrint("Personality: ${widget.personality}");
                      debugPrint("SpeechStyles: ${widget.speechStyles}");
                      debugPrint("SpaceStyle: ${widget.spaceStyle}");
                      debugPrint("Appearance: ${widget.appearance}");
                      debugPrint("Image Path: ${_selectedXFile?.path}");
                      debugPrint("🧠 Initial Prompt:\n$prompt");

                      Navigator.pushReplacement(
                        context,
                        MaterialPageRoute(builder: (context) => const MainNavigation()),
                      );
                    }
                  : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.slateNavy,
                foregroundColor: Colors.white,
              ),
              child: const Text('Finish Character Creation'),
            ),
          ],
        ),
      ),
    );
  }
}
