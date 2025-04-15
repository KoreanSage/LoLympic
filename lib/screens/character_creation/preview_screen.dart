import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'dart:typed_data';

import 'package:romi_app/theme/colors.dart';
import 'illustration_select_screen.dart';

class PreviewScreen extends StatefulWidget {
  final String name;
  final String personality;
  final List<String> speechStyles;
  final String spaceStyle;
  final String appearance;

  const PreviewScreen({
    super.key,
    required this.name,
    required this.personality,
    required this.speechStyles,
    required this.spaceStyle,
    required this.appearance,
  });

  @override
  State<PreviewScreen> createState() => _PreviewScreenState();
}

class _PreviewScreenState extends State<PreviewScreen> {
  String? aiMessage;
  Uint8List? imageBytes;
  bool isLoading = true;

  @override
  void initState() {
    super.initState();
    generateCharacter();
  }

  Future<void> generateCharacter() async {
    final url = Uri.parse('http://localhost:3000/generate-character');

    try {
      final response = await http.post(
        url,
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'name': widget.name,
          'personality': widget.personality,
          'speechStyles': widget.speechStyles,
          'spaceStyle': widget.spaceStyle,
          'appearance': widget.appearance,
        }),
      );

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        print('✅ Response: $data');

        setState(() {
          aiMessage = data['aiMessage'];
          final base64 = data['imageBase64'];
          imageBytes = base64 != null ? base64Decode(base64) : null;
          isLoading = false;
        });
      } else {
        throw Exception('Failed to generate');
      }
    } catch (e) {
      print('❌ Error: $e');
      setState(() {
        aiMessage = '⚠️ Failed to generate message.';
        isLoading = false;
      });
    }
  }

  Widget buildCharacterInfo(String label, String value, IconData icon) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 20, color: AppColors.slateNavy),
          const SizedBox(width: 8),
          Expanded(
            child: RichText(
              text: TextSpan(
                text: '$label: ',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.black),
                children: [
                  TextSpan(
                    text: value,
                    style: const TextStyle(fontWeight: FontWeight.normal),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Preview Character'),
        backgroundColor: Colors.white,
        foregroundColor: AppColors.slateNavy,
        elevation: 0,
      ),
      body: isLoading
          ? const Center(child: CircularProgressIndicator())
          : Padding(
              padding: const EdgeInsets.all(20.0),
              child: Column(
                children: [
                  // 캐릭터 정보
                  Card(
                    elevation: 1,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    child: Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Column(
                        children: [
                          buildCharacterInfo('Name', widget.name, Icons.person),
                          buildCharacterInfo('Personality', widget.personality, Icons.spa),
                          buildCharacterInfo('Speech Style', widget.speechStyles.join(', '), Icons.chat),
                          buildCharacterInfo('Space Style', widget.spaceStyle, Icons.home),
                          buildCharacterInfo('Appearance', widget.appearance, Icons.pets),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),

                  // 이미지
                  if (imageBytes != null)
                    ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: Image.memory(
                        imageBytes!,
                        width: 280,
                        height: 280,
                        fit: BoxFit.cover,
                      ),
                    )
                  else
                    const Text('⚠️ No image available.'),
                  const SizedBox(height: 20),

                  // 메시지
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppColors.iceBlue.withOpacity(0.3),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          '✨ AI Message',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          aiMessage ?? '',
                          style: const TextStyle(fontSize: 14, color: Colors.black87),
                        ),
                      ],
                    ),
                  ),

                  const Spacer(),

                  // 버튼 영역
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      OutlinedButton(
                        onPressed: () => Navigator.pop(context),
                        child: const Text('Edit'),
                      ),
                      ElevatedButton(
                        onPressed: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => IllustrationSelectScreen(
                                name: widget.name,
                                personality: widget.personality,
                                speechStyles: widget.speechStyles,
                                spaceStyle: widget.spaceStyle,
                                appearance: widget.appearance,
                              ),
                            ),
                          );
                        },
                        style: ElevatedButton.styleFrom(backgroundColor: AppColors.slateNavy),
                        child: const Text('Next'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
    );
  }
}
