# Tool Description Testing - Quick Start

## Run Tests

```bash
# Test current tool descriptions
npm run test:descriptions

# Or directly
node tests/tool-selection/run-tool-selection-tests.js
```

## Output

The test will:
1. ✅ Load current tool descriptions from `src/mcp-browser.js`
2. ✅ Run 12 test scenarios covering critical use cases
3. ✅ Calculate weighted scores by priority
4. ✅ Output detailed report with pass/fail for each scenario
5. ✅ Determine best version and overall score

## Testing Multiple Versions

Create alternative description versions:

```bash
# 1. Save current version
mkdir -p src/tool-descriptions
cp src/mcp-browser.js src/tool-descriptions/v1-current.js

# 2. Edit src/mcp-browser.js with new descriptions

# 3. Save new version
cp src/mcp-browser.js src/tool-descriptions/v2-enhanced.js

# 4. Run comparison test
npm run test:descriptions
```

The test automatically detects all versions in `src/tool-descriptions/` and compares them.

## Example Output

```
╔═══════════════════════════════════════════════════════════════════════╗
║                  TOOL DESCRIPTION TESTING                             ║
╚═══════════════════════════════════════════════════════════════════════╝

================================================================================
TOOL DESCRIPTION TEST REPORT
================================================================================
Date: 2026-01-01T12:00:00.000Z
Scenarios: 12
Versions tested: 2

────────────────────────────────────────────────────────────────────────────
VERSION: v1-current
────────────────────────────────────────────────────────────────────────────

CRITICAL (4/4 = 100.0%) ✅
  ✅ auth-corporate-site
  ✅ microsoft-internal
  ✅ azure-portal
  ✅ form-interaction

HIGH (3/3 = 100.0%) ✅
  ✅ spa-application
  ✅ unknown-domain
  ✅ check-page-state

OVERALL SCORE: 95.5% (21.5/22.5 weighted) ✅ PASS

────────────────────────────────────────────────────────────────────────────
VERSION: v2-enhanced
────────────────────────────────────────────────────────────────────────────

CRITICAL (4/4 = 100.0%) ✅
HIGH (3/3 = 100.0%) ✅

OVERALL SCORE: 98.2% (22/22.5 weighted) ✅ PASS

================================================================================
COMPARISON
================================================================================

Ranking:
🏆 1. v2-enhanced: 98.2%
🥈 2. v1-current: 95.5%

================================================================================
🏆 BEST VERSION: v2-enhanced with 98.2% accuracy
================================================================================
```

## What Gets Tested

### Critical Scenarios (Must be 100%)
- ✅ Auth-required corporate sites (eng.ms, *.microsoft.com)
- ✅ Multi-step workflows (login, navigation)
- ✅ Tool sequencing (fetch → type → click)

### High Priority (90%+ accuracy)
- ✅ Unknown corporate domains
- ✅ JavaScript SPAs
- ✅ State checking after interactions

### Medium/Low Priority
- ✅ Simple pages, API endpoints, tab management

## Integration with CI/CD

Add to your GitHub Actions:

```yaml
- name: Test Tool Descriptions
  run: npm run test:descriptions
```

## Troubleshooting

**Test fails with parsing error:**
- Ensure `src/mcp-browser.js` has valid JavaScript syntax
- Check that `const tools = [...]` array is properly formatted

**All scenarios fail:**
- Verify tool descriptions are loaded correctly
- Check test scenarios in `tests/tool-selection-tests.json`

**Unexpected results:**
- The simulator uses keyword matching (deterministic)
- For LLM-based testing, integrate OpenAI/Anthropic API
