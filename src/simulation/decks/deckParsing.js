export function parseDeckLines(deckText = "") {
  return String(deckText || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\d+)\s+(.+)$/);
      if (!match) {
        return { quantity: 1, name: line, unresolvedDefinition: true };
      }
      return {
        quantity: Number(match[1]) || 1,
        name: match[2].trim(),
        unresolvedDefinition: true,
      };
    });
}
