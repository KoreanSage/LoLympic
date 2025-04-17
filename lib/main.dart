import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'firebase_options.dart';
import 'theme/theme.dart';

// 시작화면: 캐릭터 생성 시작
import 'screens/character_creation/name_input_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // ✅ Firebase 초기화
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );

  // ✅ 익명 로그인 (userId 확보용)
  final auth = FirebaseAuth.instance;
  if (auth.currentUser == null) {
    await auth.signInAnonymously();
    print("✅ 익명 로그인 완료: ${auth.currentUser?.uid}");
  } else {
    print("✅ 이미 로그인됨: ${auth.currentUser?.uid}");
  }

  // ✅ Firestore 연결 확인용 테스트 로그 (선택 사항)
  try {
    final test = await FirebaseFirestore.instance
        .collection('firestore_test')
        .doc('connection_check')
        .get();
    print("✅ Firestore 연결 성공: ${test.exists ? '문서 있음' : '문서 없음'}");
  } catch (e) {
    print("❌ Firestore 연결 실패: $e");
  }

  runApp(const ROMIApp());
}

class ROMIApp extends StatelessWidget {
  const ROMIApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ROMI',
      debugShowCheckedModeBanner: false,
      theme: romiTheme,
      home: const NameInputScreen(), // 캐릭터 생성부터 시작
    );
  }
}
