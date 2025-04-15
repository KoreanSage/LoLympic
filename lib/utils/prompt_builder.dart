String buildCharacterPrompt({
  required String name,
  required String personality,
  required List<String> speechStyles,
  required String spaceStyle,
  required String appearance,
}) {
  final buffer = StringBuffer();
  buffer.writeln("You are an AI character named '$name'.");
  buffer.writeln("Personality: $personality.");
  if (speechStyles.isNotEmpty) {
    buffer.writeln("You speak in the following style(s):");
    for (var style in speechStyles) {
      buffer.writeln("- $style");
    }
  }
  buffer.writeln("You live in: $spaceStyle");
  buffer.writeln("You look like: $appearance");
  return buffer.toString();
}
