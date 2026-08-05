export function validateText(text) {
  if (!text || !text.trim()) return "refusing to add an empty todo";
  if (text.length > 200) return "todo text is longer than 200 characters";
  return null;
}
