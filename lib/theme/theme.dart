import 'package:flutter/material.dart';

class AppColors {
  static const Color background = Color(0xFFFFFFFF); // Pure white
  static const Color iceBlue = Color(0xFFDFF6FF);
  static const Color slateNavy = Color(0xFF4B5C78);
  static const Color coralRed = Color(0xFFF2836B); // For emotion highlights
}

final ThemeData romiTheme = ThemeData(
  scaffoldBackgroundColor: AppColors.background,
  primaryColor: AppColors.slateNavy,
  fontFamily: 'SpoqaHanSansNeo', // Update this if using a different font
  textTheme: const TextTheme(
    bodyMedium: TextStyle(
      fontSize: 16,
      color: AppColors.slateNavy,
    ),
    titleLarge: TextStyle(
      fontSize: 20,
      fontWeight: FontWeight.bold,
      color: AppColors.slateNavy,
    ),
  ),
  elevatedButtonTheme: ElevatedButtonThemeData(
    style: ElevatedButton.styleFrom(
      backgroundColor: AppColors.slateNavy,
      foregroundColor: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
    ),
  ),
  inputDecorationTheme: InputDecorationTheme(
    filled: true,
    fillColor: AppColors.iceBlue.withOpacity(0.1),
    border: OutlineInputBorder(
      borderSide: BorderSide(color: AppColors.iceBlue.withOpacity(0.4)),
      borderRadius: BorderRadius.circular(12),
    ),
    focusedBorder: OutlineInputBorder(
      borderSide: BorderSide(color: AppColors.slateNavy, width: 1.5),
      borderRadius: BorderRadius.circular(12),
    ),
    hintStyle: TextStyle(color: AppColors.slateNavy.withOpacity(0.5)),
  ),
);
