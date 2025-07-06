import { NextResponse } from 'next/server'
import cloudinary from 'cloudinary'

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get('file');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  }
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // 直接上傳 buffer 到 Cloudinary
  try {
    const uploadRes = await new Promise((resolve, reject) => {
      cloudinary.v2.uploader.upload_stream(
        { folder: 'peiplay_uploads' },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(buffer);
    });
    // @ts-ignore
    return NextResponse.json({ url: uploadRes.secure_url });
  } catch (err) {
    return NextResponse.json({ error: 'Cloudinary upload failed', detail: String(err) }, { status: 500 });
  }
} 