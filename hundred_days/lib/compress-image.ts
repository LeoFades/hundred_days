const MAX_BYTES = 1_000_000 // 1 MB
const MAX_SIDE = 1600       // longest edge in px

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
    return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))
}

export async function compressImage(file: File): Promise<Blob> {
    let bitmap: ImageBitmap
    try {
        bitmap = await createImageBitmap(file)
    } catch {
        throw new Error(`"${file.name}" isn't a supported image. Try JPG or PNG.`)
    }

    let scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))

    try {
        // Try a few sizes, and a few qualities at each size
        for (let attempt = 0; attempt < 4; attempt++) {
            const canvas = document.createElement('canvas')
            canvas.width = Math.round(bitmap.width * scale)
            canvas.height = Math.round(bitmap.height * scale)
            canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

            for (const quality of [0.8, 0.65, 0.5]) {
                let blob = await canvasToBlob(canvas, 'image/webp', quality)
                // Some browsers (older Safari) can't make WebP and silently return PNG
                if (!blob || blob.type !== 'image/webp') {
                    blob = await canvasToBlob(canvas, 'image/jpeg', quality)
                }
                if (blob && blob.size <= MAX_BYTES) return blob
            }
            scale *= 0.75
        }
    } finally {
        bitmap.close()
    }

    throw new Error(`Couldn't shrink "${file.name}" under 1 MB.`)
}