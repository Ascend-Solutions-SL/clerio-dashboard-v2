import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ error: 'gone' }, { status: 410 });
}
