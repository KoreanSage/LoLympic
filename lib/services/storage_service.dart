import 'dart:typed_data';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:uuid/uuid.dart';

class StorageService {
  final FirebaseStorage _storage = FirebaseStorage.instance;
  final Uuid _uuid = const Uuid();

  /// 프로필 이미지를 Firebase Storage에 업로드하고 다운로드 URL을 반환합니다.
  Future<String?> uploadProfileImage(Uint8List imageBytes) async {
    try {
      // 파일명은 UUID로 고유하게 설정
      final fileName = _uuid.v4();
      final ref = _storage.ref().child('profile_images/$fileName.png');

      // 이미지 업로드
      final uploadTask = await ref.putData(
        imageBytes,
        SettableMetadata(contentType: 'image/png'),
      );

      // 업로드 후 다운로드 URL 반환
      final url = await uploadTask.ref.getDownloadURL();
      return url;
    } catch (e) {
      print('🔥 Storage upload failed: $e');
      return null;
    }
  }
}
