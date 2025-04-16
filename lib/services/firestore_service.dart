import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:romi_app/models/guestbook_entry.dart';

class FirestoreService {
  final _firestore = FirebaseFirestore.instance;
  final _auth = FirebaseAuth.instance;

  // ✅ 댓글 추가 (외부에서 프로필 이미지 URL 받음)
  Future<void> addComment(String message, String? emotion, String profileImageUrl) async {
    final user = _auth.currentUser;

    if (user == null) {
      print("⛔ addComment: user is null (로그인 안 됨)");
      return;
    }

    final trimmedMessage = message.trim();
    if (trimmedMessage.isEmpty) {
      print("⛔ addComment: message is empty");
      return;
    }

    final commentRef = _firestore.collection('guestbook').doc();

    print("✅ addComment 실행됨");
    print("🔸 uid: ${user.uid}");
    print("🔸 message: $trimmedMessage");
    print("🔸 emotion: $emotion");
    print("🔸 userProfileUrl: $profileImageUrl");

    try {
      await commentRef.set({
        'uid': user.uid,
        'user': user.displayName ?? 'Anonymous',
        'userProfileUrl': profileImageUrl,
        'message': trimmedMessage,
        'emotion': emotion,
        'createdAt': DateTime.now().toIso8601String(),
        'likes': 0,
        'likedBy': [],
      });

      print("✅ Comment successfully saved to Firestore");
    } catch (e) {
      print("❌ Failed to save comment: $e");
    }
  }

  // ✅ 대댓글 추가
  Future<void> addReply(String parentCommentId, String message) async {
    final user = _auth.currentUser;
    if (user == null || message.trim().isEmpty) return;

    final replyRef = _firestore
        .collection('guestbook')
        .doc(parentCommentId)
        .collection('replies')
        .doc();

    await replyRef.set({
      'uid': user.uid,
      'user': user.displayName ?? 'Anonymous',
      'userProfileUrl': user.photoURL ?? '',
      'message': message.trim(),
      'createdAt': DateTime.now().toIso8601String(),
    });
  }

  // ✅ 좋아요 토글
  Future<void> toggleLike(String docId, bool isLiked, String userId) async {
    final ref = _firestore.collection('guestbook').doc(docId);

    await _firestore.runTransaction((transaction) async {
      final snapshot = await transaction.get(ref);
      final data = snapshot.data()!;
      final likedBy = List<String>.from(data['likedBy'] ?? []);
      final likes = (data['likes'] ?? 0) as int;

      if (isLiked) {
        likedBy.remove(userId);
      } else {
        likedBy.add(userId);
      }

      transaction.update(ref, {
        'likedBy': likedBy,
        'likes': likedBy.length,
      });
    });
  }

  // ✅ 댓글 삭제 (대댓글 먼저 삭제)
  Future<void> deleteComment(String docId) async {
    final ref = _firestore.collection('guestbook').doc(docId);
    final replies = await ref.collection('replies').get();

    for (final reply in replies.docs) {
      await reply.reference.delete();
    }

    await ref.delete();
  }

  // ✅ 전체 Guestbook 가져오기 (좋아요 순 정렬 + 대댓글 포함)
  Stream<List<GuestbookEntry>> fetchGuestbook() {
    final currentUid = _auth.currentUser?.uid ?? '';

    return _firestore
        .collection('guestbook')
        .orderBy('likes', descending: true) // ✅ 좋아요 많은 순 정렬
        .snapshots()
        .asyncMap((snapshot) async {
      final entries = <GuestbookEntry>[];

      for (final doc in snapshot.docs) {
        final data = doc.data();
        final repliesSnapshot = await doc.reference
            .collection('replies')
            .orderBy('createdAt')
            .get();

        final replies = repliesSnapshot.docs.map((r) {
          return GuestbookReply.fromFirestore(r.id, r.data());
        }).toList();

        entries.add(
          GuestbookEntry.fromFirestore(data, doc.id, replies, currentUid),
        );
      }

      return entries;
    });
  }
}
