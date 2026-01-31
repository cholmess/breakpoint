import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'output', 'distributions.json');
    
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ 
        by_failure_mode: {}, 
        by_prompt_family: {} 
      }, { status: 200 });
    }
    
    const fileContents = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(fileContents);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error reading distributions.json:', error);
    return NextResponse.json({ 
      by_failure_mode: {}, 
      by_prompt_family: {} 
    }, { status: 200 });
  }
}

