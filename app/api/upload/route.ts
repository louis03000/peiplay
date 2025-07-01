import { NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import { join } from 'path'

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get('file');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  }
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const filename = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
  const uploadDir = join(process.cwd(), 'public', 'uploads');
  await writeFile(join(uploadDir, filename), buffer);
  // 回傳 public 路徑
  return NextResponse.json({ url: `/uploads/${filename}` });
} 