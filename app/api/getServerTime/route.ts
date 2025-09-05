import { NextRequest, NextResponse } from 'next/server'

export const GET = async (req: NextRequest) => {
  const serverTimestamp = Math.floor(Date.now() / 1000);
  return NextResponse.json({ serverTimestamp }, { status: 200 });
}