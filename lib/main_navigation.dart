import 'package:flutter/material.dart';
import 'package:romi_app/screens/home_tab_screen.dart';
import 'package:romi_app/screens/chat_screen.dart';
import 'package:romi_app/screens/gallery_screen.dart';
import 'package:romi_app/theme/colors.dart';

class MainNavigation extends StatefulWidget {
  final String characterName;
  final String imageUrl;

  const MainNavigation({
    super.key,
    required this.characterName,
    required this.imageUrl,
  });

  @override
  State<MainNavigation> createState() => _MainNavigationState();
}

class _MainNavigationState extends State<MainNavigation> {
  int _selectedIndex = 0;

  late final List<Widget> _screens;

  @override
  void initState() {
    super.initState();
    _screens = [
      HomeTabScreen(
        characterName: widget.characterName,
        imageUrl: widget.imageUrl,
      ),
      ChatScreen(
        characterName: widget.characterName,
        characterImageUrl: widget.imageUrl,
      ),
      GalleryScreen(
        characterName: widget.characterName,
      ),
      const Center(child: Text('Friends')),
      const Center(child: Text('Settings')),
    ];
  }

  void _onItemTapped(int index) {
    setState(() {
      _selectedIndex = index;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _screens[_selectedIndex],
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _selectedIndex,
        backgroundColor: AppColors.slateNavy,
        selectedItemColor: Colors.white,
        unselectedItemColor: Colors.white.withOpacity(0.5),
        onTap: _onItemTapped,
        type: BottomNavigationBarType.fixed,
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home), label: 'Home'),
          BottomNavigationBarItem(icon: Icon(Icons.chat_bubble), label: 'Chat'),
          BottomNavigationBarItem(icon: Icon(Icons.photo_library), label: 'Gallery'),
          BottomNavigationBarItem(icon: Icon(Icons.people), label: 'Friends'),
          BottomNavigationBarItem(icon: Icon(Icons.settings), label: 'Settings'),
        ],
      ),
    );
  }
}
