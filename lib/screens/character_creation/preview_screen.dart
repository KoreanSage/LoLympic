import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
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
        final base64 = data['imageBase64'];
        final message = data['aiMessage'];

        setState(() {
          aiMessage = message;
          imageBytes = base64Decode(base64);
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

  TextStyle get _infoStyle => const TextStyle(fontSize: 18, fontWeight: FontWeight.bold);
  TextStyle get _detailStyle => const TextStyle(fontSize: 16, color: Colors.black87);

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
              padding: const EdgeInsets.all(24.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('👤 Name: ${widget.name}', style: _infoStyle),
                  const SizedBox(height: 8),
                  Text('🌱 Personality:', style: _infoStyle),
                  Text(widget.personality, style: _detailStyle),
                  const SizedBox(height: 8),
                  Text('💬 Speech Style:', style: _infoStyle),
                  ...widget.speechStyles.map((s) => Text('- $s', style: _detailStyle)),
                  const SizedBox(height: 8),
                  Text('🏡 Space Style:', style: _infoStyle),
                  Text(widget.spaceStyle, style: _detailStyle),
                  const SizedBox(height: 8),
                  Text('🧬 Appearance:', style: _infoStyle),
                  Text(widget.appearance, style: _detailStyle),
                  const SizedBox(height: 20),

                  if (imageBytes != null)
                    Center(
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(12),
                        child: Image.memory(
                          imageBytes!,
                          width: 300,
                          height: 300,
                          fit: BoxFit.cover,
                        ),
                      ),
                    ),

                  const SizedBox(height: 20),
                  Text('✨ AI Message:', style: _infoStyle),
                  const SizedBox(height: 4),
                  Text(aiMessage ?? '', style: _detailStyle),
                  const Spacer(),

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
                                aiMessage: aiMessage ?? '',
                                imageBytes: imageBytes,
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
