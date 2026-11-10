export async function parseFile(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'txt') return await file.text();
  if (ext === 'docx') return await parseDocx(file);
  if (ext === 'pdf') return await parsePdf(file);
  throw new Error('不支持的文件格式：' + ext + '，请上传 .txt / .docx / .pdf 文件');
}

async function parseDocx(file: File): Promise<string> {
  const mammoth = await import('mammoth');
  const buffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value;
}

async function parsePdf(file: File): Promise<string> {
  const text = await file.text();
  if (text.includes('%PDF')) {
    const clean = text.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '')
      .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, ' ')
      .replace(/\s+/g, ' ').trim();
    if (clean.length > 50) return clean;
  }
  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('PDF读取失败'));
    reader.readAsText(file);
  });
}
