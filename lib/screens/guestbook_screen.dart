import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:romi_app/models/guestbook_entry.dart';
import 'package:romi_app/services/firestore_service.dart';
import 'package:romi_app/widgets/guestbook_tile.dart';
import 'package:romi_app/theme/colors.dart';

class GuestbookScreen extends StatefulWidget {
  final String profileImageUrl; // ✅ 캐릭터 생성 시 업로드된 이미지

  const GuestbookScreen({
    super.key,
    required this.profileImageUrl,
  });

  @override
  State<GuestbookScreen> createState() => _GuestbookScreenState();
}

class _GuestbookScreenState extends State<GuestbookScreen> {
  final FirestoreService _firestoreService = FirestoreService();
  final TextEditingController _commentController = TextEditingController();
  String? _selectedEmotion;

  final List<String> _emotionOptions = ['😊', '😢', '😡', '😍', '😶'];
  final user = FirebaseAuth.instance.currentUser;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        leading: const BackButton(color: AppColors.slateNavy),
        title: const Text(
          'Guestbook',
          style: TextStyle(color: AppColors.slateNavy),
        ),
        backgroundColor: Colors.white,
        elevation: 0,
      ),
      body: Column(
        children: [
          // 🔁 실시간 댓글 스트리밍
          Expanded(
            child: StreamBuilder<List<GuestbookEntry>>(
              stream: _firestoreService.fetchGuestbook(),
              builder: (context, snapshot) {
                if (!snapshot.hasData) {
                  return const Center(child: CircularProgressIndicator());
                }

                final entries = snapshot.data!;
                if (entries.isEmpty) {
                  return const Center(
                    child: Text(
                      "No comments yet.",
                      style: TextStyle(color: Colors.grey),
                    ),
                  );
                }

                return ListView.builder(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                  itemCount: entries.length,
                  itemBuilder: (context, index) {
                    return GuestbookTile(
                      entry: entries[index],
                    );
                  },
                );
              },
            ),
          ),

          // 🥰 감정 이모지 선택
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: _emotionOptions.map((emoji) {
                final selected = _selectedEmotion == emoji;
                return GestureDetector(
                  onTap: () => setState(() => _selectedEmotion = emoji),
                  child: Container(
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: selected ? AppColors.iceBlue : Colors.grey[200],
                      shape: BoxShape.circle,
                    ),
                    child: Text(emoji, style: const TextStyle(fontSize: 20)),
                  ),
                );
              }).toList(),
            ),
          ),

          // ✏️ 댓글 입력창 + 전송 버튼
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _commentController,
                    decoration: const InputDecoration(
                      hintText: 'Leave a comment...',
                      border: OutlineInputBorder(),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                ElevatedButton(
                  onPressed: () {
                    final msg = _commentController.text.trim();
                    if (msg.isNotEmpty) {
                      _firestoreService.addComment(
                        msg,
                        _selectedEmotion,
                        widget.profileImageUrl, // ✅ 전달
                      );
                      _commentController.clear();
                      setState(() => _selectedEmotion = null);
                    }
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.slateNavy,
                  ),
                  child: const Text("Send"),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
