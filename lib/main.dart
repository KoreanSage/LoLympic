import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'firebase_options.dart';
import 'theme/theme.dart';

// 시작화면: 캐릭터 생성 시작
import 'screens/character_creation/name_input_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );

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
      home: const NameInputScreen(), // 처음 시작은 캐릭터 생성
    );
  }
}
