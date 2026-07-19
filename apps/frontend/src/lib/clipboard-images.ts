const ACCEPTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
])

function isAcceptedImage(file: File) {
  return ACCEPTED_IMAGE_TYPES.has(file.type)
}

/**
 * Collect image files from a paste event (screenshots, copied images).
 * Returns an empty array when the clipboard has no image data.
 */
export function getClipboardImageFiles(
  clipboardData: DataTransfer | null | undefined,
): File[] {
  if (!clipboardData) return []

  const files: File[] = []
  const seen = new Set<string>()

  const pushFile = (file: File | null) => {
    if (!file || !isAcceptedImage(file)) return
    const key = `${file.name}:${file.size}:${file.lastModified}:${file.type}`
    if (seen.has(key)) return
    seen.add(key)

    files.push(
      file.name
        ? file
        : new File([file], `pasted-image-${Date.now()}.png`, {
            type: file.type || "image/png",
          }),
    )
  }

  for (const item of Array.from(clipboardData.items ?? [])) {
    if (item.kind !== "file" || !item.type.startsWith("image/")) continue
    pushFile(item.getAsFile())
  }

  if (files.length === 0) {
    for (const file of Array.from(clipboardData.files ?? [])) {
      pushFile(file)
    }
  }

  return files
}
