import { supabase } from './supabase';

export type StorageBucket = 'store-photos' | 'product-photos';

function guessContentType(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.includes('.png')) return 'image/png';
  if (lower.includes('.webp')) return 'image/webp';
  return 'image/jpeg';
}

/** Upload a local file URI to Supabase Storage; returns public HTTPS URL. */
export async function uploadImageFromUri(
  localUri: string,
  bucket: StorageBucket,
  objectPath: string
): Promise<{ publicUrl: string | null; error?: string }> {
  if (!localUri.startsWith('file:') && !localUri.startsWith('content:')) {
    if (localUri.startsWith('http')) {
      return { publicUrl: localUri };
    }
  }

  try {
    const response = await fetch(localUri);
    const blob = await response.blob();
    const arrayBuffer = await new Response(blob).arrayBuffer();
    const contentType = blob.type || guessContentType(localUri);

    const { error } = await supabase.storage.from(bucket).upload(objectPath, arrayBuffer, {
      contentType,
      upsert: true,
    });

    if (error) return { publicUrl: null, error: error.message };

    const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
    return { publicUrl: data.publicUrl };
  } catch (e) {
    return { publicUrl: null, error: String(e) };
  }
}

export function storePhotoPath(ownerId: string, storeId: string, fileName = 'cover.jpg') {
  return `${ownerId}/stores/${storeId}/${fileName}`;
}

export function productPhotoPath(
  ownerId: string,
  storeId: string,
  productId: string,
  fileName = 'photo.jpg'
) {
  return `${ownerId}/products/${storeId}/${productId}-${fileName}`;
}
