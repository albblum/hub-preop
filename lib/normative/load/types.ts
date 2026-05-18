export type ParsedClause = {
  clauseCode: string;
  body: string;
};

export type ParsedParagraph = {
  paragraphCode: string;
  clauses: ParsedClause[];
};

export type ParsedArticle = {
  articleCode: string;
  paragraphs: ParsedParagraph[];
};

export type ParsedLanguageBlock = {
  articleCode: string;
  paragraphs: ParsedParagraph[];
};

export type ParseNormativeMarkdownResult = {
  articles: ParsedArticle[];
};
