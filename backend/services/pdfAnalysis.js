const pdf = require('pdf-parse');
const fs = require('fs');
const path = require('path');

// PDF Analysis Service for automatic book information extraction
class PDFAnalysisService {
  constructor() {
    this.maxPagesToAnalyze = 5; // Only analyze first few pages for efficiency
  }

  // Extract text from PDF file
  async extractTextFromPDF(pdfPath) {
    try {
      if (!fs.existsSync(pdfPath)) {
        throw new Error('PDF file not found');
      }

      const dataBuffer = fs.readFileSync(pdfPath);
      const data = await pdf(dataBuffer, {
        max: this.maxPagesToAnalyze, // Limit pages for performance
        version: 'v1.10.100' // Use specific PDF.js version
      });

      return {
        text: data.text,
        pages: data.numpages,
        info: data.info || {}
      };
    } catch (error) {
      console.error('PDF text extraction error:', error);
      throw new Error('Failed to extract text from PDF');
    }
  }

  // Extract book metadata from PDF
  async extractBookMetadata(pdfPath) {
    try {
      const pdfData = await this.extractTextFromPDF(pdfPath);
      const text = pdfData.text;
      const info = pdfData.info;

      // Extract title from PDF metadata or text
      let title = this.extractTitle(text, info);
      
      // Extract author from PDF metadata or text
      let author = this.extractAuthor(text, info);
      
      // Generate summary from text content
      let summary = this.generateSummary(text);

      return {
        title: title || 'Unknown Title',
        author: author || 'Unknown Author',
        summary: summary || 'No summary available',
        pages: pdfData.pages,
        extractedText: text.substring(0, 1000) // First 1000 chars for debugging
      };
    } catch (error) {
      console.error('PDF metadata extraction error:', error);
      return {
        title: 'Unknown Title',
        author: 'Unknown Author',
        summary: 'No summary available',
        pages: 0,
        extractedText: ''
      };
    }
  }

  // Extract title from PDF text or metadata
  extractTitle(text, info) {
    // Try PDF metadata first
    if (info && info.Title) {
      return this.cleanTitle(info.Title);
    }

    // Extract from first few lines of text
    const lines = text.split('\n').slice(0, 10);
    
    for (const line of lines) {
      const cleanLine = line.trim();
      if (cleanLine.length > 3 && cleanLine.length < 200) {
        // Skip common non-title patterns
        if (!this.isNonTitleLine(cleanLine)) {
          return this.cleanTitle(cleanLine);
        }
      }
    }

    return null;
  }

  // Extract author from PDF text or metadata
  extractAuthor(text, info) {
    // Try PDF metadata first
    if (info && info.Author) {
      return this.cleanAuthor(info.Author);
    }

    // Look for author patterns in text
    const lines = text.split('\n').slice(0, 40);
    
    for (const line of lines) {
      const cleanLine = line.trim();
      
      // Common author patterns
      if (this.isAuthorLine(cleanLine)) {
        return this.cleanAuthor(cleanLine);
      }
    }

    return null;
  }

  // Generate summary from PDF text
  generateSummary(text) {
    try {
      // Extract key sentences from the text
      const sentences = this.extractKeySentences(text);
      
      if (sentences.length === 0) {
        return 'This book explores various topics and provides valuable insights for readers.';
      }

      // Create a coherent summary
      let summary = sentences.join(' ');
      
      // Ensure summary is not too long
      if (summary.length > 500) {
        summary = summary.substring(0, 500) + '...';
      }

      return summary;
    } catch (error) {
      console.error('Summary generation error:', error);
      return 'This book provides valuable content and insights for readers.';
    }
  }

  // Extract key sentences for summary
  extractKeySentences(text) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
    
    // Score sentences based on importance indicators
    const scoredSentences = sentences.map(sentence => ({
      text: sentence.trim(),
      score: this.scoreSentence(sentence)
    }));

    // Sort by score and take top sentences
    scoredSentences.sort((a, b) => b.score - a.score);
    
    return scoredSentences
      .slice(0, 3)
      .map(s => s.text)
      .filter(s => s.length > 30);
  }

  // Score sentence importance
  scoreSentence(sentence) {
    let score = 0;
    const lowerSentence = sentence.toLowerCase();

    // High-value keywords
    const highValueKeywords = [
      'introduction', 'overview', 'summary', 'conclusion', 'main', 'primary',
      'important', 'key', 'essential', 'fundamental', 'core', 'central',
      'explores', 'examines', 'discusses', 'presents', 'introduces'
    ];

    highValueKeywords.forEach(keyword => {
      if (lowerSentence.includes(keyword)) {
        score += 3;
      }
    });

    // Medium-value keywords
    const mediumValueKeywords = [
      'book', 'chapter', 'section', 'topic', 'subject', 'theme',
      'learn', 'understand', 'discover', 'reveals', 'shows'
    ];

    mediumValueKeywords.forEach(keyword => {
      if (lowerSentence.includes(keyword)) {
        score += 1;
      }
    });

    // Length bonus (prefer medium-length sentences)
    const length = sentence.length;
    if (length > 50 && length < 200) {
      score += 2;
    }

    return score;
  }

  // Check if line is likely not a title
  isNonTitleLine(line) {
    const nonTitlePatterns = [
      /^\d+$/, // Just numbers
      /^(chapter|part|section)\s*\d+/i, // Chapter headers
      /^(table of contents|contents|index)/i, // TOC
      /^(copyright|all rights reserved)/i, // Copyright
      /^\s*$/ // Empty lines
    ];

    return nonTitlePatterns.some(pattern => pattern.test(line));
  }

  // Check if line is likely an author line
  isAuthorLine(line) {
    const authorPatterns = [
      /^by\s+.+/i, // "By Author Name"
      /^author:\s*.+/i, // "Author: Name"
      /^written by\s+.+/i, // "Written by Name"
      /^[A-Z][a-z]+\s+[A-Z][a-z]+$/, // "FirstName LastName"
      /^[A-Z][a-z]+\s+[A-Z]\.\s*[A-Z][a-z]+$/, // "FirstName M. LastName"
      /^[A-Z][a-z]+\s+[A-Z][a-z]+\s+[A-Z][a-z]+$/ // "FirstName Middle LastName"
    ];

    // Avoid lines that look like headings or categories
    const blacklist = /(contents|chapter|section|copyright|summary|introduction|acknowledg|table of|index)/i;

    return !blacklist.test(line) &&
           authorPatterns.some(pattern => pattern.test(line)) && 
           line.length > 5 && 
           line.length < 100;
  }

  // Clean title text
  cleanTitle(title) {
    return title
      .replace(/[^\w\s\-.,:()]/g, '') // Remove special chars except common punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  // Clean author text
  cleanAuthor(author) {
    return author
      .replace(/^(by|author:|written by)\s*/i, '') // Remove prefixes
      .replace(/[^\w\s\-.,]/g, '') // Remove special chars
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }
}

module.exports = new PDFAnalysisService();
