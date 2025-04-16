class GuestbookEntry {
  final String docId;
  final String uid;
  final String user;
  final String? userProfileUrl;
  final String message;
  final String? emotion;
  final DateTime createdAt;
  final int likes;
  final List<String> likedBy;
  final bool isLiked;
  final List<GuestbookReply> replies;

  GuestbookEntry({
    required this.docId,
    required this.uid,
    required this.user,
    required this.message,
    required this.createdAt,
    this.userProfileUrl,
    this.emotion,
    this.likes = 0,
    this.likedBy = const [],
    this.isLiked = false,
    this.replies = const [],
  });

  Map<String, dynamic> toMap() {
    return {
      'uid': uid,
      'user': user,
      'userProfileUrl': userProfileUrl,
      'message': message,
      'emotion': emotion,
      'createdAt': createdAt.toIso8601String(),
      'likes': likes,
      'likedBy': likedBy,
    };
  }

  factory GuestbookEntry.fromFirestore(
    Map<String, dynamic> data,
    String docId,
    List<GuestbookReply> replies,
    String currentUid,
  ) {
    final likedByList = List<String>.from(data['likedBy'] ?? []);
    return GuestbookEntry(
      docId: docId,
      uid: data['uid'] ?? '',
      user: data['user'] ?? 'Anonymous',
      userProfileUrl: data['userProfileUrl'] ?? '',
      message: data['message'] ?? '',
      emotion: data['emotion'],
      createdAt: DateTime.tryParse(data['createdAt'] ?? '') ?? DateTime.now(),
      likes: data['likes'] ?? 0,
      likedBy: likedByList,
      isLiked: likedByList.contains(currentUid),
      replies: replies,
    );
  }
}

class GuestbookReply {
  final String id;
  final String uid;
  final String user;
  final String? userProfileUrl;
  final String message;
  final DateTime createdAt;

  GuestbookReply({
    required this.id,
    required this.uid,
    required this.user,
    required this.message,
    required this.createdAt,
    this.userProfileUrl,
  });

  Map<String, dynamic> toMap() {
    return {
      'uid': uid,
      'user': user,
      'userProfileUrl': userProfileUrl,
      'message': message,
      'createdAt': createdAt.toIso8601String(),
    };
  }

  factory GuestbookReply.fromFirestore(String id, Map<String, dynamic> data) {
    return GuestbookReply(
      id: id,
      uid: data['uid'] ?? '',
      user: data['user'] ?? 'Anonymous',
      message: data['message'] ?? '',
      userProfileUrl: data['userProfileUrl'] ?? '',
      createdAt: DateTime.tryParse(data['createdAt'] ?? '') ?? DateTime.now(),
    );
  }
}
