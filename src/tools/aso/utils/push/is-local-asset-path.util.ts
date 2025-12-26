/**
 * Determine if screenshot path refers to a local public asset
 */
export function isLocalAssetPath(assetPath: string): boolean {
  if (!assetPath) {
    return false;
  }

  const trimmedPath = assetPath.trim();
  return !/^([a-z]+:)?\/\//i.test(trimmedPath);
}

