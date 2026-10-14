const THINKING_REGEX = /<rem_thinking>([\s\S]*?)<\/rem_thinking>\s*/gi;
// Detect incomplete opening tag at end of streaming content
const PARTIAL_TAG_REGEX = /<rem_thinking>[^<]*$/i;
const PARTIAL_OPEN_REGEX = /<(?:r(?:e(?:m(?:_(?:t(?:h(?:i(?:n(?:k(?:i(?:n(?:g(?:>?)?)?)?)?)?)?)?)?)?)?)?)?)?$/i;

export function parseThinking(content: string): {
  displayContent: string;
  thinking: string | null;
} {
  // Extract completed thinking blocks
  const thinkingParts: string[] = [];
  let cleaned = content.replace(THINKING_REGEX, (_, thought) => {
    thinkingParts.push(thought.trim());
    return '';
  });

  // Handle streaming: hide incomplete thinking block (opened but not closed)
  const partialMatch = cleaned.match(PARTIAL_TAG_REGEX);
  if (partialMatch) {
    cleaned = cleaned.slice(0, partialMatch.index);
  }

  // Hide partial opening tag at end of stream (e.g., "<rem_thi")
  const partialOpen = cleaned.match(PARTIAL_OPEN_REGEX);
  if (partialOpen) {
    cleaned = cleaned.slice(0, partialOpen.index);
  }

  return {
    displayContent: cleaned.trim(),
    thinking: thinkingParts.length > 0 ? thinkingParts.join('\n\n') : null,
  };
}

export function stripThinking(text: string): string {
  return parseThinking(text).displayContent;
}
