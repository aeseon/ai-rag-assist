import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalyzeRequest {
  submissionId: string;
}

interface AnalysisIssue {
  category: string;
  severity: 'error' | 'warning' | 'info';
  title: string;
  description: string;
  location?: string;
  suggestion?: string;
  regulation?: string;
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

    const { submissionId } = await req.json() as AnalyzeRequest;
    
    console.log('Starting RAG analysis for submission:', submissionId);

    // Get submission chunks with embeddings
    const { data: submissionChunks, error: chunksError } = await supabase
      .from('submission_chunks')
      .select('content, embedding')
      .eq('submission_id', submissionId)
      .order('chunk_index');

    if (chunksError || !submissionChunks || submissionChunks.length === 0) {
      throw new Error('Failed to retrieve submission chunks');
    }

    console.log(`Retrieved ${submissionChunks.length} submission chunks`);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // For each submission chunk, find similar regulation chunks
    const allIssues: AnalysisIssue[] = [];
    
    for (const submissionChunk of submissionChunks) {
      console.log('Analyzing chunk...');
      
      // Parse embedding (stored as JSON string)
      const embedding = typeof submissionChunk.embedding === 'string' 
        ? JSON.parse(submissionChunk.embedding)
        : submissionChunk.embedding;

      // Search for similar regulation chunks
      const { data: similarRegulations, error: searchError } = await supabase
        .rpc('search_similar_regulations', {
          query_embedding: embedding,
          match_threshold: 0.6,
          match_count: 5
        });

      if (searchError) {
        console.error('Error searching similar regulations:', searchError);
        continue;
      }

      if (!similarRegulations || similarRegulations.length === 0) {
        console.log('No similar regulations found for chunk');
        continue;
      }

      // Use AI to compare submission chunk with relevant regulation chunks
      const regulationContext = similarRegulations
        .map((reg: any) => `[Regulation] ${reg.content}`)
        .join('\n\n');

      const analysisPrompt = `You are a medical device regulation compliance expert. Analyze the following medical device submission content against relevant regulations and identify any compliance issues.

Submission Content:
${submissionChunk.content}

Relevant Regulations:
${regulationContext}

Analyze the submission for compliance with the regulations. For each issue found, provide:
1. Category (e.g., "Safety Requirements", "Documentation", "Testing", "Labeling")
2. Severity (error, warning, or info)
3. Title (brief description)
4. Description (detailed explanation)
5. Location (section or part of submission)
6. Suggestion (how to fix)
7. Regulation (which regulation is violated)

Return the analysis as a JSON array of issues. If no issues are found, return an empty array.
Format: [{"category": "...", "severity": "...", "title": "...", "description": "...", "location": "...", "suggestion": "...", "regulation": "..."}]`;

      const analysisResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
              content: 'You are a medical device regulation compliance expert. Analyze submissions and return findings as valid JSON arrays only.'
            },
            {
              role: 'user',
              content: analysisPrompt
            }
          ],
        }),
      });

      if (!analysisResponse.ok) {
        console.error('AI analysis failed:', analysisResponse.status);
        continue;
      }

      const analysisResult = await analysisResponse.json();
      const analysisText = analysisResult.choices[0].message.content;

      // Extract JSON from response
      const jsonMatch = analysisText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          const issues = JSON.parse(jsonMatch[0]) as AnalysisIssue[];
          allIssues.push(...issues);
        } catch (parseError) {
          console.error('Failed to parse AI response:', parseError);
        }
      }
    }

    console.log(`Analysis complete. Found ${allIssues.length} issues`);

    // Determine overall status
    const hasErrors = allIssues.some(issue => issue.severity === 'error');
    const hasWarnings = allIssues.some(issue => issue.severity === 'warning');
    const overallStatus = hasErrors ? 'non_compliant' : hasWarnings ? 'needs_review' : 'compliant';

    // Store analysis results
    const { data: analysisResult, error: resultError } = await supabase
      .from('analysis_results')
      .insert({
        submission_id: submissionId,
        overall_status: overallStatus,
      })
      .select()
      .single();

    if (resultError || !analysisResult) {
      throw new Error('Failed to store analysis result');
    }

    // Store individual issues
    if (allIssues.length > 0) {
      const issuesToInsert = allIssues.map(issue => ({
        analysis_result_id: analysisResult.id,
        category: issue.category,
        severity: issue.severity,
        title: issue.title,
        description: issue.description,
        location: issue.location || null,
        suggestion: issue.suggestion || null,
        regulation: issue.regulation || null,
      }));

      const { error: issuesError } = await supabase
        .from('analysis_issues')
        .insert(issuesToInsert);

      if (issuesError) {
        console.error('Error storing issues:', issuesError);
      }
    }

    // Update submission status
    const { error: updateError } = await supabase
      .from('submissions')
      .update({ status: 'completed' })
      .eq('id', submissionId);

    if (updateError) {
      console.error('Error updating submission status:', updateError);
    }

    console.log('Analysis stored successfully');

    return new Response(
      JSON.stringify({ 
        success: true,
        analysisId: analysisResult.id,
        overallStatus,
        issuesFound: allIssues.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error analyzing submission:', error);
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