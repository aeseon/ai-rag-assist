// @deno-types="npm:@supabase/supabase-js@2"
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
  submission_highlight?: string;
  regulation_highlight?: string;
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
    
    console.log('Starting direct comparison analysis for submission:', submissionId);

    // Get submission chunks (no embeddings needed)
    const { data: submissionChunks, error: chunksError } = await supabase
      .from('submission_chunks')
      .select('content')
      .eq('submission_id', submissionId)
      .order('chunk_index');

    if (chunksError) {
      console.error('Database error fetching chunks:', chunksError);
      throw new Error(`Database error: ${chunksError.message}`);
    }

    if (!submissionChunks || submissionChunks.length === 0) {
      console.error('No chunks found for submission:', submissionId);
      const { data: submission } = await supabase
        .from('submissions')
        .select('id, status')
        .eq('id', submissionId)
        .single();
      
      console.log('Submission status:', submission);
      throw new Error(`No submission chunks found. The document may still be processing or failed to process.`);
    }

    console.log(`Retrieved ${submissionChunks.length} submission chunks`);

    // Combine all submission chunks into full text
    const submissionText = submissionChunks.map(c => c.content).join('\n\n');

    // Get all regulation chunks
    const { data: regulationChunks, error: regError } = await supabase
      .from('regulation_chunks')
      .select('content')
      .order('chunk_index');

    if (regError || !regulationChunks || regulationChunks.length === 0) {
      console.log('No regulation data found, proceeding with general analysis');
    }

    const regulationText = regulationChunks?.map(c => c.content).join('\n\n') || 'No regulation data available.';

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('Analyzing submission with AI...');

    // Use AI to compare submission with regulations directly
    const analysisPrompt = `You are a medical device regulation compliance expert. Analyze the following medical device submission content against relevant regulations and identify any compliance issues.

Submission Content:
${submissionText.substring(0, 15000)} ${submissionText.length > 15000 ? '...(truncated)' : ''}

Relevant Regulations:
${regulationText.substring(0, 10000)} ${regulationText.length > 10000 ? '...(truncated)' : ''}

Analyze the submission for compliance with the regulations. For each issue found, provide:
1. Category (e.g., "Safety Requirements", "Documentation", "Testing", "Labeling")
2. Severity (error, warning, or info)
3. Title (brief description)
4. Description (detailed explanation)
5. Location (section or part of submission)
6. Suggestion (how to fix)
7. Regulation (which regulation is violated)
8. submission_highlight (exact quoted text from submission that shows the issue - keep it under 200 characters)
9. regulation_highlight (exact quoted text from regulation that serves as the basis - keep it under 200 characters)

IMPORTANT: For highlights, extract the EXACT relevant text from the documents. These will be shown to users as evidence.

Return the analysis as a JSON array of issues. If no issues are found, return an empty array.
Format: [{"category": "...", "severity": "...", "title": "...", "description": "...", "location": "...", "suggestion": "...", "regulation": "...", "submission_highlight": "...", "regulation_highlight": "..."}]`;

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
      const errorText = await analysisResponse.text();
      console.error('AI analysis failed:', analysisResponse.status, errorText);
      throw new Error(`AI analysis failed: ${analysisResponse.status}`);
    }

    const aiResponse = await analysisResponse.json();
    const analysisText = aiResponse.choices[0].message.content;

    // Extract JSON from response
    const jsonMatch = analysisText.match(/\[[\s\S]*\]/);
    let allIssues: AnalysisIssue[] = [];
    
    if (jsonMatch) {
      try {
        allIssues = JSON.parse(jsonMatch[0]) as AnalysisIssue[];
      } catch (parseError) {
        console.error('Failed to parse AI response:', parseError);
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
        submission_highlight: issue.submission_highlight || null,
        regulation_highlight: issue.regulation_highlight || null,
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