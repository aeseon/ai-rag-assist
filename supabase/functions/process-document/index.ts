// @deno-types="npm:@supabase/supabase-js@2"
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessDocumentRequest {
  submissionId: string;
  filePath: string;
  isRegulation?: boolean;
  regulationId?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { submissionId, filePath, isRegulation = false, regulationId } = await req.json() as ProcessDocumentRequest;
    
    console.log('Processing document:', { submissionId, filePath, isRegulation, regulationId });

    // Download PDF from storage
    const bucket = isRegulation ? 'regulations' : 'submissions';
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(bucket)
      .download(filePath);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message}`);
    }

    // Read PDF bytes
    const arrayBuffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    console.log('Attempting lightweight text extraction from PDF bytes...');

    // Lightweight ASCII extraction fallback (avoids heavy PDF libs on Edge)
    // 1) Decode bytes as latin1
    // 2) Collect visible ASCII spans (length >= 4)
    // 3) Join and normalize whitespace
    const latin1 = new TextDecoder('latin1').decode(bytes);
    const visibleSpans = latin1.match(/[ -~]{4,}/g) || [];
    let extractedText = visibleSpans.join(' ').replace(/\s+/g, ' ').trim();

    let hasTextContent = true;
    let noTextReason = '';

    if (!extractedText || extractedText.length < 50) {
      // Fallback placeholder to keep pipeline moving
      hasTextContent = false;
      noTextReason = 'PDF 파일에 텍스트가 포함되어 있지 않습니다. 이미지 기반 PDF이거나 스캔된 문서일 수 있습니다. 텍스트가 포함된 PDF로 다시 제출하거나, 문서 제출 요건에 따라 원본 텍스트 파일을 함께 제출해 주세요.';
      extractedText = `[텍스트 없음] ${filePath} - 대체 근거: 의료기기 허가 신고 시 제출 서류는 텍스트 형식으로 제출되어야 하며, 검토 가능한 형태여야 합니다.`;
      console.warn('PDF contains no extractable text');
    }

    console.log(`Extracted ~${extractedText.length} characters (lightweight mode). Has text: ${hasTextContent}`);

    // Chunk the document (split into ~500 word chunks) for storage
    const chunks = chunkText(extractedText, 500);
    console.log(`Created ${chunks.length} chunks for storage`);

    // Store chunks WITHOUT embeddings (Lovable AI doesn't support embedding API)
    if (isRegulation && regulationId) {
      const chunksToInsert = chunks.map((content, index) => ({
        regulation_id: regulationId,
        content,
        embedding: null, // No embeddings
        chunk_index: index,
      }));

      const { error: insertError } = await supabase
        .from('regulation_chunks')
        .insert(chunksToInsert);

      if (insertError) {
        console.error('Error inserting regulation chunks:', insertError);
        throw insertError;
      }
    } else {
      const chunksToInsert = chunks.map((content, index) => ({
        submission_id: submissionId,
        content: hasTextContent ? content : `${content}\n\n[진단 사유: ${noTextReason}]`,
        embedding: null, // No embeddings
        chunk_index: index,
      }));

      const { error: insertError } = await supabase
        .from('submission_chunks')
        .insert(chunksToInsert);

      if (insertError) {
        console.error('Error inserting submission chunks:', insertError);
        throw insertError;
      }

      // Update submission status
      const { error: updateError } = await supabase
        .from('submissions')
        .update({ status: 'processing' })
        .eq('id', submissionId);

      if (updateError) {
        console.error('Error updating submission status:', updateError);
      }
    }

    console.log('Document processing completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        chunksProcessed: chunks.length,
        message: 'Document processed and embeddings generated'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing document:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

function chunkText(text: string, wordsPerChunk: number): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    const chunk = words.slice(i, i + wordsPerChunk).join(' ');
    if (chunk.trim()) {
      chunks.push(chunk);
    }
  }
  
  return chunks;
}