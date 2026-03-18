# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

This is a single-file HTML application (`erp_selection_scoring_v14_unified_search.html`, ~3400 lines) — an ERP product selection analysis workbench for Amazon sellers. It runs entirely in the browser with no build step, no dependencies, and no backend.

## How to Run

Open `erp_selection_scoring_v14_unified_search.html` directly in a browser. No server or build tools needed.

## Architecture

The app is structured as a single HTML file with three sections:
- **CSS** (lines 7–104): CSS custom properties in `:root`, responsive grid layout with sidebar + main content
- **HTML** (lines 106–797): Sidebar navigation linking to `#section` anchors; main area with card-based sections
- **JavaScript** (lines 798–3438): All logic in a single `<script>` block

### State Management

A single global `state` object (line 879) holds all application data: scoring model selection, analysis results, uploads, brain/AI config, keyword library, watch list, projects, pipeline, monitors, connectors, alerts, action cards, and search state. All render functions read from `state` directly.

### Dual Scoring Models (`MODEL_CONFIG`)

Two scoring models defined at line 799:
- **Model A (station)**: Amazon opportunity-based — weights: Amazon opportunity (60), Facebook ads (20), Google Trends (10), social media (10). Hard rule: Amazon opportunity < 35/60 = auto-reject.
- **Model B (social)**: Social media heat-based — weights: social heat (40), Amazon blank (35), cross-platform (15), trend speed (10). Hard rules: social heat < 24/40, Amazon blank < 20/35.

Both models output S/A/B/C levels with corresponding actions (rush pool, formal project, watch, eliminate).

### Key Modules (by function group)

| Module | Key Functions | Purpose |
|--------|--------------|---------|
| Brain/AI | `callBrain()`, `buildBrainMessages()`, `applyBrainResult()` | OpenAI-compatible API integration for AI-assisted scoring |
| Scoring | `calcSummary()`, `renderScoreForm()`, `basicAnalyze()` | Score calculation and model-based decisions |
| Unified Search | `buildUnifiedSearchResults()`, `runUnifiedSearch()` | Cross-module search across all data pools |
| Monitoring | `renderMonitoring()`, `pollMonitoring()`, `advanceMonitorState()` | Post-listing tracking with auto-poll |
| Pipeline | `renderPipeline()`, `advancePipelineItem()`, `evaluatePipelineRisk()` | Rush/FBM testing execution flow |
| Alerts | `ensureOpportunityAlertFromEvent()`, `dispatchAlert()` | Opportunity alerts and action card dispatch |
| Surveillance | `renderSurveillance()`, `evaluateKeywordAnomaly()` | Keyword and site monitoring tasks |
| Connectors | `renderBridgeCenter()`, `saveConnectorFramework()` | Third-party data source integration framework |
| Dashboard | `renderControlCenter()`, `buildFocusQueue()` | Today's cockpit with priority focus queue |

### Navigation / Routing

Sidebar links use `#hash` anchors. No client-side router — sections are always rendered in the DOM and scrolled to via `scrollToId()`.

## Language

All UI text, comments, and variable naming conventions use Chinese (zh-CN). Keep this consistent when making changes.
