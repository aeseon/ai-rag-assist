// @deno-types="npm:@supabase/supabase-js@2"
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalyzeRequest {
  submissionId: string;
}

interface Citation {
  doc_id: string;
  title: string;
  category: string;
  version?: string;
  effective_date?: string;
  status: string;
  section_path?: string;
  snippet: string;
  score?: number;
}

interface AnalysisIssue {
  issue_code?: string;
  category: string;
  severity: 'error' | 'warning' | 'info';
  title: string;
  description: string;
  location?: string;
  suggestion?: string;
  regulation?: string;
  submission_highlight?: string;
  regulation_highlight?: string;
  regulation_id?: string;
  regulation_title?: string;
  regulation_category?: string;
  regulation_version?: string;
  regulation_effective_date?: string;
  regulation_status?: string;
  citations?: Citation[];
  rule_based_alert?: {
    message: string;
    severity: string;
  };
  notes?: string;
}

interface RuleIssue {
  rule: string;
  severity: 'high' | 'medium' | 'low';
  msg: string;
  suggest: string;
}

// Rule-based filtering functions
function ruleSterileConflict(text: string): RuleIssue[] {
  const issues: RuleIssue[] = [];
  if (!text) return issues;
  
  const hasSterile = /멸균/.test(text);
  const hasNonSterile = /비멸균|무멸균/.test(text);
  
  if (hasSterile && hasNonSterile) {
    issues.push({
      rule: "의료기기법 시행규칙 제28조(제조허가 등)",
      severity: "high",
      msg: "작용원리에 멸균/비멸균 문구가 혼재되어 있습니다. 실제 공급상태와 일치하도록 단일화 필요.",
      suggest: "작용원리·라벨·IFU에서 '멸균' 또는 '비멸균' 하나로 통일하여 표기하고 관련 문구를 일괄 정정하세요."
    });
  }
  
  return issues;
}

function ruleUnits(text: string): RuleIssue[] {
  const issues: RuleIssue[] = [];
  if (!text) return issues;
  
  const headerMm = /단위\s*[:：]?\s*mm/i.test(text);
  const hasCmOrM = /\d+(\.\d+)?\s*(cm|㎝|m(?!m))/.test(text);
  
  if (headerMm && hasCmOrM) {
    issues.push({
      rule: "의료기기 기술문서 등의 심사에 관한 규정 별표1",
      severity: "medium",
      msg: "치수 표 상단은 mm로 표기되어 있으나 본문 값에 cm/m가 혼용되어 있습니다.",
      suggest: "모든 치수를 mm로 환산하여 통일 기재하세요. 예) 2.5 cm → 25 mm, 1.8 m → 1800 mm."
    });
  }
  
  return issues;
}

