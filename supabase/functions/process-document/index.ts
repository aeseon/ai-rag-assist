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

    // Step 1: Lightweight ASCII extraction
    const latin1 = new TextDecoder('latin1').decode(bytes);
    const visibleSpans = latin1.match(/[ -~]{4,}/g) || [];
    let extractedText = visibleSpans.join(' ').replace(/\s+/g, ' ').trim();

    // 🚨 Force AI OCR fallback: Ignore ASCII extraction result
    extractedText = '';

    let hasTextContent = true;
    let noTextReason = '';

    // Step 2: AI OCR fallback when ASCII extraction fails (typical for Korean PDFs)
    if (!extractedText || extractedText.length < 50) {
      console.warn('ASCII extraction insufficient. Trying AI OCR fallback...');
      console.warn('ASCII extraction yielded insufficient text. Trying AI OCR fallback...');
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      if (LOVABLE_API_KEY) {
        try {
          // Encode full PDF as base64 for the AI gateway
          const base64 = btoa(String.fromCharCode(...bytes));
          const extractResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash',
              messages: [
                {
                  role: 'user',
                  content: [
                    {
                      type: 'text',
                      text: '당신은 의료기기 심사 문서 OCR 시스템입니다. 이 PDF 파일(제출 문서)의 모든 한글 텍스트를 원문 구조와 줄바꿈을 최대한 유지하며 추출해 주세요. PDF 처리 실패 시 "NO_TEXT_CONTENT"만 응답하세요.'
                    },
                    {
                      type: 'image_url',
                      image_url: {
                        url: `data:application/pdf;base64,${base64}`
                      }
                    }
                  ]
                }
              ],
            }),
          });

          if (extractResponse.ok) {
            const extractResult = await extractResponse.json();
            const aiText = extractResult?.choices?.[0]?.message?.content ?? '';
            if (aiText && !/NO_TEXT_CONTENT/i.test(aiText) && aiText.trim().length >= 50) {
              extractedText = aiText.trim();
              hasTextContent = true;
              noTextReason = '';
              console.log(`AI OCR extracted ~${extractedText.length} characters.`);
            } else {
              hasTextContent = false;
              console.warn('AI OCR indicates no text content or too short output.');
            }
          } else {
            const errText = await extractResponse.text();
            console.error('AI OCR request failed:', extractResponse.status, errText);
            hasTextContent = false;
          }
        } catch (e) {
          console.error('AI OCR fallback error:', e);
          hasTextContent = false;
        }
      } else {
        console.warn('LOVABLE_API_KEY not configured; skipping AI OCR fallback.');
        hasTextContent = false;
      }
    }

    // Step 3: Final validation and failure handling
    if (!hasTextContent) {
      noTextReason = 'PDF에서 텍스트 추출 및 AI OCR 처리에 실패했습니다. 파일이 스캔본이거나 비표준 형식일 수 있습니다.';
      extractedText = '';
      console.warn('PDF contains no extractable text, aborting chunking.');
    } else if (extractedText.length < 50) {
      hasTextContent = false;
      noTextReason = 'AI OCR에서 추출된 유효 텍스트가 50자 미만입니다.';
      extractedText = '';
      console.warn('AI OCR returned insufficient text, aborting chunking.');
    }

    // Abort chunk processing if no valid text content
    if (extractedText.length < 50) {
      console.warn('Aborting chunk processing due to lack of valid text content.');

      // Update submission status to failed
      if (!isRegulation) {
        await supabase
          .from('submissions')
          .update({ 
            status: 'failed',
            // Optionally store reason in a metadata field if available
          })
          .eq('id', submissionId);
      }

      return new Response(
        JSON.stringify({ 
          success: false, 
          chunksProcessed: 0,
          hasTextContent: false,
          reason: noTextReason || 'No valid text content extracted',
          message: 'Document processing failed due to lack of extractable text'
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`Extracted ~${extractedText.length} characters. Has text: ${hasTextContent}`);

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