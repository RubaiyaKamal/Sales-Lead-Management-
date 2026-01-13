/**
 * Standalone AI Qualification Test Script
 *
 * Tests the Claude API integration without requiring database setup.
 * Run with: npx ts-node test-ai-qualification.ts
 */

import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const ANTHROPIC_API_KEY = process.env['ANTHROPIC_API_KEY'];
const ANTHROPIC_MODEL = process.env['ANTHROPIC_MODEL'] || 'claude-3-sonnet-20240229';

if (!ANTHROPIC_API_KEY) {
  console.error('❌ Error: ANTHROPIC_API_KEY not found in .env file');
  process.exit(1);
}

// Mock lead data for testing
const mockLead = {
  id: 'test-lead-123',
  name: 'Jane Smith',
  email: 'jane.smith@techstartup.com',
  phone: '+14155551234',
  company: 'TechStartup Inc',
  lead_source: 'website',
  metadata: {
    utm_campaign: 'enterprise-trial-2024',
    utm_source: 'google',
    utm_medium: 'cpc',
    initial_message: 'We need a CRM solution for our growing sales team of 25 people. Looking to implement within the next 2 months. Budget allocated: $50k annually.',
    company_size: '50-100 employees',
    industry: 'Technology',
  }
};

const BANT_SYSTEM_PROMPT = `You are an expert sales qualification analyst specializing in the BANT (Budget, Authority, Need, Timeline) methodology.

Your task is to analyze lead information and provide a structured qualification score across four dimensions:

1. **Budget** (0-25 points): Does the lead have allocated budget or financial capacity?
2. **Authority** (0-25 points): Is the lead a decision-maker or influencer?
3. **Need** (0-25 points): Does the lead have a clear business need?
4. **Timeline** (0-25 points): Is there urgency to purchase?

**Output**: Provide a JSON response with the following structure (IMPORTANT: respond ONLY with valid JSON, no additional text):

{
  "budget_score": <integer 0-25>,
  "authority_score": <integer 0-25>,
  "need_score": <integer 0-25>,
  "timeline_score": <integer 0-25>,
  "total_score": <sum of all scores>,
  "reasoning": "<2-3 sentences explaining the scoring rationale>",
  "confidence": <decimal 0.0-1.0 indicating confidence in this assessment>
}`;

function buildUserPrompt(lead: typeof mockLead): string {
  const parts: string[] = [];

  parts.push(`Lead Information:`);
  parts.push(`- Name: ${lead.name}`);
  parts.push(`- Email: ${lead.email}`);
  parts.push(`- Phone: ${lead.phone}`);
  parts.push(`- Company: ${lead.company}`);
  parts.push(`- Lead Source: ${lead.lead_source}`);

  if (lead.metadata) {
    parts.push(`\nAdditional Information:`);
    if (lead.metadata.utm_campaign) parts.push(`- Campaign: ${lead.metadata.utm_campaign}`);
    if (lead.metadata.initial_message) parts.push(`- Initial Message: ${lead.metadata.initial_message}`);
    if (lead.metadata.company_size) parts.push(`- Company Size: ${lead.metadata.company_size}`);
    if (lead.metadata.industry) parts.push(`- Industry: ${lead.metadata.industry}`);
  }

  parts.push(`\nPlease analyze this lead and provide BANT qualification scores.`);

  return parts.join('\n');
}

