import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'output', 'analysis.json');
    
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ configs: {} }, { status: 200 });
    }
    
    const fileContents = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(fileContents);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error reading analysis.json:', error);
    return NextResponse.json({ configs: {} }, { status: 200 });
  }
}

