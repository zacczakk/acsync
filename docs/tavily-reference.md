---
summary: "Detailed Tavily MCP parameter reference for search, extract, crawl, and map."
read_when:
  - "Debugging or optimizing Tavily MCP tool usage"
  - "Configuring Tavily search parameters"
---

# Tavily MCP Server — Full Parameter Reference

## `mcp__tavily__search` — Primary Web Search Tool

**Purpose**: AI-optimized web search engine designed specifically for LLMs and agents.

- **Best for**: Real-time information retrieval, research, fact-checking, current events.
- **Key features**:
  - Aggregates up to 20 sites per call with proprietary AI scoring and filtering.
  - Optimized for RAG (Retrieval Augmented Generation) applications.
  - Returns both search results and optional extracted content in one call.
- **Parameters**:
  - `search_depth="advanced"` — higher relevance and quality (2 credits vs 1 for basic).
  - `max_results=10` — comprehensive coverage (default is 5).
  - `include_answer=true` — AI-generated answer based on search results.
  - `include_raw_content=true` — immediate content access (two-step process often better).
  - `topic="news"` — news-specific searches with published dates.
  - `time_range` — filter by recency (day, week, month, year).
  - `include_domains` — focus on trusted sources.
  - `exclude_domains` — filter out irrelevant sites.
- **Best practices**:
  - Keep queries under 400 characters.
  - Break complex queries into focused sub-queries.
  - Use `search_depth="advanced"` with `chunks_per_source=3` for best results.
  - Prefer specific domain filtering over broad searches.
  - Use score thresholds (>0.5) to filter results.

## `mcp__tavily__extract` — Advanced Content Extraction

**Purpose**: Extract clean, structured content from specific URLs with AI-powered processing.

- **Best for**: Getting full content from known URLs, following up on search results, content analysis.
- **Key features**:
  - Advanced extraction retrieves tables, embedded content with higher success rates.
  - Supports both markdown and text output formats.
  - Handles multiple URLs in a single request.
  - Never charged for failed extractions.
- **Parameters**:
  - `extract_depth="advanced"` — complex pages with dynamic content, tables, structured data (2 credits per 5 URLs vs 1 for basic).
  - `format="markdown"` — structured output (default).
  - `include_images=true` — when visual content is relevant.
- **Best practices**:
  - Use two-step process: search first, then extract from most relevant URLs.
  - Filter URLs by score (>0.5) before extraction.
  - Use advanced depth for complex web pages, basic for simple content.
  - Batch multiple URLs in single request for efficiency.

## `mcp__tavily__crawl` — Intelligent Website Crawling (BETA)

**Purpose**: Graph-based website traversal for comprehensive site exploration and content extraction.

- **Best for**: Site audits, comprehensive documentation gathering, research across entire domains.
- **Key features**:
  - Parallel exploration of hundreds of paths.
  - Built-in extraction and intelligent discovery.
  - Natural language instructions for guided crawling.
  - Regex pattern support for path filtering.
- **Parameters**:
  - `max_depth=2-3` — thorough but controlled exploration (start with 1, increase as needed).
  - `instructions="Find all documentation pages"` — AI-guided discovery (doubles cost but improves targeting).
  - `select_paths=["/docs/.*", "/api/.*"]` — focused crawling.
  - `exclude_paths=["/private/.*", "/admin/.*"]` — avoid irrelevant sections.
  - `categories=["Documentation", "Blog", "API"]` — predefined filtering.
  - `extract_depth="advanced"` — only when needed for complex content.
- **Best practices**:
  - Start with limited depth and breadth, increase gradually.
  - Use path patterns to focus on relevant content.
  - Consider using Map first to understand site structure.
  - Set appropriate limits to control costs and crawl scope.
  - Use instructions for complex discovery needs.

## `mcp__tavily__map` — Website Structure Discovery (BETA)

**Purpose**: Create structured maps of website URLs and navigation paths.

- **Best for**: Site architecture analysis, URL discovery, planning crawl strategies.
- **Key features**:
  - Quick site structure overview without content extraction.
  - URL collection and organization.
  - Sitemap generation capabilities.
- **Parameters**:
  - `max_depth=1-2` — structure discovery.
  - `instructions="Map all product documentation"` — guided mapping.
  - `select_domains` and `select_paths` — focused mapping.
  - `categories` — predefined section filtering.
- **Best practices**:
  - Use before crawling to plan strategy.
  - Ideal for understanding site organization.
  - Combine with crawl for comprehensive site analysis.

## When to Use Each Tool

- **Search**: Discovering new information, research, current events, finding relevant sources.
- **Extract**: Getting full content from known URLs, following up on search results.
- **Crawl**: Comprehensive site analysis, gathering all content from a domain section.
- **Map**: Understanding site structure before detailed exploration.

## Cost Reference

| Tool | Basic | Advanced |
|------|-------|----------|
| Search | 1 credit | 2 credits |
| Extract | 1 credit per 5 URLs | 2 credits per 5 URLs |
| Map | 1 credit per 10 pages | 2 credits (with instructions) |
| Crawl | mapping + extraction combined | — |