function ruleMaterials(materialText: string, warningsText: string = ""): RuleIssue[] {
  const issues: RuleIssue[] = [];
  if (!materialText) return issues;
  
  // Latex allergy warning
  const hasLatex = /latex|라텍스|rubber\s*latex/i.test(materialText);
  if (hasLatex) {
    const warnHasLatex = /알레르기|라텍스/i.test(warningsText);
    if (!warnHasLatex) {
      issues.push({
        rule: "의료기기 사용설명서 작성 및 심사에 관한 규정 제5조",
        severity: "high",
        msg: "원재료에 천연고무 라텍스가 포함되었으나 알레르기 주의 문구가 누락되었습니다.",
        suggest: "주의사항에 '본 제품에는 천연고무 라텍스가 포함되어 민감자에게 알레르기 반응을 유발할 수 있음'을 추가하세요."
      });
    }
  }
  
  // Menthol CAS number
  if (/menthol|멘솔/i.test(materialText)) {
    const hasCasLine = /CAS\s*번호.*\d/.test(materialText);
    if (!hasCasLine) {
      issues.push({
        rule: "의료기기 기술문서 등의 심사에 관한 규정 제6조",
        severity: "medium",
        msg: "Menthol 기재는 있으나 CAS 번호가 누락되었을 가능성이 있습니다.",
        suggest: "Menthol CAS 번호(예: 89-78-1 등)를 확인하여 원재료 표에 기재하세요."
      });
    }
  }
  
  // Percentage sum check
  const percentages = Array.from(materialText.matchAll(/(\d{1,3}(?:\.\d+)?)\s*%/g))
    .map(m => parseFloat(m[1]));
  if (percentages.length > 0) {
    const sum = percentages.reduce((a, b) => a + b, 0);
    if (sum < 99.5 || sum > 100.5) {
      issues.push({
        rule: "의료기기 기술문서 등의 심사에 관한 규정 별표1",
        severity: "medium",
        msg: `원재료(%) 합계가 100%와 불일치할 가능성(${sum.toFixed(1)}%)이 있습니다.`,
        suggest: "함량 합계를 재검토하여 100%가 되도록 조정·정정하세요(중복/중첩 기재 여부 확인)."
      });
    }
  }
  
  // Contact information
  const hasContact = /접촉|피부|인체접촉/.test(materialText);
  if (!hasContact) {
    issues.push({
      rule: "의료기기 기술문서 등의 심사에 관한 규정 별표1",
      severity: "low",
      msg: "원재료 표의 접촉부위/인체접촉 여부 기재가 미흡합니다.",
      suggest: "각 원재료의 인체 접촉 여부 및 접촉 부위를 비고란에 명확히 기재하세요."
    });
  }
  
  // Generic name for brand names
  const brandPattern = /(벨크로|밸크로|Velcro|3M\s*\d{3,4})/gi;
  const brandMatches = Array.from(materialText.matchAll(brandPattern));
  for (const match of brandMatches) {
    const start = match.index || 0;
    const window = materialText.substring(start, start + 200);
    const hasGeneric = /(일반명|화학명|CAS\s*번호)/i.test(window);
    if (!hasGeneric) {
      issues.push({
        rule: "의료기기 기술문서 등의 심사에 관한 규정 제6조",
        severity: "medium",
        msg: `상표/제품명('${match[0]}')이 기재되었으나 인접 구간에 원재료명(일반명/화학명) 또는 CAS 번호가 확인되지 않습니다.`,
        suggest: "상표/제품명과 함께 원재료명(일반명/화학명) 및 CAS 번호를 명확히 기재하세요. 예: Nylon(Polyamide), CAS 25038-54-4."
      });
    }
  }
  
  // Additive purpose
  const needsPurpose = /(pigment|dye|색소|Titanium\s*Dioxide)/i.test(materialText);
  const hasPurpose = /(착색제|자외선차단제|안정화제|유화제|분산제|보존제|가교제|가소제|개시제|윤활제|촉매제|항산화제)/.test(materialText);
  if (needsPurpose && !hasPurpose) {
    issues.push({
      rule: "의료기기 기술문서 등의 심사에 관한 규정 별표1",
      severity: "medium",
      msg: "첨가제/색소 항목의 비고란에 첨가목적(예: 착색제, 자외선차단제 등) 기재가 누락되었습니다.",
      suggest: "해당 원재료 행 비고란에 첨가목적을 명시하세요."
    });
  }
  
  // Completeness checks
  const hasGenericName = /(일반명|화학명|CAS\s*[:\s]*\d{2,})/i.test(materialText);
  if (!hasGenericName) {
    issues.push({
      rule: "의료기기 기술문서 등의 심사에 관한 규정 제6조",
      severity: "medium",
      msg: "원재료명 또는 성분명란에 일반명/화학명/CAS 기재가 불충분합니다.",
      suggest: "예: 일반명 Nylon / 화학명 Polyamide / CAS 25038-54-4 형태로 기재하세요."
    });
  }
  
  const hasSpec = /(KS|ASTM|ISO)\s*[\w\-\.]+/i.test(materialText) || /자사규격/.test(materialText);
  if (!hasSpec) {
    issues.push({
      rule: "의료기기 기술문서 등의 심사에 관한 규정 별표1",
      severity: "medium",
      msg: "규격란에 KS/ASTM/ISO 등 공인 규격 또는 자사규격 기재가 필요합니다.",
      suggest: "관련 규격이 없으면 '자사규격'을, 있으면 KS/ASTM/ISO 규격번호를 기재하세요."
    });
  }
  
  return issues;
}

function ruleInstructions(text: string): RuleIssue[] {
  const issues: RuleIssue[] = [];
  if (!text) return issues;
  
  const confirmCount = (text.match(/확인/g) || []).length;
  if (confirmCount >= 3) {
    issues.push({
      rule: "의료기기 사용설명서 작성 및 심사에 관한 규정 제4조",
      severity: "low",
      msg: "사용 전 준비/확인 문구가 중복되어 간결성이 떨어질 수 있습니다.",
      suggest: "중복되는 '확인' 중심 문장을 통합해 간결화하세요. (예: 포장/손상/청결 확인을 1개 항목으로 통합)"
    });
  }
  
  const hasSingleUse = /일회용|재사용\s*금지/.test(text);
  if (!hasSingleUse) {
    issues.push({
      rule: "의료기기 사용설명서 작성 및 심사에 관한 규정 제5조",
      severity: "medium",
      msg: "일회용/재사용 금지 원칙이 명확히 기재되어야 합니다.",
      suggest: "'본 제품은 일회용으로 재사용하지 않습니다(재사용 금지).' 문구를 명확히 기재하세요."
    });
  }
  
  return issues;
}

