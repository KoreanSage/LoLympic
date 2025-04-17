import 'package:cloud_firestore/cloud_firestore.dart';

/// 사용자 기억 저장 (Firestore user_memory 컬렉션)
Future<void> saveUserMemory(String userId, Map<String, dynamic> memory) async {
  try {
    await FirebaseFirestore.instance
        .collection('user_memory')
        .doc(userId)
        .set({
          ...memory,
          'updatedAt': FieldValue.serverTimestamp(),
        }, SetOptions(merge: true));
    print("✅ 사용자 기억 저장 완료: $userId");
  } catch (e) {
    print("❌ 사용자 기억 저장 실패: $e");
  }
}

/// 사용자 기억 불러와 system prompt 생성
Future<String> buildSystemPrompt(String userId) async {
  try {
    final doc = await FirebaseFirestore.instance
        .collection('user_memory')
        .doc(userId)
        .get();

    if (!doc.exists) {
      print("ℹ️ 사용자 기억 없음, 기본 system prompt 반환");
      return "You are ROMI, a warm AI friend.";
    }

    final data = doc.data()!;
    final likes = (data['likes'] as List<dynamic>?)?.join(', ') ?? '';
    final dislikes = (data['dislikes'] as List<dynamic>?)?.join(', ') ?? '';
    final interests = (data['interests'] as List<dynamic>?)?.join(', ') ?? '';
    final emotion = data['recentMood'] ?? '';
    final personality = data['personality'] ?? '';
    final chatStyle = data['chatStyle'] ?? '';
    final memory = (data['memories'] as List<dynamic>?)?.join('; ') ?? '';

    final prompt = '''
You are ROMI, a warm and empathetic AI friend.
User preferences:
- Likes: $likes
- Dislikes: $dislikes
- Interests: $interests

User traits:
- Personality: $personality
- Chat style: $chatStyle
- Current emotion: $emotion

Notable experiences:
$memory

Speak with emotional warmth and remember what the user has shared in the past.
''';

    print("✅ system prompt 생성됨\n$prompt");
    return prompt;
  } catch (e) {
    print("❌ system prompt 생성 실패: $e");
    return "You are ROMI, a warm AI friend.";
  }
}
