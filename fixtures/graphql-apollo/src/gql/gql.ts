/* eslint-disable */
import * as types from './graphql';
import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
    "\n  mutation AddTodo($input: AddTodoInput!) {\n    addTodo(input: $input) {\n      id\n      title\n    }\n  }\n": typeof types.AddTodoDocument,
    "\n  query Todo($id: ID!) {\n    todo(id: $id) {\n      id\n      title\n      done\n      status\n      owner {\n        name\n      }\n    }\n  }\n": typeof types.TodoDocument,
    "\n  mutation ToggleTodo($id: ID!) {\n    toggleTodo(id: $id) {\n      id\n      done\n      status\n    }\n  }\n": typeof types.ToggleTodoDocument,
    "\n  fragment TodoItem on Todo {\n    id\n    title\n    done\n  }\n": typeof types.TodoItemFragmentDoc,
    "\n  query Todos($status: TodoStatus) {\n    todos(status: $status) {\n      id\n      ...TodoItem\n    }\n  }\n": typeof types.TodosDocument,
    "\n  query Search($text: String!) {\n    search(text: $text) {\n      __typename\n      ... on Todo {\n        id\n        title\n      }\n      ... on User {\n        id\n        name\n      }\n    }\n  }\n": typeof types.SearchDocument,
    "\n  query Users {\n    users {\n      id\n      name\n      email\n    }\n  }\n": typeof types.UsersDocument,
    "\n  query Viewer {\n    viewer {\n      id\n      name\n    }\n  }\n": typeof types.ViewerDocument,
};
const documents: Documents = {
    "\n  mutation AddTodo($input: AddTodoInput!) {\n    addTodo(input: $input) {\n      id\n      title\n    }\n  }\n": types.AddTodoDocument,
    "\n  query Todo($id: ID!) {\n    todo(id: $id) {\n      id\n      title\n      done\n      status\n      owner {\n        name\n      }\n    }\n  }\n": types.TodoDocument,
    "\n  mutation ToggleTodo($id: ID!) {\n    toggleTodo(id: $id) {\n      id\n      done\n      status\n    }\n  }\n": types.ToggleTodoDocument,
    "\n  fragment TodoItem on Todo {\n    id\n    title\n    done\n  }\n": types.TodoItemFragmentDoc,
    "\n  query Todos($status: TodoStatus) {\n    todos(status: $status) {\n      id\n      ...TodoItem\n    }\n  }\n": types.TodosDocument,
    "\n  query Search($text: String!) {\n    search(text: $text) {\n      __typename\n      ... on Todo {\n        id\n        title\n      }\n      ... on User {\n        id\n        name\n      }\n    }\n  }\n": types.SearchDocument,
    "\n  query Users {\n    users {\n      id\n      name\n      email\n    }\n  }\n": types.UsersDocument,
    "\n  query Viewer {\n    viewer {\n      id\n      name\n    }\n  }\n": types.ViewerDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = graphql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function graphql(source: string): unknown;

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation AddTodo($input: AddTodoInput!) {\n    addTodo(input: $input) {\n      id\n      title\n    }\n  }\n"): (typeof documents)["\n  mutation AddTodo($input: AddTodoInput!) {\n    addTodo(input: $input) {\n      id\n      title\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Todo($id: ID!) {\n    todo(id: $id) {\n      id\n      title\n      done\n      status\n      owner {\n        name\n      }\n    }\n  }\n"): (typeof documents)["\n  query Todo($id: ID!) {\n    todo(id: $id) {\n      id\n      title\n      done\n      status\n      owner {\n        name\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ToggleTodo($id: ID!) {\n    toggleTodo(id: $id) {\n      id\n      done\n      status\n    }\n  }\n"): (typeof documents)["\n  mutation ToggleTodo($id: ID!) {\n    toggleTodo(id: $id) {\n      id\n      done\n      status\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment TodoItem on Todo {\n    id\n    title\n    done\n  }\n"): (typeof documents)["\n  fragment TodoItem on Todo {\n    id\n    title\n    done\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Todos($status: TodoStatus) {\n    todos(status: $status) {\n      id\n      ...TodoItem\n    }\n  }\n"): (typeof documents)["\n  query Todos($status: TodoStatus) {\n    todos(status: $status) {\n      id\n      ...TodoItem\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Search($text: String!) {\n    search(text: $text) {\n      __typename\n      ... on Todo {\n        id\n        title\n      }\n      ... on User {\n        id\n        name\n      }\n    }\n  }\n"): (typeof documents)["\n  query Search($text: String!) {\n    search(text: $text) {\n      __typename\n      ... on Todo {\n        id\n        title\n      }\n      ... on User {\n        id\n        name\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Users {\n    users {\n      id\n      name\n      email\n    }\n  }\n"): (typeof documents)["\n  query Users {\n    users {\n      id\n      name\n      email\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Viewer {\n    viewer {\n      id\n      name\n    }\n  }\n"): (typeof documents)["\n  query Viewer {\n    viewer {\n      id\n      name\n    }\n  }\n"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;