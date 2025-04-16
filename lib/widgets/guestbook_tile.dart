import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:romi_app/models/guestbook_entry.dart';
import 'package:romi_app/services/firestore_service.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:romi_app/theme/colors.dart';

class GuestbookTile extends StatefulWidget {
  final GuestbookEntry entry;

  const GuestbookTile({super.key, required this.entry});

  @override
  State<GuestbookTile> createState() => _GuestbookTileState();
}

class _GuestbookTileState extends State<GuestbookTile> {
  final firestoreService = FirestoreService();
  final currentUser = FirebaseAuth.instance.currentUser;

  bool showReplyField = false;
  bool showReplies = false;
  final TextEditingController _replyController = TextEditingController();

  @override
  Widget build(BuildContext context) {
    final entry = widget.entry;
    final isOwner = currentUser?.uid == entry.uid;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // 💬 메인 댓글 영역
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ✅ 프로필 이미지 (댓글)
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: entry.userProfileUrl != null && entry.userProfileUrl!.isNotEmpty
                  ? Image.network(entry.userProfileUrl!, width: 36, height: 36, fit: BoxFit.cover)
                  : Container(
                      width: 36,
                      height: 36,
                      color: AppColors.iceBlue,
                      child: const Icon(Icons.person, color: AppColors.slateNavy),
                    ),
            ),
            const SizedBox(width: 12),

            // 📝 메시지 블록
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(entry.user, style: const TextStyle(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 2),
                  Text(entry.message),
                  if (entry.emotion != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text(entry.emotion!, style: const TextStyle(fontSize: 16)),
                    ),
                  const SizedBox(height: 4),
                  Text(
                    DateFormat('MMM d, hh:mm a').format(entry.createdAt),
                    style: const TextStyle(fontSize: 12, color: Colors.grey),
                  ),
                  Row(
                    children: [
                      TextButton(
                        onPressed: () => setState(() => showReplyField = !showReplyField),
                        child: const Text("Reply", style: TextStyle(fontSize: 13)),
                      ),
                      if (entry.replies.isNotEmpty)
                        TextButton(
                          onPressed: () => setState(() => showReplies = !showReplies),
                          child: Text(
                            showReplies ? "Hide Replies" : "Show Replies (${entry.replies.length})",
                            style: const TextStyle(fontSize: 13),
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),

            // ❤️ 좋아요 + 삭제
            Column(
              children: [
                IconButton(
                  icon: Icon(
                    entry.isLiked ? Icons.favorite : Icons.favorite_border,
                    color: entry.isLiked ? Colors.red : Colors.grey,
                    size: 20,
                  ),
                  onPressed: () async {
                    await firestoreService.toggleLike(
                      entry.docId,
                      entry.isLiked,
                      currentUser?.uid ?? '',
                    );
                    setState(() {});
                  },
                ),
                if (entry.likes > 0)
                  Text('${entry.likes}', style: const TextStyle(fontSize: 12)),
                if (isOwner)
                  IconButton(
                    icon: const Icon(Icons.delete_outline, size: 20),
                    onPressed: () async {
                      await firestoreService.deleteComment(entry.docId);
                    },
                  ),
              ],
            ),
          ],
        ),

        // 📝 대댓글 입력창
        if (showReplyField)
          Padding(
            padding: const EdgeInsets.only(left: 48, right: 8, bottom: 8),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _replyController,
                    decoration: const InputDecoration(
                      hintText: "Write a reply...",
                      border: OutlineInputBorder(),
                      isDense: true,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                ElevatedButton(
                  onPressed: () async {
                    if (_replyController.text.trim().isNotEmpty) {
                      await firestoreService.addReply(entry.docId, _replyController.text.trim());
                      _replyController.clear();
                      setState(() {
                        showReplyField = false;
                        showReplies = true;
                      });
                    }
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.slateNavy,
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  ),
                  child: const Text("Reply"),
                ),
              ],
            ),
          ),

        // 💬 대댓글 목록
        if (showReplies)
          ...entry.replies.map((reply) {
            return Padding(
              padding: const EdgeInsets.only(left: 48, bottom: 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: reply.userProfileUrl != null && reply.userProfileUrl!.isNotEmpty
                        ? Image.network(reply.userProfileUrl!, width: 28, height: 28, fit: BoxFit.cover)
                        : Container(
                            width: 28,
                            height: 28,
                            color: AppColors.iceBlue,
                            child: const Icon(Icons.person, size: 14, color: AppColors.slateNavy),
                          ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(reply.user, style: const TextStyle(fontWeight: FontWeight.bold)),
                        Text(reply.message),
                        Text(
                          DateFormat('MMM d, hh:mm a').format(reply.createdAt),
                          style: const TextStyle(fontSize: 11, color: Colors.grey),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            );
          }),

        const Divider(),
      ],
    );
  }
}
