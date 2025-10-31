import "jsr:@supabase/functions-js/edge-runtime.d.ts";
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

    // Convert blob to base64 for AI processing
    const arrayBuffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const base64 = btoa(String.fromCharCode(...bytes));

    console.log('Extracting text from PDF...');

    // Extract text using AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

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
            role: 'system',
            content: 'Extract all text content from this PDF document. Return the text in a structured format, preserving sections and headings.'
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Please extract all text from this document.'
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
      console.error('AI extraction error:', extractResponse.status, errorText);
      throw new Error(`AI extraction failed: ${extractResponse.status}`);
    }

    const extractResult = await extractResponse.json();
    const extractedText = extractResult.choices[0].message.content;

    console.log('Text extracted, chunking document...');

    // Chunk the document (split into ~500 word chunks)
    const chunks = chunkText(extractedText, 500);
    console.log(`Created ${chunks.length} chunks`);

    // Generate embeddings for each chunk
    console.log('Generating embeddings...');
    const chunksWithEmbeddings = await Promise.all(
      chunks.map(async (content, index) => {
        const embeddingResponse = await fetch('https://ai.gateway.lovable.dev/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: content,
          }),
        });

        if (!embeddingResponse.ok) {
          throw new Error(`Embedding generation failed for chunk ${index}`);
        }

        const embeddingResult = await embeddingResponse.json();
        const embedding = embeddingResult.data[0].embedding;

        return {
          content,
          embedding,
          chunk_index: index,
        };
      })
    );

    // Store chunks with embeddings
    if (isRegulation && regulationId) {
      const chunksToInsert = chunksWithEmbeddings.map(chunk => ({
        regulation_id: regulationId,
        content: chunk.content,
        embedding: JSON.stringify(chunk.embedding),
        chunk_index: chunk.chunk_index,
      }));

      const { error: insertError } = await supabase
        .from('regulation_chunks')
        .insert(chunksToInsert);

      if (insertError) {
        console.error('Error inserting regulation chunks:', insertError);
        throw insertError;
      }
    } else {
      const chunksToInsert = chunksWithEmbeddings.map(chunk => ({
        submission_id: submissionId,
        content: chunk.content,
        embedding: JSON.stringify(chunk.embedding),
        chunk_index: chunk.chunk_index,
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