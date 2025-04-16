import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:romi_app/theme/colors.dart';

class PhotoDetailScreen extends StatefulWidget {
  final Uint8List imageData;
  final String ownerName;

  const PhotoDetailScreen({
    super.key,
    required this.imageData,
    required this.ownerName,
  });

  @override
  State<PhotoDetailScreen> createState() => _PhotoDetailScreenState();
}

class _PhotoDetailScreenState extends State<PhotoDetailScreen> {
  bool isLiked = false;
  String? aiComment =
      "What a beautiful photo! It reminds me of peaceful summer mornings.";

  final List<Map<String, dynamic>> comments = [
    {
      'user': 'Friend A',
      'text': 'Wow this is lovely!',
      'replies': ['So true!', 'Agreed!']
    },
    {
      'user': 'Friend B',
      'text': 'Looks like a dream place!',
      'replies': []
    },
  ];

  final TextEditingController _commentController = TextEditingController();

  void _toggleLike() {
    setState(() => isLiked = !isLiked);
  }

  void _deleteAIComment() {
    setState(() => aiComment = null);
  }

  void _addComment(String text) {
    if (text.isEmpty) return;
    setState(() {
      comments.add({
        'user': 'You',
        'text': text,
        'replies': []
      });
      _commentController.clear();
    });
  }

  void _addReply(int index, String replyText) {
    if (replyText.isEmpty) return;
    setState(() => comments[index]['replies'].add(replyText));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: Text("${widget.ownerName}'s Gallery"),
        backgroundColor: Colors.white,
        foregroundColor: AppColors.slateNavy,
        elevation: 0,
      ),
      body: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: Image.memory(widget.imageData),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      IconButton(
                        icon: Icon(
                          isLiked ? Icons.favorite : Icons.favorite_border,
                          color: isLiked ? Colors.red : Colors.grey,
                        ),
                        onPressed: _toggleLike,
                      ),
                      const Text('Like')
                    ],
                  ),
                  if (aiComment != null)
                    Container(
                      margin: const EdgeInsets.only(top: 16),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.slateNavy.withOpacity(0.05),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Icon(Icons.psychology_alt_outlined,
                              color: AppColors.slateNavy),
                          const SizedBox(width: 8),
                          Expanded(child: Text(aiComment!)),
                          IconButton(
                            icon: const Icon(Icons.delete_outline),
                            onPressed: _deleteAIComment,
                          ),
                        ],
                      ),
                    ),
                  const SizedBox(height: 24),
                  const Text('Comments', style: TextStyle(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  ...comments.asMap().entries.map((entry) {
                    final index = entry.key;
                    final comment = entry.value;
                    final TextEditingController replyController = TextEditingController();
                    return Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              const Icon(Icons.person, size: 18, color: Colors.grey),
                              const SizedBox(width: 6),
                              Text(
                                comment['user'],
                                style: const TextStyle(fontWeight: FontWeight.bold),
                              ),
                            ],
                          ),
                          Padding(
                            padding: const EdgeInsets.only(left: 24, top: 4),
                            child: Text(comment['text']),
                          ),
                          ...comment['replies'].map<Widget>((reply) => Padding(
                                padding: const EdgeInsets.only(left: 36, top: 4),
                                child: Text('↳ $reply'),
                              )),
                          Padding(
                            padding: const EdgeInsets.only(left: 24, top: 6),
                            child: Row(
                              children: [
                                Expanded(
                                  child: TextField(
                                    controller: replyController,
                                    decoration: const InputDecoration(
                                      hintText: 'Write a reply...',
                                      isDense: true,
                                    ),
                                  ),
                                ),
                                IconButton(
                                  icon: const Icon(Icons.send),
                                  onPressed: () {
                                    _addReply(index, replyController.text);
                                  },
                                )
                              ],
                            ),
                          )
                        ],
                      ),
                    );
                  }).toList(),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _commentController,
                    decoration: const InputDecoration(
                      hintText: 'Add a comment...',
                      border: OutlineInputBorder(),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                ElevatedButton(
                  onPressed: () => _addComment(_commentController.text),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.slateNavy,
                  ),
                  child: const Text('Post'),
                )
              ],
            ),
          )
        ],
      ),
    );
  }
}
