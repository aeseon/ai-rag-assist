// @deno-types="npm:@supabase/supabase-js@2"
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessRequest {
  regulationId: string;
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

    const { regulationId } = await req.json() as ProcessRequest;
    
    console.log('Processing regulation:', regulationId);

    // Get regulation info
    const { data: regulation, error: regError } = await supabase
      .from('regulations')
      .select('*')
      .eq('id', regulationId)
      .single();

    if (regError || !regulation) {
      throw new Error('Regulation not found');
    }

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('regulations')
      .download(regulation.file_path);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message}`);
    }

    console.log('File downloaded, size:', fileData.size);

    // Convert to base64
    const arrayBuffer = await fileData.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    // Extract text using Lovable AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('Extracting text from PDF...');

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
                text: 'Extract all text content from this PDF document. Return only the extracted text, preserving the structure and formatting as much as possible. If the PDF contains no extractable text, respond with: NO_TEXT_CONTENT'
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

    if (!extractResponse.ok) {
      const errorText = await extractResponse.text();
      console.error('Text extraction failed:', extractResponse.status, errorText);
      throw new Error(`Text extraction failed: ${extractResponse.status}`);
    }

    const extractResult = await extractResponse.json();
    let textContent = extractResult.choices[0].message.content;

    let hasTextContent = true;
    let noTextReason = null;

    if (textContent.includes('NO_TEXT_CONTENT')) {
      hasTextContent = false;
      noTextReason = '해당 PDF는 텍스트 정보를 포함하지 않습니다. 이미지 기반 PDF이거나 스캔된 문서일 수 있습니다.';
      textContent = `[텍스트 없음] ${regulation.title}\n\n${noTextReason}\n\n대체 근거: 본 규정은 ${regulation.category} 카테고리에 속하며, 제출 시 해당 규정의 요구사항을 준수해야 합니다.`;
      console.log('No text content found in PDF');
    }

    console.log('Text extracted, length:', textContent.length);

    // Split into chunks (approx 1000 chars each)
    const chunkSize = 1000;
    const chunks: string[] = [];
    
    for (let i = 0; i < textContent.length; i += chunkSize) {
      chunks.push(textContent.substring(i, i + chunkSize));
    }

    console.log(`Created ${chunks.length} chunks`);

    // Delete existing chunks
    await supabase
      .from('regulation_chunks')
      .delete()
      .eq('regulation_id', regulationId);

    // Store chunks
    const chunksToInsert = chunks.map((content, index) => ({
      regulation_id: regulationId,
      content: hasTextContent ? content : `${content}\n\n[사유: ${noTextReason}]`,
      chunk_index: index,
    }));

    const { error: insertError } = await supabase
      .from('regulation_chunks')
      .insert(chunksToInsert);

    if (insertError) {
      console.error('Error inserting chunks:', insertError);
      throw insertError;
    }

    console.log('Regulation processing complete');

    return new Response(
      JSON.stringify({ 
        success: true, 
        chunks: chunks.length,
        hasTextContent
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing regulation:', error);
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
