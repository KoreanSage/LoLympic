import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:romi_app/screens/guestbook_screen.dart';
import 'package:romi_app/services/firestore_service.dart';
import 'package:romi_app/models/guestbook_entry.dart';
import 'package:romi_app/theme/colors.dart';

class HomeTabScreen extends StatelessWidget {
  final String characterName;
  final String imageUrl; // ✅ imageBytes → imageUrl

  const HomeTabScreen({
    super.key,
    required this.characterName,
    required this.imageUrl,
  });

  @override
  Widget build(BuildContext context) {
    final firestoreService = FirestoreService();

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 🔔 알림 아이콘
            Padding(
              padding: const EdgeInsets.only(right: 16.0, top: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  IconButton(
                    icon: const Icon(Icons.notifications_none, color: AppColors.slateNavy),
                    onPressed: () {},
                  ),
                ],
              ),
            ),

            // 🖼️ 캐릭터 이미지
            Center(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(20),
                child: Image.network(
                  imageUrl,
                  height: 400,
                  width: 400,
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) =>
                      const Icon(Icons.error, size: 60, color: Colors.grey),
                ),
              ),
            ),

            const SizedBox(height: 12),

            // 🧑 캐릭터 이름
            Center(
              child: Text(
                characterName,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                  color: AppColors.slateNavy,
                ),
              ),
            ),

            const SizedBox(height: 24),

            // 💬 댓글 미리보기
            StreamBuilder<List<GuestbookEntry>>(
              stream: firestoreService.fetchGuestbook(),
              builder: (context, snapshot) {
                if (!snapshot.hasData) {
                  return const Padding(
                    padding: EdgeInsets.symmetric(vertical: 40),
                    child: Center(child: CircularProgressIndicator()),
                  );
                }

                final entries = snapshot.data!;
                final preview = entries.take(3).toList();

                return Padding(
                  padding: const EdgeInsets.only(left: 48, right: 24, top: 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (entries.isEmpty)
                        const Padding(
                          padding: EdgeInsets.only(bottom: 16),
                          child: Text(
                            "No comments yet. Leave a message in the guestbook!",
                            style: TextStyle(color: Colors.grey),
                          ),
                        )
                      else
                        ...preview.map((entry) {
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 16),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                // 프로필 이미지
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(8),
                                  child: entry.userProfileUrl != null &&
                                          entry.userProfileUrl!.isNotEmpty
                                      ? Image.network(
                                          entry.userProfileUrl!,
                                          width: 36,
                                          height: 36,
                                          fit: BoxFit.cover,
                                        )
                                      : Container(
                                          width: 36,
                                          height: 36,
                                          color: AppColors.iceBlue,
                                          child: const Icon(Icons.person,
                                              color: AppColors.slateNavy, size: 20),
                                        ),
                                ),
                                const SizedBox(width: 12),

                                // 텍스트 영역
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        entry.user,
                                        style: const TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 14,
                                          color: AppColors.slateNavy,
                                        ),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(entry.message,
                                          style: const TextStyle(fontSize: 13)),
                                      const SizedBox(height: 2),
                                      Text(
                                        DateFormat('MMM d, hh:mm a').format(entry.createdAt),
                                        style: const TextStyle(fontSize: 11, color: Colors.grey),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          );
                        }),
                    ],
                  ),
                );
              },
            ),

            const Spacer(),

            // 📄 View All 버튼
            Center(
              child: Padding(
                padding: const EdgeInsets.only(bottom: 24),
                child: ElevatedButton(
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => GuestbookScreen(profileImageUrl: imageUrl),
                      ),
                    );
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.slateNavy,
                    padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: const Text("View All Guestbook"),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
