import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:romi_app/theme/colors.dart';
import 'package:romi_app/screens/photo_detail_screen.dart'; // ✅ 상세페이지 import 추가

class GalleryScreen extends StatefulWidget {
  final String characterName;

  const GalleryScreen({super.key, required this.characterName});

  @override
  State<GalleryScreen> createState() => _GalleryScreenState();
}

class _GalleryScreenState extends State<GalleryScreen> {
  final List<Uint8List> _images = [];
  final ImagePicker _picker = ImagePicker();

  Future<void> _pickImage() async {
    final XFile? picked = await _picker.pickImage(source: ImageSource.gallery);
    if (picked != null) {
      final bytes = await picked.readAsBytes();
      setState(() {
        _images.insert(0, bytes); // 가장 위에 표시
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: Text('${widget.characterName}\'s Gallery'),
        backgroundColor: Colors.white,
        foregroundColor: AppColors.slateNavy,
        elevation: 0,
        actions: [
          IconButton(
            onPressed: _pickImage,
            icon: const Icon(Icons.add_a_photo),
            tooltip: 'Upload Image',
          ),
        ],
      ),
      body: _images.isEmpty
          ? const Center(
              child: Text(
                'No photos yet.',
                style: TextStyle(color: Colors.grey, fontSize: 16),
              ),
            )
          : GridView.builder(
              padding: const EdgeInsets.all(16),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
              ),
              itemCount: _images.length,
              itemBuilder: (context, index) {
                return GestureDetector(
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => PhotoDetailScreen(
                          imageData: _images[index], // ✅ 수정된 파라미터명
                          ownerName: widget.characterName, // ✅ 파라미터명 수정
                        ),
                      ),
                    );
                  },
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: Image.memory(
                      _images[index],
                      fit: BoxFit.cover,
                    ),
                  ),
                );
              },
            ),
    );
  }
}