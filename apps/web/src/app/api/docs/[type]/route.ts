import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest, { params }: { params: { type: string } }) {
  const type = params.type;
  if (type !== 'usuario' && type !== 'tecnico') {
    return new NextResponse('Not found', { status: 404 });
  }

  const p = path.join(
    process.cwd(),
    `../../docs/MANUAL_${type === 'usuario' ? 'USUARIO' : 'TECNICO'}.md`,
  );
  if (!fs.existsSync(p)) return new NextResponse('File not found', { status: 404 });

  const content = fs.readFileSync(p, 'utf8');
  return new NextResponse(content, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
