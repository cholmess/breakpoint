import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // Try to load from prompt-suite.json first, then suite.json
    const paths = [
      path.join(process.cwd(), 'data', 'prompts', 'prompt-suite.json'),
      path.join(process.cwd(), 'data', 'prompts', 'suite.json'),
    ];

    let filePath: string | null = null;
    for (const p of paths) {
      if (fs.existsSync(p)) {
        filePath = p;
        break;
      }
    }

    if (!filePath) {
      return NextResponse.json({ 
        families: [],
        prompts: []
      }, { status: 200 });
    }

    let fileContents = fs.readFileSync(filePath, 'utf-8');
    // Strip BOM if present
    if (fileContents.charCodeAt(0) === 0xFEFF) {
      fileContents = fileContents.slice(1);
    }
    const data = JSON.parse(fileContents);

    // Extract unique prompt families
    const families = new Set<string>();
    if (Array.isArray(data)) {
      data.forEach((prompt: any) => {
        if (prompt.family) {
          families.add(prompt.family);
        }
      });
    } else if (data.prompts && Array.isArray(data.prompts)) {
      data.prompts.forEach((prompt: any) => {
        if (prompt.family) {
          families.add(prompt.family);
        }
      });
    }

    return NextResponse.json({
      families: Array.from(families).sort(),
      prompts: data.prompts || data || [],
    });
  } catch (error) {
    console.error('Error reading prompts:', error);
    return NextResponse.json({ 
      families: [],
      prompts: []
    }, { status: 200 });
  }
}

