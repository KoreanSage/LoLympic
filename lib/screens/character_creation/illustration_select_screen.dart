import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:romi_app/theme/colors.dart';
import 'package:uuid/uuid.dart';
import 'package:romi_app/main_navigation.dart';

class IllustrationSelectScreen extends StatefulWidget {
  final String name;
  final String personality;
  final List<String> speechStyles;
  final String spaceStyle;
  final String appearance;
  final String aiMessage;
  final Uint8List? imageBytes;

  const IllustrationSelectScreen({
    super.key,
    required this.name,
    required this.personality,
    required this.speechStyles,
    required this.spaceStyle,
    required this.appearance,
    required this.aiMessage,
    required this.imageBytes,
  });

  @override
  State<IllustrationSelectScreen> createState() => _IllustrationSelectScreenState();
}

class _IllustrationSelectScreenState extends State<IllustrationSelectScreen> {
  XFile? _selectedXFile;
  Uint8List? _uploadedImage;
  bool _isUploading = false;

  Future<void> _pickImage() async {
    final picked = await ImagePicker().pickImage(source: ImageSource.gallery);
    if (picked != null) {
      final bytes = await picked.readAsBytes();
      setState(() {
        _selectedXFile = picked;
        _uploadedImage = bytes;
      });
    }
  }

  Future<String?> _uploadImageToFirebase(Uint8List imageData) async {
    try {
      setState(() => _isUploading = true);
      final storageRef =
          FirebaseStorage.instance.ref().child('profile_images/${const Uuid().v4()}.png');
      await storageRef.putData(imageData, SettableMetadata(contentType: 'image/png'));
      final downloadUrl = await storageRef.getDownloadURL();
      return downloadUrl;
    } catch (e) {
      print('❌ Upload failed: $e');
      return null;
    } finally {
      setState(() => _isUploading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final finalImage = _uploadedImage ?? widget.imageBytes;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Select Profile Image'),
        backgroundColor: Colors.white,
        foregroundColor: AppColors.slateNavy,
        elevation: 0,
      ),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              const Text(
                'Upload your character’s profile image',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              const Text(
                'A profile image has been automatically generated.',
                style: TextStyle(fontSize: 14),
              ),
              const SizedBox(height: 4),
              const Text(
                'Want to use your own? Tap below to upload a different image.',
                style: TextStyle(fontSize: 13, color: Colors.grey),
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
                  child: finalImage != null
                      ? ClipRRect(
                          borderRadius: BorderRadius.circular(10),
                          child: Image.memory(finalImage, fit: BoxFit.cover),
                        )
                      : const Center(child: Text('Tap to select image')),
                ),
              ),
              const SizedBox(height: 30),
              _isUploading
                  ? const CircularProgressIndicator()
                  : ElevatedButton(
                      onPressed: () async {
                        if (finalImage == null) return;

                        final imageUrl = await _uploadImageToFirebase(finalImage);
                        if (imageUrl == null) return;

                        Navigator.pushReplacement(
                          context,
                          MaterialPageRoute(
                            builder: (_) => MainNavigation(
                              characterName: widget.name,
                              imageUrl: imageUrl,
                            ),
                          ),
                        );
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.slateNavy,
                        foregroundColor: Colors.white,
                      ),
                      child: const Text('Finish Character Creation'),
                    ),
            ],
          ),
        ),
      ),
    );
  }
}