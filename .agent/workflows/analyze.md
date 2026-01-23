---
description: Comprehensive iterative analysis of any feature or component
---

# Deep Analysis Workflow

Use this workflow to analyze any feature, component, or issue with iterative improvement cycles.

## Usage
```
/analyze [FEATURE/COMPONENT NAME]
```

## Process
- Create a document to put together every single thing that you analyze, covering every single iteration. Keep appending to the document to cover everything, and then add a summary at the very end.

### Phase 1: Discovery
1. Identify ALL elements involved:
   - Files and functions
   - Data flows (state, API, database)
   - UI components (desktop + mobile)
   - User interactions

### Phase 2: Iterative Analysis
Perform N iterations until convergence:

**Iteration Template:**
```
ITERATION N - CRITICAL ANALYSIS
- Issue 1: [Description] → [Fix]
- Issue 2: [Description] → [Fix]
...

VERSION N - IMPROVEMENTS
[Applied fixes]
```

### Phase 3: Focus Areas
Each iteration should check:
- **UX**: Visual feedback, responsiveness, accessibility
- **Data Flow**: Save/load correctness, sync behavior
- **Performance**: Re-renders, queries, bundle size
- **Code Quality**: DRY, types, separation of concerns
- **Edge Cases**: Errors, loading, empty states, offline
- **Security**: Auth, validation, data isolation

### Phase 4: Convergence
Stop when:
- No HIGH/MEDIUM issues remain
- Only "nice to have" improvements exist
- Best practices followed

### Phase 5: Output
- Create specification document
- Include implementation checklist
- Fix verified bugs immediately
- Commit with clear messages

## Quick Version
```
Analyze [FEATURE]:
1. Map all elements
2. Critical analysis × N until 0 flaws
3. Focus: UX, data, performance, edge cases
4. Fix, document, commit
```