function ruleProhibitedTerms(text: string): RuleIssue[] {
  const issues: RuleIssue[] = [];
  if (!text) return issues;
  
  // Check for prohibited term '보호대'
  if (text.includes('보호대')) {
    issues.push({
      rule: "의료기기법 시행규칙 제45조 별표 7 제1호~10호",
      severity: "high",
      msg: "신고서류 외형 파일에서 사용 불가 단어 '보호대'가 존재하는 것으로 확인됩니다.",
      suggest: "명칭 내 사용 불가 단어가 포함되어 있습니다. 의료기기법 시행규칙 제45조(별표 7 제1호~10호)를 확인하시고, 사용 불가 단어를 제거하신 후 제출하시기 바랍니다."
    });
  }
  
  return issues;
}

function runRuleBasedFiltering(submissionText: string): AnalysisIssue[] {
  const ruleIssues: RuleIssue[] = [];
  
  // Run all rule checks
  ruleIssues.push(...ruleSterileConflict(submissionText));
  ruleIssues.push(...ruleUnits(submissionText));
  ruleIssues.push(...ruleMaterials(submissionText, submissionText));
  ruleIssues.push(...ruleInstructions(submissionText));
  ruleIssues.push(...ruleProhibitedTerms(submissionText));
  
  // Convert rule issues to analysis issues
  return ruleIssues.map(issue => {
    const severityMap: Record<string, 'error' | 'warning' | 'info'> = {
      high: 'error',
      medium: 'warning',
      low: 'info'
    };
    
    return {
      category: "규정 준수",
      severity: severityMap[issue.severity] || 'warning',
      title: issue.msg,
      description: `${issue.msg}\n\n${issue.suggest}`,
      location: "문서 전체",
      suggestion: issue.suggest,
      regulation: issue.rule,
      submission_highlight: undefined,
      regulation_highlight: issue.rule,
      regulation_id: undefined,
      regulation_title: issue.rule,
      regulation_category: "의료기기법 및 하위 규정",
      regulation_version: undefined,
      regulation_effective_date: undefined,
      regulation_status: "active"
    };
  });
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

    // Get all regulation chunks with metadata
    const { data: regulationChunks, error: regError } = await supabase
      .from('regulation_chunks')
      .select(`
        content,
        chunk_index,
        regulation_id,
        regulations (
          id,
          title,
          category,
          version,
          effective_date,
          status
        )
      `)
      .order('chunk_index');

    if (regError || !regulationChunks || regulationChunks.length === 0) {
      console.log('No regulation data found, proceeding with general analysis');
    }

    // Build regulation text with metadata
    const regulationsByIdMap = new Map();
    const regulationTextParts: string[] = [];
    
    regulationChunks?.forEach(chunk => {
      const reg = (chunk as any).regulations;
      if (reg && !regulationsByIdMap.has(reg.id)) {
        regulationsByIdMap.set(reg.id, reg);
        regulationTextParts.push(
          `\n[규정 ID: ${reg.id}]\n` +
          `제목: ${reg.title}\n` +
          `카테고리: ${reg.category}\n` +
          `버전: ${reg.version || 'N/A'}\n` +
          `시행일: ${reg.effective_date || 'N/A'}\n` +
          `상태: ${reg.status}\n` +
          `--- 내용 시작 ---`
        );
      }
      regulationTextParts.push(chunk.content);
    });

    const regulationText = regulationTextParts.length > 0 
      ? regulationTextParts.join('\n\n') 
      : 'No regulation data available.';

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('Running rule-based filtering...');
    
    // Step 1: Rule-based filtering
    const ruleBasedIssues = runRuleBasedFiltering(submissionText);
    console.log(`Rule-based filtering found ${ruleBasedIssues.length} issues`);

    console.log('Analyzing submission with AI...');

    // Step 2: Use RAG-enhanced AI analysis to compare submission with regulations
    const analysisPrompt = `You are a medical device regulation compliance expert with RAG (Retrieval-Augmented Generation) capabilities. 

Your task: Analyze the medical device submission against relevant regulations and generate detailed compliance findings with citations.

Submission Content:
${submissionText.substring(0, 15000)} ${submissionText.length > 15000 ? '...(truncated)' : ''}

Relevant Regulations Database:
${regulationText.substring(0, 12000)} ${regulationText.length > 12000 ? '...(truncated)' : ''}

For EACH compliance issue found, provide a comprehensive analysis with the following structure:

1. **issue_code**: Unique identifier (e.g., "missing_regulatory_data", "sterile_conflict", "unit_mismatch")
2. **category**: Classification (e.g., "규정 준수", "안전 요건", "문서화", "시험", "표시사항")
3. **severity**: "error" | "warning" | "info"
4. **title**: Brief description of the issue
5. **description**: Detailed explanation (2-3 sentences)
6. **location**: Specific section/part of submission where issue occurs
7. **suggestion**: Actionable fix recommendation
8. **submission_highlight**: EXACT quoted text from submission (max 200 chars) showing the issue
9. **regulation_highlight**: EXACT quoted text from regulation (max 200 chars) serving as basis
10. **regulation_id**: The UUID from [규정 ID: ...] markers
11. **regulation_title**: Title from regulation metadata
12. **regulation_category**: Category from regulation metadata
13. **regulation_version**: Version from regulation metadata
14. **regulation_effective_date**: Effective date from regulation metadata
15. **regulation_status**: Status from regulation metadata
16. **citations**: Array of detailed citation objects, each containing:
    - doc_id: regulation_id
    - title: regulation title
    - category: regulation category
    - version: regulation version
    - effective_date: effective date
    - status: regulation status
    - section_path: specific section/article path (e.g., "제3장 제출서류 요건/제12조")
    - snippet: relevant excerpt (100-200 characters)
    - score: relevance score (0.0-1.0, estimate based on how directly it relates)
17. **notes**: Additional context or special considerations

**CRITICAL REQUIREMENTS:**
- Extract EXACT text for highlights - these are evidence shown to users
- Match regulation content to [규정 ID: ...] metadata sections
- Provide multiple citations if multiple regulation sections apply
- Estimate relevance scores based on directness of relation
- Include section_path for precise location in regulation documents
- For text-free PDFs, include notes about text extraction issues

**OUTPUT FORMAT:**
Return valid JSON array only. No explanatory text before or after.
[
  {
    "issue_code": "...",
    "category": "...",
    "severity": "error"|"warning"|"info",
    "title": "...",
    "description": "...",
    "location": "...",
    "suggestion": "...",
    "submission_highlight": "...",
    "regulation_highlight": "...",
    "regulation_id": "...",
    "regulation_title": "...",
    "regulation_category": "...",
    "regulation_version": "...",
    "regulation_effective_date": "...",
    "regulation_status": "...",
    "citations": [
      {
        "doc_id": "...",
        "title": "...",
        "category": "...",
        "version": "...",
        "effective_date": "...",
        "status": "...",
        "section_path": "...",
        "snippet": "...",
        "score": 0.85
      }
    ],
    "notes": "..."
  }
]

If no issues are found, return empty array: []`;

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
            content: 'You are a medical device regulation compliance expert with RAG capabilities. Analyze medical device submissions against regulations and return detailed findings with citations as valid JSON arrays only. Always include exact text highlights and comprehensive citation information with relevance scores.'
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
    let aiIssues: AnalysisIssue[] = [];
    
    if (jsonMatch) {
      try {
        aiIssues = JSON.parse(jsonMatch[0]) as AnalysisIssue[];
      } catch (parseError) {
        console.error('Failed to parse AI response:', parseError);
      }
    }

    console.log(`AI analysis found ${aiIssues.length} issues`);
    
    // Combine rule-based and AI-based issues
    const allIssues = [...ruleBasedIssues, ...aiIssues];
    console.log(`Total issues found: ${allIssues.length} (${ruleBasedIssues.length} from rules, ${aiIssues.length} from AI)`);

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
        regulation_id: issue.regulation_id || null,
        regulation_title: issue.regulation_title || null,
        regulation_category: issue.regulation_category || null,
        regulation_version: issue.regulation_version || null,
        regulation_effective_date: (issue.regulation_effective_date && issue.regulation_effective_date !== 'N/A') ? issue.regulation_effective_date : null,
        regulation_status: issue.regulation_status || null,
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