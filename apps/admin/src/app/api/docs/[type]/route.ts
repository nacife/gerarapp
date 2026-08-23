import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest, { params }: { params: { type: string } }) {
  const type = params.type;
  if (type !== 'usuario' && type !== 'tecnico') {
    return new NextResponse('Not found', { status: 404 });
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/v1';
  const res = await fetch(`${apiUrl}/auth/me`, {
    headers: { Cookie: req.headers.get('cookie') || '' },
  });

  if (!res.ok) return new NextResponse('Unauthorized', { status: 401 });

  const me = await res.json();
  if (type === 'tecnico' && me.role !== 'admin' && me.role !== 'super_admin') {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const p = path.join(
    process.cwd(),
    `../../docs/MANUAL_${type === 'usuario' ? 'USUARIO' : 'TECNICO'}.md`,
  );
  if (!fs.existsSync(p)) return new NextResponse('File not found', { status: 404 });

  const content = fs.readFileSync(p, 'utf8');
  return new NextResponse(content, { headers: { 'Content-Type': 'text/plain' } });
}
