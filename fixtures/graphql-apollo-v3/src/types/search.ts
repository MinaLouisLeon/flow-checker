export type SearchResult =
  | { __typename: 'Todo'; id: string; title: string }
  | { __typename: 'User'; id: string; name: string }

export interface SearchData {
  search: SearchResult[]
}

export interface SearchVars {
  text: string
}
