export const parseOriginCountry = (origin: string): string => {
  const trimmed = origin.trim();

  if (!trimmed) {
    return '';
  }

  const [firstPart] = trimmed.split(/[·,，/|]/).map((part) => part.trim()).filter(Boolean);

  return firstPart ?? trimmed;
};