async function testQualification() {
  console.log('🧪 Testing AI Lead Qualification\n');
  console.log('📋 Lead Information:');
  console.log(`   Name: ${mockLead.name}`);
  console.log(`   Company: ${mockLead.company}`);
  console.log(`   Email: ${mockLead.email}`);
  console.log(`   Message: ${mockLead.metadata.initial_message}\n`);

  console.log('🔄 Calling Claude API...\n');

  const anthropic = new Anthropic({
    apiKey: ANTHROPIC_API_KEY,
  });

  try {
    const startTime = Date.now();

    const message = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      temperature: 0.7,
      system: BANT_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: buildUserPrompt(mockLead),
        },
      ],
    });

    const duration = Date.now() - startTime;

    // Extract response
    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

    console.log('✅ Claude API Response Received\n');
    console.log('📊 Usage Stats:');
    console.log(`   Input Tokens: ${message.usage.input_tokens}`);
    console.log(`   Output Tokens: ${message.usage.output_tokens}`);
    console.log(`   Duration: ${duration}ms\n`);

    // Parse JSON response
    let cleanedText = responseText.trim();
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.replace(/^```json\n/, '').replace(/\n```$/, '');
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```\n/, '').replace(/\n```$/, '');
    }

    const result = JSON.parse(cleanedText);

    // Display results
    console.log('🎯 BANT Qualification Results:\n');
    console.log('┌─────────────┬────────┬────────────┬─────────────┐');
    console.log('│ Dimension   │ Score  │ Percentage │ Label       │');
    console.log('├─────────────┼────────┼────────────┼─────────────┤');

    const dimensions = [
      { name: 'Budget', score: result.budget_score },
      { name: 'Authority', score: result.authority_score },
      { name: 'Need', score: result.need_score },
      { name: 'Timeline', score: result.timeline_score },
    ];

    dimensions.forEach(dim => {
      const percentage = Math.round((dim.score / 25) * 100);
      const label = dim.score <= 6 ? 'Low' : dim.score <= 13 ? 'Medium' : dim.score <= 19 ? 'High' : 'Very High';
      console.log(`│ ${dim.name.padEnd(11)} │ ${String(dim.score).padStart(2)}/25  │ ${String(percentage).padStart(3)}%       │ ${label.padEnd(11)} │`);
    });

    console.log('├─────────────┼────────┼────────────┼─────────────┤');

    const totalPercentage = result.total_score;
    const qualStatus = result.total_score >= 60 ? 'Qualified' : result.total_score >= 40 ? 'In Progress' : 'Disqualified';
    console.log(`│ TOTAL       │ ${String(result.total_score).padStart(2)}/100 │ ${String(totalPercentage).padStart(3)}%       │ ${qualStatus.padEnd(11)} │`);
    console.log('└─────────────┴────────┴────────────┴─────────────┘\n');

    console.log(`💭 Reasoning: ${result.reasoning}\n`);
    console.log(`📈 Confidence: ${(result.confidence * 100).toFixed(0)}%\n`);

    // Validation
    console.log('✅ Validation:');
    const validations = [
      { check: 'Budget score in range (0-25)', pass: result.budget_score >= 0 && result.budget_score <= 25 },
      { check: 'Authority score in range (0-25)', pass: result.authority_score >= 0 && result.authority_score <= 25 },
      { check: 'Need score in range (0-25)', pass: result.need_score >= 0 && result.need_score <= 25 },
      { check: 'Timeline score in range (0-25)', pass: result.timeline_score >= 0 && result.timeline_score <= 25 },
      { check: 'Total score matches sum', pass: result.total_score === (result.budget_score + result.authority_score + result.need_score + result.timeline_score) },
      { check: 'Confidence in range (0.0-1.0)', pass: result.confidence >= 0.0 && result.confidence <= 1.0 },
      { check: 'Reasoning provided', pass: result.reasoning && result.reasoning.length > 10 },
    ];

    validations.forEach(v => {
      console.log(`   ${v.pass ? '✅' : '❌'} ${v.check}`);
    });

    const allPassed = validations.every(v => v.pass);

    if (allPassed) {
      console.log('\n🎉 All validations passed! AI qualification is working correctly.');
    } else {
      console.log('\n⚠️  Some validations failed. Check the response structure.');
    }

  } catch (error) {
    console.error('❌ Error during qualification:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
    }
    process.exit(1);
  }
}

// Run the test
testQualification()
  .then(() => {
    console.log('\n✅ Test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
